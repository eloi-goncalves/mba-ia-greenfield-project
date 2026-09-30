import { randomUUID } from 'crypto';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import storageConfig from '../config/storage.config';
import uploadConfig from '../config/upload.config';
import { StorageService } from './storage.service';

describe('StorageService (integration)', () => {
  let service: StorageService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [storageConfig, uploadConfig] }),
      ],
      providers: [StorageService],
    }).compile();

    service = module.get(StorageService);
    await service.ensureBucket();
  });

  it('round-trips a multipart upload and serves 206 for a Range request', async () => {
    const key = service.sourceKey(randomUUID());
    const body = Buffer.from('hello streamtube video content for range test');

    const uploadId = await service.createMultipartUpload(key, 'video/mp4');
    const partUrl = await service.presignUploadPart(key, uploadId, 1);
    const putRes = await fetch(partUrl, { method: 'PUT', body });
    expect(putRes.ok).toBe(true);
    const etag = putRes.headers.get('etag');
    expect(etag).toBeTruthy();

    await service.completeMultipartUpload(key, uploadId, [
      { partNumber: 1, etag: etag! },
    ]);

    const getUrl = await service.presignGet(key);
    const ranged = await fetch(getUrl, { headers: { Range: 'bytes=0-4' } });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get('content-range')).toContain(`/${body.length}`);
    const text = await ranged.text();
    expect(text).toBe('hello');
  });

  it('aborts a multipart upload', async () => {
    const key = service.sourceKey(randomUUID());
    const uploadId = await service.createMultipartUpload(key, 'video/mp4');
    await expect(
      service.abortMultipartUpload(key, uploadId),
    ).resolves.toBeUndefined();
  });

  it('presignGet with responseContentDisposition returns an attachment header', async () => {
    const key = service.sourceKey(randomUUID());
    const uploadId = await service.createMultipartUpload(key, 'video/mp4');
    const partUrl = await service.presignUploadPart(key, uploadId, 1);
    const putRes = await fetch(partUrl, {
      method: 'PUT',
      body: Buffer.from('downloadable'),
    });
    await service.completeMultipartUpload(key, uploadId, [
      { partNumber: 1, etag: putRes.headers.get('etag')! },
    ]);

    const url = await service.presignGet(key, {
      responseContentDisposition: 'attachment; filename="video.mp4"',
    });
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
  });

  it('putObject stores a thumbnail and headObject reflects existence', async () => {
    const key = service.thumbnailKey(randomUUID());
    await service.putObject(key, Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg');

    expect(await service.headObject(key)).toBe(true);
    expect(await service.headObject(service.thumbnailKey(randomUUID()))).toBe(
      false,
    );
  });
});
