import { ConfigModule, type ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import queueConfig from './queue.config';

const QUEUE_KEYS = ['REDIS_HOST', 'REDIS_PORT'] as const;

const loadConfig = async (
  env: Partial<Record<(typeof QUEUE_KEYS)[number], string>>,
): Promise<ConfigType<typeof queueConfig>> => {
  for (const key of QUEUE_KEYS) {
    if (env[key] !== undefined) {
      process.env[key] = env[key];
    } else {
      delete process.env[key];
    }
  }

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true, load: [queueConfig] }),
    ],
  }).compile();

  const config = module.get<ConfigType<typeof queueConfig>>(queueConfig.KEY);
  await module.close();
  return config;
};

describe('queueConfig', () => {
  afterEach(() => {
    for (const key of QUEUE_KEYS) {
      delete process.env[key];
    }
  });

  it('reads host and port', async () => {
    const config = await loadConfig({
      REDIS_HOST: 'redis',
      REDIS_PORT: '6379',
    });

    expect(config.redisHost).toBe('redis');
    expect(config.redisPort).toBe(6379);
  });

  it('applies defaults when variables are absent', async () => {
    const config = await loadConfig({});

    expect(config.redisHost).toBe('redis');
    expect(config.redisPort).toBe(6379);
  });
});
