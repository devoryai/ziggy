/**
 * SQLite schema definitions.
 * Run initSchema() on startup to create tables if they don't exist.
 */
import { getDb } from "./db";

export const SCHEMA_SQL = `
-- Tracks every task run
CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL,
  task_title  TEXT NOT NULL,
  task_goal   TEXT NOT NULL,
  context     TEXT NOT NULL,
  capabilities TEXT NOT NULL,  -- JSON array
  allowed_capabilities TEXT NOT NULL DEFAULT '[]',  -- JSON array
  risk_level TEXT NOT NULL DEFAULT 'medium',
  sensitivity_level TEXT NOT NULL DEFAULT 'basic',
  state       TEXT NOT NULL DEFAULT 'queued',
  plan        TEXT,             -- JSON Plan object
  result_summary TEXT,
  error       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Approval requests for side-effect steps
CREATE TABLE IF NOT EXISTS approvals (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES runs(id),
  step_index    INTEGER NOT NULL,
  tool          TEXT NOT NULL,
  args          TEXT NOT NULL,  -- JSON
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  reviewer_note TEXT,
  created_at    TEXT NOT NULL,
  decided_at    TEXT,
  UNIQUE(run_id, step_index)
);

-- Log of every tool execution
CREATE TABLE IF NOT EXISTS tool_calls (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES runs(id),
  step_index   INTEGER NOT NULL,
  tool         TEXT NOT NULL,
  args         TEXT NOT NULL,   -- JSON
  result       TEXT NOT NULL,   -- JSON ToolCallResult
  duration_ms  INTEGER NOT NULL,
  executed_at  TEXT NOT NULL
);

-- User-edited draft diffs (learning signals source)
CREATE TABLE IF NOT EXISTS draft_diffs (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES runs(id),
  tool         TEXT NOT NULL DEFAULT 'email.draft',
  context      TEXT NOT NULL,
  generated    TEXT NOT NULL,
  final        TEXT NOT NULL,
  diff_summary TEXT,
  created_at   TEXT NOT NULL
);

-- Derived learning signals from draft diffs
CREATE TABLE IF NOT EXISTS learning_signals (
  id              TEXT PRIMARY KEY,
  source_diff_id  TEXT NOT NULL REFERENCES draft_diffs(id),
  context         TEXT NOT NULL,
  signal_type     TEXT NOT NULL,
  detail          TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_runs_state ON runs(state);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_run ON approvals(run_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(run_id);
CREATE INDEX IF NOT EXISTS idx_draft_diffs_run ON draft_diffs(run_id);
CREATE INDEX IF NOT EXISTS idx_learning_context ON learning_signals(context);
`;

export function initSchema(): void {
  const db = getDb();
  db.exec(SCHEMA_SQL);
  const runColumnMigrations = [
    "ALTER TABLE runs ADD COLUMN allowed_capabilities TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE runs ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'medium'",
    "ALTER TABLE runs ADD COLUMN sensitivity_level TEXT NOT NULL DEFAULT 'basic'",
  ];
  for (const statement of runColumnMigrations) {
    try {
      db.exec(statement);
    } catch {
      // Existing databases may already have the column; this is fine for lightweight migrations.
    }
  }
  console.log("[db] Schema initialized.");
}
