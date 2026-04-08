export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { SaveDraftDiffSchema } from "@ziggy/shared";
import { saveDraftDiff, listDraftDiffs, listLearningSignals } from "@ziggy/memory";
import { ensureDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  ensureDb();
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId") ?? undefined;
  const diffs = listDraftDiffs(runId);
  const signals = listLearningSignals();
  return NextResponse.json({ diffs, signals });
}

export async function POST(req: NextRequest) {
  ensureDb();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SaveDraftDiffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid diff data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const diff = saveDraftDiff({
    runId: parsed.data.run_id,
    context: parsed.data.context,
    generated: parsed.data.generated,
    final: parsed.data.final,
  });
  return NextResponse.json({ diff });
}
