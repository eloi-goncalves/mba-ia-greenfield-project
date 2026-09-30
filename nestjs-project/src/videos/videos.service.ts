import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Video } from './entities/video.entity';
import {
  VIDEO_PROCESS_JOB,
  VIDEO_PROCESSING_QUEUE,
  type VideoProcessJobData,
} from './videos.constants';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly processingQueue: Queue<VideoProcessJobData>,
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
}
