// Core domain types for Ziggy

export type RunState =
  | "queued"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "completed"
  | "failed"
  | "blocked";

export type CapabilityId =
  | "email.read"
  | "email.draft"
  | "calendar.read"
  | "files.propose_organize"
  | "files.apply_organize";

export type ContextId =
  | "work_email"
  | "file_cleanup"
  | "calendar_prep"
  | "casual"
  | "teaching";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type SensitivityLevel = "basic";
export type WorkerType = "local" | "external";
export type WorkerRole = "planner" | "writer" | "builder";

// A capability definition loaded from capabilities.yaml
export interface CapabilityDefinition {
  id: CapabilityId;
  description: string;
  side_effect: boolean;
  approval_required: boolean;
  accounts?: string[];
  calendars?: string[];
  paths?: string[];
}

// A context definition loaded from contexts.yaml
export interface ContextDefinition {
  id: ContextId;
  description: string;
  system_hint: string;
}

export interface GovernanceRiskLevelDefinition {
  id: RiskLevel;
  description: string;
  approval_requirement: string;
  allowed_side_effects: string[];
  allowed_worker_types: WorkerType[];
  logging_level: "standard" | "detailed" | "full";
}

export interface GovernanceCapabilityDefinition {
  id: CapabilityId;
  display_name: string;
  risk_level: RiskLevel;
  default_worker_role: WorkerRole;
  allowed_worker_types: WorkerType[];
  notes?: string;
}

export interface GovernanceApprovalRule {
  id: string;
  applies_to: {
    risk_level?: RiskLevel;
    capability?: CapabilityId;
  };
  outcome: string;
}

export interface GovernanceContextDefinition {
  id: ContextId;
  preferred_worker_role: WorkerRole;
  default_risk_level: RiskLevel;
  notes?: string;
}

export interface GovernanceTaskTemplate {
  id: string;
  title: string;
  goal: string;
  context: ContextId;
  risk_level: RiskLevel;
  sensitivity_level: SensitivityLevel;
  allowed_capabilities: CapabilityId[];
}

// The contract submitted for a task
export interface TaskContract {
  id: string;
  title: string;
  goal: string;
  capabilities: CapabilityId[];
  allowed_capabilities: CapabilityId[];
  context: ContextId;
  risk_level: RiskLevel;
  sensitivity_level: SensitivityLevel;
  created_at: string;
  // Optional constraints passed by the user
  constraints?: Record<string, unknown>;
}

// A single planned step returned by the model
export interface PlannedToolCall {
  tool: CapabilityId;
  args: Record<string, unknown>;
  label?: string;
  reason: string;
  // Populated after execution
  result?: ToolCallResult;
}

// The structured plan returned by the planner
export interface Plan {
  summary: string;
  steps: PlannedToolCall[];
}

// Result from executing a tool
export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type FileCategory =
  | "Images"
  | "Documents"
  | "Archives"
  | "Installers"
  | "Audio"
  | "Video"
  | "Code"
  | "Other";

export interface DiscoveredFileRecord {
  filename: string;
  full_path: string;
  extension: string;
  size: number;
  modified_time: string;
  category: FileCategory;
}

export interface ProposedDestinationFolder {
  category: FileCategory;
  path: string;
}

export interface FileMoveProposal {
  operation: "move" | "rename";
  from: string;
  to: string;
  filename: string;
  category: FileCategory;
  reason: string;
}

export interface FileOrganizationProposal {
  source_directory: string;
  discovered_files: DiscoveredFileRecord[];
  proposed_destination_folders: ProposedDestinationFolder[];
  proposed_moves: FileMoveProposal[];
  categories: Record<FileCategory, number>;
  strategy: string;
  scan_mode: "scan" | "propose";
}

export interface AppliedFileRecord {
  from: string;
  to: string;
  final_to?: string;
  filename: string;
  category?: FileCategory;
  status: "moved" | "skipped" | "error";
  reason?: string;
}

export interface FileOrganizationApplyResult {
  source_directory?: string;
  requested_moves: number;
  moved_files: AppliedFileRecord[];
  skipped_files: AppliedFileRecord[];
  collisions_resolved: Array<{
    original_to: string;
    resolved_to: string;
  }>;
  errors: AppliedFileRecord[];
}

// A full run record (persisted in DB)
export interface RunRecord {
  id: string;
  task_id: string;
  task_title: string;
  task_goal: string;
  context: ContextId;
  capabilities: CapabilityId[];
  allowed_capabilities: CapabilityId[];
  risk_level: RiskLevel;
  sensitivity_level: SensitivityLevel;
  state: RunState;
  plan?: Plan;
  result_summary?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

// An approval request for a side-effect step
export interface ApprovalRecord {
  id: string;
  run_id: string;
  step_index: number;
  tool: CapabilityId;
  args: Record<string, unknown>;
  reason: string;
  status: ApprovalStatus;
  reviewer_note?: string;
  created_at: string;
  decided_at?: string;
}

// A log entry for a single tool call execution
export interface ToolCallLog {
  id: string;
  run_id: string;
  step_index: number;
  tool: CapabilityId;
  args: Record<string, unknown>;
  result: ToolCallResult;
  duration_ms: number;
  executed_at: string;
}

// Communication preferences
export interface EmailPreferences {
  tone: string;
  avoid_phrases: string[];
  prefers_short_openings: boolean;
  max_reply_length?: string;
}

// User preference profile loaded from preferences.yaml
export interface PreferenceProfile {
  communication: {
    work_email?: EmailPreferences;
    casual?: Partial<EmailPreferences>;
  };
  approval: {
    email_draft: "always_review" | "auto";
    file_changes: "always_review" | "auto";
    calendar_events: "always_review" | "auto";
  };
  organization: {
    downloads_strategy: string;
    rename_convention: string;
    group_by_date: boolean;
  };
  planning: {
    max_steps: number;
    require_reason_per_step: boolean;
  };
}

// A diff between generated draft and user's final version
export interface DraftDiff {
  id: string;
  run_id: string;
  tool: "email.draft";
  context: ContextId;
  generated: string;
  final: string;
  diff_summary?: string;
  created_at: string;
}

// A learning signal derived from user edits
export interface LearningSignal {
  id: string;
  source_diff_id: string;
  context: ContextId;
  signal_type: "phrase_avoided" | "length_adjusted" | "tone_changed" | "content_added" | "content_removed";
  detail: string;
  created_at: string;
}
