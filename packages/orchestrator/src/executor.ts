/**
 * Execution engine — runs a plan step by step.
 *
 * State transitions:
 *   queued → planning → (awaiting_approval | executing) → completed | failed | blocked
 *
 * Side-effect steps always pause for approval.
 * Read-only steps run automatically.
 */
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import type {
  TaskContract,
  Plan,
  PlannedToolCall,
  CapabilityId,
  FileMoveProposal,
  FileOrganizationProposal,
  FileOrganizationApplyResult,
} from "@ziggy/shared";
import { loadCapabilities, loadContexts, getCapability } from "@ziggy/policy";
import { generatePlan, generateMockPlan, checkOllamaHealth } from "@ziggy/models";
import { executeTool, setToolLogCallback } from "@ziggy/tools";
import type { ToolExecutionLog } from "@ziggy/tools";
import { loadPreferences } from "@ziggy/policy";
import {
  createRun,
  getRun,
  updateRunState,
  updateRunPlan,
  updateRunResult,
} from "./runs";
import { createApproval, getApprovalForStep } from "./approvals";
import { logToolCall, listToolCallsByRun } from "./tool-logger";

// Wire tool logging into the orchestrator
setToolLogCallback(async (entry: ToolExecutionLog) => {
  logToolCall(entry, entry.stepIndex ?? -1);
});

// ---- Artifact writing ----

function getArtifactsDir(): string {
  return process.env.ZIGGY_ARTIFACTS_DIR ?? resolve(process.cwd(), "data/runs");
}

function writeArtifact(runId: string, filename: string, content: string): void {
  const dir = resolve(getArtifactsDir(), runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, filename), content, "utf-8");
}

function writeJsonArtifact(runId: string, filename: string, data: unknown): void {
  writeArtifact(runId, filename, JSON.stringify(data, null, 2));
}

function writeStepResultArtifact(runId: string, stepIndex: number, result: unknown): void {
  writeJsonArtifact(runId, `step-${stepIndex}-result.json`, result);
}

export function writeApprovalDecisionArtifact(
  runId: string,
  stepIndex: number,
  decision: { approval_id: string; status: "approved" | "rejected"; reviewer_note?: string }
): void {
  writeJsonArtifact(runId, `approval-step-${stepIndex}.json`, {
    ...decision,
    decided_at: new Date().toISOString(),
  });
}

// ---- Task submission ----

export async function submitTask(task: TaskContract): Promise<string> {
  const run = createRun(task);
  return run.id;
}

// ---- Planning ----

export async function planRun(runId: string): Promise<Plan> {
  const run = getRun(runId);
  if (!run) throw new Error(`Run '${runId}' not found`);

  updateRunState(runId, "planning");

  const allCapabilities = loadCapabilities();
  const allowedCapabilities = allCapabilities.filter((c) =>
    (run.capabilities as CapabilityId[]).includes(c.id as CapabilityId)
  );

  const allContexts = loadContexts();
  const context = allContexts.find((c) => c.id === run.context);
  if (!context) throw new Error(`Context '${run.context}' not found`);

  const preferences = loadPreferences();

  const plannerInput = {
    task: {
      id: run.task_id,
      title: run.task_title,
      goal: run.task_goal,
      capabilities: run.capabilities,
      allowed_capabilities: run.allowed_capabilities,
      context: run.context,
      risk_level: run.risk_level,
      sensitivity_level: run.sensitivity_level,
      created_at: run.created_at,
    },
    capabilities: allowedCapabilities,
    context,
    preferences,
  };

  let plan: Plan;
  const isFileOrganizationRun = run.capabilities.some(
    (capability) =>
      capability === "files.propose_organize" || capability === "files.apply_organize"
  );

  if (isFileOrganizationRun) {
    plan = generateMockPlan(plannerInput);
  } else {
    // Try Ollama; fall back to mock plan if unavailable
    try {
      await checkOllamaHealth();
      plan = await generatePlan(plannerInput);
      console.log(`[orchestrator] Generated plan via Ollama for run ${runId}`);
    } catch (err) {
      console.warn(`[orchestrator] Ollama unavailable (${String(err)}), using mock plan`);
      plan = generateMockPlan(plannerInput);
    }
  }

  updateRunPlan(runId, plan);
  writeArtifact(runId, "plan.json", JSON.stringify(plan, null, 2));

  return plan;
}

// ---- Step execution ----

/**
 * Execute all read-only steps in the plan.
 * Returns when it encounters a step that requires approval (or completes).
 */
export async function executeReadOnlySteps(runId: string): Promise<{
  completed: boolean;
  pendingApprovalStepIndex?: number;
  results: Array<{ stepIndex: number; result: unknown }>;
}> {
  const run = getRun(runId);
  if (!run || !run.plan) throw new Error(`Run '${runId}' has no plan`);

  updateRunState(runId, "executing");

  const results: Array<{ stepIndex: number; result: unknown }> = [];
  const steps = run.plan.steps;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const cap = getCapability(step.tool);

    if (!cap) {
      updateRunState(runId, "failed", `Unknown capability '${step.tool}'`);
      throw new Error(`Unknown capability '${step.tool}'`);
    }

    if (cap.side_effect || cap.approval_required) {
      updateRunPlan(runId, run.plan);
      // Create an approval record and pause
      createApproval({
        runId,
        stepIndex: i,
        tool: step.tool as CapabilityId,
        args: step.args,
        reason: step.reason,
      });
      updateRunState(runId, "awaiting_approval");
      return { completed: false, pendingApprovalStepIndex: i, results };
    }

    // Execute read-only step
    const result = await executeTool(step.tool as CapabilityId, step.args, runId, i);

    results.push({ stepIndex: i, result });
    writeStepResultArtifact(runId, i, result);

    if (!result.success) {
      updateRunState(runId, "failed", `Step ${i} (${step.tool}) failed: ${result.error}`);
      writeArtifact(runId, "results.json", JSON.stringify(results, null, 2));
      return { completed: false, results };
    }

    hydrateFileApplyStep(run.plan, i, result);
    updateRunPlan(runId, run.plan);

    if (step.tool === "files.propose_organize") {
      writeJsonArtifact(runId, "proposal.json", result);
    }

    // Write partial results after each step
    writeArtifact(runId, "results.json", JSON.stringify(results, null, 2));
  }

  // All steps completed
  const summary = buildResultSummary(steps, results);
  updateRunResult(runId, summary);
  writeArtifact(runId, "summary.txt", summary);

  return { completed: true, results };
}

/**
 * Execute a specific step after it has been approved.
 * Resumes execution and continues with remaining steps.
 */
export async function executeApprovedStep(
  runId: string,
  stepIndex: number
): Promise<{ completed: boolean; results: Array<{ stepIndex: number; result: unknown }> }> {
  const run = getRun(runId);
  if (!run || !run.plan) throw new Error(`Run '${runId}' has no plan`);

  const approval = getApprovalForStep(runId, stepIndex);
  if (!approval || approval.status !== "approved") {
    throw new Error(`Step ${stepIndex} is not approved`);
  }

  updateRunState(runId, "executing");

  const step = run.plan.steps[stepIndex];
  const result = await executeTool(step.tool as CapabilityId, step.args, runId, stepIndex);
  const priorResults = listToolCallsByRun(runId)
    .filter((call) => call.step_index < stepIndex)
    .map((call) => ({ stepIndex: call.step_index, result: call.result }));

  const results = [...priorResults, { stepIndex, result }];
  writeArtifact(runId, "results.json", JSON.stringify(results, null, 2));

  if (!result.success) {
    updateRunState(runId, "failed", `Step ${stepIndex} (${step.tool}) failed: ${result.error}`);
    return { completed: false, results };
  }

  writeStepResultArtifact(runId, stepIndex, result);
  if (step.tool === "files.apply_organize") {
    writeJsonArtifact(runId, "apply-result.json", result);
  }

  // Continue with remaining steps
  for (let i = stepIndex + 1; i < run.plan.steps.length; i++) {
    const nextStep = run.plan.steps[i];
    const cap = getCapability(nextStep.tool);

    if (!cap) {
      updateRunState(runId, "failed", `Unknown capability '${nextStep.tool}'`);
      break;
    }

    if (cap.side_effect || cap.approval_required) {
      updateRunPlan(runId, run.plan);
      createApproval({
        runId,
        stepIndex: i,
        tool: nextStep.tool as CapabilityId,
        args: nextStep.args,
        reason: nextStep.reason,
      });
      updateRunState(runId, "awaiting_approval");
      return { completed: false, results };
    }

    const nextResult = await executeTool(nextStep.tool as CapabilityId, nextStep.args, runId, i);
    results.push({ stepIndex: i, result: nextResult });
    writeStepResultArtifact(runId, i, nextResult);
    writeArtifact(runId, "results.json", JSON.stringify(results, null, 2));

    if (!nextResult.success) {
      updateRunState(runId, "failed", `Step ${i} failed: ${nextResult.error}`);
      return { completed: false, results };
    }

    hydrateFileApplyStep(run.plan, i, nextResult);
    updateRunPlan(runId, run.plan);
  }

  const summary = buildResultSummary(run.plan.steps, results);
  updateRunResult(runId, summary);
  writeArtifact(runId, "summary.txt", summary);

  return { completed: true, results };
}

// ---- Helpers ----

function buildResultSummary(
  steps: PlannedToolCall[],
  results: Array<{ stepIndex: number; result: unknown }>
): string {
  const lines = [`Completed ${results.length} of ${steps.length} steps.`];
  for (const { stepIndex, result } of results) {
    const step = steps[stepIndex];
    const r = result as {
      success: boolean;
      error?: string;
      data?: FileOrganizationProposal | FileOrganizationApplyResult;
    };
    if (!r.success) {
      lines.push(`  [${stepIndex}] ${step.tool}: FAILED — ${r.error}`);
      continue;
    }

    if (step.tool === "files.propose_organize" && r.data) {
      const proposal = r.data as FileOrganizationProposal;
      lines.push(
        `  [${stepIndex}] ${step.tool}: scanned ${proposal.discovered_files.length} files in ${proposal.source_directory} and proposed ${proposal.proposed_moves.length} moves`
      );
      continue;
    }

    if (step.tool === "files.apply_organize" && r.data) {
      const applyResult = r.data as FileOrganizationApplyResult;
      lines.push(
        `  [${stepIndex}] ${step.tool}: moved ${applyResult.moved_files.length}, skipped ${applyResult.skipped_files.length}, errors ${applyResult.errors.length}`
      );
      continue;
    }

    lines.push(`  [${stepIndex}] ${step.tool}: OK`);
  }
  return lines.join("\n");
}

function hydrateFileApplyStep(
  plan: Plan,
  stepIndex: number,
  result: { success: boolean; data?: unknown }
): void {
  if (!result.success || plan.steps[stepIndex]?.tool !== "files.propose_organize") {
    return;
  }

  const proposal = result.data as FileOrganizationProposal | undefined;
  if (!proposal || !Array.isArray(proposal.proposed_moves)) {
    return;
  }

  const nextApplyStep = plan.steps.find(
    (step, index) => index > stepIndex && step.tool === "files.apply_organize"
  );
  if (!nextApplyStep) {
    return;
  }

  nextApplyStep.args = {
    source_directory: proposal.source_directory,
    proposals: proposal.proposed_moves.map((move): FileMoveProposal => ({
      operation: move.operation,
      from: move.from,
      to: move.to,
      filename: move.filename,
      category: move.category,
      reason: move.reason,
    })),
  };
}
