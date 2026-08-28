/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, ImagePlus, Lightbulb, Loader2, RefreshCw, Volume2, VolumeX, X } from "lucide-react";

const ISBN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

function cleanCode(value) {
  return String(value ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

function isValidISBN10(isbn) {
  if (!/^(?:\d{9}[\dX])$/.test(isbn)) return false;
  return isbn.split("").reduce((sum, char, index) => sum + (char === "X" ? 10 : Number(char)) * (10 - index), 0) % 11 === 0;
}

function isValidISBN13(isbn) {
  if (!/^\d{13}$/.test(isbn) || !/^(978|979)/.test(isbn)) return false;
  return isbn.split("").reduce((sum, char, index) => sum + Number(char) * (index % 2 ? 3 : 1), 0) % 10 === 0;
}

function normalizeISBN(value) {
  const code = cleanCode(value);
  if (isValidISBN13(code)) return code;
  if (!isValidISBN10(code)) return null;
  const body = `978${code.slice(0, 9)}`;
  const check = (10 - body.split("").reduce((sum, char, index) => sum + Number(char) * (index % 2 ? 3 : 1), 0) % 10) % 10;
  return `${body}${check}`;
}

function stopMedia(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

/** Scanner hybride : BarcodeDetector natif, ZXing, puis html5-qrcode et photo. */
export default function ISBNScanner({ onScan, onClose, mode = "isbn" }) {
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [engine, setEngine] = useState("");
  const [torch, setTorch] = useState(false);
  const [sound, setSound] = useState(true);
  const [pendingCode, setPendingCode] = useState("");
  const [facingMode, setFacingMode] = useState("environment");
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const controlsRef = useRef(null);
  const scannerRef = useRef(null);
  const animationRef = useRef(null);
  const scanHandledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const soundRef = useRef(sound);
  const containerId = useRef("isbn-scanner-" + Math.random().toString(36).slice(2, 8));

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  const stopEverything = useCallback(async () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    controlsRef.current?.stop?.();
    controlsRef.current = null;
    stopMedia(streamRef.current);
    streamRef.current = null;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      await scanner.stop?.().catch(() => undefined);
      await scanner.clear?.().catch(() => undefined);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const handleDetected = useCallback((raw) => {
    if (scanHandledRef.current) return;
    const value = mode === "isbn" ? normalizeISBN(raw) : cleanCode(raw);
    if (!value) {
      return;
    }
    scanHandledRef.current = true;
    if (soundRef.current) {
      try {
        navigator.vibrate?.(80);
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 880; gain.gain.value = 0.04;
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.08);
      } catch { /* vibration/son optionnels */ }
    }
    void stopEverything();
    setPendingCode(value);
    setStatus("detected");
  }, [mode, stopEverything]);

  const startZXing = useCallback(async () => {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 1500 });
    const video = videoRef.current;
    if (!video) throw new Error("video_unavailable");
    setEngine("ZXing");
    controlsRef.current = await reader.decodeFromConstraints(
      { audio: false, video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      video,
      (result) => { if (result) handleDetected(result.getText()); },
    );
    if (!scanHandledRef.current) setStatus("scanning");
  }, [facingMode, handleDetected]);

  const startLegacy = useCallback(async () => {
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
    const formats = mode === "isbn"
      ? [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E]
      : [Html5QrcodeSupportedFormats.QR_CODE];
    const scanner = new Html5Qrcode(containerId.current, { formatsToSupport: formats });
    scannerRef.current = scanner;
    setEngine("compatibilité");
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 280, height: 180 } }, handleDetected, () => undefined);
    if (!scanHandledRef.current) setStatus("scanning");
  }, [handleDetected, mode]);

  const startCamera = useCallback(async () => {
    await stopEverything();
    setStatus("loading");
    setErrorMsg("");
    try {
      if ("BarcodeDetector" in window) {
        const formats = await window.BarcodeDetector.getSupportedFormats?.() ?? [];
        const wanted = mode === "isbn" ? ISBN_FORMATS : ["qr_code"];
        if (wanted.some((format) => formats.includes(format))) {
          const detector = new window.BarcodeDetector({ formats: wanted.filter((format) => formats.includes(format)) });
          const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } } });
          streamRef.current = stream;
          const video = videoRef.current;
          video.srcObject = stream;
          await video.play();
          setEngine("natif");
          setStatus("scanning");
          const scanFrame = async () => {
            if (scanHandledRef.current || !videoRef.current) return;
            try { const results = await detector.detect(video); if (results[0]?.rawValue) handleDetected(results[0].rawValue); } catch { /* frame illisible, on continue */ }
            animationRef.current = requestAnimationFrame(scanFrame);
          };
          animationRef.current = requestAnimationFrame(scanFrame);
          return;
        }
      }
      try { await startZXing(); } catch { await startLegacy(); }
    } catch (error) {
      await stopEverything();
      setStatus("idle");
      setErrorMsg(error?.name === "NotAllowedError" ? "Autorisez la caméra ou utilisez le bouton photo ci-dessous." : "Caméra indisponible. Utilisez une photo du code-barres.");
    }
  }, [facingMode, handleDetected, mode, startLegacy, startZXing, stopEverything]);

  useEffect(() => {
    scanHandledRef.current = false;
    void startCamera();
    return () => { void stopEverything(); };
  }, [startCamera, stopEverything]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("loading"); setErrorMsg(""); await stopEverything();
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      const result = await reader.decodeFromImageElement(image);
      URL.revokeObjectURL(url);
      handleDetected(result.getText());
    } catch {
      setStatus("error"); setErrorMsg("Aucun code valide détecté. Prenez une photo nette, sans reflet, en cadrant tout le code-barres.");
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track?.applyConstraints) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch((value) => !value); } catch { setErrorMsg("La torche n’est pas disponible sur cette caméra."); }
  };

  const confirmScan = () => onScanRef.current(pendingCode);
  const switchCamera = () => {
    setPendingCode("");
    scanHandledRef.current = false;
    setFacingMode((value) => value === "environment" ? "user" : "environment");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm space-y-4 overflow-hidden rounded-xl border border-white/10 bg-biblio-card">
        <div className="flex items-center justify-between px-5 pt-5"><h2 className="flex items-center gap-2 text-base font-semibold"><Camera className="h-5 w-5 text-biblio-accent" />{mode === "isbn" ? "Scanner un ISBN" : "Scanner un QR code"}</h2><button onClick={onClose} aria-label="Fermer" className="rounded-full p-2 text-biblio-muted hover:bg-white/10"><X className="h-5 w-5" /></button></div>
        <div className="space-y-4 px-5">
          {status === "loading" && <div className="flex flex-col items-center gap-3 py-10"><Loader2 className="h-8 w-8 animate-spin text-biblio-accent" /><span className="text-sm text-biblio-muted">Préparation du scanner…</span></div>}
          <div id={containerId.current} className="relative min-h-44 overflow-hidden rounded-lg bg-black"><video ref={videoRef} muted playsInline className="h-56 w-full object-cover" /><div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" /></div>
          {status === "scanning" && <p className="text-center text-xs text-biblio-muted">Cadrez le code-barres horizontalement. Évitez les reflets et rapprochez légèrement le téléphone.</p>}
          {status === "detected" && <div className="space-y-3 rounded-lg border border-biblio-success/40 bg-biblio-success/10 p-4"><p className="text-sm font-medium text-biblio-success">ISBN détecté et vérifié ✅</p><p className="break-all font-mono text-lg font-semibold text-biblio-text">{pendingCode}</p><div className="flex gap-2"><button onClick={confirmScan} className="flex-1 rounded-lg bg-biblio-success py-3 text-sm font-semibold text-white hover:brightness-110">Rechercher ce livre</button><button onClick={() => { setPendingCode(""); scanHandledRef.current = false; void startCamera(); }} className="rounded-lg bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/20">Re-scanner</button></div></div>}
          {engine && status !== "loading" && <p className="text-center text-[11px] text-biblio-muted">Moteur actif : {engine} · validation ISBN activée</p>}
          {status === "error" && <div className="flex flex-col items-center gap-3 py-2"><AlertCircle className="h-8 w-8 text-biblio-danger" /><p className="text-center text-sm text-biblio-danger">{errorMsg}</p><button onClick={() => void startCamera()} className="text-sm text-biblio-accent underline">Réessayer</button></div>}
          <div className="flex gap-2"><button onClick={toggleTorch} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/10 py-3 text-sm font-medium hover:bg-white/20"><Lightbulb className="h-4 w-4" />{torch ? "Éteindre" : "Torche"}</button><button onClick={() => setSound((value) => !value)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/10 py-3 text-sm font-medium hover:bg-white/20">{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}{sound ? "Son" : "Muet"}</button><button onClick={switchCamera} aria-label="Changer de caméra" className="rounded-lg bg-white/10 px-4 py-3 hover:bg-white/20"><RefreshCw className="h-4 w-4" /></button></div>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} /><button onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-biblio-accent py-3 font-medium text-white hover:bg-biblio-accent-hover"><ImagePlus className="h-5 w-5" />Prendre une photo</button>
          <p className="pb-1 text-center text-xs text-biblio-muted">Le code est vérifié et converti automatiquement en ISBN‑13.</p>
        </div>
        <div className="px-5 pb-5"><button onClick={onClose} className="w-full rounded-lg bg-white/10 py-2.5 text-sm font-medium text-biblio-text hover:bg-white/20">Annuler</button></div>
      </div>
    </div>
  );
}
