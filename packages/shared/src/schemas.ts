import { z } from "zod";
import type { CapabilityId, ContextId } from "./types";

// ---- Enums ----

export const CapabilityIdSchema = z.enum([
  "email.read",
  "email.draft",
  "calendar.read",
  "files.propose_organize",
  "files.apply_organize",
]);

export const ContextIdSchema = z.enum([
  "work_email",
  "file_cleanup",
  "calendar_prep",
  "casual",
  "teaching",
]);

export const RunStateSchema = z.enum([
  "queued",
  "planning",
  "awaiting_approval",
  "executing",
  "completed",
  "failed",
  "blocked",
]);

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const SensitivityLevelSchema = z.enum(["basic"]);
export const WorkerTypeSchema = z.enum(["local", "external"]);
export const WorkerRoleSchema = z.enum(["planner", "writer", "builder"]);

// ---- Task Contract ----

export const TaskContractSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  goal: z.string().min(1).max(2000),
  capabilities: z.array(CapabilityIdSchema).min(1),
  allowed_capabilities: z.array(CapabilityIdSchema).min(1),
  context: ContextIdSchema,
  risk_level: RiskLevelSchema,
  sensitivity_level: SensitivityLevelSchema,
  created_at: z.string().datetime(),
  constraints: z.record(z.unknown()).optional(),
});

// ---- Planned Tool Call (model output) ----

export const PlannedToolCallSchema = z.object({
  tool: CapabilityIdSchema,
  args: z.record(z.unknown()),
  label: z.string().min(1).optional(),
  reason: z.string().min(1),
});

export const PlanSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(PlannedToolCallSchema).min(1).max(10),
});

// ---- Tool-specific arg schemas (validate before execution) ----

export const EmailReadArgsSchema = z.object({
  account: z.string(),
  filter: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
});

export const EmailDraftArgsSchema = z.object({
  message_id: z.string(),
  context: ContextIdSchema,
  subject: z.string().optional(),
  reply_to: z.string().optional(),
  instructions: z.string().optional(),
});

export const CalendarReadArgsSchema = z.object({
  calendar: z.string(),
  date: z.string().optional(), // ISO date string, defaults to today
  include_past: z.boolean().optional(),
});

export const FilesProposArgsSchema = z.object({
  path: z.string(),
  strategy: z.string().optional(),
  dry_run: z.boolean().optional(),
  mode: z.enum(["scan", "propose"]).optional(),
});

export const FilesApplyArgsSchema = z.object({
  source_directory: z.string().optional(),
  proposals: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      operation: z.enum(["move", "rename"]),
      filename: z.string().optional(),
      category: z.enum(["Images", "Documents", "Archives", "Installers", "Audio", "Video", "Code", "Other"]).optional(),
      reason: z.string().optional(),
    })
  ),
});

// ---- Approval ----

export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const ApprovalDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewer_note: z.string().optional(),
});

// ---- API request schemas ----

export const CreateTaskRequestSchema = z.object({
  title: z.string().min(1).max(200),
  goal: z.string().min(1).max(2000),
  capabilities: z.array(CapabilityIdSchema).min(1),
  context: ContextIdSchema,
  allowed_capabilities: z.array(CapabilityIdSchema).min(1).optional(),
  risk_level: RiskLevelSchema.optional(),
  sensitivity_level: SensitivityLevelSchema.optional(),
  constraints: z.record(z.unknown()).optional(),
});

export const SaveDraftDiffSchema = z.object({
  run_id: z.string(),
  tool: z.literal("email.draft"),
  context: ContextIdSchema,
  generated: z.string(),
  final: z.string(),
});

// Type exports from schemas
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
