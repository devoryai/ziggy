import { PlanSchema } from "@ziggy/shared";
import type { Plan, TaskContract, CapabilityDefinition, ContextDefinition, PreferenceProfile } from "@ziggy/shared";
import { ollamaChat, type OllamaConfig } from "./ollama";

function buildDeterministicFilePlan(input: PlannerInput): Plan | null {
  const fileCaps = input.task.capabilities.filter(
    (capId) => capId === "files.propose_organize" || capId === "files.apply_organize"
  );
  if (fileCaps.length === 0) {
    return null;
  }

  const proposeCapability = input.capabilities.find((cap) => cap.id === "files.propose_organize");
  const applyCapability = input.capabilities.find((cap) => cap.id === "files.apply_organize");
  const approvedPath =
    proposeCapability?.paths?.[0] ??
    applyCapability?.paths?.[0] ??
    "~/Downloads";
  const strategy = input.preferences.organization?.downloads_strategy ?? "type_buckets";

  const steps: Plan["steps"] = [];

  if (fileCaps.includes("files.propose_organize")) {
    steps.push({
      tool: "files.propose_organize",
      label: "Propose organization",
      args: { path: approvedPath, strategy, dry_run: true, mode: "propose" },
      reason: "Scan the approved root and prepare a concrete organization proposal without changing any files.",
    });
  }

  if (fileCaps.includes("files.apply_organize")) {
    steps.push({
      tool: "files.apply_organize",
      label: "Apply approved moves",
      args: { source_directory: approvedPath, proposals: [] },
      reason: "After approval, apply the proposed moves inside the same approved root and report what actually moved.",
    });
  }

  return {
    summary: "Review the approved directory, propose an organization plan, then apply approved moves only after review.",
    steps,
  };
}

export interface PlannerInput {
  task: TaskContract;
  capabilities: CapabilityDefinition[];
  context: ContextDefinition;
  preferences: PreferenceProfile;
}

/**
 * Build the system prompt for the planner.
 * The planner must return structured JSON — no prose, no markdown.
 */
function buildSystemPrompt(): string {
  return `You are a planning assistant for a governed personal AI system called Ziggy.
Your job is to produce a structured execution plan given a task and the allowed tools.

RULES:
- You MUST respond with valid JSON only — no prose, no markdown, no code fences.
- Only use tools from the provided capability list.
- Keep the plan minimal — use only the steps necessary.
- Each step must include a clear "reason" explaining why it is needed.
- Do not invent tool names or arguments outside the defined schemas.
- Do not include any side-effect tool calls that the task does not require.

OUTPUT FORMAT (strict JSON):
{
  "summary": "Brief description of what the plan will do",
  "steps": [
    {
      "tool": "capability_id",
      "args": { ... },
      "reason": "Why this step is needed"
    }
  ]
}`;
}

/**
 * Build the user prompt with full task context.
 */
function buildUserPrompt(input: PlannerInput): string {
  const capList = input.capabilities
    .map((c) => {
      const constraints: string[] = [];
      if (c.accounts) constraints.push(`allowed accounts: ${c.accounts.join(", ")}`);
      if (c.calendars) constraints.push(`allowed calendars: ${c.calendars.join(", ")}`);
      if (c.paths) constraints.push(`allowed paths: ${c.paths.join(", ")}`);
      if (c.side_effect) constraints.push("has side effects — requires approval");
      return `- ${c.id}: ${c.description}${constraints.length ? ` (${constraints.join("; ")})` : ""}`;
    })
    .join("\n");

  const prefSummary = JSON.stringify(input.preferences.communication, null, 2);

  return `TASK:
Title: ${input.task.title}
Goal: ${input.task.goal}
Context: ${input.context.id} — ${input.context.description}
${input.task.constraints ? `Constraints: ${JSON.stringify(input.task.constraints)}` : ""}

AVAILABLE CAPABILITIES:
${capList}

ACTIVE CONTEXT SYSTEM HINT:
${input.context.system_hint}

USER PREFERENCES (communication):
${prefSummary}

Produce the JSON plan now. Steps should be limited to ${input.preferences.planning?.max_steps ?? 8}.`;
}

/**
 * Call the planner model and return a validated Plan.
 * Throws if the model output is not valid JSON or does not match the schema.
 */
export async function generatePlan(
  input: PlannerInput,
  ollamaConfig?: Partial<OllamaConfig>
): Promise<Plan> {
  const deterministicFilePlan = buildDeterministicFilePlan(input);
  if (deterministicFilePlan) {
    return deterministicFilePlan;
  }

  const messages = [
    { role: "system" as const, content: buildSystemPrompt() },
    { role: "user" as const, content: buildUserPrompt(input) },
  ];

  const raw = await ollamaChat(messages, ollamaConfig);

  // Strip any accidental markdown code fences
  const cleaned = raw
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Planner returned non-JSON output. Raw response:\n${raw.slice(0, 500)}`
    );
  }

  const result = PlanSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Planner output failed schema validation: ${result.error.message}\nRaw: ${cleaned.slice(0, 500)}`
    );
  }

  return result.data;
}

/**
 * Generate a mock plan for testing/demo without a real model.
 * Used when Ollama is not available.
 */
export function generateMockPlan(input: PlannerInput): Plan {
  const deterministicFilePlan = buildDeterministicFilePlan(input);
  if (deterministicFilePlan) {
    return deterministicFilePlan;
  }

  const steps = input.task.capabilities.slice(0, 3).map((capId) => {
    if (capId === "email.read") {
      return {
        tool: capId,
        label: "Read unread emails",
        args: { account: "work", filter: "unread since today", limit: 10 },
        reason: "Read unread emails to identify which need responses",
      };
    }
    if (capId === "email.draft") {
      return {
        tool: capId,
        label: "Draft a reply",
        args: { message_id: "demo-001", context: input.task.context },
        reason: "Draft a reply to an email that needs a response",
      };
    }
    if (capId === "calendar.read") {
      return {
        tool: capId,
        label: "Review calendar",
        args: { calendar: "work", date: new Date().toISOString().slice(0, 10) },
        reason: "Read today's calendar events to prepare meeting notes",
      };
    }
    if (capId === "files.propose_organize") {
      return {
        tool: capId,
        label: "Propose organization",
        args: { path: "~/Downloads", strategy: "project_then_type", mode: "propose" },
        reason: "Scan the approved root and prepare an organization structure",
      };
    }
    if (capId === "files.apply_organize") {
      return {
        tool: capId,
        label: "Apply approved moves",
        args: { proposals: [] },
        reason: "Apply approved file organization proposals",
      };
    }
    return {
      tool: capId,
      args: {},
      reason: "Execute requested action",
    };
  });

  return {
    summary: `[DEMO PLAN] ${input.task.title}: ${input.task.goal.slice(0, 80)}`,
    steps: steps as Plan["steps"],
  };
}
