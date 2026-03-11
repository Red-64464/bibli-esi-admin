import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/utils";
import { Calendar, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  // 0=Sun → convert to Mon-based
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function Calendrier() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [prets, setPrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    fetchPrets();
  }, [year, month]);

  const fetchPrets = async () => {
    try {
      setLoading(true);
      const start = new Date(year, month, 1).toISOString().slice(0, 10);
      const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

      const { data, error: err } = await supabase
        .from("prets")
        .select("id, date_retour_prevue, date_pret, rendu, livres(titre), etudiants(nom, prenom)")
        .eq("rendu", false)
        .gte("date_retour_prevue", start)
        .lte("date_retour_prevue", end);

      if (err) throw err;
      setPrets(data || []);
    } catch (err) {
      setError("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  // Grouper les prêts par jour de retour
  const pretsByDay = {};
  prets.forEach((p) => {
    if (!p.date_retour_prevue) return;
    const day = new Date(p.date_retour_prevue).getDate();
    if (!pretsByDay[day]) pretsByDay[day] = [];
    pretsByDay[day].push(p);
  });

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const selectedPrets = selectedDay ? (pretsByDay[selectedDay] || []) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Calendar className="w-8 h-8 text-biblio-accent" />
          Calendrier des retours
        </h1>
        <p className="text-biblio-muted mt-1">
          Retours prévus pour {MONTH_NAMES[month]} {year}
        </p>
      </div>

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
        {/* Navigation mois */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-white/10 text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-biblio-text">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-white/10 text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
          </div>
        ) : (
          <div className="p-4">
            {/* En-têtes jours */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_NAMES.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-biblio-muted py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grille jours */}
            <div className="grid grid-cols-7 gap-1">
              {/* Cases vides au début */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-14" />
              ))}

              {/* Jours du mois */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayPrets = pretsByDay[day] || [];
                const isToday =
                  day === today.getDate() &&
                  month === today.getMonth() &&
                  year === today.getFullYear();
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    onClick={() =>
                      setSelectedDay(selectedDay === day ? null : day)
                    }
                    className={`h-14 rounded-lg flex flex-col items-center justify-start pt-1.5 transition-colors relative
                      ${isSelected ? "bg-biblio-accent/20 border border-biblio-accent" : "hover:bg-white/5 border border-transparent"}
                      ${isToday ? "ring-1 ring-biblio-accent" : ""}
                    `}
                  >
                    <span
                      className={`text-sm font-medium ${isToday ? "text-biblio-accent" : "text-biblio-text"}`}
                    >
                      {day}
                    </span>
                    {dayPrets.length > 0 && (
                      <span className="mt-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-biblio-warning/20 text-biblio-warning text-[10px] font-bold px-1">
                        {dayPrets.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && (
        <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="font-semibold text-biblio-text">
              Retours prévus le {selectedDay} {MONTH_NAMES[month]} {year}
              <span className="ml-2 text-biblio-muted text-sm font-normal">
                ({selectedPrets.length} prêt{selectedPrets.length !== 1 ? "s" : ""})
              </span>
            </h3>
          </div>
          {selectedPrets.length === 0 ? (
            <p className="px-6 py-4 text-sm text-biblio-muted">
              Aucun retour prévu ce jour.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {selectedPrets.map((p) => (
                <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-biblio-text line-clamp-1">
                      {p.livres?.titre || "—"}
                    </p>
                    <p className="text-xs text-biblio-muted">
                      {p.etudiants
                        ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                        : "—"}
                    </p>
                  </div>
                  <span className="text-xs text-biblio-muted">
                    {formatDate(p.date_retour_prevue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
