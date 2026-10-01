import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import {
  Video,
  VideoStatus,
  type VideoMetadata,
} from '../videos/entities/video.entity';

const execFileAsync = promisify(execFile);

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
}

interface FfprobeOutput {
  format?: { duration?: string };
  streams?: FfprobeStream[];
}

export interface ProcessedResult {
  durationSeconds: number;
  sizeBytes: number;
  metadata: VideoMetadata;
}

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly storageService: StorageService,
  ) {}

  async process(videoId: string): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });
    if (!video) {
      this.logger.warn(`Video ${videoId} not found — skipping processing`);
      return;
    }

    const workDir = await mkdtemp(join(tmpdir(), `video-${videoId}-`));
    const sourcePath = join(workDir, 'source');
    const thumbnailPath = join(workDir, 'thumbnail.jpg');

    try {
      await this.downloadSource(video.source_key, sourcePath);

      const probe = await this.probe(sourcePath);
      await this.generateThumbnail(
        sourcePath,
        thumbnailPath,
        probe.durationSeconds,
      );

      const thumbnailBuffer = await readFile(thumbnailPath);
      const thumbnailKey = this.storageService.thumbnailKey(video.id);
      await this.storageService.putObject(
        thumbnailKey,
        thumbnailBuffer,
        'image/jpeg',
      );

      video.duration_seconds = probe.durationSeconds;
      video.size_bytes = probe.sizeBytes;
      video.metadata = probe.metadata;
      video.thumbnail_key = thumbnailKey;
      video.status = VideoStatus.READY;
      await this.videoRepository.save(video);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  async markFailed(videoId: string, reason: string): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });
    if (!video) {
      return;
    }
    video.status = VideoStatus.FAILED;
    video.error_reason = reason.slice(0, 2000);
    await this.videoRepository.save(video);
  }

  private async downloadSource(
    sourceKey: string,
    destination: string,
  ): Promise<void> {
    const url = await this.storageService.presignGet(sourceKey);
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download source (status ${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(destination, buffer);
  }

  private async probe(sourcePath: string): Promise<ProcessedResult> {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      sourcePath,
    ]);

    const parsed = JSON.parse(stdout) as FfprobeOutput;
    const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
    const durationSeconds = Math.round(Number(parsed.format?.duration ?? 0));
    const { size } = await stat(sourcePath);

    return {
      durationSeconds,
      sizeBytes: size,
      metadata: {
        width: videoStream?.width,
        height: videoStream?.height,
        codec: videoStream?.codec_name,
      },
    };
  }

  private async generateThumbnail(
    sourcePath: string,
    thumbnailPath: string,
    durationSeconds: number,
  ): Promise<void> {
    const offset = Math.max(0, durationSeconds * 0.1);
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss',
      offset.toFixed(2),
      '-i',
      sourcePath,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      thumbnailPath,
    ]);
  }
}
