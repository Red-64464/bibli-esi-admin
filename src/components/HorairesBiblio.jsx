import { useState, useEffect } from "react";
import { getSettings, DEFAULT_HOURS } from "../lib/settings";
import { Clock, AlertOctagon, CheckCircle, XCircle } from "lucide-react";

const JOURS = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" },
  { key: "samedi", label: "Samedi" },
  { key: "dimanche", label: "Dimanche" },
];

// 0 = dimanche dans JS, on mappe vers nos clés
const JS_DAY_TO_KEY = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

function isCurrentlyOpen(hours) {
  const now = new Date();
  const dayKey = JS_DAY_TO_KEY[now.getDay()];
  const jour = hours[dayKey];
  if (!jour?.ouvert || !jour.debut || !jour.fin) return false;

  const [hd, md] = jour.debut.split(":").map(Number);
  const [hf, mf] = jour.fin.split(":").map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const debutMinutes = hd * 60 + md;
  const finMinutes = hf * 60 + mf;
  return nowMinutes >= debutMinutes && nowMinutes < finMinutes;
}

export default function HorairesBiblio({ compact = false }) {
  const [hours, setHours] = useState(null);
  const [isClosed, setIsClosed] = useState(false);
  const [closedMessage, setClosedMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((s) => {
        try {
          setHours(JSON.parse(s.library_hours));
        } catch {
          setHours({ ...DEFAULT_HOURS });
        }
        setIsClosed(s.library_is_closed === "true");
        setClosedMessage(s.library_closed_message || "");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const open = !isClosed && hours && isCurrentlyOpen(hours);

  // ── Compact badge (pour navbar / dashboard) ──────────────────────────────
  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          isClosed
            ? "bg-biblio-danger/10 text-biblio-danger"
            : open
              ? "bg-biblio-success/10 text-biblio-success"
              : "bg-white/10 text-biblio-muted"
        }`}
      >
        {isClosed ? (
          <AlertOctagon className="w-3 h-3" />
        ) : open ? (
          <CheckCircle className="w-3 h-3" />
        ) : (
          <XCircle className="w-3 h-3" />
        )}
        {isClosed ? "Fermeture exceptionnelle" : open ? "Ouvert" : "Fermé"}
      </div>
    );
  }

  // ── Bloc complet (pour page étudiant / calendrier) ───────────────────────
  return (
    <div className="bg-biblio-card rounded-xl border border-white/10 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-biblio-accent" />
        <h3 className="text-base font-semibold">Horaires d'ouverture</h3>
        <div
          className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isClosed
              ? "bg-biblio-danger/10 text-biblio-danger"
              : open
                ? "bg-biblio-success/10 text-biblio-success"
                : "bg-amber-500/10 text-amber-400"
          }`}
        >
          {isClosed ? (
            <>
              <AlertOctagon className="w-3 h-3" /> Fermeture exceptionnelle
            </>
          ) : open ? (
            <>
              <CheckCircle className="w-3 h-3" /> Ouvert maintenant
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3" /> Actuellement fermé
            </>
          )}
        </div>
      </div>

      {/* Message fermeture exceptionnelle */}
      {isClosed && closedMessage && (
        <div className="bg-biblio-danger/10 text-biblio-danger rounded-lg px-4 py-3 text-sm flex items-start gap-2">
          <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
          {closedMessage}
        </div>
      )}

      {/* Grille des jours */}
      <div className="space-y-1">
        {hours &&
          JOURS.map(({ key, label }) => {
            const jour = hours[key] || { ouvert: false, debut: "", fin: "" };
            const todayKey = JS_DAY_TO_KEY[new Date().getDay()];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  isToday
                    ? "bg-biblio-accent/10 border border-biblio-accent/20"
                    : "hover:bg-white/5"
                }`}
              >
                <span
                  className={`font-medium ${isToday ? "text-biblio-accent" : "text-biblio-text"}`}
                >
                  {label}
                  {isToday && (
                    <span className="ml-2 text-xs opacity-70">
                      (aujourd'hui)
                    </span>
                  )}
                </span>
                {jour.ouvert && jour.debut && jour.fin ? (
                  <span
                    className={
                      isToday ? "text-biblio-accent" : "text-biblio-muted"
                    }
                  >
                    {jour.debut} – {jour.fin}
                  </span>
                ) : (
                  <span className="text-biblio-danger text-xs">Fermé</span>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
