---
kind: phase
name: phase-03-videos
sources_mtime:
  docs/project-plan.md: "2026-09-30T13:22:09-03:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-09-30T18:02:00-03:00"
  docs/phases/phase-03-videos/context.md: "2026-09-30T17:55:00-03:00"
  docs/phases/phase-03-videos/library-refs.md: "2026-09-30T18:00:00-03:00"
---

# Phase 03 — Upload e Processamento de Vídeos

## Objective

Entregar o ciclo completo de vídeo — upload de arquivos de até 10GB sem trafegar bytes pela API (presigned multipart direto ao storage), pré-cadastro do vídeo como rascunho, processamento assíncrono em fila (extração de duração/metadados via ffprobe e geração de thumbnail via ffmpeg em um worker dedicado), URL única por vídeo, streaming por range (`206`) e download — com a nova infraestrutura (object storage MinIO, fila Redis/BullMQ e worker FFmpeg) subindo no Docker Compose junto ao backend.

---

## Step Implementations

### SI-03.1 — Dependências, Config Namespaces e Infra no Docker Compose

**Description:** Instalar as dependências de produção da fase, criar os config namespaces (`storage`, `queue`, `upload`) no padrão `registerAs` da Fase 01, estender o schema Joi + `.env.example`, e adicionar os serviços `redis`, `minio` e `video-worker` ao Compose.

**Technical actions:**

- Instalar em `nestjs-project`: `@nestjs/bullmq@^11`, `bullmq@^5`, `@aws-sdk/client-s3@^3`, `@aws-sdk/s3-request-presigner@^3`, `@aws-sdk/lib-storage@^3`, `nanoid@^3` (CommonJS — ver `library-refs.md`).
- Criar `src/config/storage.config.ts` (`registerAs('storage', ...)`) lendo `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET_VIDEOS`, `STORAGE_FORCE_PATH_STYLE`.
- Criar `src/config/queue.config.ts` (`registerAs('queue', ...)`) lendo `REDIS_HOST` (default `redis`), `REDIS_PORT` (default `6379`).
- Criar `src/config/upload.config.ts` (`registerAs('upload', ...)`) lendo `UPLOAD_MAX_BYTES` (default `10737418240`), `UPLOAD_PART_SIZE_BYTES` (default `104857600`), `PRESIGN_EXPIRES_SECONDS` (default `3600`).
- Estender `src/config/env.validation.ts` (Joi) com todas as variáveis novas; atualizar `.env.example` com defaults compatíveis com Docker (hosts = nome do serviço).
- Adicionar ao `nestjs-project/compose.yaml`: `redis` (`redis:7-alpine`, healthcheck `redis-cli ping`), `minio` (`minio/minio`, portas 9000/9001, credenciais dev, healthcheck), um job de provisionamento do bucket (`createbuckets` via `mc`), e `video-worker` (build local com FFmpeg, `depends_on: [db, redis, minio]`). `nestjs-api` passa a depender de `redis` e `minio`.
- Criar `Dockerfile.worker` (ou estágio) instalando `ffmpeg`/`ffprobe` na imagem do worker.

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/config/storage.config.spec.ts` | Unit | `storage` namespace lê e tipa as variáveis corretamente |
| `src/config/queue.config.spec.ts` | Unit | `queue` namespace lê host/port com defaults |

**Dependencies:** None

**Acceptance criteria:**

- `docker compose up -d` sobe `db`, `redis`, `minio`, `mailpit`, `nestjs-api` e `video-worker` saudáveis; bucket `videos` provisionado.
- App sobe sem erro com as novas variáveis; ausência de variável obrigatória de storage causa erro de Joi no bootstrap.
- Suíte existente (Fase 02) permanece verde.

---

### SI-03.2 — Storage Service (S3/MinIO)

**Description:** Encapsular o acesso ao object storage em um `StorageService` reutilizável pela API e pelo worker: geração de URLs pré-assinadas (PUT de parte, GET de stream/download), operações de multipart (create/complete/abort) e upload server-side (thumbnail), com layout de chaves por `videoId`.

**Technical actions:**

- Criar `src/storage/storage.module.ts` e `src/storage/storage.service.ts` instanciando `S3Client` com `endpoint`, `region`, `credentials` e `forcePathStyle: true` a partir de `storageConfig`.
- Métodos: `createMultipartUpload(key)`, `presignUploadPart(key, uploadId, partNumber)`, `completeMultipartUpload(key, uploadId, parts)`, `abortMultipartUpload(key, uploadId)`, `presignGet(key, { expiresIn, responseContentDisposition? })`, `putObject(key, body, contentType)` (thumbnail), `headObject(key)`.
- Definir o helper de chaves: `sourceKey(videoId)` = `videos/{videoId}/source`, `thumbnailKey(videoId)` = `videos/{videoId}/thumbnail.jpg`.

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/storage/storage.service.integration-spec.ts` | Integration | Contra MinIO real (Compose): multipart round-trip (create→part→complete), `presignGet` retorna URL que serve `206` com Range, `putObject`/`headObject` de thumbnail |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- Um objeto enviado por multipart é recuperável; a URL pré-assinada GET responde `206 Partial Content` a um header `Range`.
- `presignGet` com `responseContentDisposition` devolve `Content-Disposition: attachment` ao baixar.

---

### SI-03.3 — Entidade Video e Migration

**Description:** Criar a entidade `Video` ligada ao canal, com `public_id` único, ciclo de status, chaves de storage, duração e metadados; gerar e aplicar a migration.

**Technical actions:**

- Criar `src/videos/entities/video.entity.ts` conforme o **Data Model** abaixo (enum `VideoStatus`, FK `channel_id`, `public_id` único, colunas de storage/metadata).
- Registrar a entidade no módulo; `autoLoadEntities` já ativo.
- Gerar a migration (`npm run migration:generate`) e revisá-la (índices únicos em `public_id`; FK para `channels`); aplicar com `npm run migration:run`.

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/entities/video.entity.integration-spec.ts` | Integration | Persistência do `Video`, unicidade de `public_id`, FK para `channel`, default de `status = draft` |
| `src/database/migrations.integration-spec.ts` | Integration | (existente) aplica todas as migrations do zero, incluindo a de vídeos |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- Migration cria a tabela `videos` com `public_id` único e FK para `channels`.
- Inserir dois vídeos com o mesmo `public_id` viola a constraint única.

---

### SI-03.4 — Videos Module e Setup da Fila (BullMQ)

**Description:** Criar o `VideosModule` (controller/service/repository) e registrar a fila de processamento com BullMQ, incluindo o produtor.

**Technical actions:**

- Registrar `BullModule.forRootAsync` (conexão Redis via `queueConfig`) no `AppModule` e `BullModule.registerQueue({ name: 'video-processing', defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: false } })` no `VideosModule`.
- Criar `VideosService` (regras), `VideosController` (endpoints, delega ao service), `VideosRepository` (ou uso do `Repository<Video>`).
- Produtor: método `enqueueProcessing(videoId)` que faz `queue.add('process', { videoId }, { jobId: videoId })` (idempotência por `jobId`).

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.spec.ts` | Unit | `enqueueProcessing` chama `queue.add` com `jobId = videoId` e payload correto |
| `src/videos/videos.module.spec.ts` | Unit | Módulo compila com a fila registrada (mock de conexão) |

**Dependencies:** SI-03.3

**Acceptance criteria:**

- O módulo sobe com a fila registrada; adicionar um job com o mesmo `videoId` não duplica (idempotência por `jobId`).

---

### SI-03.5 — Orquestração de Upload (Initiate / Complete / Abort)

**Description:** Implementar o handshake de upload presigned multipart: iniciar (pré-cadastra o vídeo como `draft`, cria o multipart no storage e devolve URLs pré-assinadas por parte), completar (finaliza o multipart, move para `processing` e enfileira o job) e abortar.

**Technical actions:**

- `POST /videos` (autenticado): recebe `{ title, filename, contentType, sizeBytes, partCount }`; valida `sizeBytes <= UPLOAD_MAX_BYTES`; resolve o `channel` do usuário; gera `public_id` (nanoid, retry em colisão); persiste `Video` (`status = draft`, `source_key`); chama `storage.createMultipartUpload`; devolve `{ videoId, publicId, uploadId, parts: [{ partNumber, url }], partSize }`.
- `POST /videos/:id/complete` (autenticado, dono): recebe `{ uploadId, parts: [{ partNumber, etag }] }`; chama `storage.completeMultipartUpload`; move `status` `draft → processing`; chama `enqueueProcessing(videoId)`.
- `POST /videos/:id/abort` (autenticado, dono): `storage.abortMultipartUpload` e remove/《marca》o rascunho.
- Guard de propriedade: só o dono (canal do usuário) inicia/completa/aborta.

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.integration-spec.ts` | Integration | Initiate cria `Video` `draft` + multipart no MinIO; complete finaliza e enfileira (status `processing`); abort limpa |
| `test/videos.e2e-spec.ts` | E2E | Fluxo initiate→(PUT partes direto no storage)→complete retorna 200 e status `processing`; `sizeBytes` acima do limite retorna 413/400; não-dono recebe 403 |

**Dependencies:** SI-03.2, SI-03.4

**Acceptance criteria:**

- Nenhum byte do arquivo passa pela API — a API só emite URLs e orquestra.
- Ao iniciar, o vídeo existe como `draft`; ao completar, vira `processing` e um job é enfileirado.

---

### SI-03.6 — Video Worker (FFmpeg): Metadados e Thumbnail

**Description:** Implementar o worker que consome a fila, baixa o source do storage, extrai duração/metadados com `ffprobe`, gera a thumbnail com `ffmpeg`, envia a thumbnail ao storage e atualiza o vídeo para `ready` (ou `failed`).

**Technical actions:**

- Criar o processo do worker (`src/worker/main.ts` ou app Nest dedicado) que roda como o serviço `video-worker` do Compose, com `@Processor('video-processing')` + `WorkerHost`.
- No `process(job)`: obter `videoId`; baixar/streamar `sourceKey`; `ffprobe -print_format json -show_format -show_streams` → extrair `duration`, `width`, `height`, `codec`, `sizeBytes`; `ffmpeg -ss <dur*0.1> -i <src> -frames:v 1 -q:v 2 thumb.jpg` → `storage.putObject(thumbnailKey)`; atualizar `Video` (`duration`, `metadata`, `thumbnail_key`, `status = ready`).
- Idempotência: reprocessar o mesmo `videoId` sobrescreve a thumbnail e os metadados sem duplicar.
- Limpeza de arquivos temporários (try/finally).

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/worker/video-processor.integration-spec.ts` | Integration | Com um vídeo de fixture pequeno + MinIO + Redis reais: job processa, thumbnail aparece no storage, `Video` vira `ready` com `duration`/metadata preenchidos |

**Dependencies:** SI-03.2, SI-03.4

**Acceptance criteria:**

- Após o complete, o worker processa automaticamente: `duration`/metadados extraídos e thumbnail gerada e persistida; `status` vira `ready`.
- Reprocessar o mesmo vídeo é idempotente.

---

### SI-03.7 — Streaming e Download

**Description:** Expor a URL única e a entrega: metadados públicos por `public_id`, streaming por range (`206`) e download — via presigned GET direto do storage.

**Technical actions:**

- `GET /videos/:publicId` (`@Public()`): retorna metadados do vídeo `ready` (título, duração, thumbnail URL pré-assinada, `publicId`). Vídeo não-`ready` → 404/409 conforme Error Catalog.
- `GET /videos/:publicId/stream` (`@Public()`): resolve `public_id` → `storage.presignGet(sourceKey, { expiresIn })` e responde `302` redirect para a URL pré-assinada (o storage serve `Range`/`206`).
- `GET /videos/:publicId/download` (`@Public()`): `presignGet(sourceKey, { responseContentDisposition: 'attachment; filename="..."' })` → `302`.
- Regra da fase: apenas vídeos `ready` são entregues; visibilidade fina (unlisted/privado) é Fase 04.

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `test/videos.e2e-spec.ts` | E2E | `GET /videos/:publicId/stream` redireciona para URL do storage que responde `206` a `Range`; `download` traz `Content-Disposition: attachment`; vídeo não-`ready` não é entregue |

**Dependencies:** SI-03.2, SI-03.3

**Acceptance criteria:**

- Streaming começa sem download completo (range/`206`) e não trafega bytes pela API.
- Download disponível com nome de arquivo correto.

---

### SI-03.8 — Ciclo de Status, Tratamento de Falha e Reprocesso

**Description:** Fechar a máquina de estados e o tratamento de falha: marcar `failed` ao esgotar os retries, persistir a causa e permitir reprocesso.

**Technical actions:**

- Listener `@OnQueueFailed()` (ou `QueueEvents` `failed`): ao esgotar `attempts`, atualizar `Video.status = failed` e `Video.error_reason`.
- `POST /videos/:id/reprocess` (autenticado, dono): revalida que o source existe (`headObject`) e re-enfileira (`status → processing`), apenas a partir de `failed`.
- Garantir transições atômicas (`draft → processing → ready|failed`; `failed → processing`) e rejeitar transições inválidas.
- Registrar as exceções de domínio no `DomainExceptionFilter` (Error Catalog abaixo).

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.spec.ts` | Unit | Transições válidas/ inválidas; `failed` grava `error_reason`; reprocess só a partir de `failed` |
| `src/worker/video-processor.integration-spec.ts` | Integration | Job que falha (ex.: source corrompido) esgota retries e marca `failed`; reprocess volta a `processing` |

**Dependencies:** SI-03.5, SI-03.6

**Acceptance criteria:**

- Falha no processamento marca `failed` com causa persistida, sem travar a fila; reprocesso recupera o vídeo.
- O ciclo de status é refletido no banco em cada transição.

---

## Technical Specifications

### Data Model

#### Video

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, generated | Identificador interno |
| public_id | varchar(16) | unique, not null | URL única curta (nanoid); imutável |
| channel_id | uuid | FK → channels.id, not null | Dono do vídeo (canal do usuário) |
| title | varchar(150) | not null | Título informado no início do upload |
| status | enum | not null, default `'draft'` | `'draft'` \| `'processing'` \| `'ready'` \| `'failed'` (enum PG `videos_status_enum`) |
| source_key | varchar | not null | Chave do arquivo no storage (`videos/{id}/source`) |
| thumbnail_key | varchar | nullable | Chave da thumbnail (`videos/{id}/thumbnail.jpg`); preenchida no processamento |
| duration_seconds | int | nullable | Extraída por ffprobe |
| size_bytes | bigint | nullable | Tamanho do source |
| metadata | jsonb | nullable | `{ width, height, codec, ... }` do ffprobe |
| error_reason | text | nullable | Preenchida quando `status = failed` |
| created_at | timestamp | not null, auto-generated | `@CreateDateColumn` |
| updated_at | timestamp | not null, auto-generated | `@UpdateDateColumn` |

**Relations:** Video → Channel (many-to-one; um canal tem muitos vídeos)
**Indexes:** `(public_id)` — unique; `(channel_id)` — FK; `(status)` — filtragem por estado

---

### API Contracts

#### POST /videos (SI-03.5) — iniciar upload

**Auth:** Bearer (usuário autenticado; vídeo criado no canal do usuário).
**Request body:** `title` (string, req), `filename` (string, req), `contentType` (string, req), `sizeBytes` (number, req, `<= UPLOAD_MAX_BYTES`), `partCount` (number, req).
**Response 201:** `videoId` (uuid), `publicId` (string), `uploadId` (string), `partSize` (number), `parts` (array de `{ partNumber, url }` — URLs pré-assinadas).
**Errors:** 400 validation; 413 `UPLOAD_TOO_LARGE`; 401 não autenticado.

#### POST /videos/:id/complete (SI-03.5) — finalizar upload

**Auth:** Bearer (dono). **Body:** `uploadId` (string), `parts` (array de `{ partNumber, etag }`).
**Response 200:** `{ publicId, status: 'processing' }`.
**Errors:** 403 `NOT_VIDEO_OWNER`; 404 `VIDEO_NOT_FOUND`; 409 `INVALID_STATUS_TRANSITION`.

#### POST /videos/:id/abort (SI-03.5)

**Auth:** Bearer (dono). **Body:** `uploadId`. **Response 204.** **Errors:** 403, 404.

#### GET /videos/:publicId (SI-03.7) — metadados públicos

**Auth:** público (`@Public()`). **Response 200:** `{ publicId, title, durationSeconds, thumbnailUrl, status }` (somente `ready`).
**Errors:** 404 `VIDEO_NOT_FOUND` (inexistente ou não-`ready`).

#### GET /videos/:publicId/stream (SI-03.7)

**Auth:** público. **Response 302** → URL pré-assinada do storage (serve `Range`/`206`). **Errors:** 404.

#### GET /videos/:publicId/download (SI-03.7)

**Auth:** público. **Response 302** → URL pré-assinada com `Content-Disposition: attachment`. **Errors:** 404.

#### POST /videos/:id/reprocess (SI-03.8)

**Auth:** Bearer (dono). **Response 200:** `{ status: 'processing' }`. **Errors:** 403, 404, 409 `INVALID_STATUS_TRANSITION` (só a partir de `failed`).

---

### Authorization Matrix

| Endpoint | Anônimo | Autenticado (não-dono) | Dono (canal) |
|----------|---------|------------------------|--------------|
| POST /videos | ❌ 401 | ✅ (cria no próprio canal) | ✅ |
| POST /videos/:id/complete | ❌ 401 | ❌ 403 | ✅ |
| POST /videos/:id/abort | ❌ 401 | ❌ 403 | ✅ |
| POST /videos/:id/reprocess | ❌ 401 | ❌ 403 | ✅ |
| GET /videos/:publicId | ✅ (ready) | ✅ | ✅ |
| GET /videos/:publicId/stream | ✅ (ready) | ✅ | ✅ |
| GET /videos/:publicId/download | ✅ (ready) | ✅ | ✅ |

> Visibilidade fina (público vs unlisted vs privado) é escopo da Fase 04; nesta fase, todo vídeo `ready` é entregável e os endpoints de escrita exigem propriedade do canal.

---

### Error Catalog

| Código | HTTP | Exceção de domínio | Quando |
|--------|------|--------------------|--------|
| `VIDEO_NOT_FOUND` | 404 | `VideoNotFoundException` | `public_id`/`id` inexistente ou não entregável |
| `NOT_VIDEO_OWNER` | 403 | `NotVideoOwnerException` | Usuário não é dono do canal do vídeo |
| `UPLOAD_TOO_LARGE` | 413 | `UploadTooLargeException` | `sizeBytes > UPLOAD_MAX_BYTES` |
| `INVALID_STATUS_TRANSITION` | 409 | `InvalidStatusTransitionException` | Transição de estado inválida (ex.: complete fora de `draft`, reprocess fora de `failed`) |
| `UPLOAD_NOT_FOUND` | 404 | `UploadNotFoundException` | `uploadId` inválido no complete/abort |

> Todas estendem `DomainException` e são mapeadas pelo `DomainExceptionFilter` para `{ statusCode, error, message }` (convenção herdada da Fase 02).

---

### Events / Messages

**Fila:** `video-processing` (BullMQ sobre Redis).

**Producer:** API, no `POST /videos/:id/complete` → `queue.add('process', { videoId }, { jobId: videoId })`.

**Job `process`:**

| Campo | Tipo | Notas |
|-------|------|-------|
| `videoId` | uuid | Referência ao `Video` a processar |

- **Opções:** `jobId = videoId` (idempotência — não duplica jobs para o mesmo vídeo); `attempts: 3`; `backoff: exponential, delay 5000ms`; `removeOnComplete: true`; `removeOnFail: false`.
- **Consumer:** serviço `video-worker` (`@Processor('video-processing')`). Sucesso → `Video.status = ready`. Erro lançado → BullMQ re-tenta conforme `attempts/backoff`.
- **Falha terminal:** ao esgotar `attempts`, `@OnQueueFailed` → `Video.status = failed`, `error_reason` persistida. Reprocesso via `POST /videos/:id/reprocess` re-enfileira.
- **Transições de estado disparadas por eventos:** `draft →(complete)→ processing →(job ok)→ ready`; `processing →(job falha terminal)→ failed →(reprocess)→ processing`.

---

## Dependency Map

```
SI-03.1 (deps + config + infra Compose)
  ├─ SI-03.2 (storage service)        ← depende de 3.1
  ├─ SI-03.3 (entidade + migration)   ← depende de 3.1
  │     └─ SI-03.4 (module + fila)    ← depende de 3.3
  │            ├─ SI-03.5 (upload)    ← depende de 3.2, 3.4
  │            └─ SI-03.6 (worker)    ← depende de 3.2, 3.4
  ├─ SI-03.7 (stream/download)        ← depende de 3.2, 3.3
  └─ SI-03.8 (status/falha/reprocess) ← depende de 3.5, 3.6
```

Ordem sugerida de execução: 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7 → 3.8.

---

## Deliverables

- Upload de até **10GB funcional** sem trafegar bytes pela API (presigned multipart direto ao MinIO), com pré-cadastro do vídeo como `draft`.
- **Processamento automático** do vídeo após o upload: duração/metadados (ffprobe) e **thumbnail** (ffmpeg) gerados por um **worker** dedicado consumindo a fila.
- **URL única** por vídeo (`public_id`), sem conflito.
- **Streaming funcionando** (range/`206`, direto do storage) e **download** disponível.
- **Ciclo de status** (`draft → processing → ready|failed`) refletido no banco, com tratamento de falha e reprocesso.
- **Infra no Compose**: `redis` (fila), `minio` (storage) e `video-worker` subindo com o backend; migration cria a tabela `videos` ligada ao canal.
- Testes nos níveis adequados (unit, integração com serviços reais, e2e) verdes; `progress.md` atualizado por SI.
