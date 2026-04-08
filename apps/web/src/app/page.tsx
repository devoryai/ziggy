"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CapabilityId, ContextId, RunRecord } from "@ziggy/shared";
import { MorningBrief } from "@/components/morning-brief";
import { QuickActions } from "@/components/quick-actions";
import { RecentActivity } from "@/components/recent-activity";
import { TaskList, type AttentionTask } from "@/components/task-list";

const CAPABILITIES: Array<{ id: CapabilityId; label: string; description: string }> = [
  { id: "email.read", label: "Read email", description: "Summarize unread work emails" },
  { id: "email.draft", label: "Draft replies", description: "Draft replies (requires approval)" },
  { id: "calendar.read", label: "Read calendar", description: "Review today's meetings" },
  { id: "files.propose_organize", label: "Propose file org", description: "Scan Downloads and propose organization" },
  { id: "files.apply_organize", label: "Apply file org", description: "Apply approved proposals (requires approval)" },
];

const CONTEXTS: Array<{ id: ContextId; label: string }> = [
  { id: "work_email", label: "Work email" },
  { id: "file_cleanup", label: "File cleanup" },
  { id: "calendar_prep", label: "Calendar prep" },
  { id: "casual", label: "Casual" },
  { id: "teaching", label: "Teaching" },
];

const TERMINAL_STATES = new Set(["completed", "failed", "blocked"]);

type PlanStep = { tool: CapabilityId; label?: string; reason: string };

type RunLaunchResponse = {
  runId: string;
  plan?: { summary: string; steps: PlanStep[] };
  execution?: { completed: boolean; results: unknown[] };
  error?: string;
};

type RunDetail = {
  run: RunRecord;
};

type TaskPreset = {
  title: string;
  goal: string;
  context: ContextId;
  capabilities: CapabilityId[];
};

type TaskCardData = TaskPreset & {
  key: string;
  lastRun: RunRecord;
};

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState<ContextId>("work_email");
  const [capabilities, setCapabilities] = useState<CapabilityId[]>([]);
  const [launching, setLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunDetail, setActiveRunDetail] = useState<RunDetail | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [activeTaskName, setActiveTaskName] = useState("");
  const createTaskRef = useRef<HTMLDivElement | null>(null);
  const taskListRef = useRef<HTMLDivElement | null>(null);

  const hasFileCapability = capabilities.some(
    (cap) => cap === "files.propose_organize" || cap === "files.apply_organize"
  );

  useEffect(() => {
    if (hasFileCapability && context === "work_email") {
      setContext("file_cleanup");
    }
  }, [hasFileCapability, context]);

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (!activeRunId) return;

    void loadRunDetail(activeRunId);
    const interval = window.setInterval(() => {
      void loadRunDetail(activeRunId);
    }, 1500);

    return () => window.clearInterval(interval);
  }, [activeRunId]);

  useEffect(() => {
    if (!activeRunDetail) return;
    if (TERMINAL_STATES.has(activeRunDetail.run.state)) {
      setLaunchStatus(null);
      void loadRuns();
    } else if (activeRunDetail.run.state === "awaiting_approval") {
      setLaunchStatus("Waiting for approval");
      void loadRuns();
    } else {
      setLaunchStatus("Ziggy is working…");
    }
  }, [activeRunDetail]);

  const taskCards = useMemo(() => buildTaskCards(runs), [runs]);
  const runIsActive =
    launching ||
    (activeRunDetail ? !TERMINAL_STATES.has(activeRunDetail.run.state) : false);

  const attentionMap = useMemo(
    () =>
      new Map(
        taskCards.map((task) => [
          task.key,
          {
            key: task.key,
            title: task.title,
            meta: `${formatRunAttention(task.lastRun)} • Last run ${formatDateTime(task.lastRun.created_at)}`,
          } satisfies AttentionTask,
        ])
      ),
    [taskCards]
  );

  const overdueTasks = useMemo(
    () =>
      taskCards
        .filter((task) =>
          ["failed", "blocked", "awaiting_approval"].includes(task.lastRun.state)
        )
        .slice(0, 4)
        .map((task) => attentionMap.get(task.key)!)
        .filter(Boolean),
    [attentionMap, taskCards]
  );

  const inProgressTasks = useMemo(
    () =>
      taskCards
        .filter((task) => ["queued", "planning", "executing"].includes(task.lastRun.state))
        .slice(0, 4)
        .map((task) => attentionMap.get(task.key)!)
        .filter(Boolean),
    [attentionMap, taskCards]
  );

  const suggestedTask =
    overdueTasks[0]?.title ??
    inProgressTasks[0]?.title ??
    taskCards[0]?.title ??
    "Review today and choose a calm first step";

  const meetingsCount = Math.max(
    1,
    Math.min(5, runs.filter((run) => run.capabilities.includes("calendar.read")).length || 2)
  );
  const unreadEmails = Math.max(
    3,
    Math.min(18, runs.filter((run) => run.capabilities.includes("email.read")).length * 2 || 6)
  );
  const focusWindow = activeRunDetail
    ? "You have a 90-minute focus window before your next meeting"
    : "You have a 90-minute focus window before your next meeting";

  const quickActions = [
    {
      label: "Start Focus Block",
      description: "Spin up a guided focus run around the next important task.",
      icon: "◔",
      onClick: () => void launchTask(makeFocusTask(taskCards[0])),
      disabled: runIsActive,
    },
    {
      label: "Review Inbox",
      description: "Read the inbox and surface what deserves your attention first.",
      icon: "✉",
      onClick: () => void launchTask(INBOX_TASK),
      disabled: runIsActive,
    },
    {
      label: "Draft Replies",
      description: "Prepare reply drafts for the messages that matter most.",
      icon: "✎",
      onClick: () => void launchTask(DRAFT_REPLIES_TASK),
      disabled: runIsActive,
    },
    {
      label: "Review Today",
      description: "Scan the calendar and get a clean picture of the day ahead.",
      icon: "☼",
      onClick: () => void launchTask(REVIEW_TODAY_TASK),
      disabled: runIsActive,
    },
  ];

  const recentActivityItems = runs.slice(0, 6).map((run) => ({
    id: run.id,
    href: `/runs/${run.id}`,
    text: `${formatActivityVerb(run)} (${formatRelativeTime(run.updated_at)})`,
  }));

  function toggleCap(id: CapabilityId) {
    setCapabilities((prev) =>
      prev.includes(id) ? prev.filter((capability) => capability !== id) : [...prev, id]
    );
  }

  async function loadRuns() {
    try {
      const res = await fetch("/api/runs");
      const data = await res.json();
      if (res.ok) {
        setRuns((data.runs ?? []) as RunRecord[]);
      }
    } catch {
      // Keep the UI usable even if refresh fails.
    }
  }

  async function loadRunDetail(runId: string) {
    try {
      const res = await fetch(`/api/runs/${runId}`);
      const data = await res.json();
      if (res.ok) {
        setActiveRunDetail(data as RunDetail);
      }
    } catch {
      // Polling failures should not tear down the page.
    }
  }

  async function launchTask(task: TaskPreset) {
    setLaunching(true);
    setLaunchStatus("Ziggy is working…");
    setError(null);
    setActiveRunId(null);
    setActiveRunDetail(null);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      const data = (await res.json()) as RunLaunchResponse;
      if (!res.ok) {
        setError(data.error ?? "Unknown error");
        setLaunchStatus(null);
        return;
      }

      setActiveRunId(data.runId);
      await Promise.all([loadRunDetail(data.runId), loadRuns()]);
    } catch (err) {
      setError(String(err));
      setLaunchStatus(null);
    } finally {
      setLaunching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !goal || capabilities.length === 0 || runIsActive) return;

    await launchTask({
      title,
      goal,
      context,
      capabilities,
    });
  }

  function applyTaskToForm(task: TaskPreset) {
    setTitle(task.title);
    setGoal(task.goal);
    setContext(task.context);
    setCapabilities(task.capabilities);
    setCreateTaskOpen(true);
    window.setTimeout(() => {
      createTaskRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function findTask(task: AttentionTask): TaskCardData | undefined {
    return taskCards.find((item) => item.key === task.key);
  }

  function handleStart(task: AttentionTask) {
    const match = findTask(task);
    if (!match) return;
    applyTaskToForm(match);
  }

  function handleRunAgain(task: AttentionTask) {
    const match = findTask(task);
    if (!match || runIsActive) return;
    void launchTask(match);
  }

  function handleFocus(task: AttentionTask) {
    const match = findTask(task);
    if (!match) return;
    setIsFocusActive(true);
    setActiveTaskName(match.title);
    if (runIsActive) return;
    void launchTask(makeFocusTask(match));
  }

  function handleViewTasks() {
    taskListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleEndEarly() {
    setIsFocusActive(false);
    setActiveTaskName("");
    setActiveRunId(null);
    setActiveRunDetail(null);
    setLaunchStatus(null);
  }

  function handleStartFocus(task?: TaskPreset) {
    const nextTaskName = task?.title ?? suggestedTask;
    setIsFocusActive(true);
    setActiveTaskName(nextTaskName);
    if (runIsActive) return;
    void launchTask(makeFocusTask(task));
  }

  function handleSwitchFocusTask() {
    setCreateTaskOpen(true);
    createTaskRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <header className="homepage-section">
        <div className="homepage-eyebrow">Daily Command Center</div>
        <h1 className="homepage-title">Your day, with clear guardrails</h1>
        <p className="homepage-subtitle">
          Ziggy keeps the day calm and inspectable, pulls forward what matters, and still asks before anything with real side effects.
        </p>
      </header>

      <section className="homepage-section">
        <div className="homepage-section-header">
          <div className="homepage-section-title">Morning Brief</div>
        </div>
        <MorningBrief
          meetingsCount={meetingsCount}
          unreadEmails={unreadEmails}
          overdueTasks={overdueTasks.length}
          focusWindow={focusWindow}
          suggestedTaskTitle={`Start here: ${suggestedTask.replace(/^Start here:\s*/i, "")}`}
          onStartFocus={() => handleStartFocus(taskCards[0])}
          onReviewEmails={() => void launchTask(INBOX_TASK)}
          onViewTasks={handleViewTasks}
        />
      </section>

      {isFocusActive ? (
        <section className="homepage-section">
          <div className="focus-block focus-banner">
            <div className="focus-block-top">
              <div>
                <div className="focus-block-title">Focus: {activeTaskName || suggestedTask}</div>
                <div className="focus-block-copy">I&apos;ll keep distractions down while you work.</div>
              </div>
            </div>

            <div className="focus-block-actions">
              <button type="button" className="button-secondary" onClick={handleEndEarly}>
                End Early
              </button>
              <button type="button" className="button-secondary">
                Extend 15 min
              </button>
              <button type="button" className="button-primary" onClick={handleSwitchFocusTask}>
                Switch Task
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="homepage-section">
        <div className="homepage-section-header">
          <div className="homepage-section-title">Quick Actions</div>
          <div className="homepage-section-copy">Simple shortcuts for the moves you repeat most often.</div>
        </div>
        <QuickActions actions={quickActions} />
      </section>

      <section ref={taskListRef} className="homepage-section">
        <div className="homepage-section-header">
          <div className="homepage-section-title">Tasks That Need Attention</div>
          <div className="homepage-section-copy">
            Pick up stalled work, revisit something important, or start focus from a familiar setup.
          </div>
        </div>
        <TaskList
          overdue={overdueTasks}
          inProgress={inProgressTasks}
          disabled={runIsActive}
          onStart={handleStart}
          onRunAgain={handleRunAgain}
          onFocus={handleFocus}
        />
      </section>

      <section className="homepage-section">
        <div className="homepage-section-header">
          <div className="homepage-section-title">Recent Activity</div>
          <div className="homepage-section-copy">What Ziggy handled recently</div>
        </div>
        <RecentActivity items={recentActivityItems} />
      </section>

      <section ref={createTaskRef} className="homepage-section homepage-card create-task-shell">
        <div className="homepage-section-header">
          <div className="homepage-section-title">Create a task</div>
          <div className="homepage-section-copy">Build something custom when today needs a different shape.</div>
        </div>

        <button
          type="button"
          className="create-task-toggle"
          onClick={() => setCreateTaskOpen((open) => !open)}
        >
          {createTaskOpen ? "Hide form" : "Show form"}
        </button>

        {createTaskOpen ? (
          <form onSubmit={handleSubmit} className="create-task-form">
            <div className="form-field">
              <label className="form-label">Title</label>
              <input
                className="input-shell"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Review unread work emails"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label">Goal</label>
              <textarea
                className="input-shell"
                style={{ minHeight: "6rem", resize: "vertical" }}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Describe what you want done, in plain language."
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label">Context</label>
              <select
                className="input-shell"
                value={context}
                onChange={(e) => setContext(e.target.value as ContextId)}
              >
                {CONTEXTS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">Capabilities</label>
              <div className="capability-list">
                {CAPABILITIES.map((capability) => {
                  const active = capabilities.includes(capability.id);

                  return (
                    <label
                      key={capability.id}
                      className={`capability-option${active ? " active" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleCap(capability.id)}
                        style={{ marginTop: "0.15rem", accentColor: "var(--accent)" }}
                      />
                      <span>
                        <strong>{capability.label}</strong>
                        <br />
                        <span className="homepage-section-copy">{capability.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="create-task-actions">
              <button
                type="submit"
                className="button-primary"
                disabled={runIsActive || capabilities.length === 0}
              >
                {runIsActive ? "Running…" : "Run Task"}
              </button>
              {(runIsActive || launchStatus) && (
                <div className="status-inline" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {runIsActive ? <span className="spinner" aria-hidden="true" /> : null}
                  <span>{launchStatus ?? "Ziggy is working…"}</span>
                </div>
              )}
            </div>
          </form>
        ) : null}

        {error ? <div className="error-banner">{error}</div> : null}
      </section>
    </div>
  );
}

function buildTaskCards(runs: RunRecord[]): TaskCardData[] {
  const grouped = new Map<string, TaskCardData>();

  for (const run of runs) {
    const task = {
      title: run.task_title,
      goal: run.task_goal,
      context: run.context,
      capabilities: run.capabilities,
    } satisfies TaskPreset;

    const key = getTaskKey(task);
    if (!grouped.has(key)) {
      grouped.set(key, { ...task, key, lastRun: run });
    }
  }

  return Array.from(grouped.values());
}

function getTaskKey(task: TaskPreset): string {
  return JSON.stringify({
    title: task.title,
    goal: task.goal,
    context: task.context,
    capabilities: [...task.capabilities].sort(),
  });
}

function getRunStatusText(run: Pick<RunRecord, "state">): string {
  if (run.state === "awaiting_approval") return "Waiting for approval";
  if (run.state === "queued") return "Queued";
  if (run.state === "planning") return "Planning";
  if (run.state === "executing") return "In progress";
  if (run.state === "failed") return "Needs attention";
  if (run.state === "blocked") return "Blocked";
  return "Completed";
}

function formatRunAttention(run: RunRecord): string {
  if (run.state === "awaiting_approval") return "Approval waiting";
  if (run.state === "failed") return "Follow-up needed";
  if (run.state === "blocked") return "Blocked last time";
  if (run.state === "queued" || run.state === "planning" || run.state === "executing") {
    return "In progress";
  }
  return "Ready to reuse";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatActivityVerb(run: RunRecord): string {
  if (run.capabilities.includes("email.read")) {
    return `Summarized inbox for "${run.task_title}"`;
  }
  if (run.capabilities.includes("email.draft")) {
    return `Prepared drafts for "${run.task_title}"`;
  }
  if (run.capabilities.includes("calendar.read")) {
    return `Reviewed today for "${run.task_title}"`;
  }
  if (run.capabilities.includes("files.apply_organize")) {
    return `Applied file changes for "${run.task_title}"`;
  }
  if (run.capabilities.includes("files.propose_organize")) {
    return `Prepared file review for "${run.task_title}"`;
  }
  return `Updated "${run.task_title}"`;
}

function makeFocusTask(task?: TaskPreset): TaskPreset {
  if (!task) {
    return {
      title: "Start focus block",
      goal: "Review today's priorities, pick a calm starting point, and begin focused work.",
      context: "calendar_prep",
      capabilities: ["calendar.read"],
    };
  }

  return {
    title: task.title,
    goal: `${task.goal} Keep distractions down and make this the active focus block.`,
    context: task.context,
    capabilities: task.capabilities,
  };
}

const INBOX_TASK: TaskPreset = {
  title: "Review inbox",
  goal: "Read unread work email and surface the messages that matter first.",
  context: "work_email",
  capabilities: ["email.read"],
};

const DRAFT_REPLIES_TASK: TaskPreset = {
  title: "Draft replies",
  goal: "Review the inbox and prepare reply drafts for the most important messages.",
  context: "work_email",
  capabilities: ["email.read", "email.draft"],
};

const REVIEW_TODAY_TASK: TaskPreset = {
  title: "Review today",
  goal: "Read today's calendar and summarize the meetings that shape the day.",
  context: "calendar_prep",
  capabilities: ["calendar.read"],
};
