#!/usr/bin/env tsx
/**
 * Seeds demo data into the database for local testing.
 */
import { randomUUID } from "crypto";
import { initSchema } from "../schema.js";
import { getDb } from "../db.js";

initSchema();
const db = getDb();
const now = new Date().toISOString();

// Demo run 1 — completed email review
const run1Id = randomUUID();
db.prepare(`
  INSERT OR IGNORE INTO runs (id, task_id, task_title, task_goal, context, capabilities, state, plan, result_summary, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  run1Id,
  randomUUID(),
  "Review unread work emails",
  "Check unread emails from the work account and draft replies for messages that need responses.",
  "work_email",
  JSON.stringify(["email.read", "email.draft"]),
  "completed",
  JSON.stringify({
    summary: "Read unread work emails and prepare draft replies for messages needing responses.",
    steps: [
      {
        tool: "email.read",
        args: { account: "work", filter: "unread since today", limit: 10 },
        reason: "Fetch unread emails before deciding which need replies",
      },
      {
        tool: "email.draft",
        args: { message_id: "msg-001", context: "work_email", subject: "Re: Q2 planning" },
        reason: "Draft a reply to Sarah's Q2 planning email",
      },
    ],
  }),
  "Completed 2 of 2 steps.\n  [0] email.read: OK\n  [1] email.draft: OK",
  new Date(Date.now() - 3600_000).toISOString(),
  new Date(Date.now() - 3600_000 + 15_000).toISOString()
);

// Demo run 2 — calendar prep in progress (awaiting approval)
const run2Id = randomUUID();
db.prepare(`
  INSERT OR IGNORE INTO runs (id, task_id, task_title, task_goal, context, capabilities, state, plan, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  run2Id,
  randomUUID(),
  "Calendar prep for today",
  "Review today's meetings and prepare brief prep notes for each.",
  "calendar_prep",
  JSON.stringify(["calendar.read"]),
  "completed",
  JSON.stringify({
    summary: "Read today's calendar events and generate meeting prep notes.",
    steps: [
      {
        tool: "calendar.read",
        args: { calendar: "work", date: new Date().toISOString().slice(0, 10) },
        reason: "Fetch today's meetings to generate prep notes",
      },
    ],
  }),
  new Date(Date.now() - 1800_000).toISOString(),
  new Date(Date.now() - 1800_000 + 8_000).toISOString()
);

// Demo run 3 — file organization with pending approval
const run3Id = randomUUID();
db.prepare(`
  INSERT OR IGNORE INTO runs (id, task_id, task_title, task_goal, context, capabilities, state, plan, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  run3Id,
  randomUUID(),
  "Organize Downloads folder",
  "Review my Downloads folder and propose a clean organization structure.",
  "casual",
  JSON.stringify(["files.propose_organize", "files.apply_organize"]),
  "awaiting_approval",
  JSON.stringify({
    summary: "Scan Downloads folder and propose file moves/renames.",
    steps: [
      {
        tool: "files.propose_organize",
        args: { path: "~/Downloads", strategy: "project_then_type" },
        reason: "Scan Downloads and generate organization proposals",
      },
      {
        tool: "files.apply_organize",
        args: { proposals: [] },
        reason: "Apply proposals after user approval",
      },
    ],
  }),
  new Date(Date.now() - 600_000).toISOString(),
  new Date(Date.now() - 600_000 + 5_000).toISOString()
);

// Pending approval for run 3 step 1
db.prepare(`
  INSERT OR IGNORE INTO approvals (id, run_id, step_index, tool, args, reason, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  randomUUID(),
  run3Id,
  1,
  "files.apply_organize",
  JSON.stringify({ proposals: [
    { from: "~/Downloads/resume_v3_FINAL.pdf", to: "~/Downloads/documents/personal/resume_v3_FINAL.pdf", operation: "move" },
    { from: "~/Downloads/Invoice_Acme_Q4.pdf", to: "~/Downloads/documents/invoices/Invoice_Acme_Q4.pdf", operation: "move" },
  ]}),
  "Apply approved file organization proposals",
  "pending",
  new Date(Date.now() - 590_000).toISOString()
);

console.log("Seed data inserted.");
console.log(`  Run 1 (completed): ${run1Id}`);
console.log(`  Run 2 (completed): ${run2Id}`);
console.log(`  Run 3 (awaiting_approval): ${run3Id}`);
process.exit(0);
