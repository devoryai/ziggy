/**
 * Draft diff storage and retrieval.
 *
 * When a user edits a generated draft, we store both the generated version
 * and the final version. This creates a learning signal for later preference
 * refinement.
 */
import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { DraftDiff, LearningSignal } from "@ziggy/shared";
import type { ContextId } from "@ziggy/shared";

// ---- Storage ----

export function saveDraftDiff(params: {
  runId: string;
  context: ContextId;
  generated: string;
  final: string;
}): DraftDiff {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  const diffSummary = summarizeDiff(params.generated, params.final);

  db.prepare(`
    INSERT INTO draft_diffs (id, run_id, tool, context, generated, final, diff_summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.runId,
    "email.draft",
    params.context,
    params.generated,
    params.final,
    diffSummary,
    now
  );

  // Emit a learning signal for each meaningful change
  emitLearningSignals(id, params.context, params.generated, params.final);

  return {
    id,
    run_id: params.runId,
    tool: "email.draft",
    context: params.context,
    generated: params.generated,
    final: params.final,
    diff_summary: diffSummary,
    created_at: now,
  };
}

export function getDraftDiff(id: string): DraftDiff | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM draft_diffs WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return undefined;
  return rowToDraftDiff(row);
}

export function listDraftDiffs(runId?: string): DraftDiff[] {
  const db = getDb();
  const rows = runId
    ? (db.prepare("SELECT * FROM draft_diffs WHERE run_id = ? ORDER BY created_at DESC").all(runId) as Record<string, unknown>[])
    : (db.prepare("SELECT * FROM draft_diffs ORDER BY created_at DESC LIMIT 50").all() as Record<string, unknown>[]);
  return rows.map(rowToDraftDiff);
}

function rowToDraftDiff(row: Record<string, unknown>): DraftDiff {
  return {
    id: row.id as string,
    run_id: row.run_id as string,
    tool: "email.draft",
    context: row.context as ContextId,
    generated: row.generated as string,
    final: row.final as string,
    diff_summary: row.diff_summary as string | undefined,
    created_at: row.created_at as string,
  };
}

// ---- Diff summarization ----

/**
 * Produce a human-readable summary of what changed.
 * Light heuristics only — not a full diff algorithm.
 */
function summarizeDiff(generated: string, final: string): string {
  const genLines = generated.split("\n").length;
  const finalLines = final.split("\n").length;
  const genWords = generated.split(/\s+/).length;
  const finalWords = final.split(/\s+/).length;

  const parts: string[] = [];

  if (finalLines < genLines) parts.push(`shortened by ${genLines - finalLines} lines`);
  if (finalLines > genLines) parts.push(`expanded by ${finalLines - genLines} lines`);
  if (Math.abs(finalWords - genWords) > 10) {
    parts.push(finalWords < genWords ? "condensed" : "expanded");
  }
  if (final === generated) parts.push("no changes");

  return parts.length > 0 ? parts.join(", ") : "modified";
}

// ---- Learning signals ----

function emitLearningSignals(
  diffId: string,
  context: ContextId,
  generated: string,
  final: string
): void {
  const db = getDb();
  const now = new Date().toISOString();

  const genWords = generated.split(/\s+/).length;
  const finalWords = final.split(/\s+/).length;

  const signals: Omit<LearningSignal, "id">[] = [];

  // Length preference signal
  if (finalWords < genWords * 0.7) {
    signals.push({
      source_diff_id: diffId,
      context,
      signal_type: "length_adjusted",
      detail: `User shortened draft from ~${genWords} to ~${finalWords} words`,
      created_at: now,
    });
  }

  // Check for phrase avoidance
  const avoidedPhrases = ["circle back", "touch base", "we've got", "per my last email"];
  for (const phrase of avoidedPhrases) {
    if (generated.toLowerCase().includes(phrase) && !final.toLowerCase().includes(phrase)) {
      signals.push({
        source_diff_id: diffId,
        context,
        signal_type: "phrase_avoided",
        detail: `User removed phrase: "${phrase}"`,
        created_at: now,
      });
    }
  }

  for (const signal of signals) {
    db.prepare(`
      INSERT INTO learning_signals (id, source_diff_id, context, signal_type, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      signal.source_diff_id,
      signal.context,
      signal.signal_type,
      signal.detail,
      signal.created_at
    );
  }
}

export function listLearningSignals(context?: ContextId): LearningSignal[] {
  const db = getDb();
  const rows = context
    ? (db.prepare("SELECT * FROM learning_signals WHERE context = ? ORDER BY created_at DESC").all(context) as Record<string, unknown>[])
    : (db.prepare("SELECT * FROM learning_signals ORDER BY created_at DESC LIMIT 100").all() as Record<string, unknown>[]);
  return rows.map((r) => ({
    id: r.id as string,
    source_diff_id: r.source_diff_id as string,
    context: r.context as ContextId,
    signal_type: r.signal_type as LearningSignal["signal_type"],
    detail: r.detail as string,
    created_at: r.created_at as string,
  }));
}
