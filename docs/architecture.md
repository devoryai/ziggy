# Ziggy Architecture

## Overview

Ziggy is structured as a local-first runtime with explicit policy, explicit tools, and explicit approvals.

High-level flow:

1. the user submits a task
2. the runtime attaches local governance metadata
3. a planner creates a narrow execution plan
4. read-only work runs automatically
5. side-effecting work stops for approval
6. approved steps execute and artifacts are recorded

## Core Layers

### Web App

The Next.js app provides the main daily-use interface:

- task submission
- inline run feedback
- approval decisions
- run inspection
- governance and preference visibility

### Shared Models

`packages/shared` contains the core runtime contract:

- task metadata
- plan and step definitions
- run records
- governance types

This package is where the system’s language stays consistent.

### Policy and Governance

`packages/policy` loads human-readable YAML from:

- `/policy` for capability scope and user preferences
- `/governance` for risk tiers, approval rules, contexts, and templates

This keeps the control surface inspectable and versionable.

### Orchestrator

`packages/orchestrator` manages:

- run creation and persistence
- state transitions
- approval gates
- artifact writing
- runtime extension hooks

The orchestrator is where Ziggy behaves like a governed runtime rather than a loose collection of tools.

### Models

`packages/models` currently focuses on planning, with local model support through Ollama and deterministic fallbacks for file workflows.

### Tools

`packages/tools` provides narrow wrappers around approved capabilities. These wrappers are intentionally small and heavily scoped. They are the runtime’s controlled boundary with real-world side effects.

## Future Routing Direction

Ziggy is being prepared for multiple worker providers and role-based routing.

The new runtime hooks establish space for:

- `WorkerProvider`
- `TaskRouter`
- `PolicyEvaluator`

This means future versions can decide:

- whether work should stay local
- whether an external worker is acceptable
- whether the role is planning, writing, or building

without changing the user-facing product philosophy.

## How Ziggy Differs From Autonomous Agents

Ziggy is not designed to run broadly and invisibly. Its architecture emphasizes:

- narrow tools over open-ended autonomy
- approvals over uninterrupted execution
- local artifacts over hidden state
- policy-backed routing over ad hoc delegation

That tradeoff is intentional. The runtime should be understandable before it becomes more powerful.
