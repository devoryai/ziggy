export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { CreateTaskRequestSchema } from "@ziggy/shared";
import {
  getRun,
  listRuns,
  submitTask,
  planRun,
  executeReadOnlySteps,
} from "@ziggy/orchestrator";
import { loadGovernanceCapabilities, loadGovernanceContexts } from "@ziggy/policy";
import { ensureDb } from "@/lib/db";

export async function GET() {
  ensureDb();
  const runs = listRuns(50);
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  ensureDb();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateTaskRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const normalizedContext =
    parsed.data.context === "work_email" &&
    parsed.data.capabilities.some(
      (capability) =>
        capability === "files.propose_organize" || capability === "files.apply_organize"
    )
      ? "file_cleanup"
      : parsed.data.context;

  const governanceCapabilities = loadGovernanceCapabilities();
  const governanceContexts = loadGovernanceContexts();
  const allowedCapabilities = parsed.data.allowed_capabilities ?? parsed.data.capabilities;
  const disallowedRequestedCapabilities = allowedCapabilities.filter(
    (capability) => !parsed.data.capabilities.includes(capability)
  );
  if (disallowedRequestedCapabilities.length > 0) {
    return NextResponse.json(
      {
        error: `allowed_capabilities must be a subset of requested capabilities. Unexpected: ${disallowedRequestedCapabilities.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const capabilityRiskRank = { low: 0, medium: 1, high: 2, critical: 3 } as const;
  const inferredRisk = parsed.data.capabilities.reduce<keyof typeof capabilityRiskRank>(
    (highest, capabilityId) => {
      const governanceCapability = governanceCapabilities.find((cap) => cap.id === capabilityId);
      if (!governanceCapability) return highest;
      return capabilityRiskRank[governanceCapability.risk_level] > capabilityRiskRank[highest]
        ? governanceCapability.risk_level
        : highest;
    },
    "low"
  );
  const governanceContext = governanceContexts.find((ctx) => ctx.id === normalizedContext);

  const task = {
    id: randomUUID(),
    ...parsed.data,
    allowed_capabilities: allowedCapabilities,
    context: normalizedContext,
    risk_level: parsed.data.risk_level ?? governanceContext?.default_risk_level ?? inferredRisk,
    sensitivity_level: parsed.data.sensitivity_level ?? "basic",
    created_at: new Date().toISOString(),
  };

  // Submit task and immediately plan + execute read-only steps
  const runId = await submitTask(task);
  const createdRun = getRun(runId);
  if (createdRun?.state === "blocked") {
    return NextResponse.json({
      runId,
      error: createdRun.error ?? "Task blocked for safety",
      run: createdRun,
    });
  }

  try {
    const plan = await planRun(runId);
    const execution = await executeReadOnlySteps(runId);

    return NextResponse.json({
      runId,
      plan,
      execution,
    });
  } catch (err) {
    const latestRun = getRun(runId);
    if (latestRun?.state === "blocked") {
      return NextResponse.json({
        runId,
        error: latestRun.error ?? "Task blocked for safety",
        run: latestRun,
      });
    }
    return NextResponse.json(
      { runId, error: `Execution error: ${String(err)}` },
      { status: 500 }
    );
  }
}
