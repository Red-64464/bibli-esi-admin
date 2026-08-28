import { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, Loader2, CheckCircle2, AlertTriangle, Radio } from "lucide-react";
import { getSettings, saveSettings } from "../lib/settings";
import { logActivity } from "../lib/activityLog";
import { useRealtimeTables } from "../lib/realtime";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function Affluence() {
  const { session } = useAuth();
  const toast = useToast();
  const [capacity, setCapacity] = useState(3);
  const [occupancy, setOccupancy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saved = useRef({ capacity: 3, occupancy: 0 });
  const current = useRef({ capacity: 3, occupancy: 0 });
  const pending = useRef(null);
  const saveTimer = useRef(null);
  const savingRef = useRef(false);

  const load = async () => {
    // Ne jamais écraser le geste en cours avec un événement Realtime plus ancien.
    if (saveTimer.current || savingRef.current) return;
    const settings = await getSettings();
    if (saveTimer.current || savingRef.current) return;
    const nextCapacity = Math.max(1, Number.parseInt(settings.library_capacity || "3", 10) || 3);
    const nextOccupancy = clamp(Number.parseInt(settings.library_current_occupancy || "0", 10) || 0, 0, nextCapacity);
    const next = { capacity: nextCapacity, occupancy: nextOccupancy };
    saved.current = next;
    current.current = next;
    setCapacity(next.capacity);
    setOccupancy(next.occupancy);
  };

  useEffect(() => {
    load().catch(() => toast.error("Impossible de charger l'affluence.")).finally(() => setLoading(false));
    return () => clearTimeout(saveTimer.current);
  }, []);

  useRealtimeTables(["bibli_settings"], () => load());

  const persist = async () => {
    const next = pending.current;
    pending.current = null;
    saveTimer.current = null;
    if (!next || (next.capacity === saved.current.capacity && next.occupancy === saved.current.occupancy)) return;

    savingRef.current = true;
    setSaving(true);
    try {
      // Une seule requête atomique : le public ne peut jamais recevoir 7/3 ou 3/8.
      await saveSettings({
        library_capacity: String(next.capacity),
        library_current_occupancy: String(next.occupancy),
      });
      saved.current = next;
      current.current = next;
      await logActivity({
        action_type: "affluence_modifiee",
        description: `Affluence : ${next.occupancy} personne(s) présente(s) sur ${next.capacity}.`,
        user_info: session?.username || "",
      }).catch(() => undefined);
    } catch (error) {
      current.current = saved.current;
      setCapacity(saved.current.capacity);
      setOccupancy(saved.current.occupancy);
      toast.error("La mise à jour a échoué : " + error.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const queue = (next) => {
    current.current = next;
    pending.current = next;
    setCapacity(next.capacity);
    setOccupancy(next.occupancy);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 250);
  };

  const queueOccupancy = (raw) => {
    const next = { ...current.current, occupancy: clamp(Number(raw), 0, current.current.capacity) };
    queue(next);
  };

  const queueCapacity = (raw) => {
    const nextCapacity = clamp(Number(raw), 1, 10);
    queue({ capacity: nextCapacity, occupancy: Math.min(current.current.occupancy, nextCapacity) });
  };

  const state = useMemo(() => {
    if (occupancy >= capacity) return { label: "Bondée", detail: "Les élèves voient qu'il faut attendre avant de venir.", color: "red", Icon: AlertTriangle };
    if (occupancy >= Math.max(1, capacity - 1)) return { label: "Presque complète", detail: "Il reste une place au maximum.", color: "amber", Icon: Gauge };
    return { label: "Calme", detail: "Les élèves voient qu'ils peuvent venir.", color: "green", Icon: CheckCircle2 };
  }, [capacity, occupancy]);

  const cardClasses = {
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
  };
  const StateIcon = state.Icon;

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-biblio-accent" /></div>;

  return <div className="max-w-3xl space-y-6">
    <div><h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3"><Gauge className="w-7 h-7 text-biblio-accent" /> Affluence</h1><p className="text-biblio-muted mt-1 text-sm">Glisse le curseur : l'enregistrement et le site public sont mis à jour automatiquement.</p></div>
    <section className={`rounded-2xl border p-5 sm:p-6 ${cardClasses[state.color]}`}><div className="flex items-start gap-4"><StateIcon className="w-8 h-8 shrink-0 mt-0.5" /><div><p className="text-lg font-bold">Bibliothèque {state.label.toLowerCase()}</p><p className="text-sm mt-1 opacity-90">{state.detail}</p><p className="mt-4 text-3xl font-bold">{occupancy} <span className="text-base font-medium opacity-80">/ {capacity} personne{capacity > 1 ? "s" : ""}</span></p></div></div></section>
    <section className="bg-biblio-card rounded-xl border border-white/10 p-5 sm:p-6 space-y-5"><div className="flex items-center gap-2"><Radio className="w-5 h-5 text-biblio-accent" /><h2 className="font-semibold">Personnes présentes maintenant</h2></div><input type="range" min="0" max={capacity} step="1" value={occupancy} disabled={saving} onChange={(e) => queueOccupancy(e.target.value)} className="w-full h-3 cursor-pointer accent-[var(--color-biblio-accent)] disabled:opacity-60" aria-label="Nombre de personnes présentes" /><div className="flex justify-between px-1 text-sm font-semibold text-biblio-text">{Array.from({ length: capacity + 1 }, (_, value) => <span key={value} className={value === occupancy ? "text-biblio-accent scale-110" : "text-biblio-muted"}>{value}</span>)}</div><p className="text-xs text-biblio-muted text-center">Enregistrement automatique… {saving ? "en cours" : "prêt"}.</p></section>
    <section className="bg-biblio-card rounded-xl border border-white/10 p-5 space-y-3"><h2 className="font-semibold">Capacité maximale</h2><p className="text-sm text-biblio-muted">À modifier uniquement si la taille du local change.</p><input type="range" min="1" max="10" step="1" value={capacity} disabled={saving} onChange={(e) => queueCapacity(e.target.value)} className="w-full h-2 cursor-pointer accent-[var(--color-biblio-accent)] disabled:opacity-60" aria-label="Capacité maximale" /><p className="text-sm font-semibold text-biblio-accent">{capacity} personnes maximum</p></section>
  </div>;
}