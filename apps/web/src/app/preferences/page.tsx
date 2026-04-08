"use client";

import { useState, useEffect } from "react";
import type {
  CapabilityDefinition,
  ContextDefinition,
  GovernanceApprovalRule,
  GovernanceCapabilityDefinition,
  GovernanceContextDefinition,
  GovernanceRiskLevelDefinition,
  GovernanceTaskTemplate,
  LearningSignal,
} from "@ziggy/shared";

type PrefsData = {
  preferences: {
    communication?: Record<string, unknown>;
    approval?: Record<string, string>;
    organization?: Record<string, unknown>;
    planning?: Record<string, unknown>;
  };
  capabilities: CapabilityDefinition[];
  contexts: ContextDefinition[];
  governance: {
    riskLevels: GovernanceRiskLevelDefinition[];
    capabilities: GovernanceCapabilityDefinition[];
    approvalRules: GovernanceApprovalRule[];
    contexts: GovernanceContextDefinition[];
    taskTemplates: GovernanceTaskTemplate[];
  };
  learningSignals: LearningSignal[];
};

export default function PreferencesPage() {
  const [data, setData] = useState<PrefsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setData(d as PrefsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;
  if (!data) return <div style={{ color: "var(--red)" }}>Unable to load governance and preferences.</div>;

  return (
    <div style={{ maxWidth: "900px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "6px", letterSpacing: "-0.03em" }}>
        Governance & Preferences
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "32px", maxWidth: "720px" }}>
        Ziggy stays trustworthy by keeping its risk model, task contexts, and review rules inspectable. This page reflects the current local configuration.
      </p>

      <Section
        title="Risk Model"
        description="The governance layer is intentionally lightweight: enough structure to guide routing and review without turning the runtime into a black box."
      >
        <div style={gridStyle}>
          {data.governance.riskLevels.map((level) => (
            <Card key={level.id}>
              <div style={titleRowStyle}>
                <strong style={{ textTransform: "capitalize" }}>{level.id}</strong>
                <Badge>{level.logging_level} logging</Badge>
              </div>
              <p style={bodyTextStyle}>{level.description}</p>
              <div style={metaTextStyle}>Approval: {level.approval_requirement}</div>
              <div style={metaTextStyle}>Workers: {level.allowed_worker_types.join(", ")}</div>
              <div style={metaTextStyle}>Side effects: {level.allowed_side_effects.join(", ") || "none"}</div>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Governed Capabilities"
        description="Capabilities remain narrow by design. Risk and worker guidance live alongside them so future routing can stay policy-first."
      >
        <div style={{ display: "grid", gap: "12px" }}>
          {data.governance.capabilities.map((cap) => (
            <Card key={cap.id}>
              <div style={titleRowStyle}>
                <strong>{cap.display_name}</strong>
                <Badge>{cap.risk_level} risk</Badge>
              </div>
              <div style={metaTextStyle}>{cap.id}</div>
              <div style={bodyTextStyle}>Default role: {cap.default_worker_role}</div>
              <div style={bodyTextStyle}>Workers: {cap.allowed_worker_types.join(", ")}</div>
              {cap.notes && <div style={bodyTextStyle}>{cap.notes}</div>}
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Approval Rules"
        description="Approval stays human-first. These rules describe how risk levels and capabilities translate into review expectations."
      >
        <div style={{ display: "grid", gap: "12px" }}>
          {data.governance.approvalRules.map((rule) => (
            <Card key={rule.id}>
              <div style={titleRowStyle}>
                <strong>{rule.id}</strong>
                <Badge>
                  {rule.applies_to.capability ?? rule.applies_to.risk_level ?? "general"}
                </Badge>
              </div>
              <div style={bodyTextStyle}>{rule.outcome}</div>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Task Templates"
        description="Templates make common work repeatable without hiding how Ziggy is allowed to behave."
      >
        <div style={gridStyle}>
          {data.governance.taskTemplates.map((template) => (
            <Card key={template.id}>
              <div style={titleRowStyle}>
                <strong>{template.title}</strong>
                <Badge>{template.risk_level} risk</Badge>
              </div>
              <div style={bodyTextStyle}>{template.goal}</div>
              <div style={metaTextStyle}>Context: {template.context}</div>
              <div style={metaTextStyle}>Allowed capabilities: {template.allowed_capabilities.join(", ")}</div>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Runtime Contexts"
        description="Contexts shape tone and routing, while the governance context model keeps defaults explicit."
      >
        <div style={{ display: "grid", gap: "12px" }}>
          {data.governance.contexts.map((ctx) => (
            <Card key={ctx.id}>
              <div style={titleRowStyle}>
                <strong>{ctx.id}</strong>
                <Badge>{ctx.default_risk_level} default</Badge>
              </div>
              <div style={bodyTextStyle}>Preferred role: {ctx.preferred_worker_role}</div>
              {ctx.notes && <div style={bodyTextStyle}>{ctx.notes}</div>}
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Local Preferences"
        description="Communication and organizational preferences remain local files so the system stays inspectable."
      >
        <Card>
          <pre style={preStyle}>{JSON.stringify(data.preferences, null, 2)}</pre>
        </Card>
      </Section>

      <Section
        title="Policy Files"
        description="These files define the current working rules. They are intended to be simple enough to read, review, and version."
      >
        <div style={gridStyle}>
          <Card>
            <strong>Policy</strong>
            <div style={bodyTextStyle}>Capabilities, approval preferences, and user-facing contexts live in `/policy`.</div>
          </Card>
          <Card>
            <strong>Governance</strong>
            <div style={bodyTextStyle}>Risk tiers, approval rules, templates, and context routing live in `/governance`.</div>
          </Card>
        </div>
      </Section>

      {data.learningSignals.length > 0 && (
        <Section
          title="What Ziggy Has Learned"
          description="Learning signals come from your edits to generated drafts. They are small, inspectable notes rather than opaque model tuning."
        >
          <div style={{ display: "grid", gap: "10px" }}>
            {data.learningSignals.map((sig) => (
              <Card key={sig.id}>
                <div style={titleRowStyle}>
                  <strong>{sig.signal_type}</strong>
                  <Badge>{sig.context}</Badge>
                </div>
                <div style={bodyTextStyle}>{sig.detail}</div>
              </Card>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "34px" }}>
      <h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--navy)", marginBottom: "8px" }}>
        {title}
      </h2>
      {description && <p style={{ ...bodyTextStyle, marginBottom: "14px", maxWidth: "720px" }}>{description}</p>}
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        border: "1px solid var(--border)",
        borderRadius: "18px",
        background: "rgba(255,253,249,0.82)",
        boxShadow: "0 16px 36px rgba(80,74,64,0.06)",
      }}
    >
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: "11px",
        padding: "4px 9px",
        borderRadius: "999px",
        background: "var(--bg-hover)",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </span>
  );
}

const titleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "8px",
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-muted)",
  lineHeight: 1.65,
};

const metaTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-dim)",
  marginTop: "6px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "12px",
};

const preStyle: React.CSSProperties = {
  background: "transparent",
  fontSize: "12px",
  color: "var(--text-muted)",
  overflowX: "auto",
  fontFamily: "var(--mono)",
  whiteSpace: "pre-wrap",
};
