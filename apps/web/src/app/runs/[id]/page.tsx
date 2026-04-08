"use client";

import { useState, useEffect } from "react";
import type {
  RunRecord,
  ApprovalRecord,
  ToolCallLog,
  FileOrganizationProposal,
  FileOrganizationApplyResult,
  FileCategory,
} from "@ziggy/shared";

const CONTEXT_LABELS: Record<RunRecord["context"], string> = {
  work_email: "Work email",
  file_cleanup: "File cleanup",
  calendar_prep: "Calendar prep",
  casual: "Casual",
  teaching: "Teaching",
};

const TOOL_LABELS: Record<ToolCallLog["tool"], string> = {
  "email.read": "Read unread emails",
  "email.draft": "Draft a reply",
  "calendar.read": "Review calendar",
  "files.propose_organize": "Propose organization",
  "files.apply_organize": "Apply approved moves",
};

type RunDetail = {
  run: RunRecord;
  approvals: ApprovalRecord[];
  toolCalls: ToolCallLog[];
  draftDiffs: unknown[];
};

export default function RunDetailPage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${params.id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load run");
      } else {
        setDetail(data as RunDetail);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function decide(approvalId: string, status: "approved" | "rejected", note?: string) {
    setApproving(approvalId);
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewer_note: note }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      } else {
        await load();
      }
    } catch (err) {
      alert(String(err));
    } finally {
      setApproving(null);
    }
  }

  if (loading) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;
  if (error) return <div style={{ color: "var(--red)" }}>Error: {error}</div>;
  if (!detail) return null;

  const { run, approvals, toolCalls } = detail;
  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const latestFileProposal = [...toolCalls]
    .reverse()
    .find((call) => call.tool === "files.propose_organize" && call.result.success)?.result
    .data as FileOrganizationProposal | undefined;
  const latestFileApply = [...toolCalls]
    .reverse()
    .find((call) => call.tool === "files.apply_organize" && call.result.success)?.result
    .data as FileOrganizationApplyResult | undefined;

  return (
    <div style={{ maxWidth: "800px" }}>
      <div style={{ marginBottom: "8px" }}>
        <a href="/runs" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          ← Back to activity
        </a>
      </div>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "6px", letterSpacing: "-0.03em" }}>{run.task_title}</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "28px", fontSize: "14px", maxWidth: "700px" }}>{run.task_goal}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "28px" }}>
        <InfoCard label="Status">
          <StateTag state={run.state} />
        </InfoCard>
        <InfoCard label="Context">
          <span style={{ fontSize: "12px" }}>{CONTEXT_LABELS[run.context] ?? run.context}</span>
        </InfoCard>
        <InfoCard label="Risk level">
          <span style={{ fontSize: "12px", textTransform: "capitalize" }}>{run.risk_level}</span>
        </InfoCard>
        <InfoCard label="Started">
          <span style={{ fontSize: "12px" }}>{new Date(run.created_at).toLocaleString()}</span>
        </InfoCard>
        <InfoCard label="Capabilities">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {run.capabilities.map((c) => (
              <span
                key={c}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  background: "var(--bg-hover)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </InfoCard>
      </div>

      {run.plan && (
        <Section title="How Ziggy approached it">
          <div style={{ marginBottom: "10px", color: "var(--text-muted)", fontSize: "13px" }}>{run.plan.summary}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {run.plan.steps.map((step, i) => {
              const call = toolCalls.find((tc) => tc.step_index === i);
              const approval = approvals.find((a) => a.step_index === i);

              return (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    background: "var(--bg-card)",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span style={{ color: "var(--text-dim)", fontSize: "12px", minWidth: "18px" }}>{i + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500 }}>
                          {step.label ?? TOOL_LABELS[step.tool] ?? step.tool}
                        </span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--text-dim)" }}>
                          {step.tool}
                        </span>
                        {call && <span style={{ fontSize: "11px", color: "var(--green)" }}>✓ executed ({call.duration_ms}ms)</span>}
                        {approval && approval.status === "pending" && (
                          <span style={{ fontSize: "11px", color: "var(--yellow)" }}>awaiting approval</span>
                        )}
                        {approval && approval.status === "approved" && (
                          <span style={{ fontSize: "11px", color: "var(--green)" }}>approved</span>
                        )}
                        {approval && approval.status === "rejected" && (
                          <span style={{ fontSize: "11px", color: "var(--red)" }}>rejected</span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{step.reason}</div>
                      {call && (
                        <div style={{ marginTop: "8px" }}>
                          <StepResultView tool={step.tool} result={call.result} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {(latestFileProposal || latestFileApply) && (
        <Section title="File review">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {latestFileProposal && <FileProposalSummary proposal={latestFileProposal} />}
            {latestFileApply && <FileApplySummary result={latestFileApply} />}
          </div>
        </Section>
      )}

      {pendingApprovals.length > 0 && (
        <Section title="Needs your approval">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {pendingApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                deciding={approving === approval.id}
                onDecide={decide}
              />
            ))}
          </div>
        </Section>
      )}

      {run.result_summary && (
        <Section title="Here’s what happened">
          <pre style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
            {run.result_summary}
          </pre>
        </Section>
      )}

      {run.error && (
        <Section title="Something went wrong">
          <div style={{ color: "var(--red)", fontSize: "13px" }}>{run.error}</div>
        </Section>
      )}
    </div>
  );
}

function ApprovalCard({
  approval,
  deciding,
  onDecide,
}: {
  approval: ApprovalRecord;
  deciding: boolean;
  onDecide: (id: string, status: "approved" | "rejected", note?: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div style={{ padding: "16px", border: "1px solid var(--yellow)", borderRadius: "18px", background: "rgba(255,253,249,0.82)", boxShadow: "0 16px 36px rgba(80,74,64,0.05)" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500 }}>
          {TOOL_LABELS[approval.tool] ?? approval.tool}
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--text-dim)" }}>
          {approval.tool}
        </span>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>step {approval.step_index + 1}</span>
      </div>
      <div style={{ fontSize: "13px", marginBottom: "10px" }}>{approval.reason}</div>
      <details style={{ marginBottom: "12px" }}>
        <summary style={{ fontSize: "12px", color: "var(--text-dim)", cursor: "pointer" }}>Args</summary>
        <div style={{ marginTop: "8px" }}>
          <ApprovalArgsView approval={approval} />
        </div>
      </details>
      <input
        style={{
          width: "100%",
          padding: "6px 10px",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          color: "var(--text)",
          fontSize: "12px",
          marginBottom: "10px",
          outline: "none",
        }}
        placeholder="Add a note if you want to record why you approved or rejected this step."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => onDecide(approval.id, "approved", note || undefined)}
          disabled={deciding}
          style={{
            padding: "7px 16px",
            background: "var(--green)",
            color: "#000",
            border: "none",
            borderRadius: "5px",
            fontSize: "13px",
            fontWeight: 500,
            opacity: deciding ? 0.5 : 1,
          }}
        >
          {deciding ? "…" : "Approve"}
        </button>
        <button
          onClick={() => onDecide(approval.id, "rejected", note || undefined)}
          disabled={deciding}
          style={{
            padding: "7px 16px",
            background: "var(--bg-hover)",
            color: "var(--red)",
            border: "1px solid var(--red)",
            borderRadius: "5px",
            fontSize: "13px",
            opacity: deciding ? 0.5 : 1,
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function StepResultView({
  tool,
  result,
}: {
  tool: ToolCallLog["tool"];
  result: ToolCallLog["result"];
}) {
  if (!result.success) {
    return <div style={{ fontSize: "12px", color: "var(--red)" }}>{result.error}</div>;
  }

  if (tool === "files.propose_organize" && result.data) {
    return <FileProposalSummary proposal={result.data as FileOrganizationProposal} compact />;
  }

  if (tool === "files.apply_organize" && result.data) {
    return <FileApplySummary result={result.data as FileOrganizationApplyResult} compact />;
  }

  return (
    <details>
      <summary style={{ fontSize: "11px", color: "var(--text-dim)", cursor: "pointer" }}>Result</summary>
      <pre style={{ marginTop: "4px", fontSize: "11px", color: "var(--text-muted)", overflowX: "auto", padding: "8px", background: "var(--bg)", borderRadius: "4px" }}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </details>
  );
}

function ApprovalArgsView({ approval }: { approval: ApprovalRecord }) {
  if (approval.tool === "files.apply_organize") {
    const args = approval.args as {
      source_directory?: string;
      proposals?: Array<{ category?: FileCategory }>;
    };
    const proposals = args.proposals ?? [];
    const categoryCounts = proposals.reduce<Record<string, number>>((acc, proposal) => {
      const category = proposal.category ?? "Other";
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});

    return (
      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        <div>Directory: {args.source_directory ?? "unknown"}</div>
        <div>Moves proposed: {proposals.length}</div>
        {Object.keys(categoryCounts).length > 0 && (
          <div style={{ marginTop: "6px" }}>
            Categories: {Object.entries(categoryCounts).map(([category, count]) => `${category} (${count})`).join(", ")}
          </div>
        )}
      </div>
    );
  }

  return (
    <pre style={{ fontSize: "11px", color: "var(--text-muted)", overflowX: "auto", padding: "8px", background: "var(--bg)", borderRadius: "4px" }}>
      {JSON.stringify(approval.args, null, 2)}
    </pre>
  );
}

function FileProposalSummary({
  proposal,
  compact = false,
}: {
  proposal: FileOrganizationProposal;
  compact?: boolean;
}) {
  const activeCategories = Object.entries(proposal.categories).filter(([, count]) => count > 0);
  const previewMoves = proposal.proposed_moves.slice(0, compact ? 3 : 5);

  return (
    <div
      style={{
        padding: compact ? "0" : "12px",
        border: compact ? "none" : "1px solid var(--border)",
        borderRadius: "8px",
        background: compact ? "transparent" : "var(--bg-card)",
      }}
    >
      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        <div>Approved root: {proposal.source_directory}</div>
        <div>Files reviewed: {proposal.discovered_files.length}</div>
        <div>Suggested folders: {activeCategories.map(([category, count]) => `${category} (${count})`).join(", ") || "none"}</div>
        <div>Suggested moves: {proposal.proposed_moves.length}</div>
      </div>
      {previewMoves.length > 0 && (
        <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
          {previewMoves.map((move) => (
            <div key={`${move.from}-${move.to}`}>{move.filename} → {move.category}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function FileApplySummary({
  result,
  compact = false,
}: {
  result: FileOrganizationApplyResult;
  compact?: boolean;
}) {
  const previewMoves = result.moved_files.slice(0, compact ? 3 : 5);

  return (
    <div
      style={{
        padding: compact ? "0" : "12px",
        border: compact ? "none" : "1px solid var(--border)",
        borderRadius: "8px",
        background: compact ? "transparent" : "var(--bg-card)",
      }}
    >
      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        {result.source_directory && <div>Approved root: {result.source_directory}</div>}
        <div>Moves completed: {result.moved_files.length}</div>
        <div>Moves skipped: {result.skipped_files.length}</div>
        <div>Errors: {result.errors.length}</div>
        <div>Collisions resolved: {result.collisions_resolved.length}</div>
      </div>
      {previewMoves.length > 0 && (
        <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
          {previewMoves.map((move) => (
            <div key={`${move.from}-${move.final_to ?? move.to}`}>{move.filename} → {move.final_to ?? move.to}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "14px", background: "rgba(255,253,249,0.82)", boxShadow: "0 14px 32px rgba(80,74,64,0.05)" }}>
      <div style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>{label}</div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <h2 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--navy)", marginBottom: "12px" }}>{title}</h2>
      {children}
    </div>
  );
}

function StateTag({ state }: { state: string }) {
  const colors: Record<string, string> = {
    completed: "var(--green)",
    failed: "var(--red)",
    awaiting_approval: "var(--yellow)",
    executing: "var(--blue)",
    planning: "var(--blue)",
    queued: "var(--text-muted)",
    blocked: "var(--yellow)",
  };
  const color = colors[state] ?? "var(--text-muted)";

  return (
    <span style={{ color, fontSize: "13px", fontWeight: 500 }}>
      {state.replace(/_/g, " ")}
    </span>
  );
}
