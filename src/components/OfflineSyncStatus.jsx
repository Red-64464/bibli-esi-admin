import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import {
  OFFLINE_QUEUE_EVENT,
  getPendingOfflineCount,
  processOfflineQueue,
} from "../lib/offlineQueue";
import { useToast } from "../contexts/ToastContext";

export default function OfflineSyncStatus() {
  const toast = useToast();
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    setCount(await getPendingOfflineCount());
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const result = await processOfflineQueue();
      await refreshCount();
      if (result.synced > 0) toast.success(`${result.synced} sauvegarde(s) locale(s) synchronisée(s).`);
      if (result.failed > 0) toast.warning(`${result.failed} sauvegarde(s) restent en attente.`);
    } finally {
      setSyncing(false);
    }
  }, [refreshCount, syncing, toast]);

  useEffect(() => {
    refreshCount();
    const updateOnline = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) setTimeout(sync, 500);
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshCount);
    const interval = setInterval(() => {
      refreshCount();
      if (navigator.onLine) sync();
    }, 30000);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshCount);
      clearInterval(interval);
    };
  }, [refreshCount, sync]);

  if (online && count === 0) return null;

  return (
    <button
      type="button"
      onClick={sync}
      disabled={!online || syncing}
      className="flex items-center gap-2 rounded-lg border border-biblio-warning/40 bg-biblio-warning/15 px-3 py-2 text-xs font-medium text-biblio-warning disabled:opacity-70"
      title={online ? "Synchroniser les sauvegardes locales" : "Hors ligne"}
    >
      {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CloudOff className="h-4 w-4" />}
      <span className="hidden sm:inline">
        {online ? `${count} en attente` : "Hors ligne"}
      </span>
      <span className="sm:hidden">{count || "!"}</span>
    </button>
  );
}
