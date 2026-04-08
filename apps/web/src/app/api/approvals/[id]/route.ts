export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { ApprovalDecisionSchema } from "@ziggy/shared";
import {
  getApproval,
  decideApproval,
  executeApprovedStep,
  updateRunResultState,
  writeApprovalDecisionArtifact,
} from "@ziggy/orchestrator";
import { ensureDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureDb();
  const approval = getApproval(params.id);
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }
  return NextResponse.json({ approval });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureDb();

  const approval = getApproval(params.id);
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json(
      { error: `Approval already decided: ${approval.status}` },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ApprovalDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid decision", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = decideApproval(
    params.id,
    parsed.data.status,
    parsed.data.reviewer_note
  );

  writeApprovalDecisionArtifact(approval.run_id, approval.step_index, {
    approval_id: approval.id,
    status: parsed.data.status,
    reviewer_note: parsed.data.reviewer_note,
  });

  if (parsed.data.status === "approved") {
    try {
      const executionResult = await executeApprovedStep(
        approval.run_id,
        approval.step_index
      );
      return NextResponse.json({ approval: updated, executionResult });
    } catch (err) {
      return NextResponse.json(
        { approval: updated, error: `Execution failed: ${String(err)}` },
        { status: 500 }
      );
    }
  }

  updateRunResultState(
    approval.run_id,
    "blocked",
    `Execution stopped at step ${approval.step_index + 1}. Approval for ${approval.tool} was rejected.`
  );

  return NextResponse.json({ approval: updated });
}
