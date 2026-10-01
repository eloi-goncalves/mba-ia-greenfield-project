---
kind: phase
name: phase-03-videos
sources_mtime:
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-09-30T17:49:37-03:00"
  docs/phases/phase-03-videos/context.md: "2026-09-30T17:55:00-03:00"
---

# phase-03-videos — Library References

> Bibliotecas e componentes de infraestrutura novos fixados para a Fase 03. Versões em faixa `^` compatíveis com **NestJS 11 / TypeScript / build CommonJS** e com **Node** da imagem do container. Confirmar a versão exata resolvida no `package-lock.json` ao instalar (regra de Library Documentation Lookup — context7 consultado para APIs e compatibilidade).

## Dependências de produção (nestjs-project — API)

| Pacote | Faixa | TD | Papel | Notas (context7) |
|--------|-------|----|-------|------------------|
| `@nestjs/bullmq` | `^11.x` | TD-01 | Integração BullMQ no NestJS (`BullModule.forRootAsync`, `registerQueue`, `@Processor`, `WorkerHost`) | Alinhado ao NestJS 11; produtor e consumidor. |
| `bullmq` | `^5.x` | TD-01, TD-04 | Cliente de fila sobre Redis (jobs, `attempts`/`backoff`, eventos) | Peer do `@nestjs/bullmq`; traz `ioredis`. |
| `@aws-sdk/client-s3` | `^3.x` | TD-02, TD-03 | Cliente S3/MinIO (`CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `GetObjectCommand`) | `endpoint` custom + `forcePathStyle: true` para MinIO. |
| `@aws-sdk/s3-request-presigner` | `^3.x` | TD-02, TD-06 | `getSignedUrl` para PUT/parts (upload) e GET (stream/download com Range e `ResponseContentDisposition`) | Confirmado via context7. |
| `@aws-sdk/lib-storage` | `^3.x` | TD-03 | `Upload` (multipart de conveniência para uploads server-side, ex.: thumbnail do worker) | `partSize >= 5MB`, `queueSize` configurável. |
| `nanoid` | `^3.x` | TD-07 | Geração do `public_id` curto URL-safe | **CommonJS** — v3 é CJS; **NÃO** usar v5 (ESM-only) no build CJS do NestJS. Alternativa dependency-free: util base62 com `crypto.randomBytes` (decisão: usar `nanoid@^3`). |

## Dependências do worker (nestjs-project — Video Worker)

| Pacote / binário | Faixa | TD | Papel |
|------------------|-------|----|-------|
| `bullmq` | `^5.x` | TD-04 | Consumidor da fila (`Worker`/`@Processor`) no processo/container do worker |
| `@aws-sdk/client-s3` + `@aws-sdk/lib-storage` | `^3.x` | TD-04, TD-05 | Ler o source do storage e enviar a thumbnail |
| `ffmpeg` (binário) | sistema | TD-04, TD-05 | Extração de thumbnail (`ffmpeg -ss <t> -i ... -frames:v 1`) |
| `ffprobe` (binário) | sistema | TD-04 | Extração de duração/metadados (`ffprobe -print_format json -show_format -show_streams`) |

> O wrapper `fluent-ffmpeg` é **opcional** (conveniência) e não é fixado como dependência obrigatória — a decisão (TD-04) é invocar os binários via `child_process.spawn`.

## Componentes de infraestrutura (Docker Compose — nestjs-project/compose.yaml)

| Serviço | Imagem | TD | Papel | Notas |
|---------|--------|----|-------|-------|
| `redis` | `redis:7-alpine` | TD-01 | Backend da fila BullMQ | Host = `redis` (nome do serviço), porta 6379; healthcheck `redis-cli ping`. |
| `minio` | `minio/minio` | TD-03 | Object storage S3-compatível | Host = `minio`, API 9000, console 9001; `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`; bucket inicial provisionado (ex.: via `mc` ou `createbuckets`). |
| `video-worker` | build local (imagem com FFmpeg) | TD-04 | Processo separado consumindo a fila | `depends_on: [redis, minio, db]`; comando inicia o worker BullMQ. |

## Variáveis de ambiente novas (Joi + `.env.example`)

| Variável | Tipo | Default (Compose) | TD |
|----------|------|-------------------|----|
| `REDIS_HOST` | string | `redis` | TD-01 |
| `REDIS_PORT` | number | `6379` | TD-01 |
| `STORAGE_ENDPOINT` | string | `http://minio:9000` | TD-03 |
| `STORAGE_REGION` | string | `us-east-1` | TD-03 |
| `STORAGE_ACCESS_KEY` | string | (dev default) | TD-03 |
| `STORAGE_SECRET_KEY` | string | (dev default) | TD-03 |
| `STORAGE_BUCKET_VIDEOS` | string | `videos` | TD-03 |
| `STORAGE_FORCE_PATH_STYLE` | boolean | `true` | TD-03 |
| `UPLOAD_MAX_BYTES` | number | `10737418240` (10GB) | TD-02 |
| `UPLOAD_PART_SIZE_BYTES` | number | `104857600` (100MB) | TD-02 |
| `PRESIGN_EXPIRES_SECONDS` | number | `3600` | TD-02, TD-06 |

> Valores exatos (nomes de bucket, tamanho de parte, expiração) são refinados no `plan-build` (Data Model / Events / API Contracts). Segredos de dev não são commitados (`.env` é gitignored); apenas `.env.example` com defaults.
