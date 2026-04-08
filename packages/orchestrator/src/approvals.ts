/**
 * Approval gate — manages approval records for side-effect steps.
 */
import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { ApprovalRecord, ApprovalStatus, CapabilityId } from "@ziggy/shared";

// ---- Create ----

export function createApproval(params: {
  runId: string;
  stepIndex: number;
  tool: CapabilityId;
  args: Record<string, unknown>;
  reason: string;
}): ApprovalRecord {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  const record: ApprovalRecord = {
    id,
    run_id: params.runId,
    step_index: params.stepIndex,
    tool: params.tool,
    args: params.args,
    reason: params.reason,
    status: "pending",
    created_at: now,
  };

  db.prepare(`
    INSERT INTO approvals (id, run_id, step_index, tool, args, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(run_id, step_index) DO UPDATE SET
      status = excluded.status,
      args = excluded.args
  `).run(
    id,
    params.runId,
    params.stepIndex,
    params.tool,
    JSON.stringify(params.args),
    params.reason,
    "pending",
    now
  );

  return record;
}

// ---- Read ----

export function getApproval(id: string): ApprovalRecord | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return undefined;
  return rowToApproval(row);
}

export function getApprovalForStep(runId: string, stepIndex: number): ApprovalRecord | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM approvals WHERE run_id = ? AND step_index = ?")
    .get(runId, stepIndex) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return rowToApproval(row);
}

export function listApprovalsByRun(runId: string): ApprovalRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM approvals WHERE run_id = ? ORDER BY step_index ASC")
    .all(runId) as Record<string, unknown>[];
  return rows.map(rowToApproval);
}

export function listPendingApprovals(): ApprovalRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at ASC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToApproval);
}

// ---- Update ----

export function decideApproval(
  id: string,
  status: "approved" | "rejected",
  reviewerNote?: string
): ApprovalRecord {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE approvals
    SET status = ?, reviewer_note = ?, decided_at = ?
    WHERE id = ?
  `).run(status, reviewerNote ?? null, now, id);

  const updated = getApproval(id);
  if (!updated) throw new Error(`Approval '${id}' not found after update`);
  return updated;
}

// ---- Serialization ----

function rowToApproval(row: Record<string, unknown>): ApprovalRecord {
  return {
    id: row.id as string,
    run_id: row.run_id as string,
    step_index: row.step_index as number,
    tool: row.tool as CapabilityId,
    args: JSON.parse(row.args as string) as Record<string, unknown>,
    reason: row.reason as string,
    status: row.status as ApprovalStatus,
    reviewer_note: row.reviewer_note as string | undefined,
    created_at: row.created_at as string,
    decided_at: row.decided_at as string | undefined,
  };
}
