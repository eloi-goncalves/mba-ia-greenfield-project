# phase-03-videos — Progress

**Status:** in_progress
**SIs:** 2/8 completed

### SI-03.1 — Dependências, Config Namespaces e Infra no Docker Compose
- **Status:** completed
- **Tests:** 4/4 config specs (storage.config.spec, queue.config.spec); regressão completa verde (148/148 unit+integração, 52/52 e2e)
- **Observations:**
  - Infra nova no Compose: `redis` (7-alpine, healthy), `minio` (com volume), `video-worker` (Dockerfile.worker com ffmpeg 5.1.9). `nestjs-api` passou a depender de redis/minio.
  - Provisionamento do bucket movido para código (StorageService no boot) — o serviço `minio/mc` teve acesso negado no registry deste ambiente.
  - Vars novas (REDIS_*, STORAGE_*, UPLOAD_*) no Joi + `.env.example` + `.env` local. `STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY` são `.required()`.
  - Regressão: atualizado o fixture `requiredEnv` de `env.validation.integration-spec.ts` para incluir as credenciais de storage obrigatórias.
  - Testes rodam dentro do container com `--runInBand --forceExit` (evita órfãos por open handles). `tsc --noEmit` roda no host.

### SI-03.2 — Storage Service (S3/MinIO)
- **Status:** completed
- **Tests:** 4/4 integração (storage.service.integration-spec) contra MinIO real: multipart round-trip, `206` com Range, abort, presignGet com Content-Disposition, putObject/headObject
- **Observations:**
  - `StorageService` (AWS SDK v3, `forcePathStyle`) com `onModuleInit` que garante o bucket (`ensureBucket` via HeadBucket→CreateBucket) — resolve PEND-03 (sem depender do image `minio/mc`).
  - `StorageModule` importado no `AppModule` para provisionar o bucket no boot.
  - Métodos: createMultipartUpload, presignUploadPart, completeMultipartUpload, abortMultipartUpload, presignGet (Range/Content-Disposition), putObject, headObject, sourceKey/thumbnailKey.

### SI-03.3 — Entidade Video e Migration
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.4 — Videos Module e Setup da Fila (BullMQ)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.5 — Orquestração de Upload (Initiate / Complete / Abort)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.6 — Video Worker (FFmpeg): Metadados e Thumbnail
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.7 — Streaming e Download
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.8 — Ciclo de Status, Tratamento de Falha e Reprocesso
- **Status:** pending
- **Tests:** —
- **Observations:** none
