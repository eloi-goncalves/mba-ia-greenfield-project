import { randomUUID } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { nanoid } from 'nanoid';
import { QueryFailedError, Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import uploadConfig from '../config/upload.config';
import {
  InvalidStatusTransitionException,
  NotVideoOwnerException,
  UploadTooLargeException,
  VideoNotFoundException,
} from '../common/exceptions/domain.exception';
import { StorageService } from '../storage/storage.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { Video, VideoStatus } from './entities/video.entity';
import {
  VIDEO_PROCESS_JOB,
  VIDEO_PROCESSING_QUEUE,
  type VideoProcessJobData,
} from './videos.constants';

const PG_UNIQUE_VIOLATION = '23505';
const PUBLIC_ID_LENGTH = 11;
const PUBLIC_ID_MAX_RETRIES = 5;

export interface InitiateUploadResult {
  videoId: string;
  publicId: string;
  uploadId: string;
  partSize: number;
  parts: { partNumber: number; url: string }[];
}

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly processingQueue: Queue<VideoProcessJobData>,
    private readonly storageService: StorageService,
    private readonly channelsService: ChannelsService,
    @Inject(uploadConfig.KEY)
    private readonly upload: ConfigType<typeof uploadConfig>,
  ) {}

  async enqueueProcessing(videoId: string): Promise<void> {
    // jobId = videoId guarantees idempotency: re-enqueuing the same video
    // does not create a duplicate job while one is already queued.
    await this.processingQueue.add(
      VIDEO_PROCESS_JOB,
      { videoId },
      { jobId: videoId },
    );
  }

  async initiateUpload(
    userId: string,
    dto: InitiateUploadDto,
  ): Promise<InitiateUploadResult> {
    if (dto.sizeBytes > this.upload.maxBytes) {
      throw new UploadTooLargeException();
    }

    const channel = await this.channelsService.findByUserId(userId);
    if (!channel) {
      throw new NotVideoOwnerException();
    }

    const video = await this.createDraftVideo(channel.id, dto);
    const uploadId = await this.storageService.createMultipartUpload(
      video.source_key,
      dto.contentType,
    );

    const parts: { partNumber: number; url: string }[] = [];
    for (let partNumber = 1; partNumber <= dto.partCount; partNumber++) {
      const url = await this.storageService.presignUploadPart(
        video.source_key,
        uploadId,
        partNumber,
      );
      parts.push({ partNumber, url });
    }

    return {
      videoId: video.id,
      publicId: video.public_id,
      uploadId,
      partSize: this.upload.partSizeBytes,
      parts,
    };
  }

  async completeUpload(
    userId: string,
    videoId: string,
    dto: CompleteUploadDto,
  ): Promise<{ publicId: string; status: VideoStatus }> {
    const video = await this.getOwnedVideo(userId, videoId);

    if (video.status !== VideoStatus.DRAFT) {
      throw new InvalidStatusTransitionException();
    }

    await this.storageService.completeMultipartUpload(
      video.source_key,
      dto.uploadId,
      dto.parts,
    );

    video.status = VideoStatus.PROCESSING;
    await this.videoRepository.save(video);
    await this.enqueueProcessing(video.id);

    return { publicId: video.public_id, status: video.status };
  }

  async abortUpload(
    userId: string,
    videoId: string,
    uploadId: string,
  ): Promise<void> {
    const video = await this.getOwnedVideo(userId, videoId);

    if (video.status !== VideoStatus.DRAFT) {
      throw new InvalidStatusTransitionException();
    }

    await this.storageService.abortMultipartUpload(video.source_key, uploadId);
    await this.videoRepository.remove(video);
  }

  async reprocess(
    userId: string,
    videoId: string,
  ): Promise<{ status: VideoStatus }> {
    const video = await this.getOwnedVideo(userId, videoId);

    if (video.status !== VideoStatus.FAILED) {
      throw new InvalidStatusTransitionException();
    }

    const sourceExists = await this.storageService.headObject(video.source_key);
    if (!sourceExists) {
      throw new VideoNotFoundException();
    }

    video.status = VideoStatus.PROCESSING;
    video.error_reason = null;
    await this.videoRepository.save(video);
    await this.enqueueProcessing(video.id);

    return { status: video.status };
  }

  async getPublicVideo(publicId: string): Promise<{
    publicId: string;
    title: string;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
    status: VideoStatus;
  }> {
    const video = await this.getReadyVideo(publicId);
    const thumbnailUrl = video.thumbnail_key
      ? await this.storageService.presignGet(video.thumbnail_key)
      : null;

    return {
      publicId: video.public_id,
      title: video.title,
      durationSeconds: video.duration_seconds,
      thumbnailUrl,
      status: video.status,
    };
  }

  async getStreamUrl(publicId: string): Promise<string> {
    const video = await this.getReadyVideo(publicId);
    return this.storageService.presignGet(video.source_key);
  }

  async getDownloadUrl(publicId: string): Promise<string> {
    const video = await this.getReadyVideo(publicId);
    return this.storageService.presignGet(video.source_key, {
      responseContentDisposition: `attachment; filename="${video.public_id}.mp4"`,
    });
  }

  private async getReadyVideo(publicId: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { public_id: publicId },
    });
    if (!video || video.status !== VideoStatus.READY) {
      throw new VideoNotFoundException();
    }
    return video;
  }

  private async createDraftVideo(
    channelId: string,
    dto: InitiateUploadDto,
  ): Promise<Video> {
    for (let attempt = 0; attempt <= PUBLIC_ID_MAX_RETRIES; attempt++) {
      const id = randomUUID();
      const video = this.videoRepository.create({
        id,
        public_id: nanoid(PUBLIC_ID_LENGTH),
        channel_id: channelId,
        title: dto.title,
        source_key: this.storageService.sourceKey(id),
        status: VideoStatus.DRAFT,
      });

      try {
        return await this.videoRepository.save(video);
      } catch (err) {
        if (this.isPublicIdCollision(err)) {
          continue;
        }
        throw err;
      }
    }

    throw new Error('Could not generate a unique public_id after retries');
  }

  private async getOwnedVideo(userId: string, videoId: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });
    if (!video) {
      throw new VideoNotFoundException();
    }

    const channel = await this.channelsService.findByUserId(userId);
    if (!channel || channel.id !== video.channel_id) {
      throw new NotVideoOwnerException();
    }

    return video;
  }

  private isPublicIdCollision(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const e = err as unknown as { code?: string; detail?: string };
    return (
      e.code === PG_UNIQUE_VIOLATION &&
      typeof e.detail === 'string' &&
      e.detail.includes('public_id')
    );
  }
}
