# phase-03-videos — Progress

**Status:** in_progress
**SIs:** 5/8 completed

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
- **Status:** completed
- **Tests:** 4/4 integração (video.entity.integration-spec): default `draft`, unicidade de `public_id`, round-trip bigint/jsonb, FK inválida rejeitada. Suíte completa 156/156.
- **Observations:**
  - Entidade `Video` (enum `VideoStatus`, FK `channel_id`→channels, `public_id` único, bigint `size_bytes` com transformer p/ number, jsonb `metadata`). Migration `CreateVideos` gerada e aplicada.
  - Removido `@Index({ unique: true })` redundante em `public_id` (a coluna `unique: true` já cria a constraint) e regenerada a migration limpa.
  - Corrigida fragilidade pré-existente do `migrations.integration-spec`: `beforeAll` agora dropa `verification_tokens_type_enum` (idempotência contra enum residual).
  - `beforeEach` do teste de entidade reusa `cleanAllTables` (ordem correta de FKs de token) + `DELETE videos`.

### SI-03.4 — Videos Module e Setup da Fila (BullMQ)
- **Status:** completed
- **Tests:** 3/3 (videos.service.spec: enqueue com jobId idempotente; videos.module.spec: compilação com fila+storage). Suíte completa 159/159 + e2e 52/52.
- **Observations:**
  - `VideosModule` com `TypeOrmModule.forFeature([Video])`, `BullModule.registerQueue('video-processing')` (attempts 3, backoff exponencial 5s, removeOnComplete) e `StorageModule`.
  - `BullModule.forRootAsync` (conexão Redis via `queueConfig`) e `VideosModule` registrados no `AppModule`.
  - `VideosService.enqueueProcessing(videoId)` usa `jobId = videoId` (idempotência).

### SI-03.5 — Orquestração de Upload (Initiate / Complete / Abort)
- **Status:** completed
- **Tests:** videos.service.integration 3/3 (initiate→draft, abort→remove, complete→processing+job); videos.e2e 4/4 (fluxo completo com PUT direto no storage, 413, 401, 403). Suíte completa 162/162 + e2e 56/56.
- **Observations:**
  - `POST /videos` (initiate: valida tamanho, resolve canal, gera `public_id` nanoid com retry, cria draft, multipart + presign partes), `POST /videos/:id/complete` (finaliza multipart, draft→processing, enfileira), `POST /videos/:id/abort`.
  - `id` pré-gerado (`randomUUID`) para compor a `source_key` antes do save (uma única escrita).
  - Exceções de domínio: VideoNotFound, NotVideoOwner, UploadTooLarge, InvalidStatusTransition, UploadNotFound.
  - `ChannelsService.findByUserId` adicionado (domínio de canais); `VideosModule` importa `ChannelsModule`.
  - **Fix central:** `cleanAllTables` passou a deletar `videos` (com guarda `to_regclass`) — a FK videos→channels quebrava o cleanup das demais suítes. `videos.service.spec` atualizado com as novas deps mockadas.

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
