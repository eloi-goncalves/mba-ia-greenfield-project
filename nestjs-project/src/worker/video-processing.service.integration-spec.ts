import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import storageConfig from '../config/storage.config';
import uploadConfig from '../config/upload.config';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';
import {
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { User } from '../users/entities/user.entity';
import { Video, VideoStatus } from '../videos/entities/video.entity';
import { VideoProcessingService } from './video-processing.service';

const execFileAsync = promisify(execFile);
const ALL_ENTITIES = [User, Channel, Video];

describe('VideoProcessingService (integration)', () => {
  let service: VideoProcessingService;
  let storage: StorageService;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;
  let counter = 0;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [storageConfig, uploadConfig],
        }),
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        TypeOrmModule.forFeature([Video]),
        StorageModule,
      ],
      providers: [VideoProcessingService],
    }).compile();

    service = module.get(VideoProcessingService);
    storage = module.get(StorageService);
    dataSource = module.get(DataSource);
    videoRepository = dataSource.getRepository(Video);
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
    await storage.ensureBucket();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  async function createDraftVideo(): Promise<Video> {
    const user = await userRepository.save(
      userRepository.create({
        email: `wk_${++counter}@example.com`,
        password: 'hashed',
      }),
    );
    const channel = await channelRepository.save(
      channelRepository.create({
        name: `ch${counter}`,
        nickname: `wk_${counter}`,
        user_id: user.id,
      }),
    );
    const video = videoRepository.create({
      public_id: `wk${counter}abcdef`.slice(0, 11),
      channel_id: channel.id,
      title: 'Worker test',
      source_key: '',
      status: VideoStatus.PROCESSING,
    });
    const saved = await videoRepository.save(video);
    saved.source_key = storage.sourceKey(saved.id);
    return videoRepository.save(saved);
  }

  async function makeTestVideo(): Promise<Buffer> {
    const dir = await mkdtemp(join(tmpdir(), 'wk-fixture-'));
    const path = join(dir, 'test.mp4');
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=2:size=320x240:rate=10',
      '-pix_fmt',
      'yuv420p',
      path,
    ]);
    const buffer = await readFile(path);
    await rm(dir, { recursive: true, force: true });
    return buffer;
  }

  it('extracts metadata, generates a thumbnail and marks the video ready', async () => {
    const video = await createDraftVideo();
    const source = await makeTestVideo();
    await storage.putObject(video.source_key, source, 'video/mp4');

    await service.process(video.id);

    const updated = await videoRepository.findOneByOrFail({ id: video.id });
    expect(updated.status).toBe(VideoStatus.READY);
    expect(updated.duration_seconds).toBeGreaterThanOrEqual(1);
    expect(updated.metadata?.width).toBe(320);
    expect(updated.metadata?.height).toBe(240);
    expect(updated.thumbnail_key).toBe(storage.thumbnailKey(video.id));
    expect(await storage.headObject(updated.thumbnail_key!)).toBe(true);
  }, 30000);

  it('throws when the source cannot be processed (missing object)', async () => {
    const video = await createDraftVideo();
    // no object uploaded to source_key

    await expect(service.process(video.id)).rejects.toThrow();
  }, 30000);
});
