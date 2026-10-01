import { DataSource, Repository } from 'typeorm';
import {
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { User } from '../../users/entities/user.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { Video, VideoStatus } from './video.entity';

const ALL_ENTITIES = [User, Channel, Video];

describe('Video entity (integration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;
  let videoRepository: Repository<Video>;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
    videoRepository = dataSource.getRepository(Video);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  let counter = 0;
  async function createChannel(): Promise<Channel> {
    const user = await userRepository.save(
      userRepository.create({
        email: `vid_user_${++counter}@example.com`,
        password: 'hashed',
      }),
    );
    return channelRepository.save(
      channelRepository.create({
        name: `Channel ${counter}`,
        nickname: `chan_${counter}`,
        user_id: user.id,
      }),
    );
  }

  it('persists a video with default status draft', async () => {
    const channel = await createChannel();
    const video = await videoRepository.save(
      videoRepository.create({
        public_id: 'abc1234567',
        channel_id: channel.id,
        title: 'My first video',
        source_key: `videos/x/source`,
      }),
    );

    const found = await videoRepository.findOneByOrFail({ id: video.id });
    expect(found.status).toBe(VideoStatus.DRAFT);
    expect(found.thumbnail_key).toBeNull();
    expect(found.duration_seconds).toBeNull();
  });

  it('enforces unique public_id', async () => {
    const channel = await createChannel();
    await videoRepository.save(
      videoRepository.create({
        public_id: 'dup1234567',
        channel_id: channel.id,
        title: 'A',
        source_key: 'k1',
      }),
    );

    await expect(
      videoRepository.save(
        videoRepository.create({
          public_id: 'dup1234567',
          channel_id: channel.id,
          title: 'B',
          source_key: 'k2',
        }),
      ),
    ).rejects.toThrow();
  });

  it('round-trips bigint size_bytes as number and jsonb metadata', async () => {
    const channel = await createChannel();
    const video = await videoRepository.save(
      videoRepository.create({
        public_id: 'meta123456',
        channel_id: channel.id,
        title: 'Metadata video',
        source_key: 'k',
        size_bytes: 10737418240,
        duration_seconds: 120,
        metadata: { width: 1920, height: 1080, codec: 'h264' },
        status: VideoStatus.READY,
      }),
    );

    const found = await videoRepository.findOneByOrFail({ id: video.id });
    expect(found.size_bytes).toBe(10737418240);
    expect(typeof found.size_bytes).toBe('number');
    expect(found.metadata).toEqual({ width: 1920, height: 1080, codec: 'h264' });
    expect(found.status).toBe(VideoStatus.READY);
  });

  it('rejects a video referencing a non-existent channel', async () => {
    await expect(
      videoRepository.save(
        videoRepository.create({
          public_id: 'fk12345678',
          channel_id: '00000000-0000-0000-0000-000000000000',
          title: 'Orphan',
          source_key: 'k',
        }),
      ),
    ).rejects.toThrow();
  });
});
