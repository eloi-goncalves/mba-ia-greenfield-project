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

| Requisito | Artefato oficial | Implementação | Teste | Evidência | Status |
|-----------|------------------|---------------|-------|-----------|--------|
| Tecnologia de fila (TBD) | `docs/decisions/technical-decisions-phase-03-videos.md` | — | — | — | `pendente` |
| Estratégia de upload de 10GB (sem travar) | idem | — | — | — | `pendente` |
| Worker (processo/container) + FFmpeg/ffprobe | idem | — | — | — | `pendente` |
| Estratégia de URL única | idem | — | — | — | `pendente` |
| Estratégia de streaming (range/206) | idem | — | — | — | `pendente` |
| Ciclo de status + falha no processamento | idem | — | — | — | `pendente` |
| Uso do object storage (S3/MinIO: buckets/chaves, presigned) | idem | — | — | — | `pendente` |

---

## 3. Planejamento (pipeline)

| Requisito | Artefato oficial | Status | Evidência |
|-----------|------------------|--------|-----------|
| Contexto consolidado | `docs/phases/phase-03-videos/context.md` | `pendente` | — |
| Validação (clean) | `docs/phases/phase-03-videos/validation.md` | `pendente` | frontmatter `status: clean` |
| Libs fixadas (context7) | `docs/phases/phase-03-videos/library-refs.md` | `pendente` | — |
| Plano executável (SIs + Tech Specs + Dependency Map + Deliverables) | `docs/phases/phase-03-videos/phase-03-videos.md` | `pendente` | — |

---

## 4. Implementação — Capabilities da Fase 03

> Fonte das capabilities: `docs/project-plan.md` (Fase 03) e `docs/instructions/readme.md` (Escopo).

| Requisito (capability) | Implementação (SI/arquivo) | Teste | Evidência | Status |
|------------------------|----------------------------|-------|-----------|--------|
| Serviço de armazenamento (vídeos e thumbnails) | — | — | — | `pendente` |
| Serviço de processamento em segundo plano (fila) + worker | — | — | — | `pendente` |
| Upload de até 10GB sem travar a API | — | — | — | `pendente` |
| Pré-cadastro automático como rascunho ao iniciar upload | — | — | — | `pendente` |
| Processamento automático (duração + metadados) | — | — | — | `pendente` |
| Geração automática de thumbnail (frame do vídeo) | — | — | — | `pendente` |
| URL única por vídeo, sem conflito | — | — | — | `pendente` |
| Reprodução via streaming (sem download completo) | — | — | — | `pendente` |
| Download do vídeo pelo usuário | — | — | — | `pendente` |
| Ciclo de status (rascunho → processando → pronto/erro) no banco | — | — | — | `pendente` |
| Migration da tabela de vídeos (entidade ligada ao canal) | — | — | — | `pendente` |
| Infra no Compose (storage + fila + worker) | `nestjs-project/compose.yaml` | — | `docker compose ps` | `pendente` |
| Progresso por SI | `docs/phases/phase-03-videos/progress.md` | — | — | `pendente` |

---

## 5. Fechamento — Definition of Done e Documentação

| Requisito | Verificação | Evidência | Status |
|-----------|-------------|-----------|--------|
| Suíte relevante + completa verdes | `npm test`, `npm run test:e2e` | saída dos testes | `pendente` |
| Compilação limpa | `npx tsc --noEmit` (código 0) | saída | `pendente` |
| Lint | `npm run lint` | saída | `pendente` |
| `CLAUDE.md` atualizado (seção vídeos, coerente com código) | revisão | diff | `pendente` |
| Git Flow (feature → dev; sem commit na main) | revisão | `git log` | `pendente` |

---

<!-- Atualize Status e preencha Implementação/Teste/Evidência à medida que cada etapa é executada. -->
