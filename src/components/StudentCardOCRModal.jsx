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

function buildStudentEmail(numeroEtudiant = "") {
  const cleaned = normaliseNumber(numeroEtudiant);
  return cleaned ? `${cleaned}@etu.he2b.be` : "";
}

function extractFields(text) {
  const lines = text
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);
  const joined = lines.join(" ");
  const labelledNumber = joined.match(/(?:n[°o]?|matricule|student\s*(?:id|number))\s*[:#-]?\s*(\d{4,10})\b/i)?.[1];
  const number = labelledNumber || (joined.match(/\b\d{5,8}\b/) || [""])[0];
  return {
    nom: "",
    prenom: "",
    numero_etudiant: normaliseNumber(number),
  };
}

async function renderProcessedImage(file, crop) {
  const source = await createImageBitmap(file);
  const cropX = Math.round(source.width * crop.x);
  const cropY = Math.round(source.height * crop.y);
  const cropWidth = Math.round(source.width * crop.width);
  const cropHeight = Math.round(source.height * crop.height);
  const scale = Math.min(3.2, Math.max(1.8, crop.target / Math.max(cropWidth, cropHeight)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropWidth * scale);
  canvas.height = Math.round(cropHeight * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
    const contrasted = Math.max(0, Math.min(255, (gray - 125) * 1.85 + 125));
    data[i] = contrasted;
    data[i + 1] = contrasted;
    data[i + 2] = contrasted;
  }
  ctx.putImageData(image, 0, 0);
  source.close();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

function prepareOcrImage(file) {
  return renderProcessedImage(file, { x: 0, y: 0.28, width: 1, height: 0.72, target: 2200 });
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
  const [files, setFiles] = useState({ recto: null });
  const [previews, setPreviews] = useState({ recto: "" });
  const [fields, setFields] = useState({ nom: "", prenom: "", numero_etudiant: "" });
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState("capture");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRefs = { recto: useRef(null) };

  useEffect(() => () => Object.values(previews).forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  const ready = useMemo(() => Boolean(files.recto), [files]);

  const selectFile = (side, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choisissez une image JPG, PNG ou HEIC.");
    if (file.size > MAX_FILE_SIZE) return setError("Chaque photo doit faire moins de 8 Mo.");
    setError("");
    setFiles((current) => ({ ...current, [side]: file }));
    setPreviews((current) => ({ ...current, [side]: URL.createObjectURL(file) }));
  };

  const analyse = async () => {
    if (!ready) return setError("Ajoutez une photo nette du recto de la carte.");
    setError("");
    setStep("analyse");
    setProgress("Lecture du QR code…");
    const qrText = await readQRCode(files.recto);
    const qrNumber = qrText.match(/\b\d{4,10}\b/)?.[0] || "";
    setProgress("Lecture OCR locale…");
    let worker;
    try {
      worker = await createWorker("fra+eng", 1, { logger: (message) => {
        if (message.status === "recognizing text") setProgress(`OCR en cours… ${Math.round((message.progress || 0) * 100)} %`);
      }});
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      const ocrImage = await prepareOcrImage(files.recto);
      const result = await worker.recognize(ocrImage || files.recto);
      const text = result.data.text || "";
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
      const blob = await prepareImage(files.recto);
      const path = `${userId}/${crypto.randomUUID()}-recto.jpg`;
        const { error: uploadError } = await supabase.storage.from("bibli-student-cards").upload(path, blob, {
          contentType: "image/jpeg", upsert: false,
        });
        if (uploadError) throw uploadError;
      uploaded.push(path);
      paths.recto = path;
      const payload = {
        nom: fields.nom.trim(), prenom: fields.prenom.trim(), numero_etudiant: fields.numero_etudiant.trim(),
        email: buildStudentEmail(fields.numero_etudiant),
        photo_carte_recto_path: paths.recto,
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
        <div className="pr-8"><h2 className="text-xl font-semibold flex items-center gap-2"><ScanLine className="text-biblio-accent" /> Ajouter par carte étudiante</h2><p className="text-sm text-biblio-muted mt-1">Une photo du recto suffit : le matricule est détecté automatiquement.</p></div>
        <div className="flex items-center gap-2 text-xs text-biblio-muted"><ShieldCheck className="w-4 h-4 text-biblio-success" /> OCR effectué localement dans votre navigateur · aucune photo envoyée à un service OCR externe</div>
        {step === "capture" && <>
          <div className="space-y-2"><p className="text-sm font-medium">Photo du recto</p><button type="button" onClick={() => inputRefs.recto.current?.click()} className="w-full aspect-[1.6] rounded-xl border-2 border-dashed border-white/20 hover:border-biblio-accent/60 overflow-hidden flex items-center justify-center bg-white/5">{previews.recto ? <img src={previews.recto} alt="Aperçu du recto" className="w-full h-full object-cover" /> : <span className="text-sm text-biblio-muted flex flex-col items-center gap-2"><ImagePlus />Ajouter une photo</span>}</button><input ref={inputRefs.recto} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => selectFile("recto", event.target.files?.[0])} /><button type="button" onClick={() => inputRefs.recto.current?.click()} className="text-xs text-biblio-accent flex items-center gap-1"><RotateCcw className="w-3 h-3" /> {previews.recto ? "Remplacer" : "Choisir"}</button></div>
          <button type="button" disabled={!ready} onClick={analyse} className="w-full px-4 py-3 bg-biblio-accent disabled:opacity-50 text-white rounded-lg font-medium flex justify-center items-center gap-2"><ScanLine className="w-5 h-5" /> Analyser la carte</button>
        </>}
        {step === "analyse" && <div className="py-10 flex flex-col items-center gap-3 text-center"><Loader2 className="w-10 h-10 animate-spin text-biblio-accent" /><p>{progress}</p><p className="text-xs text-biblio-muted">Cela peut prendre quelques secondes sur mobile.</p></div>}
        {step === "review" && <>
          <div className="rounded-lg bg-biblio-success/10 border border-biblio-success/30 p-3 text-sm flex gap-2"><Check className="text-biblio-success shrink-0" />Matricule détecté. Complétez le nom et le prénom avant l’enregistrement.</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[["prenom", "Prénom *"], ["nom", "Nom *"], ["numero_etudiant", "Matricule *"]].map(([key, label]) => <label key={key} className="text-xs text-biblio-muted">{label}<input value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} className={INPUT_CLASS + " mt-1"} /></label>)}</div>
          <details className="text-xs text-biblio-muted"><summary>Voir le texte OCR brut</summary><pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap bg-black/20 rounded p-2">{rawText || "Aucun texte"}</pre></details>
          <div className="flex gap-3"><button type="button" onClick={() => setStep("capture")} className="px-4 py-2.5 bg-white/10 rounded-lg">Reprendre les photos</button><button type="button" onClick={save} disabled={saving} className="px-4 py-2.5 bg-biblio-success text-white rounded-lg flex items-center gap-2">{saving ? <Loader2 className="animate-spin" /> : <Upload />} Enregistrer</button></div>
        </>}
        {error && <div className="bg-biblio-danger/10 text-biblio-danger p-3 rounded-lg text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      </div>
    </div>
  );
}
