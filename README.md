# Ziggy

Ziggy is a governed agent runtime for everyday work.

It is risk-first, human-in-the-loop by default, local-first with optional external workers, and fully inspectable from policy to artifact logs. Ziggy is meant to feel like a trustworthy daily system you rely on, not a black-box autonomous agent.

## Product Direction

Ziggy is:

- a governed agent runtime
- risk-first, not capability-first
- human-reviewed by default
- local-first with room for optional external workers
- inspectable and auditable end to end

Ziggy is not:

- an autonomous free-running agent
- a plugin marketplace
- a browser automation bot
- a black-box AI assistant

## What It Can Do Today

- review unread email and draft replies for approval
- review calendar context and prepare meeting notes
- propose and apply approved file organization inside an allowed root

Every side effect remains explicit, reviewed, logged, and scoped.

## Quick Start

### Prerequisites

- Node.js 22.5+
- pnpm 10+
- Optional: [Ollama](https://ollama.ai) for local planning

### Install

```bash
pnpm install
```

### Initialize the database

```bash
ZIGGY_DB_PATH=./data/ziggy.db ZIGGY_POLICY_DIR=./policy \
  node_modules/.bin/tsx packages/orchestrator/src/scripts/db-init.ts
```

### Optional demo data

```bash
ZIGGY_DB_PATH=./data/ziggy.db ZIGGY_POLICY_DIR=./policy \
  node_modules/.bin/tsx packages/orchestrator/src/scripts/db-seed.ts
```

### Start Ziggy

```bash
pnpm dev
```

Then open [http://localhost:3737](http://localhost:3737).

## Repository Structure

```text
apps/
  web/                  Next.js UI and API routes

packages/
  shared/               Types, schemas, and governance models
  policy/               YAML loading, validation, and local policy helpers
  models/               Local planning model integration
  tools/                Narrow tool wrappers with explicit scope checks
  memory/               Preferences and edit-derived learning signals
  orchestrator/         Run lifecycle, approvals, execution, runtime hooks

policy/
  capabilities.yaml     Current capability boundaries and path/account scope
  contexts.yaml         User-facing context hints
  preferences.yaml      Local communication and approval preferences

governance/
  risk-levels.yaml      Lightweight risk tier definitions
  capabilities.yaml     Capability-to-risk mapping
  approval-rules.yaml   Review expectations by risk or capability
  contexts.yaml         Governance context defaults
  task-templates/       Reusable task templates

docs/
  philosophy.md         Product direction and principles
  risk-model.md         Risk tiers and human-in-the-loop rationale
  architecture.md       Runtime architecture and future routing direction
```

## Runtime Shape

Run states:

```text
queued → planning → (awaiting_approval | executing) → completed
                                                    → failed
                                                    → blocked
```

Current capabilities:

| Capability | Side effects | Notes |
| --- | --- | --- |
| `email.read` | No | Read-only email summaries |
| `email.draft` | Yes | Drafts require approval |
| `calendar.read` | No | Read-only calendar context |
| `files.propose_organize` | No | Safe file organization proposal |
| `files.apply_organize` | Yes | Approved local file moves only |

## Governance Foundation

Ziggy now includes a lightweight governance layer with:

- four risk tiers: `low`, `medium`, `high`, `critical`
- task metadata for `risk_level`, `sensitivity_level`, and `allowed_capabilities`
- approval rules and context defaults in `/governance`
- placeholder runtime hooks for policy evaluation and worker routing

This is deliberate structure, not overbuilt enforcement.

## Philosophy

Read the product docs for the full rationale:

- [docs/philosophy.md](docs/philosophy.md)
- [docs/risk-model.md](docs/risk-model.md)
- [docs/architecture.md](docs/architecture.md)

## Development Notes

- `pnpm build` compiles every package and the web app
- policies and governance files are local YAML, not hidden service config
- tool calls and approval decisions are logged to the local database and run artifacts
- side effects remain bounded by explicit capability rules and approved roots
