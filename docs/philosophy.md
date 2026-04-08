# Ziggy Philosophy

## Why Ziggy Exists

Most agent systems start by asking, "What else can this model do?" Ziggy starts somewhere else: "What should this system be allowed to do, under what conditions, and how would a person understand it afterward?"

That difference matters.

Ziggy is meant to be a governed agent runtime for daily use. It should feel trustworthy, legible, and calm. It should support real work without asking people to suspend their judgment.

## Risk-First, Not Capability-First

Capability-first systems often drift toward broad permissioning, hidden automation, and unclear responsibility boundaries. Ziggy takes the opposite approach.

Before a task is routed or a tool is called, Ziggy should be able to answer:

- what risk tier this work belongs to
- what capabilities are allowed
- whether a human must approve it
- whether the work must stay local
- what evidence should be logged

This keeps the runtime grounded in policy instead of ambition.

## Human-in-the-Loop by Default

Human review is not a fallback for when the model is unreliable. It is a core product decision.

For Ziggy, review matters because:

- people remain accountable for meaningful side effects
- sensitive work benefits from explicit pause points
- approvals create understandable boundaries
- audit trails are only useful if they reflect real decision points

The goal is not to remove the human. The goal is to make the human effective.

## Local-First by Design

Local-first is about trust as much as latency.

Keeping planning, artifacts, and policy local makes the system easier to inspect and easier to reason about. External workers may become useful for selected tasks, but local execution remains the default for higher-risk work and the baseline for auditability.

## What Ziggy Is Not

Ziggy is not trying to be:

- an autonomous free-running agent
- a black-box assistant that hides its reasoning and effects
- a browser bot that acts everywhere on the user’s behalf
- a plugin marketplace optimized for unlimited extension

Those directions can be powerful, but they are not this product.

## Open Source Direction

Open source readiness for Ziggy means more than publishing code. It means publishing a clear philosophy:

- risk is modeled explicitly
- approvals are part of the runtime, not a patch
- policies are readable files
- architecture remains understandable without private context

That is the standard this repository is moving toward.
