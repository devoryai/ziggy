/**
 * Persists tool call logs to the tool_calls table.
 */
import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { ToolCallLog, CapabilityId } from "@ziggy/shared";
import type { ToolExecutionLog } from "@ziggy/tools";

export function logToolCall(entry: ToolExecutionLog, stepIndex: number): ToolCallLog {
  const db = getDb();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO tool_calls (id, run_id, step_index, tool, args, result, duration_ms, executed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entry.runId,
    stepIndex,
    entry.tool,
    JSON.stringify(entry.args),
    JSON.stringify(entry.result),
    entry.durationMs,
    entry.executedAt
  );

  return {
    id,
    run_id: entry.runId,
    step_index: stepIndex,
    tool: entry.tool as CapabilityId,
    args: entry.args,
    result: entry.result,
    duration_ms: entry.durationMs,
    executed_at: entry.executedAt,
  };
}

export function deleteToolCallsForRunStep(runId: string, stepIndex: number): void {
  const db = getDb();
  db.prepare("DELETE FROM tool_calls WHERE run_id = ? AND step_index = ?").run(runId, stepIndex);
}

export function listToolCallsByRun(runId: string): ToolCallLog[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM tool_calls WHERE run_id = ? ORDER BY step_index ASC")
    .all(runId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    run_id: row.run_id as string,
    step_index: row.step_index as number,
    tool: row.tool as CapabilityId,
    args: JSON.parse(row.args as string) as Record<string, unknown>,
    result: JSON.parse(row.result as string) as ToolCallLog["result"],
    duration_ms: row.duration_ms as number,
    executed_at: row.executed_at as string,
  }));
}
