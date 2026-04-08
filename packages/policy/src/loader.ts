import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { z } from "zod";
import type {
  CapabilityDefinition,
  ContextDefinition,
  GovernanceApprovalRule,
  GovernanceCapabilityDefinition,
  GovernanceContextDefinition,
  GovernanceRiskLevelDefinition,
  GovernanceTaskTemplate,
  PreferenceProfile,
} from "@ziggy/shared";

// Resolve the policy directory relative to the repo root.
// ZIGGY_POLICY_DIR env var is the canonical override (set via next.config.mjs or CLI).
// The __dirname fallback works in CommonJS/bundled contexts (tsx, Next.js transpile).
function findPolicyDir(): string {
  if (process.env.ZIGGY_POLICY_DIR) {
    return resolve(process.env.ZIGGY_POLICY_DIR);
  }
  // Fallback: walk up from this file (packages/policy/src/) to the monorepo root
  // Works in bundled (Next.js) and tsx contexts where __dirname is available.
  if (typeof __dirname !== "undefined") {
    return resolve(__dirname, "../../../policy");
  }
  // Last resort: cwd (works if running from monorepo root)
  return resolve(process.cwd(), "policy");
}

function loadYaml<T>(filename: string): T {
  const policyDir = findPolicyDir();
  const filePath = resolve(policyDir, filename);
  const raw = readFileSync(filePath, "utf-8");
  return yaml.load(raw) as T;
}

function findGovernanceDir(): string {
  if (process.env.ZIGGY_GOVERNANCE_DIR) {
    return resolve(process.env.ZIGGY_GOVERNANCE_DIR);
  }
  if (typeof __dirname !== "undefined") {
    return resolve(__dirname, "../../../governance");
  }
  return resolve(process.cwd(), "governance");
}

function loadGovernanceYaml<T>(filename: string): T {
  const governanceDir = findGovernanceDir();
  const filePath = resolve(governanceDir, filename);
  const raw = readFileSync(filePath, "utf-8");
  return yaml.load(raw) as T;
}

// ---- Capability loading ----

const RawCapabilitySchema = z.object({
  id: z.string(),
  description: z.string(),
  side_effect: z.boolean(),
  approval_required: z.boolean().optional().default(false),
  accounts: z.array(z.string()).optional(),
  calendars: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
});

const RawCapabilitiesFileSchema = z.object({
  capabilities: z.array(RawCapabilitySchema),
});

let _capabilities: CapabilityDefinition[] | null = null;

export function loadCapabilities(): CapabilityDefinition[] {
  if (_capabilities) return _capabilities;
  const raw = loadYaml<unknown>("capabilities.yaml");
  const parsed = RawCapabilitiesFileSchema.parse(raw);
  _capabilities = parsed.capabilities as CapabilityDefinition[];
  return _capabilities;
}

export function getCapability(id: string): CapabilityDefinition | undefined {
  return loadCapabilities().find((c) => c.id === id);
}

export function requireCapability(id: string): CapabilityDefinition {
  const cap = getCapability(id);
  if (!cap) throw new Error(`Capability '${id}' is not defined in policy.`);
  return cap;
}

// ---- Context loading ----

const RawContextSchema = z.object({
  id: z.string(),
  description: z.string(),
  system_hint: z.string(),
});

const RawContextsFileSchema = z.object({
  contexts: z.array(RawContextSchema),
});

let _contexts: ContextDefinition[] | null = null;

export function loadContexts(): ContextDefinition[] {
  if (_contexts) return _contexts;
  const raw = loadYaml<unknown>("contexts.yaml");
  const parsed = RawContextsFileSchema.parse(raw);
  _contexts = parsed.contexts as ContextDefinition[];
  return _contexts;
}

export function getContext(id: string): ContextDefinition | undefined {
  return loadContexts().find((c) => c.id === id);
}

// ---- Preference loading ----

let _preferences: PreferenceProfile | null = null;
let _riskLevels: GovernanceRiskLevelDefinition[] | null = null;
let _governanceCapabilities: GovernanceCapabilityDefinition[] | null = null;
let _approvalRules: GovernanceApprovalRule[] | null = null;
let _governanceContexts: GovernanceContextDefinition[] | null = null;
let _taskTemplates: GovernanceTaskTemplate[] | null = null;

export function loadPreferences(): PreferenceProfile {
  if (_preferences) return _preferences;
  const raw = loadYaml<unknown>("preferences.yaml");
  // Preferences are loosely typed — cast after basic existence check
  if (!raw || typeof raw !== "object") {
    throw new Error("preferences.yaml is malformed");
  }
  _preferences = raw as PreferenceProfile;
  return _preferences;
}

// ---- Governance loading ----

const RawRiskLevelSchema = z.object({
  id: z.enum(["low", "medium", "high", "critical"]),
  description: z.string(),
  approval_requirement: z.string(),
  allowed_side_effects: z.array(z.string()),
  allowed_worker_types: z.array(z.enum(["local", "external"])),
  logging_level: z.enum(["standard", "detailed", "full"]),
});

const RawRiskLevelsFileSchema = z.object({
  risk_levels: z.array(RawRiskLevelSchema),
});

const RawGovernanceCapabilitySchema = z.object({
  id: z.string(),
  display_name: z.string(),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  default_worker_role: z.enum(["planner", "writer", "builder"]),
  allowed_worker_types: z.array(z.enum(["local", "external"])),
  notes: z.string().optional(),
});

const RawGovernanceCapabilitiesFileSchema = z.object({
  capabilities: z.array(RawGovernanceCapabilitySchema),
});

const RawApprovalRuleSchema = z.object({
  id: z.string(),
  applies_to: z.object({
    risk_level: z.enum(["low", "medium", "high", "critical"]).optional(),
    capability: z.string().optional(),
  }),
  outcome: z.string(),
});

const RawApprovalRulesFileSchema = z.object({
  approval_rules: z.array(RawApprovalRuleSchema),
});

const RawGovernanceContextSchema = z.object({
  id: z.string(),
  preferred_worker_role: z.enum(["planner", "writer", "builder"]),
  default_risk_level: z.enum(["low", "medium", "high", "critical"]),
  notes: z.string().optional(),
});

const RawGovernanceContextsFileSchema = z.object({
  contexts: z.array(RawGovernanceContextSchema),
});

const RawTaskTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  goal: z.string(),
  context: z.string(),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  sensitivity_level: z.enum(["basic"]),
  allowed_capabilities: z.array(z.string()),
});

export function loadGovernanceRiskLevels(): GovernanceRiskLevelDefinition[] {
  if (_riskLevels) return _riskLevels;
  const raw = loadGovernanceYaml<unknown>("risk-levels.yaml");
  const parsed = RawRiskLevelsFileSchema.parse(raw);
  _riskLevels = parsed.risk_levels as GovernanceRiskLevelDefinition[];
  return _riskLevels;
}

export function loadGovernanceCapabilities(): GovernanceCapabilityDefinition[] {
  if (_governanceCapabilities) return _governanceCapabilities;
  const raw = loadGovernanceYaml<unknown>("capabilities.yaml");
  const parsed = RawGovernanceCapabilitiesFileSchema.parse(raw);
  _governanceCapabilities = parsed.capabilities as GovernanceCapabilityDefinition[];
  return _governanceCapabilities;
}

export function loadApprovalRules(): GovernanceApprovalRule[] {
  if (_approvalRules) return _approvalRules;
  const raw = loadGovernanceYaml<unknown>("approval-rules.yaml");
  const parsed = RawApprovalRulesFileSchema.parse(raw);
  _approvalRules = parsed.approval_rules as GovernanceApprovalRule[];
  return _approvalRules;
}

export function loadGovernanceContexts(): GovernanceContextDefinition[] {
  if (_governanceContexts) return _governanceContexts;
  const raw = loadGovernanceYaml<unknown>("contexts.yaml");
  const parsed = RawGovernanceContextsFileSchema.parse(raw);
  _governanceContexts = parsed.contexts as GovernanceContextDefinition[];
  return _governanceContexts;
}

export function loadTaskTemplates(): GovernanceTaskTemplate[] {
  if (_taskTemplates) return _taskTemplates;
  const governanceDir = findGovernanceDir();
  const templatesDir = resolve(governanceDir, "task-templates");
  const filenames = ["daily-briefing.yaml", "downloads-cleanup.yaml", "reply-triage.yaml"];
  _taskTemplates = filenames.map((filename) => {
    const raw = yaml.load(readFileSync(resolve(templatesDir, filename), "utf-8"));
    return RawTaskTemplateSchema.parse(raw) as GovernanceTaskTemplate;
  });
  return _taskTemplates;
}

// Invalidate caches (useful in tests or after hot-reload)
export function resetPolicyCache(): void {
  _capabilities = null;
  _contexts = null;
  _preferences = null;
  _riskLevels = null;
  _governanceCapabilities = null;
  _approvalRules = null;
  _governanceContexts = null;
  _taskTemplates = null;
}
