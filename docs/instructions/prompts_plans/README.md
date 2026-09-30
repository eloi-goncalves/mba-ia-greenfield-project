# Prompts / Planos de Execução — Camada de Meta-Planejamento

> **O que é esta pasta.** Aqui vivem os **meta-planos** (também chamados de *prompts/plans*) que **orientam agentes de IA** a executar a **Fase 03 — Upload e Processamento de Vídeos** do projeto StreamTube. Estes documentos **não são** os artefatos oficiais do desafio; eles ensinam um agente a produzir corretamente esses artefatos oficiais, seguindo o workflow do projeto.

---

## 1. As duas camadas (não confundir)

Existem dois níveis de planejamento neste repositório. Eles são diferentes e **nunca** devem ser misturados.

| | **Camada 1 — Meta-planos (esta pasta)** | **Camada 2 — Execução oficial** |
|---|---|---|
| **Pergunta que responde** | "Como orientar um agente de IA a executar a Fase 03 corretamente?" | "Como o agente efetivamente executa o desafio e entrega os artefatos?" |
| **Local** | `docs/instructions/prompts_plans/` | `docs/decisions/`, `docs/phases/phase-03-videos/`, `nestjs-project/` |
| **Natureza** | Orquestração / instruções para o agente | Artefatos oficiais exigidos pelos Critérios de Aceite |
| **Autoridade** | Subordinado ao README oficial e às skills | Definido pelo README oficial do desafio |

O fluxo mental correto é:

```
README OFICIAL DO DESAFIO  (docs/instructions/readme.md)
        │  define O QUE entregar e COMO é o workflow
        ▼
META-PLANOS  (esta pasta)
        │  ensinam o agente a percorrer o workflow
        ▼
AGENTE EXECUTOR
        │  consulta README + skills + meta-planos
        ▼
WORKFLOW OFICIAL
        │  research → plan-context → plan-validate → plan-resolve → plan-build → (plan-test-specs) → implement
        ▼
ARTEFATOS OFICIAIS  (docs/decisions/… e docs/phases/phase-03-videos/…)
        ▼
RASTREABILIDADE  (history.md + delivery.md em docs/instructions/)
```

**Regra absoluta:** os meta-planos **não substituem, não renomeiam e não reinterpretam** os artefatos oficiais. Se houver conflito, o README oficial vence.

---

## 2. Ordem de precedência (em caso de conflito)

1. Regras oficiais do desafio
2. `docs/instructions/readme.md`
3. Seção **Dicas finais** do `readme.md`
4. Skills oficiais do projeto (`.claude/skills/`) e rules (`.claude/rules/`)
5. Artefatos e documentação oficial existente (`docs/`, `CLAUDE.md`)
6. Código existente (`nestjs-project/`)
7. Estes meta-planos
8. Convenções genéricas
9. Suposições do agente

---

## 3. Índice dos meta-planos

Leia e execute na ordem. Cada meta-plano é autossuficiente, mas **o agente deve sempre reconsultar o `readme.md` oficial antes de agir**.

| Ordem | Documento | Objetivo | Etapa acadêmica coberta |
|-------|-----------|----------|--------------------------|
| 0 | [execution_plan_phase#00-setup.md](execution_plan_phase%2300-setup.md) | Preparar o ambiente: fork, subir backend, migrations, suíte verde, Git Flow (`dev`), fundação de IA | Pré-condição (Setup) |
| 1 | [execution_plan_phase#01-research.md](execution_plan_phase%2301-research.md) | Fechar as decisões técnicas em aberto (fila, upload, streaming, processamento, ciclo de status) | `research` → `technical-decisions-phase-03-videos.md` |
| 2 | [execution_plan_phase#02-planejamento.md](execution_plan_phase%2302-planejamento.md) | Rodar a pipeline de planejamento até o plano final | `plan-context` → `plan-validate` → `plan-resolve` → `plan-build` → (`plan-test-specs`) |
| 3 | [execution_plan_phase#03-implementacao.md](execution_plan_phase%2303-implementacao.md) | Implementar SI a SI: módulo de vídeos, infra (storage/fila/worker), migration, testes | `implement` → código + `progress.md` |
| 4 | [execution_plan_phase#04-fechamento.md](execution_plan_phase%2304-fechamento.md) | Garantir Definition of Done, atualizar CLAUDE.md, revisar Critérios de Aceite, Git Flow de merge | Fechamento |

---

## 4. Rastreabilidade (history.md e delivery.md)

Em **`docs/instructions/`** existem dois arquivos de rastreamento desta iniciativa:

- [`history.md`](../history.md) — histórico global cronológico de cada execução relevante (data, etapa, entendimento, objetivo, arquivos, testes, evidências, bloqueios, status `pendente`/`executada`).
- [`delivery.md`](../delivery.md) — matriz de rastreabilidade Requisito → Artefato oficial → Implementação → Teste → Evidência → Status.

Eles **complementam**, e não substituem, os artefatos oficiais de progresso (`docs/phases/phase-03-videos/progress.md`).

---

## 5. Guardrails de reprova automática (resumo)

Estes itens **reprovam** a entrega. Todo meta-plano os reforça no ponto aplicável:

- Pular qualquer etapa do workflow (research, planejamento, implementação) ou seus artefatos.
- Plano sem SIs ou sem Technical Specifications; `validation.md` que não fecha em `clean`.
- Passar o arquivo de 10GB pela API de forma que trave o sistema.
- Não ter fila, worker e storage reais subindo no Compose.
- `tsc` com erro, lint quebrado ou suíte vermelha.
- Commit direto na `main`.
- `CLAUDE.md`/equivalente inconsistente com o código.
- Usar outra ferramenta sem portar a fundação de IA para a convenção dela.

---

_Idioma oficial desta camada: **português**. Termos técnicos, nomes de arquivos, comandos, classes e APIs permanecem em seu formato original._
