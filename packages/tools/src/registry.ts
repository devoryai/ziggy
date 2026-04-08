/**
 * Tool registry — single source of truth for all registered tools.
 *
 * Tools must be registered here to be executable.
 * Attempting to call an unregistered tool fails hard.
 */
import type { CapabilityId, ToolCallResult } from "@ziggy/shared";
import type { ToolHandler, ToolExecutionLog } from "./types";
import { emailReadTool } from "./email-read";
import { emailDraftTool } from "./email-draft";
import { calendarReadTool } from "./calendar-read";
import { fileProposeOrganizeTool } from "./files-propose";
import { fileApplyOrganizeTool } from "./files-apply";

// ---- Registration ----

const REGISTRY = new Map<CapabilityId, ToolHandler>();

function register(handler: ToolHandler): void {
  REGISTRY.set(handler.capabilityId, handler);
}

register(emailReadTool);
register(emailDraftTool);
register(calendarReadTool);
register(fileProposeOrganizeTool);
register(fileApplyOrganizeTool);

// ---- Execution ----

/** Execution log callback — injected by the orchestrator for persistence. */
let logCallback: ((entry: ToolExecutionLog) => Promise<void>) | null = null;

export function setToolLogCallback(fn: (entry: ToolExecutionLog) => Promise<void>): void {
  logCallback = fn;
}

/**
 * Execute a named tool with the provided args.
 * Logs execution time and result.
 * Throws if the tool is not registered.
 */
export async function executeTool(
  capabilityId: CapabilityId,
  args: Record<string, unknown>,
  runId: string,
  stepIndex?: number
): Promise<ToolCallResult> {
  const handler = REGISTRY.get(capabilityId);
  if (!handler) {
    throw new Error(
      `Tool '${capabilityId}' is not registered. Cannot execute.`
    );
  }

  const start = Date.now();
  let result: ToolCallResult;

  try {
    result = await handler.execute(args, runId);
  } catch (err) {
    result = { success: false, error: `Unexpected error: ${String(err)}` };
  }

  const durationMs = Date.now() - start;

  const logEntry: ToolExecutionLog = {
    runId,
    stepIndex,
    tool: capabilityId,
    args,
    result,
    durationMs,
    executedAt: new Date().toISOString(),
  };

  if (logCallback) {
    await logCallback(logEntry).catch((err) => {
      console.error("[tools/registry] Failed to write tool log:", err);
    });
  }

  return result;
}

export function getRegisteredTools(): CapabilityId[] {
  return Array.from(REGISTRY.keys());
}
