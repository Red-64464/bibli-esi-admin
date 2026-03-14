import { useEffect } from "react";
import { supabase } from "./supabase";

/**
 * Hook pour écouter les changements en temps réel sur une table Supabase.
 * @param {string} table - Nom de la table
 * @param {function} onChange - Callback appelé lors d'un changement (payload)
 * @param {object} [filter] - Filtre optionnel { column, value }
 */
export function useRealtimeTable(table, onChange, filter) {
  useEffect(() => {
    let channel = supabase.channel(
      `realtime-${table}-${filter?.value || "all"}`,
    );

    let subscription = channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
      },
      (payload) => {
        onChange(payload);
      },
    );

    subscription.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter?.column, filter?.value]);
}
