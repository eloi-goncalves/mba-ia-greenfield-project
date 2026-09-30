import { ConfigModule, type ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import storageConfig from './storage.config';

const STORAGE_KEYS = [
  'STORAGE_ENDPOINT',
  'STORAGE_REGION',
  'STORAGE_ACCESS_KEY',
  'STORAGE_SECRET_KEY',
  'STORAGE_BUCKET_VIDEOS',
  'STORAGE_FORCE_PATH_STYLE',
] as const;

const loadConfig = async (
  env: Partial<Record<(typeof STORAGE_KEYS)[number], string>>,
): Promise<ConfigType<typeof storageConfig>> => {
  for (const key of STORAGE_KEYS) {
    if (env[key] !== undefined) {
      process.env[key] = env[key];
    } else {
      delete process.env[key];
    }
  }

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true, load: [storageConfig] }),
    ],
  }).compile();

  const config = module.get<ConfigType<typeof storageConfig>>(
    storageConfig.KEY,
  );
  await module.close();
  return config;
};

describe('storageConfig', () => {
  afterEach(() => {
    for (const key of STORAGE_KEYS) {
      delete process.env[key];
    }
  });

  it('reads all storage variables', async () => {
    const config = await loadConfig({
      STORAGE_ENDPOINT: 'http://minio:9000',
      STORAGE_REGION: 'us-east-1',
      STORAGE_ACCESS_KEY: 'key',
      STORAGE_SECRET_KEY: 'secret',
      STORAGE_BUCKET_VIDEOS: 'videos',
      STORAGE_FORCE_PATH_STYLE: 'true',
    });

    expect(config.endpoint).toBe('http://minio:9000');
    expect(config.region).toBe('us-east-1');
    expect(config.accessKey).toBe('key');
    expect(config.secretKey).toBe('secret');
    expect(config.bucketVideos).toBe('videos');
    expect(config.forcePathStyle).toBe(true);
  });

  it('applies defaults and coerces forcePathStyle to boolean', async () => {
    const config = await loadConfig({
      STORAGE_ACCESS_KEY: 'key',
      STORAGE_SECRET_KEY: 'secret',
      STORAGE_FORCE_PATH_STYLE: 'false',
    });

    expect(config.endpoint).toBe('http://minio:9000');
    expect(config.region).toBe('us-east-1');
    expect(config.bucketVideos).toBe('videos');
    expect(config.forcePathStyle).toBe(false);
  });
});
