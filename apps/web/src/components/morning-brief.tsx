type MorningBriefProps = {
  meetingsCount: number;
  unreadEmails: number;
  overdueTasks: number;
  focusWindow: string;
  suggestedTaskTitle: string;
  onStartFocus: () => void;
  onReviewEmails: () => void;
  onViewTasks: () => void;
};

export function MorningBrief({
  meetingsCount,
  unreadEmails,
  overdueTasks,
  focusWindow,
  suggestedTaskTitle,
  onStartFocus,
  onReviewEmails,
  onViewTasks,
}: MorningBriefProps) {
  const items = [
    `${meetingsCount} meetings on today’s calendar`,
    `${unreadEmails} unread emails worth a look`,
    `${overdueTasks} tasks that need attention`,
    `A ${focusWindow} focus window is open`,
  ];

  return (
    <section className="morning-brief-card">
      <div className="morning-brief-topline">Good morning. Here&apos;s what matters today.</div>

      <div className="morning-brief-list">
        {items.map((item) => (
          <div key={item} className="morning-brief-item">
            <span className="morning-brief-dot" aria-hidden="true" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="morning-brief-suggestion">
        <div className="morning-brief-label">Start here:</div>
        <div className="morning-brief-task">{suggestedTaskTitle}</div>
      </div>

      <div className="morning-brief-actions">
        <button type="button" className="button-primary" onClick={onStartFocus}>
          Start Focus
        </button>
        <button type="button" className="button-secondary" onClick={onReviewEmails}>
          Review Emails
        </button>
        <button type="button" className="button-secondary" onClick={onViewTasks}>
          View Tasks
        </button>
      </div>

      <div className="morning-brief-helper">You have time to make progress right now.</div>
    </section>
  );
}
