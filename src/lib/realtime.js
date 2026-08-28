import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

/**
 * Réagit aux changements Supabase sans recharger la page.
 * Un seul canal est ouvert pour la page active et les rafales sont regroupées.
 */
export function useRealtimeTables(tables, onChange, delay = 250) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;
  const key = [...tables].sort().join("|");

  useEffect(() => {
    const names = key ? key.split("|") : [];
    if (!names.length) return undefined;
    let timer;
    const channel = supabase.channel(`live-${key}`);
    const refresh = (payload) => {
      clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current(payload), delay);
    };
    names.forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh));
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, delay]);
}

/** Compatibilité avec les anciens appels d'une seule table. */
export function useRealtimeTable(table, onChange) {
  useRealtimeTables([table], onChange);
}
