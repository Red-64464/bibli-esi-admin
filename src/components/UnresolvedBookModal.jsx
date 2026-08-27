import { useRef, useState } from "react";
import { AlertCircle, Camera, FileText, ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "../lib/supabase";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function PhotoField({ label, help, file, onChange }) {
  const inputRef = useRef(null);
  const preview = file ? URL.createObjectURL(file) : "";

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-biblio-text">{label} <span className="text-biblio-danger">*</span></p>
      <p className="text-xs text-biblio-muted">{help}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      {file ? (
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/20">
          <img src={preview} alt={label} className="h-40 w-full object-contain" />
          <button type="button" onClick={() => onChange(null)} className="absolute right-2 top-2 rounded-full bg-biblio-danger p-1.5 text-white" aria-label={`Retirer ${label}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 text-biblio-muted hover:border-biblio-accent hover:text-biblio-text">
          <ImagePlus className="h-6 w-6" />
          Prendre ou choisir la photo
        </button>
      )}
    </div>
  );
}

function validateFile(file) {
  if (!file) return "Les deux photos sont obligatoires.";
  if (!ALLOWED_TYPES.includes(file.type)) return "Utilisez une image JPEG, PNG ou WebP.";
  if (file.size > MAX_FILE_SIZE) return "Chaque photo doit faire au maximum 5 Mo.";
  return "";
}

export default function UnresolvedBookModal({ rawScan = "", onClose, onQueued }) {
  const [cover, setCover] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [notes, setNotes] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [processingOcr, setProcessingOcr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const runOcr = async () => {
    const validation = validateFile(evidence);
    if (validation) return setError("Ajoutez d'abord la photo du dos, du code ou de la page de titre.");
    setProcessingOcr(true);
    setError("");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["fra", "eng"]);
      const pages = await Promise.all([worker.recognize(cover), worker.recognize(evidence)]);
      await worker.terminate();
      const text = pages.map((page) => page.data.text.trim()).filter(Boolean).join("\n\n").slice(0, 6000);
      setOcrText(text);
      if (!title && text) setTitle(text.split("\n").map((line) => line.trim()).find((line) => line.length > 3 && line.length < 140) || "");
    } catch {
      setError("L'analyse du texte n'a pas pu aboutir. Les photos peuvent quand même être envoyées.");
    } finally {
      setProcessingOcr(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    const fileError = validateFile(cover) || validateFile(evidence);
    if (fileError) return setError(fileError);
    setSaving(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Votre session a expiré. Reconnectez-vous.");
      const id = crypto.randomUUID();
      const ext = (file) => file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const coverPath = `${id}/cover.${ext(cover)}`;
      const evidencePath = `${id}/evidence.${ext(evidence)}`;
      const bucket = supabase.storage.from("bibli-pending-books");
      const [coverUpload, evidenceUpload] = await Promise.all([
        bucket.upload(coverPath, cover, { upsert: false, contentType: cover.type, cacheControl: "3600" }),
        bucket.upload(evidencePath, evidence, { upsert: false, contentType: evidence.type, cacheControl: "3600" }),
      ]);
      if (coverUpload.error || evidenceUpload.error) throw new Error(coverUpload.error?.message || evidenceUpload.error?.message);
      const isbn = rawScan.replace(/[^0-9Xx]/g, "").toUpperCase();
      const { error: insertError } = await supabase.from("bibli_pending_books").insert({
        id,
        raw_scan: rawScan || null,
        isbn: /^(?:\d{9}[\dX]|\d{13})$/.test(isbn) ? isbn : null,
        titre_suggere: title.trim() || null,
        auteur_suggere: author.trim() || null,
        notes: notes.trim() || null,
        cover_path: coverPath,
        evidence_path: evidencePath,
        ocr_text: ocrText || null,
        ocr_data: ocrText ? { language: ["fra", "eng"], source: "client" } : {},
        lookup_sources: ["Google Books", "Open Library", "BnF"],
        last_lookup_at: new Date().toISOString(),
        created_by: authData.user.id,
      });
      if (insertError) throw insertError;
      onQueued?.();
      onClose();
    } catch (err) {
      setError(`Envoi impossible : ${err.message || "erreur inconnue"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-8">
      <form onSubmit={save} className="w-full max-w-2xl rounded-2xl border border-white/10 bg-biblio-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Camera className="h-5 w-5 text-biblio-accent" /> Livre à identifier plus tard</h2>
            <p className="mt-1 text-sm text-biblio-muted">Aucun catalogue gratuit n'a reconnu ce livre. Les photos sont privées et visibles seulement par le personnel autorisé.</p>
          </div>
          <button type="button" onClick={onClose} className="text-biblio-muted hover:text-biblio-danger" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-6">
          {rawScan && <p className="rounded-lg bg-white/5 p-3 font-mono text-xs text-biblio-muted">Code lu : {rawScan}</p>}
          {error && <p className="flex gap-2 rounded-lg bg-biblio-danger/10 p-3 text-sm text-biblio-danger"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
          <div className="grid gap-5 sm:grid-cols-2">
            <PhotoField label="1. Couverture du livre" help="Cadrez toute la couverture, nette et bien éclairée." file={cover} onChange={(file) => { setCover(file); setError(""); }} />
            <PhotoField label="2. Dos, code ou page de titre" help="Prenez le code-barres ISBN ou la page qui indique le titre et l'auteur." file={evidence} onChange={(file) => { setEvidence(file); setError(""); }} />
          </div>
          <button type="button" disabled={processingOcr || !cover || !evidence} onClick={runOcr} className="flex items-center gap-2 text-sm text-biblio-accent disabled:opacity-50">
            {processingOcr ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {processingOcr ? "Lecture du texte en cours…" : "Lire le texte des deux photos (optionnel)"}
          </button>
          {ocrText && <textarea readOnly value={ocrText} className="h-24 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-biblio-muted" aria-label="Texte détecté" />}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-biblio-muted">Titre suggéré<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-biblio-text" /></label>
            <label className="text-xs font-medium text-biblio-muted">Auteur suggéré<input value={author} onChange={(event) => setAuthor(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-biblio-text" /></label>
          </div>
          <label className="block text-xs font-medium text-biblio-muted">Note pour l'équipe (optionnel)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 h-20 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-biblio-text" placeholder="Ex. Édition abîmée, titre difficile à lire…" /></label>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-4 py-2.5 text-sm">Annuler</button><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-biblio-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer dans « À identifier »</button></div>
      </form>
    </div>
  );
}
