import type { CapabilityId, ToolCallResult } from "@ziggy/shared";

// Every tool handler implements this interface.
export interface ToolHandler<TArgs = Record<string, unknown>> {
  capabilityId: CapabilityId;
  /** Validate args and execute the tool. */
  execute(args: TArgs, runId: string): Promise<ToolCallResult>;
}

// Standardized log entry emitted by the tool runner
export interface ToolExecutionLog {
  runId: string;
  stepIndex?: number;
  tool: CapabilityId;
  args: Record<string, unknown>;
  result: ToolCallResult;
  durationMs: number;
  executedAt: string;
}
