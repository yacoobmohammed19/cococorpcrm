type Props = {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon = "📭", title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-5xl mb-4 opacity-60">{icon}</span>
      <h3 className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>{title}</h3>
      {description && (
        <p className="text-sm mb-5 max-w-xs" style={{ color: "var(--muted2)" }}>{description}</p>
      )}
      {action}
    </div>
  );
}
