# Doctrine Enforcement

This MVP pass makes a small part of Ziggy Doctrine affect runtime behavior instead of living only in documentation.

## What is enforced now

### Human Control First

- High-risk and critical work now requires explicit approval before side effects.
- Side-effecting capabilities require approval even when the broader task is otherwise allowed to proceed.

### Explicit Risk Awareness

- Each run stores a doctrine evaluation with risk, approval requirement, execution mode, scope status, reversibility, and reasoning.
- If doctrine and YAML policy disagree, Ziggy takes the safer path.

### Transparency Over Magic

- Run detail pages now show trust signals for risk, approval, execution mode, scope, and reversibility.
- Runs also store doctrine reasoning so the user can see why Ziggy paused, blocked, or stayed local.

### Least Privilege Behavior

- Planned steps are validated against `task.allowed_capabilities` before execution.
- Ziggy blocks the run instead of silently widening capability scope.
- Tool argument scope checks now run before execution, so out-of-scope accounts, calendars, or paths are blocked.

### Reversible Actions Preferred

- Runs now record whether the requested capability set stays in reversible or inspectable territory.
- UI copy calls out when a run is reversible versus harder to undo.

### Local-First by Default

- Doctrine evaluation now chooses an execution mode of `local`, `external`, or `blocked`.
- High-risk and critical work prefer local execution.
- If execution mode cannot be chosen safely, the run is blocked.

### Calm Over Speed

- Missing governance data now blocks execution instead of falling through.
- Missing allowed capabilities, missing risk definitions, and unsafe execution-mode decisions now stop the run with a clear reason.

## Where it lives

- Runtime evaluation: `packages/orchestrator/src/doctrine.ts`
- Execution hooks: `packages/orchestrator/src/executor.ts`
- Run persistence: `packages/orchestrator/src/runs.ts`
- Run schema migration: `packages/orchestrator/src/schema.ts`
- Trust UI: `apps/web/src/app/runs/[id]/page.tsx`

## What is still future work

- Ziggy does not yet route real work to external workers.
- The doctrine layer is intentionally lightweight and does not implement a full policy engine.
- Sensitivity handling is still basic because the current schema only exposes `basic`.
- Planner behavior itself is not redesigned here; this pass validates and constrains planner output instead.
