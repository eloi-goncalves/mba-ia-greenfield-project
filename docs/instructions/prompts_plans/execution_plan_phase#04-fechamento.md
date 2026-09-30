# Execution Plan — Phase #04 — Fechamento (Definition of Done)

> **Camada 1 (meta-plano).** Este documento **orienta um agente de IA** a fechar a Fase 03: garantir a Definition of Done, atualizar a documentação de IA, revisar os Critérios de Aceite item a item e concluir o Git Flow. Ele **não** é um artefato oficial. Antes de agir, o agente **deve** reconsultar `docs/instructions/readme.md`.

---

## Objetivo do Meta-Plano

Ensinar o agente a validar a entrega inteira contra a lista única de avaliação do README, fechar a Definition of Done técnica e preparar o merge conforme Git Flow — sem pular nenhum guardrail de reprova automática.

## Objetivo da Execução

- Definition of Done completa: suíte relevante + suíte completa verdes, `npx tsc --noEmit` código 0, `npm run lint` passando.
- `CLAUDE.md` (raiz e/ou `nestjs-project/`, ou o equivalente da ferramenta) atualizado com a seção de vídeos, **coerente com o código**.
- Revisão dos Critérios de Aceite, item a item, antes do push.
- Git Flow concluído (trabalho em `feature/*` a partir de `dev`; sem commit na `main`).

## Contexto Acadêmico

"Fechamento. Garanta a Definition of Done (testes + tsc + lint), atualize o CLAUDE.md e revise os Critérios de Aceite item a item antes do push." Documentação que cite arquivos ou comportamentos inexistentes **reprova**.

## Instruções Oficiais que Devem Ser Respeitadas

- `docs/instructions/readme.md` — **Requisitos → 4. Atualização da documentação de IA**, **Critérios de Aceite** (lista completa), **Reprova automática**, **Ordem de execução sugerida → 5. Fechamento**.
- `CLAUDE.md` (raiz) — **Definition of Done (Technical)**, **Git Conventions**, **Testing Policy**.

## Pré-condições

- Meta-plano #03 concluído: todos os SIs implementados, testes verdes por SI, `progress.md` completo.
- Branch `feature/phase-03-videos` com o trabalho.

## Workflow Oficial (posição desta etapa)

Fechamento pós-`implement`. Nenhuma etapa do workflow pode ter sido pulada — confirme que existem: documento de decisões, `context.md`, `validation.md` (clean), `library-refs.md`, `phase-03-videos.md`, `progress.md`.

## Definition of Done (Technical) — verificação obrigatória

Execute e garanta que **todos** passam (no ambiente do projeto, respeitando Docker/serviços):

```bash
cd nestjs-project
npm test              # suíte unit + integração
npm run test:e2e      # e2e (supertest)
npx tsc --noEmit      # deve sair com código 0
npm run lint          # deve passar
```

- Qualquer falha → a fase **não está pronta**; volte ao #03 e corrija a causa raiz. **Não** deixe débito.

## Revisão dos Critérios de Aceite (checklist único do README)

**Decisões e planejamento**
- [ ] `technical-decisions-phase-03-videos.md` com decisões em aberto resolvidas e justificadas (fila, upload, streaming, processamento/thumbnail, ciclo de status).
- [ ] Pasta `docs/phases/phase-03-videos/` com `context.md`, `validation.md` (status `clean`), `phase-03-videos.md`, `progress.md` e `library-refs.md`.
- [ ] Plano no formato do projeto: SIs `SI-03.x`, Technical Specifications (Data Model, API Contracts, Authorization Matrix, Error Catalog, **Events/Messages**), Dependency Map e Deliverables.

**Implementação — feature**
- [ ] Upload de até 10GB sem travar a API, com pré-cadastro como rascunho.
- [ ] Processamento automático: duração/metadados + thumbnail.
- [ ] URL única por vídeo, sem conflito.
- [ ] Streaming funcionando (sem exigir download completo) e download disponível.
- [ ] Ciclo de status (rascunho → processando → pronto/erro) no banco.

**Implementação — infraestrutura e qualidade**
- [ ] Object storage, fila e worker subindo via `docker compose` junto com o backend.
- [ ] Migration cria a tabela de vídeos; entidade ligada ao canal.
- [ ] Testes nos níveis adequados, verdes (`npm test` e `npm run test:e2e`).
- [ ] Definition of Done completa: suíte verde + `npx tsc --noEmit` (código 0) + `npm run lint`.
- [ ] Git Flow respeitado (trabalho em `feature/*` a partir de `dev`, sem commit direto na `main`).

**Documentação e ferramenta**
- [ ] `CLAUDE.md` (ou equivalente) atualizado com a seção de vídeos, coerente com o código.
- [ ] Se usou outra ferramenta: fundação de IA portada e artefatos da fase no mesmo formato.

## Guardrails de Reprova Automática (verificação final)

- [ ] Nenhuma etapa do workflow foi pulada (research, planejamento, implementação e seus artefatos existem).
- [ ] Plano tem SIs e Technical Specifications; `validation.md` fecha em `clean`.
- [ ] O upload de 10GB **não** passa pela API de forma que trave o sistema.
- [ ] Fila, worker e storage **reais** sobem no Compose.
- [ ] `tsc` sem erro, lint OK, suíte verde.
- [ ] Nenhum commit direto na `main`.
- [ ] `CLAUDE.md`/equivalente **coerente** com o código (sem citar arquivos/comportamentos inexistentes).

## Passo a Passo

1. Rodar a Definition of Done completa (comandos acima) e capturar evidências.
2. Atualizar `CLAUDE.md` (raiz e/ou `nestjs-project/`) com a seção de vídeos: módulo, endpoints, fila/worker e storage — refletindo o **estado real** do código.
3. Revisar o `progress.md` (todos os SIs `completed`, testes registrados).
4. Percorrer o checklist de Critérios de Aceite e os guardrails de reprova, item a item.
5. Atualizar `history.md` (fechamento) e `delivery.md` (status final por requisito).
6. **Git Flow:** garantir commits na `feature/phase-03-videos`; abrir PR/merge para `dev` (nunca direto na `main`). Push apenas após autorização do usuário (operação que afeta o remoto).

## Regras de Git (fechamento)

- Merge segue Git Flow: `feature/phase-03-videos` → `dev`. `dev` → `main` só quando estável e com autorização.
- **Nunca** commite direto na `main` (reprova automática).
- Push/merge para o remoto: peça confirmação explícita ao usuário antes (ação difícil de reverter).

## Evidências

- Saída de `npm test`, `npm run test:e2e`, `npx tsc --noEmit`, `npm run lint`.
- `docker compose ps` com todos os serviços (incl. storage/fila/worker) saudáveis.
- Diff do `CLAUDE.md` mostrando a seção de vídeos coerente com o código.

## Critérios de Aceitação (desta etapa)

- [ ] Definition of Done completa e evidenciada.
- [ ] Todos os Critérios de Aceite do README satisfeitos.
- [ ] Nenhum guardrail de reprova violado.
- [ ] `CLAUDE.md` atualizado e coerente.
- [ ] Git Flow respeitado.

## Tratamento de Bloqueios

Registre como `pendente` quando: a DoD não fecha (teste/tsc/lint) sem correção segura; o `CLAUDE.md` não pode ser mantido coerente sem revisitar o código; conflito de merge que exija decisão do usuário.

## Atualização do Histórico

`history.md`: entrada de fechamento com o resultado da DoD, o checklist de aceite e o status final (`executada`).

## Atualização do Delivery

`delivery.md`: status final de cada requisito (Requisito → Artefato → Implementação → Teste → Evidência → Status), com tudo `entregue` ou `pendente` justificado.

## Definition of Done (desta etapa)

DoD técnica verde, aceite revisado item a item, documentação de IA coerente, Git Flow pronto para merge em `dev`. A Fase 03 está concluída.

## Condições para Interromper a Execução

- Qualquer item da DoD falhando.
- Qualquer guardrail de reprova automática violado.
- Inconsistência entre `CLAUDE.md` e o código.

---

**Anterior:** [execution_plan_phase#03-implementacao.md](execution_plan_phase%2303-implementacao.md) · **Índice:** [README.md](README.md)
