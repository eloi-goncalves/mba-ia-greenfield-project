---
scope_type: phase
related_phases: [3]
status: decided
date: 2026-09-30
scope_description: "Backend/infra foundation for video upload and processing: processing queue, large-file upload strategy, object storage usage, video worker (FFmpeg), thumbnail generation, streaming/download delivery, unique per-video URL, and the video status lifecycle."
---

# Technical Decisions — Phase 03: Upload e Processamento de Vídeos

_Subprojects in scope:_

- `nestjs-project/` — backend that delivers the video module (upload orchestration, presigned URLs, metadata persistence, streaming/download endpoints), the object-storage integration, the processing queue producer, and the video worker (FFmpeg/ffprobe) as a separate process/container.
- `next-frontend/` — Frontend out of scope for this phase (the video UI belongs to Fases 04–05). The upload handshake (TD-02) and delivery strategy (TD-06) define the client-facing contract that a future frontend will consume, but no frontend code is decided or produced here.

---

## TD-01: Tecnologia da Fila de Processamento

**Scope:** Backend

**Capability:** Serviço de processamento em segundo plano (filas)

**Context:** O `project-plan.md` deixa a fila explicitamente como "TBD" — é a principal decisão de stack da fase. O processamento de vídeo (extração de metadados + thumbnail via FFmpeg) é pesado e não pode bloquear a API; precisa rodar em segundo plano, com retries e observabilidade de falhas. A escolha define um novo serviço de infraestrutura no Compose e como o worker consome os jobs.

**Options:**

### Option A: BullMQ (Redis)
- Fila baseada em Redis, com integração oficial do NestJS (`@nestjs/bullmq`): produtor via `Queue.add()`, consumidor via `@Processor` + `WorkerHost`, retries/backoff nativos (`attempts`, `backoff`), eventos de falha (`@OnQueueFailed`) e concorrência por worker.
- **Pros:** Padrão idiomático do ecossistema NestJS; retry/backoff/dead-letter e concorrência prontos; worker roda como processo separado trivialmente; ecossistema maduro (dashboards, métricas). Documentação confirmada via context7 (`/nestjs/bull`).
- **Cons:** Adiciona um serviço **Redis** ao Compose (nova peça de infra e de operação).

### Option B: pg-boss (PostgreSQL)
- Fila implementada sobre o PostgreSQL já existente (usa `SKIP LOCKED`), sem broker adicional.
- **Pros:** Zero infra nova — reusa o Postgres do projeto; transacional com os dados de domínio; simples de operar.
- **Cons:** Menos idiomático no NestJS (sem módulo oficial — integração manual); throughput/latência inferiores a Redis sob carga; acopla carga de fila ao banco transacional (competição por conexões/IO com as queries de domínio).

### Option C: RabbitMQ (AMQP)
- Broker de mensagens dedicado, com `@nestjs/microservices` ou `amqplib`.
- **Pros:** Muito robusto para roteamento complexo (exchanges/bindings), ack/nack finos, alta durabilidade.
- **Cons:** Peça de infra mais pesada e mais conceitos (exchanges, DLX) do que este caso de uso exige; retry/backoff exigem montagem manual (DLX + TTL). Overkill para "processar um vídeo após upload".

**Recommendation:** **BullMQ (Redis)** — melhor equilíbrio entre robustez e aderência ao NestJS; retries/backoff/eventos de falha nativos cobrem o ciclo de status (TD-08) com o mínimo de código; o custo (um Redis no Compose) é baixo e padrão de mercado. Confirmado com o usuário.

**Decision:** A (BullMQ sobre Redis, via `@nestjs/bullmq`)

---

## TD-02: Estratégia de Upload de Arquivos de até 10GB

**Scope:** Cross-layer

**Capability:** Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance

**Context:** O requisito crítico é enviar arquivos de até 10GB **sem travar a API** (passar 10GB pelo processo Node é reprova automática). O handshake vive em dois lados: a API emite credenciais/URLs e registra o vídeo; o cliente envia os bytes. Como o object storage é S3-compatível (MinIO local), a decisão é qual protocolo de upload usar.

**Options:**

### Option A: Presigned Multipart Upload direto ao storage
- A API inicia um multipart upload no storage (`CreateMultipartUpload`), gera **URLs pré-assinadas por parte** (`UploadPart`) e devolve ao cliente; o cliente envia as partes **diretamente ao storage** (paralelizável, retomável por parte) e a API finaliza (`CompleteMultipartUpload`). Os bytes nunca passam pela API.
- **Pros:** Bytes não trafegam pela API (uso de memória/CPU da API constante independentemente do tamanho); paralelismo e retomada por parte (resiliência em 10GB); nativo do S3/MinIO; suportado pelo `@aws-sdk/client-s3` + `s3-request-presigner` (confirmado via context7).
- **Cons:** Handshake em múltiplos passos (init → part URLs → complete/abort) — mais endpoints e estado a coordenar.

### Option B: Presigned PUT único (single-part)
- A API gera uma única URL pré-assinada (`PutObject`); o cliente faz um PUT direto ao storage.
- **Pros:** Simplicidade máxima (um endpoint, uma URL); bytes também não passam pela API.
- **Cons:** Sem retomada — falha de rede em 9GB reinicia tudo; limites práticos de tamanho por request; sem paralelismo. Inadequado para 10GB com resiliência.

### Option C: Protocolo tus (upload resumável)
- Servidor tus (`@tus/server`) recebe uploads resumáveis em chunks.
- **Pros:** Retomada padronizada e madura no cliente.
- **Cons:** Introduz um servidor tus (nova dependência/infra) e os bytes tendem a passar por um endpoint da aplicação (a menos de plugin S3), contrariando o "direto ao storage"; redundante frente ao multipart nativo do S3.

**Recommendation:** **Presigned Multipart Upload direto ao storage** — única opção que combina "bytes fora da API" + resiliência/retomada exigidas por 10GB, usando recursos nativos do S3/MinIO já disponíveis. A API orquestra (init/complete/abort) e persiste o rascunho (TD-08), sem nunca segurar o arquivo.

**Decision:** A (Presigned Multipart Upload direto ao storage)

---

## TD-03: Object Storage — Cliente e Organização de Buckets/Chaves

**Scope:** Backend

**Capability:** Serviço de armazenamento de arquivos (vídeos e thumbnails)

**Context:** O storage não é escolha em aberto — o projeto aponta para S3-compatível, rodando **MinIO** local em Docker (trocável por S3 em produção). O que se decide é **como usá-lo**: qual SDK, como endereçar o endpoint do MinIO, e a organização de buckets/chaves para vídeos e thumbnails.

**Options:**

### Option A: `@aws-sdk/client-s3` (v3) + `s3-request-presigner` + `lib-storage`, com layout de chaves por vídeo
- SDK oficial AWS v3 apontando para o MinIO via `endpoint` custom + `forcePathStyle: true`. Chaves organizadas por recurso, ex.: bucket `videos` com `videos/{videoId}/source/{original}` e `videos/{videoId}/thumbnail/{n}.jpg`. Presign para GET/PUT/parts.
- **Pros:** SDK oficial, primeira-classe em TypeScript, compatível com MinIO (path-style); mesmo SDK cobre upload (TD-02), streaming/download (TD-06) e o worker; `endpoint` custom confirmado via context7. Prefixo por `videoId` isola e simplifica limpeza/lifecycle.
- **Cons:** Pacotes AWS são modulares (várias deps `@aws-sdk/*`); configuração de path-style para MinIO exige atenção.

### Option B: SDK `minio` (cliente nativo MinIO)
- Cliente específico do MinIO.
- **Pros:** API enxuta focada em MinIO.
- **Cons:** Menos portável para S3 real (o objetivo é "trocar por S3 em produção"); comunidade/typing menores que o AWS SDK; presign e multipart menos alinhados ao padrão S3 canônico.

**Recommendation:** **AWS SDK v3** com layout de chaves por `videoId` e dois buckets lógicos (ou um bucket com prefixos) — portável S3↔MinIO, cobre todos os fluxos da fase com um único cliente, path-style para MinIO. Buckets e chaves exatos são refinados no Data Model/plan-build.

**Decision:** A (`@aws-sdk/client-s3` v3 + `s3-request-presigner` + `lib-storage`, chaves por `videoId`)

---

## TD-04: Worker de Vídeo — Execução e Extração de Metadados

**Scope:** Backend

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** Após o upload, é preciso extrair duração/metadados e (TD-05) gerar thumbnail. Isso é CPU/IO-intensivo e usa binários nativos (FFmpeg/ffprobe). A decisão é onde e como o worker roda e como invoca o FFmpeg.

**Options:**

### Option A: Container/processo separado consumindo a fila, invocando ffprobe/ffmpeg via `child_process`
- Um serviço dedicado no Compose (imagem com FFmpeg instalado) roda um `Worker`/`@Processor` BullMQ; baixa o source do storage (ou usa stream), chama `ffprobe` para metadados e `ffmpeg` para thumbnail via `spawn`, faz upload do resultado e atualiza o banco.
- **Pros:** Isola carga pesada da API (escala independente); FFmpeg fica só na imagem do worker; `child_process.spawn` é robusto e sem dependência de wrapper não-mantido; alinhado ao diagrama de arquitetura (worker separado).
- **Cons:** Parsing manual da saída do `ffprobe` (usar `-print_format json`); gerência de arquivos temporários.

### Option B: Wrapper `fluent-ffmpeg`
- Biblioteca que abstrai a linha de comando do FFmpeg.
- **Pros:** API fluente e conveniente para comandos comuns.
- **Cons:** Manutenção intermitente do pacote; ainda depende do binário FFmpeg instalado; abstração adiciona superfície sem remover a necessidade do binário. Pode ser adotada como conveniência, mas não é requisito.

### Option C: Processar dentro da própria API (sem worker separado)
- A API consome a fila no mesmo processo.
- **Pros:** Menos serviços.
- **Cons:** Contraria o diagrama (worker dedicado); picos de CPU do FFmpeg degradam a latência da API; escala acoplada. Inadequado.

**Recommendation:** **Worker em container separado, consumindo BullMQ, invocando `ffprobe`/`ffmpeg` via `child_process.spawn`** (com `ffprobe -print_format json` para metadados). Isola a carga, segue a arquitetura e evita dependência de wrapper não essencial. `fluent-ffmpeg` fica como conveniência opcional a critério do implementador, não como decisão de stack.

**Decision:** A (worker separado + `child_process` para ffprobe/ffmpeg)

---

## TD-05: Estratégia de Geração de Thumbnail

**Scope:** Backend

**Capability:** Geração automática de thumbnail a partir de um frame do vídeo

**Context:** É preciso gerar automaticamente uma thumbnail a partir de um frame do vídeo. A decisão é qual frame extrair e como, dentro do worker (TD-04).

**Options:**

### Option A: Frame em timestamp relativo à duração (ex.: 10%) via ffmpeg
- Após obter a duração (ffprobe), o worker extrai um frame em um ponto relativo (ex.: `duração * 0.1`) com `ffmpeg -ss <t> -i <input> -frames:v 1 <out>.jpg`, e envia ao storage sob a chave do vídeo.
- **Pros:** Determinístico e barato (1 frame); evita frames pretos do início (offset relativo); reutiliza a duração já extraída; um único ponto de saída.
- **Cons:** Um frame fixo pode não ser "representativo" — aceitável para a fase (thumbnail customizada é escopo da Fase 04).

### Option B: Múltiplos candidatos + heurística de seleção
- Extrai N frames e escolhe por heurística (ex.: maior variância/nitidez).
- **Pros:** Thumbnail potencialmente melhor.
- **Cons:** Mais custo e complexidade sem requisito que justifique; fora do escopo da Fase 03.

**Recommendation:** **Frame único em timestamp relativo (ex.: 10% da duração)** — simples, determinístico e suficiente para o requisito; a customização de thumbnail é uma capability da Fase 04, não desta.

**Decision:** A (frame único em offset relativo via ffmpeg)

---

## TD-06: Estratégia de Streaming e Download

**Scope:** Cross-layer

**Capability:** Transversal — covers: "Reprodução via streaming (sem necessidade de download completo)"; "Download do vídeo pelo usuário"

**Context:** O vídeo deve começar a tocar sem download completo (streaming por range/`206 Partial Content`) e também permitir download. O diagrama de arquitetura mostra o frontend fazendo streaming **direto do object storage** (`frontend → storage: Streams HTTPS`). A decisão é se a entrega é direta do storage (presigned) ou proxied pela API.

**Options:**

### Option A: Presigned GET direto do storage (range nativo) + download via presigned com `Content-Disposition`
- Um endpoint da API resolve a URL única (TD-07) → gera uma **URL pré-assinada GET** do storage e redireciona/entrega ao cliente. O storage serve `Range`/`206` nativamente (confirmado via context7: `GetObjectCommand` responde `ContentRange`/`Accept-Ranges`). Para download, presign com `ResponseContentDisposition: attachment; filename=...`.
- **Pros:** Bytes não passam pela API (streaming de 10GB sem carga na API), coerente com o diagrama; range/206 nativos do storage; download controlado por `Content-Disposition` na presign; expiração/escopo por URL.
- **Cons:** Cliente fala direto com o storage (em produção, exige CORS/rede adequados); a API não vê cada byte (controle de acesso acontece na emissão da URL, com TTL curto).

### Option B: Proxy de streaming pela API (a API lê do storage com Range e repassa 206)
- A API recebe a requisição com `Range`, lê o intervalo do storage e repassa `206` ao cliente.
- **Pros:** Controle de acesso por requisição; cliente nunca vê o storage.
- **Cons:** Todos os bytes passam pela API (carga/латência sob 10GB e muitos espectadores) — contraria o princípio "não segurar arquivos grandes na API" e o diagrama. Mais custo de CPU/rede na API.

**Recommendation:** **Presigned GET direto do storage** para streaming (range/206 nativos) e para download (presign com `Content-Disposition`), com a API atuando como emissora de URLs de curta duração a partir da URL única. Alinha-se ao diagrama e mantém a API leve. Controle de acesso da fase: vídeos `ready` públicos; regras finas de visibilidade (unlisted/privado) são da Fase 04/05.

**Decision:** A (entrega direta do storage via presigned GET; streaming por range/206; download por `Content-Disposition`)

---

## TD-07: Estratégia de URL Única por Vídeo

**Scope:** Backend

**Capability:** URL única por vídeo, sem conflito com outros vídeos

**Context:** Cada vídeo precisa de um identificador público curto e único que nunca conflite, usado na URL de reprodução/entrega (distinto do UUID interno da tabela). A decisão é como gerar/armazenar esse identificador.

**Options:**

### Option A: Identificador curto aleatório (nanoid) em coluna com índice único
- Gera um id curto URL-safe (ex.: 11 chars) no ato do pré-cadastro, persistido em coluna `public_id` com `UNIQUE`. Colisão praticamente nula; em caso de violação de unicidade, regenera (retry).
- **Pros:** Curto e amigável para URL; colisão desprezível; desacoplado do PK interno (não vaza sequência/UUID interno); simples de indexar/consultar. **Atenção de compatibilidade:** `nanoid` v5 é ESM-only — usar `nanoid@^3` (CommonJS) para casar com o build CJS do NestJS, ou um gerador base62 com `crypto`.
- **Cons:** Introduz uma dependência (pequena) ou um util próprio; precisa do índice único + tratamento de colisão (trivial).

### Option B: Usar o próprio UUID (PK) como identificador público
- A URL usa o `id` UUID da linha.
- **Pros:** Zero geração extra; unicidade garantida pelo PK.
- **Cons:** URLs longas e feias; expõe o identificador interno; não atende ao espírito de "URL curta e única" do `project-plan.md` (§ Pontos de Atenção).

### Option C: Slug derivado do título
- Gera slug a partir do título.
- **Cons:** Títulos colidem e mudam (Fase 04 edita título); exige desambiguação e quebra de imutabilidade da URL. Inadequado como identidade.

**Recommendation:** **Identificador curto aleatório em coluna `public_id` com índice único** (nanoid v3 CJS ou util base62 com `crypto`), gerado no pré-cadastro e imutável. Atende "URL curta e única sem conflito" e desacopla do PK interno.

**Decision:** A (`public_id` curto aleatório, coluna única, retry em colisão)

**Libraries:** `nanoid@^3` (CommonJS — a v5 é ESM-only e quebraria o build CJS do NestJS). Fixado em `library-refs.md` (resolve OQ-1).

---

## TD-08: Ciclo de Status do Vídeo e Tratamento de Falha no Processamento

**Scope:** Backend

**Capability:** Pré-cadastro automático do vídeo como rascunho ao iniciar o upload

**Context:** Ao iniciar o upload, o vídeo é pré-cadastrado como rascunho; depois passa por processamento até ficar pronto — ou falhar. É preciso definir os estados, as transições e o que acontece quando o FFmpeg/worker falha (o README exige tratar a falha explicitamente). O ciclo é refletido no banco.

**Options:**

### Option A: Máquina de estados `draft → processing → ready | failed`, com retry/backoff da fila e estado `failed` terminal-recuperável
- `draft`: criado ao iniciar o upload (antes dos bytes). Ao concluir o upload, a API enfileira o job e move para `processing`. O worker, ao terminar com sucesso (metadados + thumbnail persistidos), move para `ready`. Em erro, o BullMQ tenta novamente (`attempts` + `backoff`); esgotadas as tentativas, `@OnQueueFailed` marca o vídeo como `failed` com uma mensagem de erro persistida. `failed` pode ser reprocessado (re-enfileirar).
- **Pros:** Estados mínimos e claros; mapeiam direto aos requisitos; retry/backoff nativos do BullMQ (TD-01); falha observável e recuperável; idempotência por `videoId`/job.
- **Cons:** Requer cuidado de idempotência (reentrega de job não deve duplicar thumbnails) e transições atômicas no banco.

### Option B: Apenas `draft/ready` (sem `processing`/`failed` explícitos)
- Menos estados.
- **Pros:** Modelo mais simples.
- **Cons:** Não expressa "processando" nem "erro" — o README pede o ciclo com falha explícito; impossível distinguir travado de pronto; reprova o critério de aceite do ciclo de status.

**Recommendation:** **Máquina de estados `draft → processing → ready | failed`** com retry/backoff do BullMQ e `failed` persistindo o erro e permitindo reprocesso. Cobre o pré-cadastro como rascunho, o processamento assíncrono e o tratamento de falha exigidos. Enum e transições exatas no Data Model do `plan-build`.

**Decision:** A (`draft → processing → ready | failed`, com retry/backoff e falha recuperável)

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|----------------|--------|
| TD-01 | Backend | Tecnologia da fila | BullMQ (Redis) via `@nestjs/bullmq` | A (BullMQ/Redis) |
| TD-02 | Cross-layer | Estratégia de upload de 10GB | Presigned Multipart direto ao storage | A (Presigned Multipart) |
| TD-03 | Backend | Cliente e layout do object storage | AWS SDK v3 + presigner + lib-storage, chaves por `videoId` | A (AWS SDK v3) |
| TD-04 | Backend | Worker e extração de metadados | Container separado + `child_process` (ffprobe/ffmpeg) | A (worker separado) |
| TD-05 | Backend | Geração de thumbnail | Frame único em offset relativo (ffmpeg) | A (frame único) |
| TD-06 | Cross-layer | Streaming e download | Presigned GET direto do storage (range/206, `Content-Disposition`) | A (direto do storage) |
| TD-07 | Backend | URL única por vídeo | `public_id` curto aleatório, coluna única | A (nanoid/base62) |
| TD-08 | Backend | Ciclo de status e falha | `draft → processing → ready\|failed`, retry/backoff | A (máquina de estados) |
