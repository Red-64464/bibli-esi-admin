import { X, FileText, FileCode, Table } from "lucide-react";

const formats = [
  {
    key: "csv",
    label: "CSV",
    desc: "Compatible Excel, Google Sheets",
    icon: FileText,
    color: "text-biblio-success",
  },
  {
    key: "excel",
    label: "Excel (.xlsx)",
    desc: "Format natif Microsoft Excel",
    icon: Table,
    color: "text-biblio-accent",
  },
  {
    key: "json",
    label: "JSON",
    desc: "Format pour développeurs / APIs",
    icon: FileCode,
    color: "text-biblio-warning",
  },
];

export default function ExportModal({
  onClose,
  onExport,
  title = "Exporter les données",
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-biblio-card rounded-2xl border border-white/10 p-6 w-80 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-biblio-muted">
          Choisissez le format d'export :
        </p>

        <div className="space-y-2">
          {formats.map(({ key, label, desc, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => {
                onExport(key);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left group"
            >
              <Icon className={`w-5 h-5 shrink-0 ${color}`} />
              <div>
                <p className="text-sm font-medium group-hover:text-biblio-text transition-colors">
                  {label}
                </p>
                <p className="text-xs text-biblio-muted">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
