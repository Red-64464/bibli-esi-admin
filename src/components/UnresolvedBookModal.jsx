import MotionOverlay from "./MotionOverlay";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, FileText, ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { compressImage, imageExtension, validateImageFile } from "../lib/images";
import { enqueueOfflineAction, shouldQueueWriteError } from "../lib/offlineQueue";

function PhotoField({ label, help, file, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
  const imageError = validateImageFile(file, 8);
  if (imageError) return imageError;
  return "";
}

export default function UnresolvedBookModal({ rawScan = "", onClose, onQueued }) {
  const [cover, setCover] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [shelfNumber, setShelfNumber] = useState("");
  const [shelfLetter, setShelfLetter] = useState("");
  const [notes, setNotes] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [suggestedAuthor, setSuggestedAuthor] = useState("");
  const [processingAi, setProcessingAi] = useState(false);
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
    } catch {
      setError("L'analyse du texte n'a pas pu aboutir. Les photos peuvent quand même être envoyées.");
    } finally {
      setProcessingOcr(false);
    }
  };

  const readPhotosWithAi = async () => {
    if (validateFile(cover) || validateFile(evidence)) return setError("Ajoutez les deux photos avant de lancer la lecture IA.");
    setProcessingAi(true); setError("");
    try {
      const toDataUrl = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Photo illisible."));
        reader.readAsDataURL(blob);
      });
      const images = await Promise.all([cover, evidence].map(async (file) => toDataUrl(await compressImage(file, { maxInputSizeMb: 8, maxSizeMB: 0.8, maxWidthOrHeight: 1600 }))));
      const { data, error: lookupError } = await supabase.functions.invoke("bibli-book-lookup", { body: { mode: "photo", images } });
      if (lookupError) {
        const details = await lookupError.context?.json?.().catch(() => null);
        throw new Error(details?.error || "Lecture IA indisponible.");
      }
      setSuggestedTitle(data?.suggestion?.titre || "");
      setSuggestedAuthor(data?.suggestion?.auteur || "");
      if (!data?.suggestion?.titre && !data?.suggestion?.auteur) setError("L’IA n’a pas pu lire de titre ou d’auteur. Les photos peuvent quand même être enregistrées.");
    } catch (err) {
      setError(err.message || "Lecture IA indisponible. Vous pouvez conserver les photos.");
    } finally { setProcessingAi(false); }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!shelfNumber || !shelfLetter) {
      setError("Choisissez un chiffre de 1 à 5 et une lettre de A à E pour l’emplacement.");
      return;
    }
    const fileError = validateFile(cover) || validateFile(evidence);
    if (fileError) return setError(fileError);
    setSaving(true);
    setError("");
    // Garder le même identifiant si une panne survient après l'envoi d'une photo.
    const id = crypto.randomUUID();
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Votre session a expiré. Reconnectez-vous.");
      const compressedCover = await compressImage(cover, { maxInputSizeMb: 8, maxSizeMB: 0.9, maxWidthOrHeight: 1600 });
      const compressedEvidence = await compressImage(evidence, { maxInputSizeMb: 8, maxSizeMB: 0.9, maxWidthOrHeight: 1600 });
      const coverPath = `${id}/cover.${imageExtension(compressedCover)}`;
      const evidencePath = `${id}/evidence.${imageExtension(compressedEvidence)}`;
      const payload = {
        id,
        raw_scan: rawScan || null,
        isbn: /^(?:\d{9}[\dX]|\d{13})$/.test(rawScan.replace(/[^0-9Xx]/g, "").toUpperCase()) ? rawScan.replace(/[^0-9Xx]/g, "").toUpperCase() : null,
        titre_suggere: suggestedTitle.trim() || null,
        auteur_suggere: suggestedAuthor.trim() || null,
        emplacement: `${shelfNumber}${shelfLetter}`,
        notes: notes.trim() || null,
        cover_path: coverPath,
        evidence_path: evidencePath,
        ocr_text: ocrText || null,
        ocr_data: ocrText ? { language: ["fra", "eng"], source: "client" } : {},
        lookup_sources: ["Google Books", "Open Library", "BnF"],
        last_lookup_at: new Date().toISOString(),
        created_by: authData.user.id,
      };
      const bucket = supabase.storage.from("bibli-pending-books");
      const [coverUpload, evidenceUpload] = await Promise.all([
        bucket.upload(coverPath, compressedCover, { upsert: false, contentType: compressedCover.type || "image/jpeg", cacheControl: "86400" }),
        bucket.upload(evidencePath, compressedEvidence, { upsert: false, contentType: compressedEvidence.type || "image/jpeg", cacheControl: "86400" }),
      ]);
      if (coverUpload.error || evidenceUpload.error) throw new Error(coverUpload.error?.message || evidenceUpload.error?.message);
      const { error: insertError } = await supabase.from("bibli_pending_books").insert(payload);
      if (insertError) throw insertError;
      onQueued?.();
      onClose();
    } catch (err) {
      if (shouldQueueWriteError(err)) {
        try {
          const compressedCover = await compressImage(cover, { maxInputSizeMb: 8, maxSizeMB: 0.9, maxWidthOrHeight: 1600 });
          const compressedEvidence = await compressImage(evidence, { maxInputSizeMb: 8, maxSizeMB: 0.9, maxWidthOrHeight: 1600 });
          const coverPath = `${id}/cover.${imageExtension(compressedCover)}`;
          const evidencePath = `${id}/evidence.${imageExtension(compressedEvidence)}`;
          const isbn = rawScan.replace(/[^0-9Xx]/g, "").toUpperCase();
          await enqueueOfflineAction({
            type: "pending-book:create",
            label: `Livre à identifier : ${rawScan || `${shelfNumber}${shelfLetter}`}`,
            payload: {
              id,
              raw_scan: rawScan || null,
              isbn: /^(?:\d{9}[\dX]|\d{13})$/.test(isbn) ? isbn : null,
              titre_suggere: suggestedTitle.trim() || null,
              auteur_suggere: suggestedAuthor.trim() || null,
              emplacement: `${shelfNumber}${shelfLetter}`,
              notes: notes.trim() || null,
              cover_path: coverPath,
              evidence_path: evidencePath,
              ocr_text: ocrText || null,
              ocr_data: ocrText ? { language: ["fra", "eng"], source: "client" } : {},
              lookup_sources: ["Google Books", "Open Library", "BnF"],
              last_lookup_at: new Date().toISOString(),
              created_by: null,
            },
            files: {
              cover: { path: coverPath, blob: compressedCover },
              evidence: { path: evidencePath, blob: compressedEvidence },
            },
          });
          onQueued?.({ offline: true });
          onClose();
          return;
        } catch (queueError) {
          setError(`Sauvegarde locale impossible : ${queueError.message || "erreur inconnue"}`);
          return;
        }
      }
      setError(`Envoi impossible : ${err.message || "erreur inconnue"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MotionOverlay className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-8">
      <form data-motion-panel onSubmit={save} className="w-full max-w-2xl rounded-2xl border border-white/10 bg-biblio-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Camera className="h-5 w-5 text-biblio-accent" /> {rawScan ? "Livre à identifier plus tard" : "Ajouter un livre à identifier"}</h2>
            <p className="mt-1 text-sm text-biblio-muted">{rawScan ? "Le livre n'a pas pu être identifié : il est peut-être absent des catalogues ou certains sont indisponibles." : "Ajoutez les deux photos du livre pour que l'équipe puisse l'identifier."} Les photos sont privées et visibles seulement par le personnel autorisé.</p>
          </div>
          <button type="button" onClick={onClose} className="text-biblio-muted hover:text-biblio-danger" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-6">
          {rawScan && <p className="rounded-lg bg-white/5 p-3 font-mono text-xs text-biblio-muted">ISBN / code scanné (rempli automatiquement) : {rawScan}</p>}
          {error && <p className="flex gap-2 rounded-lg bg-biblio-danger/10 p-3 text-sm text-biblio-danger"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
          <div className="grid gap-5 sm:grid-cols-2">
            <PhotoField label="1. Recto : couverture du livre" help="Cadrez toute la couverture, nette et bien éclairée." file={cover} onChange={(file) => { setCover(file); setError(""); }} />
            <PhotoField label="2. Verso : dos du livre" help="Photographiez le dos avec son ISBN ; si besoin, utilisez la page de titre." file={evidence} onChange={(file) => { setEvidence(file); setError(""); }} />
          </div>
          <div className="space-y-3 rounded-lg border border-white/10 p-3">
            <button type="button" disabled={processingAi || !cover || !evidence} onClick={readPhotosWithAi} className="flex items-center gap-2 text-sm text-biblio-accent disabled:opacity-50">{processingAi && <Loader2 className="h-4 w-4 animate-spin" />}{processingAi ? "Lecture IA en cours…" : "Proposer le titre et l’auteur avec l’IA"}</button>
            <p className="text-xs text-biblio-muted">Les deux photos sont envoyées à OpenAI uniquement si tu utilises ce bouton. Vérifie les propositions avant de les enregistrer.</p>
            <label className="block text-xs text-biblio-muted">Titre proposé (modifiable)<input value={suggestedTitle} onChange={(event) => setSuggestedTitle(event.target.value)} maxLength={220} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-biblio-text" /></label>
            <label className="block text-xs text-biblio-muted">Auteur proposé (modifiable)<input value={suggestedAuthor} onChange={(event) => setSuggestedAuthor(event.target.value)} maxLength={220} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-biblio-text" /></label>
          </div>
          <button type="button" disabled={processingOcr || !cover || !evidence} onClick={runOcr} className="flex items-center gap-2 text-sm text-biblio-accent disabled:opacity-50">
            {processingOcr ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {processingOcr ? "Lecture du texte en cours…" : "Lire le texte des deux photos (optionnel)"}
          </button>
          {ocrText && <textarea readOnly value={ocrText} className="h-24 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-biblio-muted" aria-label="Texte détecté" />}
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-biblio-muted">Emplacement <span className="text-biblio-danger">*</span></legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-biblio-muted">Chiffre
                <select required value={shelfNumber} onChange={(event) => setShelfNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-biblio-text">
                  <option value="">Choisir (1 à 5)</option>
                  {[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>{number}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-biblio-muted">Lettre
                <select required value={shelfLetter} onChange={(event) => setShelfLetter(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-biblio-text">
                  <option value="">Choisir (A à E)</option>
                  {["A", "B", "C", "D", "E"].map((letter) => <option key={letter} value={letter}>{letter}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-biblio-muted">{shelfLetter && shelfNumber ? `Rangée choisie : ${shelfLetter}${shelfNumber}` : "Exemple : A1"}</p>
          </fieldset>
          <label className="block text-xs font-medium text-biblio-muted">Note pour l'équipe (optionnel)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 h-20 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-biblio-text" placeholder="Ex. Édition abîmée, titre difficile à lire…" /></label>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-4 py-2.5 text-sm">Annuler</button><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-biblio-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer dans « À identifier »</button></div>
      </form>
    </MotionOverlay>
  );
}
