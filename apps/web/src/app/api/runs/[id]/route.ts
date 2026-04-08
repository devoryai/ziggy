export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  getRun,
  listApprovalsByRun,
  listToolCallsByRun,
} from "@ziggy/orchestrator";
import { listDraftDiffs } from "@ziggy/memory";
import { ensureDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureDb();
  const run = getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const approvals = listApprovalsByRun(params.id);
  const toolCalls = listToolCallsByRun(params.id);
  const draftDiffs = listDraftDiffs(params.id);

  return NextResponse.json({ run, approvals, toolCalls, draftDiffs });
}
