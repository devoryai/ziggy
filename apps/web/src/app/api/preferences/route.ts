export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import {
  loadPreferences,
  loadCapabilities,
  loadContexts,
  loadGovernanceRiskLevels,
  loadGovernanceCapabilities,
  loadApprovalRules,
  loadGovernanceContexts,
  loadTaskTemplates,
} from "@ziggy/policy";
import { listLearningSignals } from "@ziggy/memory";
import { ensureDb } from "@/lib/db";

export async function GET() {
  ensureDb();
  const preferences = loadPreferences();
  const capabilities = loadCapabilities();
  const contexts = loadContexts();
  const governance = {
    riskLevels: loadGovernanceRiskLevels(),
    capabilities: loadGovernanceCapabilities(),
    approvalRules: loadApprovalRules(),
    contexts: loadGovernanceContexts(),
    taskTemplates: loadTaskTemplates(),
  };
  const learningSignals = listLearningSignals();

  return NextResponse.json({
    preferences,
    capabilities,
    contexts,
    governance,
    learningSignals,
  });
}
