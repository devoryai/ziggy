type FocusBlockProps = {
  taskName: string;
  timerLabel: string;
  stateLabel: string;
  onEndEarly: () => void;
  onExtend: () => void;
  onSwitchTask: () => void;
  detailHref?: string;
};

export function FocusBlock({
  taskName,
  timerLabel,
  stateLabel,
  onEndEarly,
  onExtend,
  onSwitchTask,
  detailHref,
}: FocusBlockProps) {
  return (
    <section className="focus-block">
      <div className="focus-block-top">
        <div>
          <div className="focus-block-title">Focus: {taskName}</div>
          <div className="focus-block-copy">I&apos;ll keep distractions down while you work.</div>
          <div className="focus-block-meta">Status: {stateLabel}</div>
        </div>
        <div className="focus-block-timer">{timerLabel}</div>
      </div>

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

      {detailHref ? (
        <a className="focus-block-link" href={detailHref}>
          Open run detail →
        </a>
      ) : null}
    </section>
  );
}
