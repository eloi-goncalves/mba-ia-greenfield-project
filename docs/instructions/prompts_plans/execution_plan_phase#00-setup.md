# Execution Plan — Phase #00 — Setup do Ambiente

> **Camada 1 (meta-plano).** Este documento **orienta um agente de IA** a preparar o ambiente antes de iniciar o desafio acadêmico da Fase 03. Ele **não** é um artefato oficial do desafio. Antes de agir, o agente **deve** reconsultar `docs/instructions/readme.md`.

---

## Objetivo do Meta-Plano

Ensinar o agente a deixar o repositório em um estado verificável e pronto para o workflow: backend no ar, banco migrado, suíte de testes verde, Git Flow estabelecido e fundação de IA confirmada para a ferramenta escolhida.

## Objetivo da Execução

Ao final desta etapa, o agente deve ter:

- O backend (`nestjs-project/`) subindo via Docker Compose com Postgres e Mailpit.
- Dependências instaladas e migrations aplicadas.
- A suíte de testes atual **verde** (linha de base antes de qualquer alteração).
- A branch `dev` criada a partir de `main`, e a branch de trabalho `feature/phase-03-videos` criada a partir de `dev`.
- A fundação de IA confirmada (Claude Code) ou **portada** para a ferramenta escolhida.

## Contexto Acadêmico

O desafio é a **Fase 03 — Upload e Processamento de Vídeos**. As Fases 01 e 02 (backend e frontend) já estão entregues. A Fase 03 é um desafio de **backend**: API, worker, infraestrutura e artefatos do processo. O frontend em `next-frontend/` está **fora de escopo**.

## Contexto Técnico (estado real do repositório)

- Monorepo com `nestjs-project/` (NestJS 11 + TypeORM + PostgreSQL 17) e `next-frontend/` (fora de escopo).
- Infra atual em `nestjs-project/compose.yaml`: apenas `nestjs-api`, `db` (postgres:17) e `mailpit`. **Não há** storage, fila ou worker ainda.
- Módulos existentes: `auth/`, `users/`, `channels/`, `mail/`, `common/`, `config/`, `database/`, `swagger/`.
- Cada usuário tem um canal (1:1). Os vídeos da Fase 03 pertencem a um canal.
- Fundação de IA em `.claude/` (skills, sub-agents, rules), `CLAUDE.md`, `.mcp.json` — específica do **Claude Code**.
- MCP configurado: `postgres` e (conforme README) `context7`. Ver `.mcp.json` / `.mcp.json.example`.
- Scripts relevantes de `nestjs-project/package.json`: `test`, `test:integration`, `test:e2e`, `lint`, `migration:run`, `migration:generate`, `seed`, `build`.

## Instruções Oficiais que Devem Ser Respeitadas

- `docs/instructions/readme.md` — seções **Ordem de execução sugerida** (item 1, Setup) e **Dicas finais**.
- `CLAUDE.md` (raiz) — **Docker Networking** (usar o nome do serviço do Compose como host, nunca `localhost`), **Git Conventions**, **Definition of Done**.

## Pré-condições

- Fork público do repositório base `https://github.com/devfullcycle/mba-ia-greenfield-project` já clonado localmente em `/home/user/dev/mba-ia-greenfield-project/`.
- Docker e Docker Compose disponíveis.
- Ferramenta agêntica escolhida (Claude Code recomendado).

## Estado Esperado do Repositório (antes desta etapa)

- Branch `main` presente; **sem** branch `dev` ainda (confirme com `git branch -a`).
- Working tree sem alterações funcionais pendentes do usuário (preserve quaisquer arquivos em progresso — **nunca** descarte).

## Passo a Passo

> Execute na ordem. Cada passo tem uma verificação objetiva. Não avance sem a evidência do passo anterior.

### 1. Verificar o estado do Git (não destrutivo)

```bash
git status
git branch -a
git --no-pager log --oneline -10
```

- **Nunca** use `git reset --hard`, `git clean -fd`, `git checkout -- .` ou equivalentes destrutivos.
- Preserve arquivos não rastreados que possam ser trabalho em progresso.

### 2. Confirmar/portar a fundação de IA

- **Se usar Claude Code:** confirme a presença de `.claude/skills/`, `.claude/agents/`, `.claude/rules/`, `CLAUDE.md` e `.mcp.json` (copie de `.mcp.json.example` se necessário, sem commitar segredos).
- **Se usar outra ferramenta (Gemini CLI, Codex, etc.):** é responsabilidade do agente **portar a fundação antes de começar** — o arquivo de instruções equivalente (ex.: `GEMINI.md`, `AGENTS.md`), o mecanismo equivalente de skills/sub-agents (ou conduzir o workflow manualmente) e a configuração de MCP (Postgres, context7). **Usar outra ferramenta sem portar a fundação reprova.**

### 3. Subir o backend

```bash
cd nestjs-project
docker compose up -d
```

- Verificação: `docker compose ps` mostra `nestjs-api`, `db` e `mailpit` saudáveis.
- Lembre-se do **Docker Networking**: dentro dos containers, o host do banco é `db` (nome do serviço), nunca `localhost`.

### 4. Instalar dependências e aplicar migrations

```bash
# dentro do container da API (preferível) ou no host, conforme a convenção do projeto
npm install
npm run migration:run
```

- Verificação: migrations aplicadas sem erro; tabelas das Fases 01–02 presentes no banco.

### 5. Rodar a suíte atual (linha de base)

```bash
npm test
npm run test:e2e
```

- Verificação: **suíte verde** antes de qualquer mudança. Registre a contagem de testes como evidência (linha de base).
- Se a suíte já estiver vermelha sem nenhuma alteração sua → **BLOQUEADO** (ver seção Tratamento de Bloqueios).

### 6. Estabelecer o Git Flow

O README exige branches de `feature/*` saindo de `dev` e voltando para `dev`, nunca commitando direto na `main`. A branch `dev` **ainda não existe** — crie-a:

```bash
git checkout main
git pull origin main
git checkout -b dev
git push -u origin dev
git checkout -b feature/phase-03-videos
```

- Verificação: `git branch` mostra `feature/phase-03-videos` como branch atual, criada a partir de `dev`.
- **Guardrail:** nunca commite diretamente na `main`.

## Regras de Investigação

- Não invente comandos, arquivos ou dependências. Confirme cada fato via repositório antes de agir.
- Se algo divergir do descrito aqui (ex.: infra já alterada, suíte vermelha), investigue a causa antes de prosseguir.

## Regras de Git

- Trabalhe sempre em `feature/phase-03-videos` (a partir de `dev`).
- Commits curtos e descritivos, focados no "porquê".
- `git status` / `git diff` antes e depois de mudanças relevantes.
- Nenhuma operação destrutiva sem autorização explícita do usuário.

## Testes

- Nesta etapa, os testes servem apenas para estabelecer a **linha de base verde**. Não crie testes novos aqui.

## Validação

- `docker compose ps` — serviços saudáveis.
- `npm test` e `npm run test:e2e` — verdes.
- `git branch -a` — `dev` e `feature/phase-03-videos` existentes.

## Evidências

Registre em `docs/instructions/history.md`:

- Saída de `docker compose ps`.
- Contagem de testes verdes (linha de base).
- Confirmação das branches criadas.
- Ferramenta de IA usada e, se aplicável, o que foi portado.

## Critérios de Aceitação (desta etapa)

- [ ] Backend, Postgres e Mailpit subindo via Compose.
- [ ] Migrations aplicadas; banco íntegro.
- [ ] Suíte atual verde (linha de base documentada).
- [ ] `dev` e `feature/phase-03-videos` criadas; `main` intocada.
- [ ] Fundação de IA confirmada ou portada.

## Tratamento de Bloqueios

Pare e registre como `pendente` em `docs/instructions/history.md` quando:

- A suíte atual falha sem alteração sua e sem correção segura.
- Docker/Compose não sobe por dependência ausente no ambiente.
- A fundação de IA não pode ser portada de forma confiável para a ferramenta escolhida.

Registre: o que falta, por que é necessário, qual decisão está bloqueada e o que se precisa para continuar. **Não** mascare bloqueios.

## Atualização do Histórico

Atualize `history.md` com data, etapa (Setup), entendimento, execução, arquivos/branches, testes, evidências e status (`executada`/`pendente`).

## Atualização do Delivery

Nesta etapa não há requisito funcional entregue; registre em `delivery.md` a linha de "Pré-condição: ambiente pronto" com status e evidência.

## Definition of Done (desta etapa)

Ambiente reproduzível, suíte verde, Git Flow estabelecido e fundação de IA pronta. Só então avance para `execution_plan_phase#01-research.md`.

## Condições para Interromper a Execução

- Qualquer bloqueio acima.
- Ausência de fork/clone válido.
- Impossibilidade de subir a infra base.

---

**Próximo meta-plano:** [execution_plan_phase#01-research.md](execution_plan_phase%2301-research.md)
