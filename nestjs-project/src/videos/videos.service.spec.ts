import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelsService } from '../channels/channels.service';
import uploadConfig from '../config/upload.config';
import { StorageService } from '../storage/storage.service';
import { Video } from './entities/video.entity';
import { VideosService } from './videos.service';
import { VIDEO_PROCESS_JOB, VIDEO_PROCESSING_QUEUE } from './videos.constants';

describe('VideosService', () => {
  let service: VideosService;
  const queueAdd = jest.fn();

  beforeEach(async () => {
    queueAdd.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        VideosService,
        { provide: getRepositoryToken(Video), useValue: {} },
        {
          provide: getQueueToken(VIDEO_PROCESSING_QUEUE),
          useValue: { add: queueAdd },
        },
        { provide: StorageService, useValue: {} },
        { provide: ChannelsService, useValue: {} },
        {
          provide: uploadConfig.KEY,
          useValue: {
            maxBytes: 10737418240,
            partSizeBytes: 104857600,
            presignExpiresSeconds: 3600,
          },
        },
      ],
    }).compile();

    service = module.get(VideosService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('enqueues a processing job using videoId as jobId (idempotent)', async () => {
    await service.enqueueProcessing('video-123');

    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(queueAdd).toHaveBeenCalledWith(
      VIDEO_PROCESS_JOB,
      { videoId: 'video-123' },
      { jobId: 'video-123' },
    );
  });
});
