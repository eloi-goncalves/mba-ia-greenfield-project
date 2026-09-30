# Execution Plan — Phase #02 — Planejamento (Pipeline)

> **Camada 1 (meta-plano).** Este documento **orienta um agente de IA** a conduzir a pipeline de planejamento da Fase 03. Ele **não** é um artefato oficial. Os artefatos oficiais vivem em `docs/phases/phase-03-videos/`. Antes de agir, o agente **deve** reconsultar `docs/instructions/readme.md` e o `.claude/skills/plan-pipeline/SKILL.md`.

---

## Objetivo do Meta-Plano

Ensinar o agente a percorrer a pipeline de planejamento — `plan-context` → `plan-validate` → `plan-resolve` → `plan-build` → (`plan-test-specs` opcional) — iterando `validate ↔ resolve` até `validation.md` fechar em **`status: clean`**, e produzindo um plano executável completo.

## Objetivo da Execução

Gerar, na pasta `docs/phases/phase-03-videos/`, os artefatos oficiais:

- `context.md` (plan-context)
- `validation.md` com `status: clean` (plan-validate)
- `library-refs.md` (plan-resolve — esperado nesta fase por causa de storage/fila/FFmpeg)
- `phase-03-videos.md` — o plano (plan-build), com SIs, Technical Specifications, Dependency Map e Deliverables
- (opcional) specs de teste via `plan-test-specs`, se o plano emitir placeholders

## Contexto Acadêmico

"A Fase 03 é grande; o plano é o que segura." Quanto melhores as decisões e o plano (SIs bem fatiados, contratos e eventos definidos), mais limpa a implementação. O README manda **gastar tempo no planejamento**.

## Contexto Técnico

- Entrada principal: o documento de decisões `docs/decisions/technical-decisions-phase-03-videos.md` (produzido no meta-plano #01).
- A fila introduz **Events/Messages** nas Technical Specifications — o README exige essa seção explicitamente.
- Use `docs/phases/phase-02-auth/` como referência de formato de pasta e de plano.

## Instruções Oficiais que Devem Ser Respeitadas

- `docs/instructions/readme.md` — **Requisitos → 2. Planejamento (pipeline)**, **Critérios de Aceite → Decisões e planejamento**, **Reprova automática** (plano sem SIs/Technical Specs ou `validation.md` que não fecha em `clean`).
- `.claude/skills/plan-pipeline/SKILL.md` e as skills de cada estágio (`plan-context`, `plan-validate`, `plan-resolve`, `plan-build`, `plan-test-specs`).
- Convenções compartilhadas da pipeline: `sources_mtime` (staleness aborta com comando explícito), gate `status: clean|dirty`, IDs de issues, abort-with-command.

## Pré-condições

- Meta-plano #01 concluído: `technical-decisions-phase-03-videos.md` no formato oficial, decisões fechadas.
- Branch `feature/phase-03-videos` ativa.

## Workflow Oficial (posição desta etapa)

```
research → ► plan-context → plan-validate → plan-resolve → plan-build → (plan-test-specs) ◄ → implement
```

## Skills Obrigatórias

| Estágio | Skill | Artefato gerado | Observações |
|---------|-------|-----------------|-------------|
| Contexto | `plan-context` | `context.md` | Consolidador puro; **não** detecta issues; aborta em violação dura (doc de fase ausente/duplicado) |
| Validação | `plan-validate` | `validation.md` | Regenera issues por categoria + veredito `clean`/`dirty` |
| Resolução | `plan-resolve` | edita decisões + `context.md` + `validation.md` + `library-refs.md` | Fixa libs confirmadas via **context7** |
| Build | `plan-build` | `phase-03-videos.md` | **Hard-block** se `validation.md` não estiver `clean` |
| Test specs (opcional) | `plan-test-specs` | specs em `nestjs-project/specs/` | Só dispara se o plano emitir placeholders (`test_specs_aware`) |

- **context7 (MCP)** é obrigatório no `plan-resolve` para fixar as libs novas (cliente S3/MinIO, driver da fila, wrapper FFmpeg) em `library-refs.md`, na versão instalada.

## Artefatos Oficiais (pasta da fase)

```
docs/phases/phase-03-videos/
├── context.md              ← plan-context
├── validation.md           ← plan-validate (precisa fechar em clean)
├── library-refs.md         ← plan-resolve (libs novas fixadas via context7)
├── phase-03-videos.md      ← plan-build (o plano)
└── progress.md             ← criado/atualizado na fase de implementação (#03)
```

**Formato obrigatório do plano `phase-03-videos.md`:**

- **Step Implementations** `SI-03.1`, `SI-03.2`, … — cada SI com Description, Technical actions, Tests (quando aplicável), Dependencies, Acceptance criteria.
- **Technical Specifications**: **Data Model**, **API Contracts**, **Authorization Matrix**, **Error Catalog** e **Events/Messages** (obrigatório por causa da fila).
- **Dependency Map** e **Deliverables**.

## Estratégia de Execução

1. `plan-context` sobre a Fase 03 → consolida `project-plan.md` + decisões da fase + fases anteriores + testing guide em um `context.md` enxuto.
2. `plan-validate` → gera `validation.md` com issues (inconsistências, decisões faltando, gaps de dependência, etc.).
3. **Iterar** `plan-resolve` ↔ `plan-validate` até `status: clean`. O `plan-resolve` pergunta ao usuário (em lote), aplica decisões ao doc de decisões, faz patch no `context.md` e fixa libs em `library-refs.md`.
4. `plan-build` → gera `phase-03-videos.md` completo (só roda com `validation.md` clean).
5. Se o plano emitir placeholders de test specs, rodar `plan-test-specs`.
6. Revisar criticamente cada saída — "plano frouxo gera implementação frouxa".

## Passo a Passo

1. **plan-context** → `context.md`. Verifique `sources_mtime` e que o doc de decisões da fase existe.
2. **plan-validate** → `validation.md`. Leia as issues por categoria (`IC`, `AMB`, `MD`, `DG`, `ICC`, `OQ`, …).
3. **plan-resolve** → resolva as pendências apontadas; fixe libs novas em `library-refs.md` via **context7**; faça patch no `context.md` e no doc de decisões.
4. **plan-validate** novamente → repita 3–4 até `status: clean` e `issue_count: 0`.
5. **plan-build** → `phase-03-videos.md` com SIs SI-03.x + Technical Specifications (incl. **Events/Messages**) + Dependency Map + Deliverables.
6. **(opcional) plan-test-specs** se houver `**Test Specs:**` em algum SI.
7. **Revisão crítica** do plano inteiro; registrar em `history.md` e `delivery.md`.

## Regras de Investigação

- Respeite `sources_mtime`: se um artefato estiver **stale**, **não** auto-regenere — aborte com o comando indicado e regenere o contexto explicitamente.
- Não pule de `plan-context` direto para `plan-build`; o gate `clean` é obrigatório.

## Regras de Implementação

- **Nenhum código de produção.** Esta etapa produz apenas artefatos de planejamento.

## Regras de Git

- Commits incrementais na `feature/phase-03-videos` (ex.: `docs(plan): context/validation/plano da fase 03`).
- Nunca na `main`.

## Testes

- Não há execução de testes de código aqui. Se `plan-test-specs` rodar, ele apenas **gera specs** (arquivos de planejamento de teste), não os executa.

## Validação

- `validation.md` com `status: clean` e `issue_count: 0`.
- `phase-03-videos.md` contém SIs SI-03.x, todas as Technical Specifications (Data Model, API Contracts, Authorization Matrix, Error Catalog, **Events/Messages**), Dependency Map e Deliverables.
- `library-refs.md` presente com as libs novas fixadas (esperado nesta fase).

## Evidências

- Os cinco artefatos da pasta da fase versionados.
- O frontmatter de `validation.md` mostrando `status: clean`.

## Critérios de Aceitação (desta etapa)

- [ ] `context.md`, `validation.md` (clean), `library-refs.md`, `phase-03-videos.md` presentes.
- [ ] Plano no formato do projeto (SIs + Technical Specs + Dependency Map + Deliverables).
- [ ] **Events/Messages** presente (fila).
- [ ] Libs confirmadas via context7 em `library-refs.md`.

## Tratamento de Bloqueios

Registre como `pendente` quando: `validation.md` não fecha em `clean` após iterações por falta de decisão essencial; conflito entre decisão da fase e restrição herdada (`ICC`) sem resolução segura; lib sem doc confiável via context7.

## Atualização do Histórico

`history.md`: data, etapa (planejamento), artefatos gerados, número de iterações validate↔resolve, veredito final, status.

## Atualização do Delivery

`delivery.md`: marque o planejamento como entregue, apontando os artefatos e o veredito `clean`.

## Definition of Done (desta etapa)

Pipeline completa, `validation.md` em `clean`, plano executável revisado. Só então avance para `execution_plan_phase#03-implementacao.md`.

## Condições para Interromper a Execução

- `validation.md` não fecha em `clean` (não implemente — **reprova automática** se prosseguir).
- Plano sem SIs ou sem Technical Specifications.
- Qualquer bloqueio de decisão remanescente.

---

**Anterior:** [execution_plan_phase#01-research.md](execution_plan_phase%2301-research.md) · **Próximo:** [execution_plan_phase#03-implementacao.md](execution_plan_phase%2303-implementacao.md)
