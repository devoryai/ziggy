export type QuickAction = {
  label: string;
  description: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
};

type QuickActionsProps = {
  actions: QuickAction[];
};

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="quick-actions-grid">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="quick-action-item"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          <div className="quick-action-icon" aria-hidden="true">
            {action.icon ?? "•"}
          </div>
          <div className="quick-action-title">{action.label}</div>
          <div className="quick-action-copy">{action.description}</div>
        </button>
      ))}
    </div>
  );
}
