import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import { Channel } from '../channels/entities/channel.entity';
import queueConfig from '../config/queue.config';
import storageConfig from '../config/storage.config';
import uploadConfig from '../config/upload.config';
import {
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { User } from '../users/entities/user.entity';
import { Video, VideoStatus } from './entities/video.entity';
import { VideosModule } from './videos.module';
import { VideosService } from './videos.service';
import { VIDEO_PROCESSING_QUEUE } from './videos.constants';

const ALL_ENTITIES = [User, Channel, Video];

const initiateDto = {
  title: 'Integration video',
  filename: 'v.mp4',
  contentType: 'video/mp4',
  sizeBytes: 2048,
  partCount: 2,
};

describe('VideosService (integration)', () => {
  let service: VideosService;
  let channelsService: ChannelsService;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let userRepository: Repository<User>;
  let queue: Queue;
  let counter = 0;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [storageConfig, uploadConfig, queueConfig],
        }),
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        BullModule.forRoot({
          connection: {
            host: process.env.REDIS_HOST ?? 'redis',
            port: Number(process.env.REDIS_PORT ?? 6379),
          },
        }),
        VideosModule,
      ],
    }).compile();

    service = module.get(VideosService);
    channelsService = module.get(ChannelsService);
    dataSource = module.get(DataSource);
    videoRepository = dataSource.getRepository(Video);
    userRepository = dataSource.getRepository(User);
    queue = module.get<Queue>(getQueueToken(VIDEO_PROCESSING_QUEUE));
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  async function createUserWithChannel(): Promise<string> {
    const email = `vsvc_${++counter}@example.com`;
    const user = await userRepository.save(
      userRepository.create({ email, password: 'hashed' }),
    );
    await channelsService.createChannel(user.id, email);
    return user.id;
  }

  it('initiateUpload pre-registers a draft video and returns presigned parts', async () => {
    const userId = await createUserWithChannel();

    const result = await service.initiateUpload(userId, initiateDto);

    expect(result.parts).toHaveLength(2);
    expect(result.publicId).toHaveLength(11);

    const video = await videoRepository.findOneByOrFail({ id: result.videoId });
    expect(video.status).toBe(VideoStatus.DRAFT);
    expect(video.source_key).toContain(result.videoId);
  });

  it('abortUpload removes the draft video', async () => {
    const userId = await createUserWithChannel();
    const result = await service.initiateUpload(userId, initiateDto);

    await service.abortUpload(userId, result.videoId, result.uploadId);

    const video = await videoRepository.findOneBy({ id: result.videoId });
    expect(video).toBeNull();
  });

  it('completeUpload finalizes the upload, moves to processing and enqueues a job', async () => {
    const userId = await createUserWithChannel();
    const result = await service.initiateUpload(userId, {
      ...initiateDto,
      partCount: 1,
    });

    const putRes = await fetch(result.parts[0].url, {
      method: 'PUT',
      body: Buffer.from('integration video bytes'),
    });
    const etag = putRes.headers.get('etag')!;

    const completed = await service.completeUpload(userId, result.videoId, {
      uploadId: result.uploadId,
      parts: [{ partNumber: 1, etag }],
    });

    expect(completed.status).toBe(VideoStatus.PROCESSING);
    const job = await queue.getJob(result.videoId);
    expect(job).toBeDefined();
    expect(job!.data.videoId).toBe(result.videoId);
  });

  it('reprocess re-enqueues a failed video and clears the error', async () => {
    const userId = await createUserWithChannel();
    const result = await service.initiateUpload(userId, {
      ...initiateDto,
      partCount: 1,
    });
    const putRes = await fetch(result.parts[0].url, {
      method: 'PUT',
      body: Buffer.from('bytes'),
    });
    await service.completeUpload(userId, result.videoId, {
      uploadId: result.uploadId,
      parts: [{ partNumber: 1, etag: putRes.headers.get('etag')! }],
    });

    // Simulate a terminal processing failure.
    const failed = await videoRepository.findOneByOrFail({
      id: result.videoId,
    });
    failed.status = VideoStatus.FAILED;
    failed.error_reason = 'boom';
    await videoRepository.save(failed);

    const out = await service.reprocess(userId, result.videoId);

    expect(out.status).toBe(VideoStatus.PROCESSING);
    const reloaded = await videoRepository.findOneByOrFail({
      id: result.videoId,
    });
    expect(reloaded.error_reason).toBeNull();
  });

  it('reprocess rejects a video that is not in the failed state', async () => {
    const userId = await createUserWithChannel();
    const result = await service.initiateUpload(userId, initiateDto);

    await expect(service.reprocess(userId, result.videoId)).rejects.toThrow();
  });
});
