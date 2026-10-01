import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { VIDEO_PROCESSING_QUEUE } from '../src/videos/videos.constants';

const UPLOAD_MAX_BYTES = 10737418240;

describe('Videos upload (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let throttlerStorage: ThrottlerStorageService;
  let queue: Queue;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new DomainExceptionFilter(),
      new ValidationExceptionFilter(),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
    queue = moduleFixture.get<Queue>(getQueueToken(VIDEO_PROCESSING_QUEUE));
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
  });

  async function login(email: string): Promise<string> {
    const authService = app.get(AuthService);
    const mailService = (authService as any).mailService;
    let token = '';
    jest
      .spyOn(mailService, 'sendConfirmationEmail')
      .mockImplementationOnce(async (_e: string, _n: string, t: string) => {
        token = t;
      });
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' });
    await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' });
    return res.body.access_token as string;
  }

  const initiateBody = {
    title: 'My E2E Video',
    filename: 'video.mp4',
    contentType: 'video/mp4',
    sizeBytes: 1024,
    partCount: 1,
  };

  it('runs the full initiate → upload-to-storage → complete flow', async () => {
    const accessToken = await login('uploader@example.com');

    const initiate = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(initiateBody)
      .expect(201);

    expect(initiate.body.videoId).toBeDefined();
    expect(initiate.body.publicId).toHaveLength(11);
    expect(initiate.body.uploadId).toBeDefined();
    expect(initiate.body.parts).toHaveLength(1);

    const { videoId, uploadId, parts } = initiate.body;
    const putRes = await fetch(parts[0].url, {
      method: 'PUT',
      body: Buffer.from('fake video bytes for e2e'),
    });
    expect(putRes.ok).toBe(true);
    const etag = putRes.headers.get('etag');

    const complete = await request(app.getHttpServer())
      .post(`/videos/${videoId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ uploadId, parts: [{ partNumber: 1, etag }] })
      .expect(200);

    expect(complete.body.status).toBe('processing');

    const job = await queue.getJob(videoId);
    expect(job).toBeDefined();
  });

  it('rejects an upload larger than the maximum size with 413', async () => {
    const accessToken = await login('toobig@example.com');

    await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...initiateBody, sizeBytes: UPLOAD_MAX_BYTES + 1 })
      .expect(413)
      .expect((res) => {
        expect(res.body.error).toBe('UPLOAD_TOO_LARGE');
      });
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/videos')
      .send(initiateBody)
      .expect(401);
  });

  it('forbids a non-owner from completing another channel upload with 403', async () => {
    const ownerToken = await login('owner@example.com');
    const otherToken = await login('intruder@example.com');

    const initiate = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(initiateBody)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/videos/${initiate.body.videoId}/complete`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ uploadId: initiate.body.uploadId, parts: [{ partNumber: 1, etag: 'x' }] })
      .expect(403)
      .expect((res) => {
        expect(res.body.error).toBe('NOT_VIDEO_OWNER');
      });
  });
});
