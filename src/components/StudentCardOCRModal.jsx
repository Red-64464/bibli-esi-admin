/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { createWorker, PSM } from "tesseract.js";
import {
  AlertCircle,
  Check,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm";

function cleanText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function normaliseNumber(value = "") {
  return value.replace(/[^0-9]/g, "").slice(0, 12);
}

function extractFields(text) {
  const lines = text
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);
  const joined = lines.join(" ");
  const numberMatch = joined.match(/(?:n[°o]?|matricule|student\s*(?:id|number))?\s*[:#-]?\s*(\d{4,10})\b/i);
  const number = numberMatch?.[1] || (joined.match(/\b\d{5,8}\b/) || [""])[0];
  const programme = lines.find((line) => /informatique|développeur|developer|bachelier|bachelor|master|formation/i.test(line)) || "";
  const labelledName = joined.match(/(?:nom|name)\s*[:#-]?\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý' -]{2,})/i)?.[1] || "";
  const nameParts = cleanText(labelledName).split(" ").filter(Boolean);
  return {
    nom: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
    prenom: nameParts.length > 1 ? nameParts[0] : "",
    numero_etudiant: normaliseNumber(number),
    programme,
  };
}

async function prepareImage(file) {
  const source = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
}

async function readQRCode(file) {
  const url = URL.createObjectURL(file);
  try {
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(url);
    return result?.getText?.() || "";
  } catch {
    return "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function StudentCardOCRModal({ onClose, onComplete }) {
  const [files, setFiles] = useState({ recto: null, verso: null });
  const [previews, setPreviews] = useState({ recto: "", verso: "" });
  const [fields, setFields] = useState({ nom: "", prenom: "", numero_etudiant: "", programme: "" });
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState("capture");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRefs = { recto: useRef(null), verso: useRef(null) };

  useEffect(() => () => Object.values(previews).forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  const ready = useMemo(() => files.recto && files.verso, [files]);

  const selectFile = (side, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choisissez une image JPG, PNG ou HEIC.");
    if (file.size > MAX_FILE_SIZE) return setError("Chaque photo doit faire moins de 8 Mo.");
    setError("");
    setFiles((current) => ({ ...current, [side]: file }));
    setPreviews((current) => ({ ...current, [side]: URL.createObjectURL(file) }));
  };

  const analyse = async () => {
    if (!ready) return setError("Ajoutez les deux côtés de la carte.");
    setError("");
    setStep("analyse");
    setProgress("Lecture du QR code…");
    const qrTexts = await Promise.all([readQRCode(files.recto), readQRCode(files.verso)]);
    const qrNumber = qrTexts.join(" ").match(/\b\d{4,10}\b/)?.[0] || "";
    setProgress("Lecture OCR locale…");
    let worker;
    try {
      worker = await createWorker("fra+eng", 1, { logger: (message) => {
        if (message.status === "recognizing text") setProgress(`OCR en cours… ${Math.round((message.progress || 0) * 100)} %`);
      }});
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      const results = await Promise.all([
        worker.recognize(files.recto),
        worker.recognize(files.verso),
      ]);
      const text = results.map((result) => result.data.text || "").join("\n");
      const extracted = extractFields(text);
      setRawText(text);
      setFields({ ...extracted, numero_etudiant: qrNumber || extracted.numero_etudiant });
      setStep("review");
    } catch (err) {
      setError(`Analyse impossible : ${err.message || "réessayez avec des photos plus nettes"}`);
      setStep("capture");
    } finally {
      await worker?.terminate();
    }
  };

  const save = async () => {
    if (!fields.nom.trim() || !fields.prenom.trim()) return setError("Le nom et le prénom doivent être confirmés.");
    if (!fields.numero_etudiant.trim()) return setError("Le numéro étudiant doit être confirmé.");
    setSaving(true);
    setError("");
    const uploaded = [];
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id || "admin";
      const paths = {};
      for (const side of ["recto", "verso"]) {
        const blob = await prepareImage(files[side]);
        const path = `${userId}/${crypto.randomUUID()}-${side}.jpg`;
        const { error: uploadError } = await supabase.storage.from("bibli-student-cards").upload(path, blob, {
          contentType: "image/jpeg", upsert: false,
        });
        if (uploadError) throw uploadError;
        uploaded.push(path);
        paths[side] = path;
      }
      const payload = {
        nom: fields.nom.trim(), prenom: fields.prenom.trim(), numero_etudiant: fields.numero_etudiant.trim(),
        photo_carte_recto_path: paths.recto, photo_carte_verso_path: paths.verso,
        champs_custom: fields.programme.trim() ? { formation: fields.programme.trim(), source: "ocr_carte" } : { source: "ocr_carte" },
      };
      const { data, error: insertError } = await supabase.from("bibli_etudiants").insert(payload).select().single();
      if (insertError) throw insertError;
      onComplete(data);
      onClose();
    } catch (err) {
      if (uploaded.length) await supabase.storage.from("bibli-student-cards").remove(uploaded);
      setError(`Enregistrement impossible : ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4 sm:py-8">
      <div className="relative bg-biblio-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl p-5 sm:p-6 space-y-5">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-biblio-muted hover:text-biblio-text"><X /></button>
        <div className="pr-8"><h2 className="text-xl font-semibold flex items-center gap-2"><ScanLine className="text-biblio-accent" /> Ajouter par carte étudiante</h2><p className="text-sm text-biblio-muted mt-1">Les photos restent dans le stockage privé de la bibliothèque.</p></div>
        <div className="flex items-center gap-2 text-xs text-biblio-muted"><ShieldCheck className="w-4 h-4 text-biblio-success" /> OCR effectué localement dans votre navigateur · aucune photo envoyée à un service OCR externe</div>
        {step === "capture" && <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {["recto", "verso"].map((side) => <div key={side} className="space-y-2"><p className="text-sm font-medium">Photo {side}</p><button type="button" onClick={() => inputRefs[side].current?.click()} className="w-full aspect-[1.6] rounded-xl border-2 border-dashed border-white/20 hover:border-biblio-accent/60 overflow-hidden flex items-center justify-center bg-white/5">{previews[side] ? <img src={previews[side]} alt={`Aperçu ${side}`} className="w-full h-full object-cover" /> : <span className="text-sm text-biblio-muted flex flex-col items-center gap-2"><ImagePlus />Ajouter une photo</span>}</button><input ref={inputRefs[side]} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => selectFile(side, event.target.files?.[0])} /><button type="button" onClick={() => inputRefs[side].current?.click()} className="text-xs text-biblio-accent flex items-center gap-1"><RotateCcw className="w-3 h-3" /> {previews[side] ? "Remplacer" : "Choisir"}</button></div>)}
          </div>
          <button type="button" disabled={!ready} onClick={analyse} className="w-full px-4 py-3 bg-biblio-accent disabled:opacity-50 text-white rounded-lg font-medium flex justify-center items-center gap-2"><ScanLine className="w-5 h-5" /> Analyser la carte</button>
        </>}
        {step === "analyse" && <div className="py-10 flex flex-col items-center gap-3 text-center"><Loader2 className="w-10 h-10 animate-spin text-biblio-accent" /><p>{progress}</p><p className="text-xs text-biblio-muted">Cela peut prendre quelques secondes sur mobile.</p></div>}
        {step === "review" && <>
          <div className="rounded-lg bg-biblio-success/10 border border-biblio-success/30 p-3 text-sm flex gap-2"><Check className="text-biblio-success shrink-0" />Données détectées. Vérifiez-les avant l’enregistrement.</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[["prenom", "Prénom *"], ["nom", "Nom *"], ["numero_etudiant", "Numéro étudiant *"], ["programme", "Formation détectée"]].map(([key, label]) => <label key={key} className="text-xs text-biblio-muted">{label}<input value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} className={INPUT_CLASS + " mt-1"} /></label>)}</div>
          <details className="text-xs text-biblio-muted"><summary>Voir le texte OCR brut</summary><pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap bg-black/20 rounded p-2">{rawText || "Aucun texte"}</pre></details>
          <div className="flex gap-3"><button type="button" onClick={() => setStep("capture")} className="px-4 py-2.5 bg-white/10 rounded-lg">Reprendre les photos</button><button type="button" onClick={save} disabled={saving} className="px-4 py-2.5 bg-biblio-success text-white rounded-lg flex items-center gap-2">{saving ? <Loader2 className="animate-spin" /> : <Upload />} Enregistrer</button></div>
        </>}
        {error && <div className="bg-biblio-danger/10 text-biblio-danger p-3 rounded-lg text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      </div>
    </div>
  );
}
