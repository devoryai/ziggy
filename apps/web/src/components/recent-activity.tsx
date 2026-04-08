type RecentActivityItem = {
  id: string;
  text: string;
  href?: string;
};

type RecentActivityProps = {
  items: RecentActivityItem[];
};

export function RecentActivity({ items }: RecentActivityProps) {
  if (items.length === 0) {
    return <div className="task-empty">Nothing has run yet.</div>;
  }

  return (
    <div className="recent-activity-list">
      {items.map((item) => (
        <div key={item.id} className="recent-activity-item">
          {item.href ? <a href={item.href}>{item.text}</a> : item.text}
        </div>
      ))}
    </div>
  );
}
