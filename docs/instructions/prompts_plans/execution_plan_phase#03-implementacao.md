# Execution Plan — Phase #03 — Implementação

> **Camada 1 (meta-plano).** Este documento **orienta um agente de IA** a executar a implementação da Fase 03, SI a SI, conduzida pela skill `implement`. Ele **não** é um artefato oficial. O artefato de progresso oficial é `docs/phases/phase-03-videos/progress.md`. Antes de agir, o agente **deve** reconsultar `docs/instructions/readme.md` e o plano `docs/phases/phase-03-videos/phase-03-videos.md`.

---

## Objetivo do Meta-Plano

Ensinar o agente a implementar a Fase 03 seguindo o plano como contrato: um SI por vez, rodando os testes de cada SI, só avançando com a suíte do SI verde, mantendo `progress.md` atualizado e reusando os padrões do projeto.

## Objetivo da Execução

Entregar a Fase 03 funcional:

- Módulo de vídeos no backend (`nestjs-project/src/videos/`, forma de referência: `auth/`).
- Infra nova no `compose.yaml`: **object storage (MinIO), fila e worker** subindo junto com o backend.
- Migration criando a tabela de vídeos (entidade ligada ao canal).
- Upload de até 10GB sem travar a API; processamento automático (duração/metadados + thumbnail); URL única; streaming; download; ciclo de status refletido no banco.
- Testes nos níveis adequados (unit, integração, e2e), verdes.
- `progress.md` atualizado (status + testes por SI).

## Contexto Acadêmico

"Infra real, testada." Fila, worker e storage precisam **subir no Compose e ser exercitados pelos testes** — não simule o que dá para rodar de verdade. "Continuidade, não retrabalho": reuse guard, filtro de exceções, repository, migrations e rules.

## Contexto Técnico

- Reuse o padrão do módulo `auth/` como forma. A estrutura concreta de arquivos é **decisão do plano**, não do enunciado.
- Guard JWT global, filtro de exceções de domínio, `ValidationPipe` global já existem (Fase 02) — reutilize.
- Vídeo pertence a um canal (`channels/`), relação a ser definida no Data Model do plano.
- Docker Networking: host do storage/fila/banco é o **nome do serviço do Compose**, nunca `localhost`.

## Instruções Oficiais que Devem Ser Respeitadas

- `docs/instructions/readme.md` — **Requisitos → 3. Implementação (implement)**, **Critérios de Aceite → Implementação (feature / infraestrutura e qualidade)**, **Reprova automática**.
- `.claude/skills/implement/SKILL.md` — contrato de execução (leitura sob demanda do plano, loop por SI, `progress.md`).
- `.claude/rules/` — especialmente `nestjs-*`, `typeorm-*`, `typescript-strict`, `nestjs-testing`. Skills de teste: `testing-guide-nestjs-project`.
- `CLAUDE.md` (raiz e `nestjs-project/`) — Definition of Done, Docker, Library Documentation Lookup (context7), Git Flow, Testing Policy.

## Pré-condições

- Meta-plano #02 concluído: `phase-03-videos.md` completo e `validation.md` em `clean`.
- Branch `feature/phase-03-videos` ativa; suíte base verde.

## Workflow Oficial (posição desta etapa)

```
research → plan-context → plan-validate → plan-resolve → plan-build → (plan-test-specs) → ► implement ◄
```

## Skills Obrigatórias

- **`implement`** — conduz a execução SI a SI.
- **`testing-guide-nestjs-project`** — o que testar em cada nível (unit/integração/e2e) e boas práticas por artefato.
- **context7 (MCP)** — antes de implementar com qualquer lib nova (cliente S3/MinIO, driver de fila, FFmpeg/ffprobe), consultar a doc oficial na versão instalada.
- Rules do NestJS/TypeORM aplicam-se automaticamente por `applyTo` — siga-as (separação de camadas, repository pattern, transações, controllers sem lógica de negócio, serviços propagando erros).

## Artefatos Oficiais

- **Código** em `nestjs-project/src/videos/` (+ serviços de storage/fila/worker conforme o plano).
- **Migration** em `nestjs-project/src/database/migrations/<timestamp>-CreateVideos.ts`.
- **`nestjs-project/compose.yaml`** com storage + fila + worker.
- **`docs/phases/phase-03-videos/progress.md`** — status + testes por SI (formato como na Fase 02).

## Estratégia de Execução

1. Indexar o plano (Preflight): mapear `## ` sections, listar `### SI-03.*`, ler Dependency Map, Deliverables, Error Catalog e Authorization Matrix uma vez. **Não** carregar o plano inteiro de uma vez.
2. Carregar `testing-guide-nestjs-project`.
3. Loop por SI (respeitando o Dependency Map):
   - Ler a seção do SI + Tech Specs referenciadas sob demanda.
   - Consultar context7 se houver lib nova.
   - Implementar seguindo as rules.
   - Rodar os testes do SI (unit/integração/e2e conforme a seção Tests do SI).
   - Só avançar com a suíte do SI **verde**.
   - Atualizar `progress.md` (status + testes + observações).
4. Subir a infra nova no Compose e **exercitá-la nos testes de integração/e2e** (não mockar o que roda de verdade).

## Passo a Passo

1. **Preflight** do plano (índice de seções e SIs).
2. **Infra primeiro** (conforme o plano): adicionar MinIO, fila e worker ao `compose.yaml`; validar que sobem (`docker compose up -d`) e são alcançáveis pelos nomes de serviço.
3. **Migration + entidade** de vídeos ligada ao canal (`migration:generate` → revisar → `migration:run`). Siga `typeorm-migrations` e `typeorm-entities`.
4. **Módulo de vídeos** SI a SI: upload (estratégia decidida no research — sem passar 10GB pela API), pré-cadastro como rascunho, publicação de job na fila, worker consumindo (FFmpeg/ffprobe: duração/metadados + thumbnail), URL única, streaming (range/`206`), download, ciclo de status.
5. **Testes por SI**: unit (`*.spec.ts`), integração com banco/serviços reais (`*.integration-spec.ts`), e2e (`*.e2e-spec.ts`). Rode `npm test`, `npm run test:integration`, `npm run test:e2e` conforme o nível do SI.
6. **Atualizar `progress.md`** a cada SI concluído.
7. Commits incrementais por SI na `feature/phase-03-videos`.

## Regras de Investigação

- Não invente arquivos, endpoints, eventos ou libs fora do plano. Se o plano estiver incompleto para um SI → volte ao planejamento (#02), não improvise.
- Confirme APIs de libs via context7 antes de usar.

## Regras de Implementação

- Siga as rules do projeto (camadas, repository pattern, transações, error contract herdado).
- Reuse infra existente (guard, filtro de exceções, `ValidationPipe`).
- Estratégia de upload de 10GB **nunca** passa o arquivo inteiro pela API de forma que trave o sistema (**reprova automática**).
- Streaming sem exigir download completo (range requests / `206 Partial Content`).
- `tsc --noEmit` deve permanecer em código 0 ao longo do caminho — **não** deixe erros de compilação como dívida.

## Regras de Git

- Um commit por SI (ou por conjunto coeso), mensagens curtas descritivas, na `feature/phase-03-videos`.
- `git status`/`git diff` antes e depois. Nunca na `main`. Nenhuma operação destrutiva sem autorização.

## Testes

- **Não mocke** o que dá para testar de verdade com a infra do Compose (storage, fila, worker).
- Cobertura nos níveis adequados conforme `testing-guide-nestjs-project` e as rules `nestjs-testing`.
- Cada SI só é "done" com a suíte do SI verde.

## Validação

- Cada SI concluído com testes verdes e `progress.md` atualizado.
- Infra (MinIO/fila/worker) subindo via `docker compose` e exercitada por testes.
- Migration cria a tabela de vídeos; entidade ligada ao canal.

## Evidências

- Saída dos testes por SI (contagens) em `progress.md`.
- `docker compose ps` com os novos serviços saudáveis.
- Demonstração dos fluxos (upload → processamento → pronto; streaming `206`; download) via testes e2e.

## Critérios de Aceitação (desta etapa)

- [ ] Upload de até 10GB sem travar a API; pré-cadastro como rascunho.
- [ ] Processamento automático: duração/metadados + thumbnail.
- [ ] URL única por vídeo, sem conflito.
- [ ] Streaming funcionando e download disponível.
- [ ] Ciclo de status (rascunho → processando → pronto/erro) no banco.
- [ ] Storage, fila e worker subindo via Compose.
- [ ] Migration cria a tabela de vídeos (entidade ligada ao canal).
- [ ] Testes nos níveis adequados, verdes; `progress.md` atualizado.

## Tratamento de Bloqueios

Registre como `pendente` quando: um teste obrigatório falha sem solução segura; o plano não cobre um SI necessário; a infra não sobe por dependência ausente; comportamento ambíguo sem origem rastreável ao plano/decisões.

## Atualização do Histórico

`history.md`: por marco relevante (infra no ar, worker processando, streaming), com arquivos, testes e status.

## Atualização do Delivery

`delivery.md`: para cada capability da Fase 03, aponte o SI/arquivo que a implementa, o teste que a cobre e a evidência.

## Definition of Done (desta etapa)

Todos os SIs concluídos com testes verdes, infra real no Compose, `progress.md` completo. Só então avance para `execution_plan_phase#04-fechamento.md` para a validação final.

## Condições para Interromper a Execução

- Suíte de um SI vermelha sem correção segura.
- Estratégia de upload que travaria o sistema (**reprova**).
- Falta de fila/worker/storage reais no Compose (**reprova**).
- `tsc` com erro acumulado.

---

**Anterior:** [execution_plan_phase#02-planejamento.md](execution_plan_phase%2302-planejamento.md) · **Próximo:** [execution_plan_phase#04-fechamento.md](execution_plan_phase%2304-fechamento.md)
