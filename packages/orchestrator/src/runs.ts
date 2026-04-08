/**
 * Run persistence — CRUD for the runs table.
 */
import { randomUUID } from "crypto";
import { getDb } from "./db";
import type {
  DoctrineEvaluation,
  RunRecord,
  RunState,
  TaskContract,
  Plan,
  CapabilityId,
  ContextId,
} from "@ziggy/shared";

// ---- Create ----

export function createRun(task: TaskContract, doctrineEvaluation?: DoctrineEvaluation): RunRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  const run: RunRecord = {
    id,
    task_id: task.id,
    task_title: task.title,
    task_goal: task.goal,
    context: task.context,
    capabilities: task.capabilities,
    allowed_capabilities: task.allowed_capabilities,
    risk_level: task.risk_level,
    sensitivity_level: task.sensitivity_level,
    execution_mode: doctrineEvaluation?.execution_mode ?? "local",
    doctrine_evaluation: doctrineEvaluation,
    state: doctrineEvaluation?.blocked ? "blocked" : "queued",
    error: doctrineEvaluation?.blocked_reason,
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO runs (
      id, task_id, task_title, task_goal, context, capabilities,
      allowed_capabilities, risk_level, sensitivity_level, execution_mode, doctrine_evaluation,
      state, error, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    run.id,
    run.task_id,
    run.task_title,
    run.task_goal,
    run.context,
    JSON.stringify(run.capabilities),
    JSON.stringify(run.allowed_capabilities),
    run.risk_level,
    run.sensitivity_level,
    run.execution_mode,
    run.doctrine_evaluation ? JSON.stringify(run.doctrine_evaluation) : null,
    run.state,
    run.error ?? null,
    run.created_at,
    run.updated_at
  );

  return run;
}

// ---- Read ----

export function getRun(id: string): RunRecord | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return undefined;
  return rowToRun(row);
}

export function listRuns(limit = 50): RunRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToRun);
}

// ---- Update ----

export function updateRunState(id: string, state: RunState, error?: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE runs SET state = ?, error = ?, updated_at = ? WHERE id = ?
  `).run(state, error ?? null, new Date().toISOString(), id);
}

export function updateRunPlan(id: string, plan: Plan): void {
  const db = getDb();
  db.prepare(`
    UPDATE runs SET plan = ?, updated_at = ? WHERE id = ?
  `).run(JSON.stringify(plan), new Date().toISOString(), id);
}

export function updateRunDoctrineEvaluation(id: string, evaluation: DoctrineEvaluation): void {
  const db = getDb();
  db.prepare(`
    UPDATE runs SET doctrine_evaluation = ?, execution_mode = ?, updated_at = ? WHERE id = ?
  `).run(
    JSON.stringify(evaluation),
    evaluation.execution_mode,
    new Date().toISOString(),
    id
  );
}

export function updateRunResult(id: string, summary: string): void {
  updateRunResultState(id, "completed", summary);
}

export function updateRunResultState(id: string, state: RunState, summary: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE runs SET result_summary = ?, state = ?, updated_at = ? WHERE id = ?
  `).run(summary, state, new Date().toISOString(), id);
}

// ---- Serialization ----

function rowToRun(row: Record<string, unknown>): RunRecord {
  return {
    id: row.id as string,
    task_id: row.task_id as string,
    task_title: row.task_title as string,
    task_goal: row.task_goal as string,
    context: row.context as ContextId,
    capabilities: JSON.parse(row.capabilities as string) as CapabilityId[],
    allowed_capabilities: row.allowed_capabilities
      ? (JSON.parse(row.allowed_capabilities as string) as CapabilityId[])
      : (JSON.parse(row.capabilities as string) as CapabilityId[]),
    risk_level: (row.risk_level as RunRecord["risk_level"]) ?? "medium",
    sensitivity_level: (row.sensitivity_level as RunRecord["sensitivity_level"]) ?? "basic",
    execution_mode: (row.execution_mode as RunRecord["execution_mode"]) ?? "local",
    doctrine_evaluation: row.doctrine_evaluation
      ? (JSON.parse(row.doctrine_evaluation as string) as DoctrineEvaluation)
      : undefined,
    state: row.state as RunState,
    plan: row.plan ? JSON.parse(row.plan as string) as Plan : undefined,
    result_summary: row.result_summary as string | undefined,
    error: row.error as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
