import Dexie from "dexie";
import { supabase } from "./supabase";

const db = new Dexie("bibliesi-admin-offline");

db.version(1).stores({
  actions: "++id, type, status, createdAt, updatedAt, attempts",
});

export const OFFLINE_QUEUE_EVENT = "bibliesi-offline-queue-change";

function emitQueueChange() {
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
}

export async function enqueueOfflineAction(action) {
  const now = new Date().toISOString();
  const id = await db.actions.add({
    ...action,
    status: "pending",
    attempts: 0,
    lastError: "",
    createdAt: now,
    updatedAt: now,
  });
  emitQueueChange();
  return id;
}

export async function getPendingOfflineActions() {
  return db.actions.where("status").equals("pending").sortBy("createdAt");
}

export async function getPendingOfflineCount() {
  return db.actions.where("status").equals("pending").count();
}

export async function deleteOfflineAction(id) {
  await db.actions.delete(id);
  emitQueueChange();
}

async function uploadBlob(bucketName, path, blob) {
  const { error } = await supabase.storage.from(bucketName).upload(path, blob, {
    contentType: blob?.type || "image/jpeg",
    cacheControl: "86400",
    upsert: false,
  });
  if (error) throw error;
}

async function publicUrl(bucketName, path) {
  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return data.publicUrl;
}

async function replayAction(action) {
  if (action.type === "book:create") {
    let couvertureUrl = action.payload.couverture_url || null;
    if (action.files?.cover?.blob && action.files?.cover?.path) {
      await uploadBlob("bibli-covers", action.files.cover.path, action.files.cover.blob);
      couvertureUrl = await publicUrl("bibli-covers", action.files.cover.path);
    }
    const { error } = await supabase.from("bibli_livres").insert([{
      ...action.payload,
      couverture_url: couvertureUrl,
    }]);
    if (error) throw error;
    return;
  }

  if (action.type === "pending-book:create") {
    await uploadBlob("bibli-pending-books", action.files.cover.path, action.files.cover.blob);
    await uploadBlob("bibli-pending-books", action.files.evidence.path, action.files.evidence.blob);
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from("bibli_pending_books").insert({
      ...action.payload,
      created_by: action.payload.created_by || authData?.user?.id || null,
    });
    if (error) throw error;
    return;
  }

  if (action.type === "student:create") {
    if (action.files?.card?.blob && action.files?.card?.path) {
      await uploadBlob("bibli-student-cards", action.files.card.path, action.files.card.blob);
    }
    const { error } = await supabase.from("bibli_etudiants").insert([action.payload]);
    if (error) throw error;
    return;
  }

  if (action.type === "loan:create") {
    const { data: currentBook, error: bookError } = await supabase
      .from("bibli_livres")
      .select("id, disponible")
      .eq("id", action.payload.livre_id)
      .maybeSingle();
    if (bookError) throw bookError;
    if (!currentBook?.disponible) {
      throw new Error("Livre indisponible au moment de la synchronisation.");
    }
    const { data: createdLoan, error: loanError } = await supabase
      .from("bibli_prets")
      .insert([action.payload])
      .select("id")
      .single();
    if (loanError) throw loanError;
    const { error: bookUpdateError } = await supabase
      .from("bibli_livres")
      .update({ disponible: false, statut: "emprunte" })
      .eq("id", action.payload.livre_id);
    if (bookUpdateError) {
      await supabase.from("bibli_prets").delete().eq("id", createdLoan.id);
      throw bookUpdateError;
    }
    return;
  }

  throw new Error(`Type d'action inconnu : ${action.type}`);
}

export async function processOfflineQueue() {
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  const actions = await getPendingOfflineActions();
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      await replayAction(action);
      await db.actions.delete(action.id);
      synced += 1;
    } catch (error) {
      failed += 1;
      await db.actions.update(action.id, {
        attempts: (action.attempts || 0) + 1,
        lastError: error?.message || "Erreur inconnue",
        updatedAt: new Date().toISOString(),
      });
    }
  }

  emitQueueChange();
  return { synced, failed };
}

export function shouldQueueWriteError(error) {
  if (!navigator.onLine) return true;
  const message = String(error?.message || error || "");
  return /failed to fetch|network|load failed|timeout|502|503|504|supabase|fetch/i.test(message);
}
