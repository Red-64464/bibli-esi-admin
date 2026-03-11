export default function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-biblio-accent",
}) {
  return (
    <div className="bg-biblio-card rounded-xl p-6 border border-white/10 flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-white/5 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-biblio-muted">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
