import { useEffect, useRef, useState } from "react";
import { Camera, X, Loader2, AlertCircle, ImagePlus } from "lucide-react";

/**
 * Scanner ISBN/QR par prise de photo.
 * Compatible tous appareils, y compris iPhone Safari.
 */
export default function ISBNScanner({ onScan, onClose, mode = "isbn" }) {
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);
  const scannerRef = useRef(null);
  const scanHandledRef = useRef(false);
  const containerId = useRef(
    "isbn-scanner-" + Math.random().toString(36).slice(2, 8),
  );

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      setStatus("loading");
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        const formatsToSupport = mode === "isbn"
          ? [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E]
          : [Html5QrcodeSupportedFormats.QR_CODE];
        const scanner = new Html5Qrcode(containerId.current, { formatsToSupport });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 180 } },
          (decodedText) => {
            if (scanHandledRef.current) return;
            scanHandledRef.current = true;
            onScan(decodedText);
          },
          () => {},
        );
        if (!cancelled) setStatus("scanning");
      } catch {
        // La photo reste disponible si le navigateur refuse la caméra.
        if (!cancelled) setStatus("idle");
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        void scanner.stop().catch(() => undefined).finally(() => {
          void scanner.clear().catch(() => undefined);
        });
      }
    };
  }, [onScan]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const liveScanner = scannerRef.current;
      if (liveScanner) {
        await liveScanner.stop().catch(() => undefined);
        await liveScanner.clear().catch(() => undefined);
        scannerRef.current = null;
      }
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const formatsToSupport = mode === "isbn"
        ? [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E]
        : [Html5QrcodeSupportedFormats.QR_CODE];
      const scanner = new Html5Qrcode(containerId.current, { formatsToSupport });
      const result = await scanner.scanFile(file, false);
      onScan(result);
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes("No MultiFormat") || msg.includes("No barcode")) {
        setErrorMsg(
          "Aucun code detecte sur cette photo. Reessayez en vous rapprochant.",
        );
      } else {
        setErrorMsg("Impossible de lire le code : " + msg);
      }
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-biblio-card rounded-xl border border-white/10 w-full max-w-sm space-y-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5 text-biblio-accent" />
            {mode === "isbn" ? "Scanner un code-barre ISBN" : "Scanner un QR code"}
          </h2>
          <button
            onClick={onClose}
            className="text-biblio-muted hover:text-biblio-danger transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
              <span className="text-sm text-biblio-muted">Ouverture de la caméra…</span>
            </div>
          )}

          <div id={containerId.current} className="overflow-hidden rounded-lg bg-black" />

          {status === "scanning" && (
            <p className="text-xs text-biblio-muted text-center">
              Placez le code-barres ISBN dans le cadre : la recherche démarre automatiquement.
            </p>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <AlertCircle className="w-8 h-8 text-biblio-danger" />
              <p className="text-sm text-biblio-danger text-center">{errorMsg}</p>
              <button
                onClick={() => {
                  setStatus("idle");
                  fileInputRef.current.value = "";
                }}
                className="text-sm text-biblio-accent underline"
              >
                Reessayer
              </button>
            </div>
          )}

          {(status === "idle" || status === "scanning") && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ImagePlus className="w-5 h-5" />
                Prendre une photo
              </button>
              <p className="text-xs text-biblio-muted text-center pb-1">
                Si la caméra ne lit pas le code, prenez une photo nette du code-barres.
              </p>
            </>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg text-sm font-medium transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
