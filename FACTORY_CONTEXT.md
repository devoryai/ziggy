# Factory Context

## Purpose

This file defines the context every AI worker loads before performing work in this Devory workspace.

## Doctrine

Doctrine files define the engineering rules every run must follow.
The worker should load every doctrine file in `doctrine/` by default, except `doctrine/product-philosophy.md`.
The explicit list below is the current default rollout set.

Always load these:

- doctrine/engineering-principles.md
- doctrine/testing-standard.md
- doctrine/workflow-rules.md
- doctrine/code-style.md

Load when relevant:

- doctrine/product-philosophy.md

## Skills

Skills are reusable procedure modules for specific kinds of work.
Activate them from task frontmatter with a `skills:` declaration, for example:

  skills: [test-generation]

Starter skills included with this workspace:
- skills/test-generation/SKILL.md    — write or extend tests for a module
- skills/nextjs-component/SKILL.md   — create or refactor a Next.js component

Skills live at `skills/<name>/SKILL.md` and are loaded after doctrine on every run that requests them.

## Standards

This workspace uses `devory.standards.yml` to define engineering guardrails.
Run `devory improve --type compliance` to check your codebase against your standards.

## Required behavior

All work must:
- follow the standards defined in devory.standards.yml
- aim for the thinnest valuable slice
- include tests where practical
- avoid unrelated scope changes
- remain safe, reviewable, and reversible

## Task lifecycle

Tasks move through: backlog → ready → doing → review → done
Support stages: blocked, archived

- `devory task new`      — create a task
- `devory task move`     — advance a task through the lifecycle
- `devory task validate` — check task format
- `devory run`           — run the factory orchestrator
