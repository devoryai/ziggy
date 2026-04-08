import type {
  CapabilityId,
  PlannedToolCall,
  RiskLevel,
  TaskContract,
  ToolCallResult,
  WorkerRole,
  WorkerType,
} from "@ziggy/shared";

export interface WorkerExecutionRequest {
  task: TaskContract;
  role: WorkerRole;
  tool?: CapabilityId;
  input: string;
  metadata?: Record<string, unknown>;
}

export interface WorkerExecutionResult {
  worker: string;
  worker_type: WorkerType;
  output: string;
  artifacts?: Array<{ label: string; value: string }>;
}

export interface WorkerProvider {
  id: string;
  displayName: string;
  workerType: WorkerType;
  supportedRoles: WorkerRole[];
  supportsRiskLevel(riskLevel: RiskLevel): boolean;
  execute(request: WorkerExecutionRequest): Promise<WorkerExecutionResult>;
}

export interface PolicyEvaluation {
  allowed: boolean;
  risk_level: RiskLevel;
  preferred_role: WorkerRole;
  preferred_worker_type: WorkerType;
  notes: string[];
}

export interface PolicyEvaluator {
  evaluateTask(task: TaskContract): Promise<PolicyEvaluation> | PolicyEvaluation;
  evaluateStep(task: TaskContract, step: PlannedToolCall): Promise<PolicyEvaluation> | PolicyEvaluation;
}

export interface TaskRoutingDecision {
  role: WorkerRole;
  workerType: WorkerType;
  selectedProviderId?: string;
  notes: string[];
}

export interface TaskRouter {
  routeTask(task: TaskContract): Promise<TaskRoutingDecision> | TaskRoutingDecision;
  routeStep(task: TaskContract, step: PlannedToolCall): Promise<TaskRoutingDecision> | TaskRoutingDecision;
}

export class StaticPolicyEvaluator implements PolicyEvaluator {
  evaluateTask(task: TaskContract): PolicyEvaluation {
    return {
      allowed: true,
      risk_level: task.risk_level,
      preferred_role: "planner",
      preferred_worker_type: task.risk_level === "high" || task.risk_level === "critical" ? "local" : "external",
      notes: ["Placeholder policy evaluation: future versions should inspect governance rules before routing."],
    };
  }

  evaluateStep(task: TaskContract, step: PlannedToolCall): PolicyEvaluation {
    return {
      allowed: true,
      risk_level: task.risk_level,
      preferred_role: step.tool === "files.apply_organize" ? "builder" : "planner",
      preferred_worker_type: step.tool === "files.apply_organize" ? "local" : "external",
      notes: ["Placeholder step evaluation: risk-first routing will tighten here over time."],
    };
  }
}

export class StaticTaskRouter implements TaskRouter {
  constructor(private readonly evaluator: PolicyEvaluator) {}

  routeTask(task: TaskContract): TaskRoutingDecision {
    const evaluation = this.evaluator.evaluateTask(task) as PolicyEvaluation;
    return {
      role: evaluation.preferred_role,
      workerType: evaluation.preferred_worker_type,
      notes: evaluation.notes,
    };
  }

  routeStep(task: TaskContract, step: PlannedToolCall): TaskRoutingDecision {
    const evaluation = this.evaluator.evaluateStep(task, step) as PolicyEvaluation;
    return {
      role: evaluation.preferred_role,
      workerType: evaluation.preferred_worker_type,
      notes: evaluation.notes,
    };
  }
}

export function summarizeWorkerResult(result: WorkerExecutionResult): ToolCallResult {
  return {
    success: true,
    data: {
      worker: result.worker,
      worker_type: result.worker_type,
      output: result.output,
      artifacts: result.artifacts ?? [],
    },
  };
}
