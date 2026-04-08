export type AttentionTask = {
  key: string;
  title: string;
  meta: string;
};

type TaskListProps = {
  overdue: AttentionTask[];
  inProgress: AttentionTask[];
  disabled: boolean;
  onStart: (task: AttentionTask) => void;
  onRunAgain: (task: AttentionTask) => void;
  onFocus: (task: AttentionTask) => void;
};

function TaskGroup({
  title,
  items,
  disabled,
  onStart,
  onRunAgain,
  onFocus,
}: {
  title: string;
  items: AttentionTask[];
  disabled: boolean;
  onStart: (task: AttentionTask) => void;
  onRunAgain: (task: AttentionTask) => void;
  onFocus: (task: AttentionTask) => void;
}) {
  return (
    <div className="task-list-group">
      <div className="task-list-group-title">{title}</div>
      {items.length > 0 ? (
        items.map((task) => (
          <div key={task.key} className="task-card">
            <div className="task-card-main">
              <div className="task-card-title">{task.title}</div>
              <div className="task-card-meta">{task.meta}</div>
            </div>
            <div className="task-list-actions">
              <button
                type="button"
                className="task-action-button"
                onClick={() => onStart(task)}
                disabled={disabled}
              >
                Start
              </button>
              <button
                type="button"
                className="task-action-button"
                onClick={() => onRunAgain(task)}
                disabled={disabled}
              >
                Run again
              </button>
              <button
                type="button"
                className="task-action-button"
                onClick={() => onFocus(task)}
                disabled={disabled}
              >
                Focus
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="task-empty">Nothing here right now.</div>
      )}
    </div>
  );
}

export function TaskList({
  overdue,
  inProgress,
  disabled,
  onStart,
  onRunAgain,
  onFocus,
}: TaskListProps) {
  return (
    <div className="task-list-grid">
      <div className="task-list-columns">
        <TaskGroup
          title="Overdue"
          items={overdue}
          disabled={disabled}
          onStart={onStart}
          onRunAgain={onRunAgain}
          onFocus={onFocus}
        />
        <TaskGroup
          title="In Progress"
          items={inProgress}
          disabled={disabled}
          onStart={onStart}
          onRunAgain={onRunAgain}
          onFocus={onFocus}
        />
      </div>
    </div>
  );
}
