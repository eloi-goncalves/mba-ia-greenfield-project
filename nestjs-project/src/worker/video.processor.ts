import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  VIDEO_PROCESSING_QUEUE,
  type VideoProcessJobData,
} from '../videos/videos.constants';
import { VideoProcessingService } from './video-processing.service';

@Processor(VIDEO_PROCESSING_QUEUE)
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(private readonly processingService: VideoProcessingService) {
    super();
  }

  async process(job: Job<VideoProcessJobData>): Promise<void> {
    this.logger.log(`Processing video ${job.data.videoId}`);
    await this.processingService.process(job.data.videoId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<VideoProcessJobData>, error: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    // Only mark the video as failed once all retry attempts are exhausted.
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Video ${job.data.videoId} failed after ${job.attemptsMade} attempts: ${error.message}`,
      );
      await this.processingService.markFailed(job.data.videoId, error.message);
    }
  }
}
