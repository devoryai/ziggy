type FocusBlockProps = {
  taskName: string;
  timerLabel?: string;
  stateLabel?: string;
  progressPercent?: number;
  isComplete?: boolean;
  onEndEarly: () => void;
  onExtend: () => void;
  onSwitchTask: () => void;
  onStartAnother?: () => void;
  onReturnToTasks?: () => void;
  detailHref?: string;
};

export function FocusBlock({
  taskName,
  timerLabel,
  stateLabel,
  progressPercent,
  isComplete = false,
  onEndEarly,
  onExtend,
  onSwitchTask,
  onStartAnother,
  onReturnToTasks,
  detailHref,
}: FocusBlockProps) {
  return (
    <section className="focus-block">
      {isComplete ? (
        <>
          <div className="focus-block-top">
            <div>
              <div className="focus-block-title">Focus complete.</div>
              <div className="focus-block-copy">You made progress on {taskName}.</div>
            </div>
          </div>

          <div className="focus-block-actions">
            <button type="button" className="button-primary" onClick={onStartAnother}>
              Start another session
            </button>
            <button type="button" className="button-secondary" onClick={onReturnToTasks}>
              Return to tasks
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="focus-block-top">
            <div>
              <div className="focus-block-title">Focus: {taskName}</div>
              <div className="focus-block-copy">I&apos;ll keep distractions down while you work.</div>
              {stateLabel ? <div className="focus-block-meta">Status: {stateLabel}</div> : null}
            </div>
            {timerLabel ? <div className="focus-block-timer">{timerLabel}</div> : null}
          </div>

          {typeof progressPercent === "number" ? (
            <div className="focus-progress" aria-hidden="true">
              <div
                className="focus-progress-bar"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          ) : null}

          <div className="focus-block-actions">
            <button type="button" className="button-secondary" onClick={onEndEarly}>
              End Early
            </button>
            <button type="button" className="button-secondary" onClick={onExtend}>
              Extend 15 min
            </button>
            <button type="button" className="button-primary" onClick={onSwitchTask}>
              Switch Task
            </button>
          </div>
        </>
      )}

      {detailHref ? (
        <a className="focus-block-link" href={detailHref}>
          Open run detail →
        </a>
      ) : null}
    </section>
  );
}
