export default function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-biblio-accent",
  onClick,
  active = false,
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-biblio-card rounded-xl p-6 border flex items-center gap-4 transition-all
        ${onClick ? "cursor-pointer hover:border-biblio-accent/50 hover:bg-white/[0.03]" : ""}
        ${active ? "border-biblio-accent bg-biblio-accent/5" : "border-white/10"}
      `}
    >
      <div className={`p-3 rounded-lg bg-white/5 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-biblio-muted">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      {active && (
        <div className="w-2 h-2 rounded-full bg-biblio-accent shrink-0" />
      )}
    </div>
  );
}
