import { registerAs } from '@nestjs/config';

export default registerAs('upload', () => ({
  maxBytes: parseInt(process.env.UPLOAD_MAX_BYTES || '10737418240', 10),
  partSizeBytes: parseInt(
    process.env.UPLOAD_PART_SIZE_BYTES || '104857600',
    10,
  ),
  presignExpiresSeconds: parseInt(
    process.env.PRESIGN_EXPIRES_SECONDS || '3600',
    10,
  ),
}));
