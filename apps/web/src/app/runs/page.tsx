"use client";

import { useState, useEffect } from "react";
import type { RunRecord } from "@ziggy/shared";

const STATE_COLORS: Record<string, string> = {
  queued: "var(--text-muted)",
  planning: "var(--blue)",
  awaiting_approval: "var(--yellow)",
  executing: "var(--blue)",
  completed: "var(--green)",
  failed: "var(--red)",
  blocked: "var(--yellow)",
};

export default function RunsPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data) => {
        setRuns(data.runs ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ maxWidth: "800px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "6px", letterSpacing: "-0.03em" }}>Activity</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "28px", fontSize: "14px", maxWidth: "640px" }}>
        Review what Ziggy has worked on, what still needs your approval, and what happened in each run.
      </p>

      {loading && <div style={{ color: "var(--text-muted)" }}>Loading…</div>}
      {error && <div style={{ color: "var(--red)" }}>Error: {error}</div>}

      {!loading && runs.length === 0 && (
        <div style={{ color: "var(--text-muted)", padding: "32px 0" }}>
          Nothing has run yet. <a href="/">Start with a daily task →</a>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {runs.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </div>
    </div>
  );
}

function RunRow({ run }: { run: RunRecord }) {
  const stateColor = STATE_COLORS[run.state] ?? "var(--text-muted)";

  return (
    <a
      href={`/runs/${run.id}`}
      style={{
        display: "block",
        padding: "18px 18px",
        border: "1px solid var(--border)",
        borderRadius: "18px",
        background: "rgba(255,253,249,0.82)",
        boxShadow: "0 16px 36px rgba(80,74,64,0.06)",
        transition: "border-color 0.1s",
        textDecoration: "none",
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: "4px" }}>
            {run.task_title}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {run.task_goal.slice(0, 120)}
            {run.task_goal.length > 120 ? "…" : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0, marginLeft: "16px" }}>
          <StateBadge state={run.state} color={stateColor} />
          <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            {new Date(run.created_at).toLocaleString()}
          </div>
        </div>
      </div>
      {run.result_summary && (
        <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--text-muted)" }}>
          {humanizeSummary(run.result_summary)}
        </div>
      )}
      <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <CapBadge cap={`risk:${run.risk_level}`} />
        {run.capabilities.map((cap) => (
          <CapBadge key={cap} cap={cap} />
        ))}
      </div>
    </a>
  );
}

function StateBadge({ state, color }: { state: string; color: string }) {
  return (
    <span
      style={{
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "99px",
        border: `1px solid ${color}`,
        color,
        background: "rgba(255,255,255,0.6)",
        whiteSpace: "nowrap",
      }}
    >
      {state.replace(/_/g, " ")}
    </span>
  );
}

function CapBadge({ cap }: { cap: string }) {
  return (
    <span
      style={{
        fontSize: "11px",
        padding: "2px 7px",
        borderRadius: "999px",
        background: "var(--bg-hover)",
        color: "var(--text-muted)",
      }}
    >
      {cap}
    </span>
  );
}

function humanizeSummary(summary: string): string {
  const lines = summary.split("\n").map((line) => line.trim()).filter(Boolean);
  const fileLine = lines.find((line) => line.includes("files.apply_organize"));
  if (fileLine) {
    const moved = fileLine.match(/moved (\d+)/)?.[1] ?? "0";
    return `Moved ${moved} files inside the approved root.`;
  }
  const proposalLine = lines.find((line) => line.includes("files.propose_organize"));
  if (proposalLine) {
    const moves = proposalLine.match(/proposed (\d+) moves?/)?.[1] ?? "0";
    return `Prepared ${moves} file moves for review.`;
  }
  return lines[0] ?? summary;
}
