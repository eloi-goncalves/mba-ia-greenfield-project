---
kind: phase
name: phase-03-videos
sources_mtime:
  docs/project-plan.md: "2026-09-30T13:22:09-03:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-09-30T17:49:37-03:00"
  docs/phases/phase-02-auth/phase-02-auth.md: "2026-09-30T13:22:09-03:00"
  docs/phases/phase-01-configuracao-base/phase-01-configuracao-base.md: "2026-09-30T13:22:09-03:00"
---

# phase-03-videos — Context

## Scope

**Phase name:** Fase 03 — Upload e Processamento de Vídeos

**Capabilities**

- Serviço de armazenamento de arquivos (vídeos e thumbnails)
- Serviço de processamento em segundo plano (filas)
- Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance
- Pré-cadastro automático do vídeo como rascunho ao iniciar o upload
- Processamento automático do vídeo após upload (extração de duração e metadados)
- Geração automática de thumbnail a partir de um frame do vídeo
- URL única por vídeo, sem conflito com outros vídeos
- Reprodução via streaming (sem necessidade de download completo)
- Download do vídeo pelo usuário

**Out of scope:** Edição de informações do vídeo, visibilidade público/unlisted, fluxo de publicação, painel de gerenciamento, página pública do canal (Fase 04); página de visualização/player, contagem de views, sugestões (Fase 05); interações sociais (Fase 06); toda a UI de vídeo em `next-frontend/`.

**Deliverables:** upload de até 10GB funcional, processamento automático do vídeo, streaming funcionando, URLs únicas geradas.

**Affected subprojects:** `nestjs-project/` (backend + worker + infra no Compose)

**Deferred subprojects:** `next-frontend/` — a interface de vídeo (upload/player) fica diferida para as Fases 04–05; esta fase entrega a API, o worker e a infraestrutura.

**Sequencing notes:** Depende da Fase 01 (Configuração Base) e da Fase 02 (cada usuário tem um canal 1:1 — o vídeo pertence a um canal).

**Neighbors (for boundary detection only):** Fase 02 — Cadastro, Login e Gerenciamento de Conta (prior), Fase 04 — Gerenciamento de Vídeos e Canal (next).

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| phase-03-videos/TD-01 | technical-decisions-phase-03-videos.md | Backend | Tecnologia da fila de processamento | decided | A (BullMQ/Redis) | @nestjs/bullmq, bullmq, redis (infra) |
| phase-03-videos/TD-02 | technical-decisions-phase-03-videos.md | Cross-layer | Estratégia de upload de 10GB | decided | A (Presigned Multipart direto ao storage) | @aws-sdk/client-s3, @aws-sdk/s3-request-presigner |
| phase-03-videos/TD-03 | technical-decisions-phase-03-videos.md | Backend | Cliente e layout do object storage | decided | A (AWS SDK v3, chaves por videoId) | @aws-sdk/client-s3, @aws-sdk/lib-storage, minio (infra) |
| phase-03-videos/TD-04 | technical-decisions-phase-03-videos.md | Backend | Worker e extração de metadados | decided | A (container separado + child_process) | bullmq, ffmpeg/ffprobe (binários) |
| phase-03-videos/TD-05 | technical-decisions-phase-03-videos.md | Backend | Geração de thumbnail | decided | A (frame único em offset relativo) | ffmpeg (binário) |
| phase-03-videos/TD-06 | technical-decisions-phase-03-videos.md | Cross-layer | Streaming e download | decided | A (presigned GET direto do storage, range/206) | @aws-sdk/s3-request-presigner |
| phase-03-videos/TD-07 | technical-decisions-phase-03-videos.md | Backend | URL única por vídeo | decided | A (public_id curto aleatório) | nanoid@^3 (CJS) ou base62 com crypto |
| phase-03-videos/TD-08 | technical-decisions-phase-03-videos.md | Backend | Ciclo de status e falha | decided | A (draft → processing → ready\|failed) | — |

_Source files:_

- `docs/decisions/technical-decisions-phase-03-videos.md`

## Capability Coverage

| Capability | Covered by |
|------------|------------|
| Serviço de armazenamento de arquivos (vídeos e thumbnails) | phase-03-videos/TD-03 |
| Serviço de processamento em segundo plano (filas) | phase-03-videos/TD-01, phase-03-videos/TD-04 |
| Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance | phase-03-videos/TD-02 |
| Pré-cadastro automático do vídeo como rascunho ao iniciar o upload | phase-03-videos/TD-08 |
| Processamento automático do vídeo após upload (extração de duração e metadados) | phase-03-videos/TD-04 |
| Geração automática de thumbnail a partir de um frame do vídeo | phase-03-videos/TD-05 |
| URL única por vídeo, sem conflito com outros vídeos | phase-03-videos/TD-07 |
| Reprodução via streaming (sem necessidade de download completo) | phase-03-videos/TD-06 |
| Download do vídeo pelo usuário | phase-03-videos/TD-06 |

## Decisions Detail

### phase-03-videos/TD-01

**Recommendation:** BullMQ (Redis) via `@nestjs/bullmq` — melhor equilíbrio entre robustez e aderência ao NestJS; retries/backoff/eventos de falha nativos cobrem o ciclo de status (TD-08); o custo (um Redis no Compose) é baixo e padrão de mercado. Confirmado com o usuário.

**Libraries:** `@nestjs/bullmq`, `bullmq`, `redis` (serviço de infra no Compose)

### phase-03-videos/TD-02

**Recommendation:** Presigned Multipart Upload direto ao storage — única opção que combina "bytes fora da API" + resiliência/retomada exigidas por 10GB, usando recursos nativos do S3/MinIO. A API orquestra init/complete/abort e persiste o rascunho; nunca segura o arquivo.

**Libraries:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

### phase-03-videos/TD-03

**Recommendation:** AWS SDK v3 com layout de chaves por `videoId` e path-style para MinIO — portável S3↔MinIO, cobre upload, streaming/download e worker com um único cliente.

**Libraries:** `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `minio` (serviço de infra no Compose)

### phase-03-videos/TD-04

**Recommendation:** Worker em container separado consumindo BullMQ, invocando `ffprobe`/`ffmpeg` via `child_process.spawn` (com `ffprobe -print_format json` para metadados). Isola a carga e segue o diagrama de arquitetura. `fluent-ffmpeg` é conveniência opcional, não decisão de stack.

**Libraries:** `bullmq`; binários `ffmpeg`/`ffprobe` na imagem do worker

### phase-03-videos/TD-05

**Recommendation:** Frame único em timestamp relativo (ex.: 10% da duração) via `ffmpeg` — simples, determinístico e suficiente; a customização de thumbnail é capability da Fase 04.

**Libraries:** binário `ffmpeg`

### phase-03-videos/TD-06

**Recommendation:** Entrega direta do storage via presigned GET — range/206 nativos do storage para streaming e `ResponseContentDisposition` para download; a API atua como emissora de URLs de curta duração a partir da URL única. Mantém a API leve e alinha-se ao diagrama.

**Libraries:** `@aws-sdk/s3-request-presigner`

### phase-03-videos/TD-07

**Recommendation:** `public_id` curto aleatório em coluna com índice único (gerado no pré-cadastro, imutável). Atenção de compatibilidade: `nanoid` v5 é ESM-only → usar `nanoid@^3` (CommonJS) para casar com o build CJS do NestJS, ou um util base62 com `crypto`.

**Libraries:** `nanoid@^3` (CJS) ou util próprio com `crypto` (a fixar em `library-refs.md`)

### phase-03-videos/TD-08

**Recommendation:** Máquina de estados `draft → processing → ready | failed` com retry/backoff do BullMQ e `failed` persistindo o erro e permitindo reprocesso. Cobre pré-cadastro como rascunho, processamento assíncrono e tratamento de falha.

**Libraries:** —

## Inherited Conventions

- Backend config usa `@nestjs/config` com `registerAs(name, () => ({...}))` namespaced — um arquivo por domínio em `src/config/`. _(Fase 01)_
- Variáveis de ambiente validadas por schema **Joi** em `src/config/env.validation.ts`, via `ConfigModule.forRoot({ validationSchema, ... })`. Novas variáveis (storage, fila, worker) devem entrar no schema + `.env.example` com defaults compatíveis com Docker. _(Fase 01)_
- `TypeOrmModule.forRootAsync` com `autoLoadEntities: true`, `synchronize: false`; migrations versionadas via `data-source.ts`; parâmetros de conexão a partir de um único `databaseConfig`. _(Fase 01)_
- **Host de serviços = nome do serviço do Compose** (`db`, `redis`, `minio`), nunca `localhost`. _(CLAUDE.md / Fase 01)_
- `ValidationPipe` global com `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. _(Fase 02)_
- Contrato de erro padronizado `{ statusCode, error, message }` via `DomainException` + `DomainExceptionFilter` (`@Catch(DomainException)`); novas exceções de vídeo estendem `DomainException`. _(Fase 02)_
- Guard JWT global (`JwtAuthGuard` como `APP_GUARD`) com `@Public()` para rotas anônimas — o streaming/watch anônimo usa `@Public()`. _(Fase 02)_
- Separação de camadas: controllers delegam a services; lógica de negócio só em services; repository pattern. _(rules `nestjs-*`)_
- Vídeo pertence a um **canal** (`channels/`) — reusar a entidade/relacionamento de canal da Fase 02; o dono do vídeo é o canal do usuário autenticado. _(Fase 02)_
- Padrões de teste: `*.spec.ts` (unit), `*.integration-spec.ts` (integração com banco/serviços reais, `--runInBand`), `*.e2e-spec.ts` (e2e via supertest). Testes rodam **dentro do container** (resolvem `db`/`redis`/`minio`). _(Fase 02 / nota de ambiente #00)_

## Inherited Deferred Capabilities

_No inherited deferred capabilities._

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale | TD refs |
|------------|--------|-----------|---------|
| Interface de vídeo (upload/player) em `next-frontend/` | deferred | UI de vídeo é escopo das Fases 04–05; esta fase entrega API + worker + infra. | TD-02, TD-06 (definem o contrato cliente↔storage) |

## Testing Requirements

Consultar a Skill `testing-guide-nestjs-project` para os requisitos de camada por tipo de artefato. A Fase 03 introduz: entidade `Video` + migration (integração com banco real); serviço de storage sobre MinIO (integração real via Compose); produtor/consumidor BullMQ sobre Redis (integração real); worker FFmpeg (integração — exercitar ffprobe/ffmpeg em um vídeo de fixture pequeno); endpoints de upload/stream/download (e2e via supertest, incluindo `206 Partial Content`). Não mockar o que sobe no Compose (storage, fila, worker). Cobertura por SI registrada em `progress.md`.
