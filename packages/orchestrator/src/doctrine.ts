import type {
  ApprovalRequirement,
  CapabilityDefinition,
  CapabilityId,
  CapabilityScope,
  DoctrineEvaluation,
  DoctrineTrustSignal,
  ExecutionMode,
  GovernanceApprovalRule,
  GovernanceCapabilityDefinition,
  GovernanceRiskLevelDefinition,
  PlannedToolCall,
  RiskLevel,
  RunRecord,
  TaskContract,
  WorkerType,
} from "@ziggy/shared";
import {
  getCapability,
  loadApprovalRules,
  loadCapabilities,
  loadGovernanceCapabilities,
  loadGovernanceRiskLevels,
} from "@ziggy/policy";

type DoctrineSubject = Pick<
  TaskContract,
  "allowed_capabilities" | "risk_level" | "sensitivity_level"
>;

const RISK_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function getGovernanceRiskLevel(riskLevel: RiskLevel): GovernanceRiskLevelDefinition | undefined {
  return loadGovernanceRiskLevels().find((level) => level.id === riskLevel);
}

function getGovernanceCapability(
  capabilityId: CapabilityId
): GovernanceCapabilityDefinition | undefined {
  return loadGovernanceCapabilities().find((capability) => capability.id === capabilityId);
}

function getApprovalRuleForCapability(
  capabilityId: CapabilityId
): GovernanceApprovalRule | undefined {
  return loadApprovalRules().find((rule) => rule.applies_to.capability === capabilityId);
}

function getApprovalRuleForRisk(riskLevel: RiskLevel): GovernanceApprovalRule | undefined {
  return loadApprovalRules().find((rule) => rule.applies_to.risk_level === riskLevel);
}

function getSelectedCapabilities(
  capabilityIds: CapabilityId[]
): Array<{
  id: CapabilityId;
  runtime?: CapabilityDefinition;
  governance?: GovernanceCapabilityDefinition;
}> {
  return capabilityIds.map((id) => ({
    id,
    runtime: getCapability(id),
    governance: getGovernanceCapability(id),
  }));
}

function describeScope(capabilities: CapabilityDefinition[]): CapabilityScope {
  return capabilities.some((capability) => capability.side_effect) ? "scoped-change" : "read-only";
}

function isReversibleCapability(capabilityId: CapabilityId): boolean {
  return capabilityId !== "files.apply_organize";
}

function hasMissingGovernanceData(subject: DoctrineSubject): string[] {
  const reasons: string[] = [];
  if (!subject.allowed_capabilities?.length) {
    reasons.push("Task blocked: missing allowed capabilities");
  }

  if (!subject.risk_level) {
    reasons.push("Task blocked: missing risk level");
  }

  if (subject.risk_level && !getGovernanceRiskLevel(subject.risk_level)) {
    reasons.push(`Task blocked: missing governance risk definition for '${subject.risk_level}'`);
  }

  for (const capabilityId of subject.allowed_capabilities ?? []) {
    if (!getCapability(capabilityId)) {
      reasons.push(`Task blocked: missing runtime capability definition for '${capabilityId}'`);
    }
    if (!getGovernanceCapability(capabilityId)) {
      reasons.push(`Task blocked: missing governance capability definition for '${capabilityId}'`);
    }
  }

  return reasons;
}

export function determineApprovalRequirement(params: {
  riskLevel: RiskLevel;
  capabilities: CapabilityDefinition[];
}): {
  approval_required: boolean;
  approval_requirement: ApprovalRequirement;
  reasons: string[];
} {
  const reasons: string[] = [];
  const riskRule = getApprovalRuleForRisk(params.riskLevel);
  const anySideEffects = params.capabilities.some((capability) => capability.side_effect);
  const anyCapabilityNeedsApproval = params.capabilities.some((capability) => capability.approval_required);
  const hasVisibleChangePotential = anySideEffects || anyCapabilityNeedsApproval;

  let requirement: ApprovalRequirement = "none";

  if ((params.riskLevel === "high" || params.riskLevel === "critical") && hasVisibleChangePotential) {
    requirement = "explicit";
    reasons.push("High-risk work always requires explicit approval before side effects.");
  } else if (hasVisibleChangePotential) {
    requirement = "confirmation";
    reasons.push("Selected capabilities include side effects, so confirmation is required.");
  } else {
    reasons.push("All selected capabilities are read-only, so Ziggy can proceed automatically.");
    if (params.riskLevel === "high" || params.riskLevel === "critical") {
      reasons.push("This higher-risk task stays read-only within the current approved scope.");
    }
  }

  if (riskRule) {
    if (params.riskLevel === "medium" && hasVisibleChangePotential) {
      requirement = requirement === "explicit" ? "explicit" : "confirmation";
      reasons.push("Governance requires review before medium-risk side effects.");
    }
    if ((params.riskLevel === "high" || params.riskLevel === "critical") && hasVisibleChangePotential) {
      requirement = "explicit";
      reasons.push("Governance keeps higher-risk execution behind explicit approval.");
    }
  } else if (hasVisibleChangePotential || params.riskLevel !== "low") {
    reasons.push("Task blocked: side effects require approval policy");
    return {
      approval_required: true,
      approval_requirement: "explicit",
      reasons,
    };
  }

  for (const capability of params.capabilities) {
    if ((capability.side_effect || capability.approval_required) && !getApprovalRuleForCapability(capability.id)) {
      if (params.riskLevel === "low") {
        reasons.push(`Task blocked: missing approval rule for '${capability.id}'`);
      }
    }
  }

  return {
    approval_required: requirement !== "none",
    approval_requirement: requirement,
    reasons,
  };
}

export function selectExecutionMode(params: {
  riskLevel: RiskLevel;
  sensitivityLevel: string;
  capabilities: GovernanceCapabilityDefinition[];
}): { execution_mode: ExecutionMode; reasons: string[]; blocked_reason?: string } {
  const reasons: string[] = [];
  const riskDefinition = getGovernanceRiskLevel(params.riskLevel);
  if (!riskDefinition) {
    return {
      execution_mode: "blocked",
      reasons: ["Task blocked: execution mode could not be safely determined"],
      blocked_reason: "Task blocked: execution mode could not be safely determined",
    };
  }

  const allowedModes = (riskDefinition.allowed_worker_types as WorkerType[]).filter((mode) =>
    params.capabilities.every((capability) => capability.allowed_worker_types.includes(mode))
  );

  if (allowedModes.length === 0) {
    return {
      execution_mode: "blocked",
      reasons: ["Task blocked: execution mode could not be safely determined"],
      blocked_reason: "Task blocked: execution mode could not be safely determined",
    };
  }

  if (params.riskLevel === "high" || params.riskLevel === "critical") {
    if (allowedModes.includes("local")) {
      reasons.push("Local execution is preferred for higher-risk work.");
      return { execution_mode: "local", reasons };
    }
    return {
      execution_mode: "blocked",
      reasons: ["High-risk work could only run externally, so Ziggy paused for safety."],
      blocked_reason: "Task blocked: execution mode could not be safely determined",
    };
  }

  if (allowedModes.includes("local")) {
    reasons.push("Ziggy prefers local execution when practical.");
    return { execution_mode: "local", reasons };
  }

  if (params.sensitivityLevel !== "basic") {
    return {
      execution_mode: "blocked",
      reasons: ["Sensitive work could only run externally, so Ziggy paused for review."],
      blocked_reason: "Task blocked: execution mode could not be safely determined",
    };
  }

  reasons.push("External execution is allowed here because no local path is available.");
  return { execution_mode: "external", reasons };
}

export function evaluateTaskAgainstDoctrine(task: DoctrineSubject): DoctrineEvaluation {
  const missing = hasMissingGovernanceData(task);
  const selectedCapabilities = getSelectedCapabilities(task.allowed_capabilities ?? []);
  const runtimeCapabilities = selectedCapabilities
    .map((capability) => capability.runtime)
    .filter((capability): capability is CapabilityDefinition => Boolean(capability));
  const governanceCapabilities = selectedCapabilities
    .map((capability) => capability.governance)
    .filter((capability): capability is GovernanceCapabilityDefinition => Boolean(capability));

  const approval = determineApprovalRequirement({
    riskLevel: task.risk_level,
    capabilities: runtimeCapabilities,
  });
  const execution = selectExecutionMode({
    riskLevel: task.risk_level,
    sensitivityLevel: task.sensitivity_level,
    capabilities: governanceCapabilities,
  });

  const scope = describeScope(runtimeCapabilities);
  const reversible = task.allowed_capabilities.every(isReversibleCapability);
  const reasoning = [
    ...missing,
    ...approval.reasons,
    ...execution.reasons,
  ];

  const blockedReason =
    missing[0] ??
    approval.reasons.find((reason) => reason.startsWith("Task blocked:")) ??
    execution.blocked_reason;

  if (scope === "read-only") {
    reasoning.push("Capability scope is read-only.");
  } else {
    reasoning.push("Capability scope includes controlled side effects.");
  }

  if (reversible) {
    reasoning.push("This task uses reversible or inspectable actions first.");
  } else {
    reasoning.push("This task includes actions that are harder to reverse, so review stays in the loop.");
  }

  return {
    risk_level: task.risk_level,
    approval_required: blockedReason ? true : approval.approval_required,
    approval_requirement: blockedReason ? "explicit" : approval.approval_requirement,
    execution_mode: blockedReason ? "blocked" : execution.execution_mode,
    scope_ok: !blockedReason,
    scope,
    reversible,
    reversible_preferred: reversible,
    blocked: Boolean(blockedReason),
    blocked_reason: blockedReason,
    reasoning,
  };
}

export function validatePlanAgainstDoctrine(
  run: Pick<RunRecord, "allowed_capabilities" | "risk_level" | "sensitivity_level">,
  plan: { steps: PlannedToolCall[] }
): DoctrineEvaluation {
  const plannedTools = plan.steps.map((step) => step.tool);
  const extraCapabilities = plannedTools.filter(
    (tool, index) =>
      !run.allowed_capabilities.includes(tool) && plannedTools.indexOf(tool) === index
  );

  if (extraCapabilities.length > 0) {
    return {
      risk_level: run.risk_level,
      approval_required: true,
      approval_requirement: "explicit",
      execution_mode: "blocked",
      scope_ok: false,
      scope: "scoped-change",
      reversible: false,
      reversible_preferred: false,
      blocked: true,
      blocked_reason: `Task blocked: planner requested unapproved capability ${extraCapabilities.join(", ")}`,
      reasoning: [
        `Task blocked: planner requested unapproved capability ${extraCapabilities.join(", ")}`,
        "Doctrine least-privilege rules do not allow Ziggy to widen scope silently.",
      ],
    };
  }

  const evaluation = evaluateTaskAgainstDoctrine({
    allowed_capabilities: run.allowed_capabilities,
    risk_level: run.risk_level,
    sensitivity_level: run.sensitivity_level,
  });

  const stepSideEffectWithoutPolicy = plan.steps.find((step) => {
    const runtimeCapability = getCapability(step.tool);
    return Boolean(
      runtimeCapability?.side_effect &&
        !getApprovalRuleForCapability(step.tool) &&
        !getApprovalRuleForRisk(run.risk_level)
    );
  });

  if (stepSideEffectWithoutPolicy) {
    return {
      ...evaluation,
      approval_required: true,
      approval_requirement: "explicit",
      execution_mode: "blocked",
      scope_ok: false,
      blocked: true,
      blocked_reason: "Task blocked: side effects require approval policy",
      reasoning: [
        ...evaluation.reasoning,
        `Task blocked: side effects require approval policy for '${stepSideEffectWithoutPolicy.tool}'`,
      ],
    };
  }

  return evaluation;
}

export function buildTrustSignals(evaluation: DoctrineEvaluation): DoctrineTrustSignal[] {
  return [
    {
      label: "Risk",
      value: evaluation.risk_level[0].toUpperCase() + evaluation.risk_level.slice(1),
      tone: RISK_RANK[evaluation.risk_level] >= RISK_RANK.high ? "caution" : "neutral",
    },
    {
      label: "Approval",
      value:
        evaluation.approval_requirement === "none"
          ? "Auto"
          : evaluation.approval_requirement === "explicit"
            ? "Required"
            : "Needs your approval",
      tone: evaluation.approval_required ? "caution" : "positive",
    },
    {
      label: "Execution mode",
      value:
        evaluation.execution_mode === "blocked"
          ? "Blocked"
          : evaluation.execution_mode === "local"
            ? "Local"
            : "External",
      tone: evaluation.execution_mode === "blocked" ? "caution" : "neutral",
    },
    {
      label: "Scope",
      value: evaluation.scope === "read-only" ? "Read-only" : "Scoped changes",
      tone: evaluation.scope === "read-only" ? "positive" : "neutral",
    },
    {
      label: "Reversible",
      value: evaluation.reversible ? "Yes" : "No",
      tone: evaluation.reversible ? "positive" : "caution",
    },
  ];
}

export function determineStepApprovalRequirement(
  run: Pick<RunRecord, "risk_level">,
  step: PlannedToolCall
): {
  approval_required: boolean;
  approval_requirement: ApprovalRequirement;
  reasons: string[];
} {
  const capability = getCapability(step.tool);
  if (!capability) {
    return {
      approval_required: true,
      approval_requirement: "explicit",
      reasons: [`Task blocked: missing runtime capability definition for '${step.tool}'`],
    };
  }

  return determineApprovalRequirement({
    riskLevel: run.risk_level,
    capabilities: [capability],
  });
}
