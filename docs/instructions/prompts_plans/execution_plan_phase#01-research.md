# Execution Plan — Phase #01 — Research (Decisões Técnicas)

> **Camada 1 (meta-plano).** Este documento **orienta um agente de IA** a conduzir a etapa de `research` da Fase 03. Ele **não** é um artefato oficial. O artefato oficial produzido por esta etapa é `docs/decisions/technical-decisions-phase-03-videos.md`. Antes de agir, o agente **deve** reconsultar `docs/instructions/readme.md`.

---

## Objetivo do Meta-Plano

Ensinar o agente a rodar a skill `research` corretamente, fechando as decisões técnicas em aberto da Fase 03 com opções, trade-offs e recomendação por decisão, no formato dos documentos de decisão existentes.

## Objetivo da Execução

Produzir o artefato oficial **`docs/decisions/technical-decisions-phase-03-videos.md`** — a base que alimenta todo o planejamento.

## Contexto Acadêmico

A Fase 03 é, por definição do README, um desafio de engenharia: envolve armazenamento de arquivos grandes, processamento assíncrono em fila, worker de vídeo, streaming e infraestrutura nova em Docker. As decisões corretas aqui determinam a qualidade de todo o resto.

## Contexto Técnico

- Stack: NestJS 11 + TypeORM + PostgreSQL 17. Vídeos pertencem a um canal (`channels/`).
- Infra a construir: object storage, fila e worker (FFmpeg). A arquitetura-alvo já prevê os três (`docs/diagrams/software-arch.mermaid`, `CLAUDE.md`).
- Decisões já feitas em fases anteriores e no `project-plan.md` são **restrições** — não as reabra.

## Instruções Oficiais que Devem Ser Respeitadas

- `docs/instructions/readme.md` — seções **Escopo da Fase 03**, **Requisitos → 1. Decisões técnicas (research)**, **Dicas finais**.
- `.claude/skills/research/SKILL.md` — contrato da etapa (o que é/ não é uma Technical Decision; capability gate; formato do documento).
- `CLAUDE.md` (raiz) — **Library Documentation Lookup**: antes de decidir com qualquer biblioteca, consulte a doc oficial via **context7** e siga a versão instalada.

## Pré-condições

- Meta-plano #00 concluído (ambiente pronto, suíte verde, branch `feature/phase-03-videos`).
- Nenhum `docs/decisions/technical-decisions-phase-03-videos.md` pré-existente (se existir parcial, o agente deve lê-lo e continuar, não recriar do zero).

## Decisões em Aberto que Esta Etapa DEVE Fechar

Conforme o README (seção "Decisões que você precisa tomar e justificar na etapa de research"):

1. **Tecnologia de fila** — explicitamente "TBD" no `project-plan.md`. **É a principal decisão de stack da fase.**
2. **Estratégia de upload de 10GB sem travar** — ex.: upload direto ao storage via URL pré-assinada / multipart, em vez de passar o arquivo pela API.
3. **Como o worker roda** — processo/container separado; como extrai metadados e gera thumbnail (FFmpeg/ffprobe).
4. **Estratégia de URL única** e **estratégia de streaming** (ex.: requisições com range / `206 Partial Content`).
5. **Ciclo de status do vídeo** (rascunho → processando → pronto/erro) e o que acontece em caso de **falha** no processamento.

**Dado fixo (NÃO é decisão em aberto):** o **object storage** já é apontado para S3-compatível. Na prática: **MinIO** local em Docker (mesma API do S3), trocável por S3 em produção. O que se decide aqui é **como usá-lo** (organização de buckets/chaves, upload pré-assinado), não qual storage.

## Workflow Oficial (posição desta etapa)

```
► research ◄  → plan-context → plan-validate → plan-resolve → plan-build → (plan-test-specs) → implement
```

## Skills Obrigatórias

- **`research`** — conduz esta etapa e gera o documento de decisões.
- **context7 (MCP)** — documentação oficial das libs candidatas (fila, cliente S3, FFmpeg wrappers). Uso obrigatório antes de recomendar qualquer lib.
- Sub-agents de leitura (`.claude/agents/`) são usados **por baixo dos panos** pelas skills — não os invoque diretamente.

## Artefato Oficial

- **`docs/decisions/technical-decisions-phase-03-videos.md`**
  - Frontmatter no padrão existente: `scope_type: phase`, `related_phases: [3]`, `status: decided`, `date`, `scope_description`.
  - Uma seção por decisão (`## TD-01: …`, `## TD-02: …`) com **Scope**, **Capability** (rastreável a um bullet da Fase 03 no `project-plan.md`), **Context**, **Options** (com Pros/Cons), **Recommendation** e **Decision**.
  - Use `docs/decisions/technical-decisions-phase-02-auth.md` como referência de formato.

## Estratégia de Execução

1. Ler o escopo da Fase 03 no `docs/project-plan.md` (capabilities) e no `readme.md`.
2. Ler `docs/decisions/` existentes para não reabrir decisões já tomadas.
3. Para cada decisão em aberto, levantar 2+ opções reais, consultar **context7** para as libs envolvidas e a **versão instalada** (`nestjs-project/package.json`), documentar trade-offs e recomendar.
4. Aplicar o teste de "o que é uma Technical Decision" da skill `research`: registre apenas escolhas estratégicas/cross-component; detalhes de implementação ficam para o `implement`.
5. Garantir o **capability gate**: cada TD referencia um bullet de capability da Fase 03.

## Passo a Passo

1. **Levantar decisões** a partir das capabilities da Fase 03 (as 5 em aberto acima, no mínimo).
2. **Pesquisar opções** de fila (ex.: candidatos de mercado compatíveis com a stack), estratégia de upload (presigned/multipart/tus), streaming (range requests), processamento (FFmpeg/ffprobe), ciclo de status.
3. **Consultar context7** para cada lib candidata e conferir compatibilidade com as versões instaladas.
4. **Escrever o documento** `technical-decisions-phase-03-videos.md` no formato oficial, uma TD por decisão.
5. **Revisar criticamente**: cada recomendação tem justificativa rastreável; nenhuma decisão inventada; object storage tratado como dado (só o "como usar").
6. **Registrar** em `history.md` e atualizar `delivery.md`.

## Regras de Investigação

- Não invente libs, versões, APIs ou trade-offs. Baseie-se em context7 + versões instaladas + repositório.
- Se uma decisão não puder ser fechada por falta de informação essencial → **BLOQUEADO**.

## Regras de Implementação

- **Nenhum código de produção** é escrito nesta etapa. Apenas o documento de decisões.

## Regras de Git

- Commit do documento de decisões na branch `feature/phase-03-videos`, mensagem curta e descritiva (ex.: `docs(research): decisões técnicas da fase 03`).
- Nunca na `main`.

## Testes

- Não há testes de código nesta etapa. A "validação" é de conteúdo (ver abaixo).

## Validação

- Todas as 5 decisões em aberto estão fechadas e justificadas.
- Object storage documentado como dado (S3/MinIO), com decisão apenas de uso.
- Formato coerente com os documentos de decisão existentes.
- Cada TD rastreável a uma capability da Fase 03.

## Evidências

- O arquivo `technical-decisions-phase-03-videos.md` versionado.
- Referências de doc (context7) que embasaram cada recomendação, citadas no documento ou no `history.md`.

## Critérios de Aceitação (desta etapa)

- [ ] `technical-decisions-phase-03-videos.md` criado no formato oficial.
- [ ] Fila, upload, streaming, processamento/thumbnail e ciclo de status decididos e justificados.
- [ ] Libs confirmadas via context7 nas versões compatíveis.
- [ ] Nenhuma decisão já tomada foi reaberta.

## Tratamento de Bloqueios

Registre como `pendente` quando: requisito ambíguo sem base para decidir, conflito entre especificações, ou lib sem documentação confiável via context7. Descreva o que falta e o que destravaria.

## Atualização do Histórico

`history.md`: data, etapa (research), decisões fechadas, evidências (docs consultadas), status.

## Atualização do Delivery

`delivery.md`: marque as decisões técnicas como entregues, apontando o artefato `technical-decisions-phase-03-videos.md`.

## Definition of Done (desta etapa)

Documento de decisões completo, no formato oficial, com todas as decisões em aberto resolvidas e rastreáveis. Só então avance para `execution_plan_phase#02-planejamento.md`.

## Condições para Interromper a Execução

- Qualquer bloqueio de decisão.
- Tentativa de pular direto para o planejamento sem fechar as decisões (**reprova automática**).

---

**Anterior:** [execution_plan_phase#00-setup.md](execution_plan_phase%2300-setup.md) · **Próximo:** [execution_plan_phase#02-planejamento.md](execution_plan_phase%2302-planejamento.md)
