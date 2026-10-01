# Delivery — Rastreabilidade de Entregas (Fase 03)

> Matriz de rastreabilidade da iniciativa. Complementa (não substitui) os artefatos oficiais do desafio.
>
> **Cadeia de rastreabilidade:** Requisito → Artefato oficial → Implementação → Teste → Evidência → Status.
>
> **Status permitidos:** `pendente` · `em-andamento` · `entregue`.

---

## 0. Camada de meta-planejamento (esta iniciativa)

| Item | Artefato | Status | Evidência |
|------|----------|--------|-----------|
| Meta-planos de execução da Fase 03 | `docs/instructions/prompts_plans/*.md` | `entregue` | 5 meta-planos + README índice criados |
| Rastreamento global | `docs/instructions/history.md`, `docs/instructions/delivery.md` | `entregue` | Arquivos criados |

---

## 1. Pré-condição — Ambiente

| Requisito | Artefato oficial | Implementação | Teste | Evidência | Status |
|-----------|------------------|---------------|-------|-----------|--------|
| Ambiente pronto (backend, Postgres, Mailpit) + Git Flow (`dev`) + fundação de IA | `compose.yaml`, branches `dev`/`feature/phase-03-videos` | Stack no ar; `.env` criado; migrations aplicadas | Base verde: unit+integração 144/144, e2e 52/52 | `docker compose ps`; logs `/tmp/baseline2.log`, `/tmp/e2e.log` | `entregue` |

---

## 2. Decisões técnicas (research)

| Requisito | Artefato oficial | Decisão | Teste | Evidência | Status |
|-----------|------------------|---------|-------|-----------|--------|
| Tecnologia de fila (TBD) | `docs/decisions/technical-decisions-phase-03-videos.md` | TD-01: BullMQ (Redis) | — | confirmado com usuário | `entregue` |
| Estratégia de upload de 10GB (sem travar) | idem | TD-02: Presigned Multipart direto ao storage | — | context7 AWS SDK v3 | `entregue` |
| Worker (processo/container) + FFmpeg/ffprobe | idem | TD-04: container separado + `child_process` | — | diagrama de arquitetura | `entregue` |
| Estratégia de URL única | idem | TD-07: `public_id` curto aleatório | — | — | `entregue` |
| Estratégia de streaming (range/206) | idem | TD-06: presigned GET direto do storage | — | context7 AWS SDK v3 | `entregue` |
| Ciclo de status + falha no processamento | idem | TD-08: `draft → processing → ready\|failed` | — | — | `entregue` |
| Geração de thumbnail | idem | TD-05: frame único em offset relativo | — | — | `entregue` |
| Uso do object storage (S3/MinIO: buckets/chaves, presigned) | idem | TD-03: AWS SDK v3, chaves por `videoId` | — | context7 AWS SDK v3 | `entregue` |

---

## 3. Planejamento (pipeline)

| Requisito | Artefato oficial | Status | Evidência |
|-----------|------------------|--------|-----------|
| Contexto consolidado | `docs/phases/phase-03-videos/context.md` | `entregue` | 9 capabilities → 8 TDs (Capability Coverage) |
| Validação (clean) | `docs/phases/phase-03-videos/validation.md` | `entregue` | frontmatter `status: clean`, `issue_count: 0` |
| Libs fixadas (context7) | `docs/phases/phase-03-videos/library-refs.md` | `entregue` | BullMQ/AWS SDK/nanoid@^3 CJS + infra redis/minio |
| Plano executável (SIs + Tech Specs + Dependency Map + Deliverables) | `docs/phases/phase-03-videos/phase-03-videos.md` | `entregue` | 8 SIs + Data Model/API/Authz/Errors/Events + Dependency Map |

---

## 4. Implementação — Capabilities da Fase 03

> Fonte das capabilities: `docs/project-plan.md` (Fase 03) e `docs/instructions/readme.md` (Escopo).

| Requisito (capability) | Implementação (SI/arquivo) | Teste | Evidência | Status |
|------------------------|----------------------------|-------|-----------|--------|
| Serviço de armazenamento (vídeos e thumbnails) | SI-03.2 `storage/storage.service.ts` | storage.integration 4/4 | `206`/presign/thumbnail | `entregue` |
| Serviço de processamento em segundo plano (fila) + worker | SI-03.4/03.6 `videos` + `worker/` | service/module + worker 2/2 | demo ao vivo: ready | `entregue` |
| Upload de até 10GB sem travar a API | SI-03.5 presigned multipart | videos.e2e 8/8 | bytes fora da API | `entregue` |
| Pré-cadastro automático como rascunho ao iniciar upload | SI-03.5 `initiateUpload` | videos.service.integration 3/3 | status `draft` | `entregue` |
| Processamento automático (duração + metadados) | SI-03.6 `VideoProcessingService` | worker integration | ffprobe 320×240/2s | `entregue` |
| Geração automática de thumbnail (frame do vídeo) | SI-03.6 ffmpeg 10% | worker integration | thumbnail no storage | `entregue` |
| URL única por vídeo, sem conflito | SI-03.3/03.5 `public_id` nanoid | entity + e2e | coluna única | `entregue` |
| Reprodução via streaming (sem download completo) | SI-03.7 presigned GET range | videos.e2e | `302`→`206` | `entregue` |
| Download do vídeo pelo usuário | SI-03.7 `Content-Disposition` | videos.e2e | attachment | `entregue` |
| Ciclo de status (rascunho → processando → pronto/erro) no banco | SI-03.8 máquina de estados | processor/reprocess | transições | `entregue` |
| Migration da tabela de vídeos (entidade ligada ao canal) | SI-03.3 `CreateVideos` | migrations.integration | FK channels | `entregue` |
| Infra no Compose (storage + fila + worker) | `nestjs-project/compose.yaml` | redis/minio/video-worker | `docker compose ps` (6 serviços) | `entregue` |
| Progresso por SI | `docs/phases/phase-03-videos/progress.md` | — | 8/8 completed | `entregue` |

---

## 5. Fechamento — Definition of Done e Documentação

| Requisito | Verificação | Evidência | Status |
|-----------|-------------|-----------|--------|
| Suíte relevante + completa verdes | `npm test`, `npm run test:e2e` | 170/170 unit+integração + 60/60 e2e | `entregue` |
| Compilação limpa | `npx tsc --noEmit` (código 0) | TSC OK | `entregue` |
| Lint | `npm run lint` | exit 0 (override p/ testes + correções) | `entregue` |
| `CLAUDE.md` atualizado (seção vídeos, coerente com código) | revisão | seção Videos + serviços + fila/worker | `entregue` |
| Git Flow (feature → dev; sem commit na main) | revisão | `feature/phase-03-videos`, `main` intocada | `entregue` |

---

<!-- Atualize Status e preencha Implementação/Teste/Evidência à medida que cada etapa é executada. -->
