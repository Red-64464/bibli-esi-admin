import { useEffect, useRef, useState } from "react";
import { Camera, X, Loader2, AlertCircle, ImageIcon } from "lucide-react";

/**
 * Scanner caméra pour codes-barres ISBN et QR codes.
 * Utilise html5-qrcode (chargé dynamiquement).
 *
 * Deux méthodes de scan sont proposées :
 *  - "photo"  : capture d'une photo via l'input file natif (compatible iPhone Safari)
 *  - "camera" : scan en direct via getUserMedia (Android Chrome, Firefox…)
 *
 * @param {function} onScan   - Appelé avec la valeur scannée (string)
 * @param {function} onClose  - Appelé quand l'utilisateur ferme le scanner
 * @param {"isbn"|"qr"} mode  - "isbn" = code-barre, "qr" = QR code
 */
export default function ISBNScanner({ onScan, onClose, mode = "isbn" }) {
  // "idle" = choix de méthode | "loading" = démarrage caméra | "scanning" = caméra active
  // "processing" = analyse photo | "error" = erreur
  const [status, setStatus] = useState("idle");
  const [scanMethod, setScanMethod] = useState(null); // null | "camera" | "photo"
  const [errorMsg, setErrorMsg] = useState("");

  // IDs uniques pour éviter les conflits si le composant est monté plusieurs fois
  const containerId = useRef(
    "isbn-scanner-" + Math.random().toString(36).slice(2, 8),
  );
  const fileScanId = useRef(
    "isbn-file-" + Math.random().toString(36).slice(2, 8),
  );
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  // Ref pour éviter les appels multiples dans la closure du scanner en direct
  const scannedRef = useRef(false);

  // ─── Scan en direct (getUserMedia) ────────────────────────────────────────
  const startCameraScanner = async () => {
    setScanMethod("camera");
    setStatus("loading");
    setErrorMsg("");
    scannedRef.current = false;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(containerId.current);
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox:
          mode === "isbn"
            ? { width: 300, height: 100 }
            : { width: 250, height: 250 },
      };

      await scanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          scanner
            .stop()
            .then(() => onScan(decodedText))
            .catch(() => onScan(decodedText));
        },
        () => {}, // ignore les erreurs de décodage (normales en scan continu)
      );

      setStatus("scanning");
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setErrorMsg(
          "Accès à la caméra refusé. Essayez la méthode « Prendre une photo » ci-dessous.",
        );
      } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
        setErrorMsg("Aucune caméra détectée sur cet appareil.");
      } else {
        setErrorMsg(
          "Impossible d'ouvrir la caméra. Essayez la méthode « Prendre une photo ».",
        );
      }
      setStatus("error");
    }
  };

  // ─── Capture photo (input file) ───────────────────────────────────────────
  // Cette méthode est compatible avec tous les navigateurs mobiles,
  // y compris iPhone Safari, grâce à l'attribut capture="environment".
  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return; // L'utilisateur a annulé — on reste sur le choix de méthode

    setScanMethod("photo");
    setStatus("processing");
    setErrorMsg("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(fileScanId.current);
      const result = await scanner.scanFile(file, /* showImage */ false);
      onScan(result);
    } catch (err) {
      // html5-qrcode lève une erreur quand aucun code-barre n'est détecté — comportement normal
      console.debug("ISBNScanner scanFile:", err);
      setErrorMsg(
        "Impossible de lire le code-barre sur cette photo. Essayez de prendre une photo plus nette, bien centrée sur le code-barre.",
      );
      setStatus("error");
    }

    // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
    e.target.value = "";
  };

  // ─── Réessayer ────────────────────────────────────────────────────────────
  const handleRetry = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    scannedRef.current = false;
    setScanMethod(null);
    setStatus("idle");
    setErrorMsg("");
  };

  // Nettoyage de la caméra au démontage du composant.
  // Le tableau de dépendances vide est intentionnel : ce nettoyage ne doit
  // s'exécuter qu'au démontage. scannerRef est une ref stable (pas une valeur).
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-biblio-card rounded-xl border border-white/10 w-full max-w-sm space-y-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5 text-biblio-accent" />
            {mode === "isbn"
              ? "Scanner un code-barre ISBN"
              : "Scanner un QR code"}
          </h2>
          <button
            onClick={onClose}
            className="text-biblio-muted hover:text-biblio-danger transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 space-y-3">
          {/* ── Choix de la méthode ── */}
          {status === "idle" && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-biblio-muted text-center">
                Choisissez la méthode de scan :
              </p>

              {/* Méthode photo — recommandée, fonctionne sur iPhone Safari */}
              <button
                onClick={handlePhotoClick}
                className="w-full py-3 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                Prendre une photo (recommandé)
              </button>

              {/* Méthode scan en direct */}
              <button
                onClick={startCameraScanner}
                className="w-full py-3 bg-white/10 hover:bg-white/15 text-biblio-text rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Scan en direct
              </button>

              <p className="text-xs text-biblio-muted text-center">
                La méthode photo est compatible avec tous les appareils,
                y compris iPhone Safari.
              </p>
            </div>
          )}

          {/* ── Chargement / Traitement ── */}
          {(status === "loading" || status === "processing") && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
              <span className="text-sm text-biblio-muted">
                {status === "loading"
                  ? "Initialisation de la caméra…"
                  : "Analyse de la photo…"}
              </span>
            </div>
          )}

          {/* ── Erreur ── */}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <AlertCircle className="w-8 h-8 text-biblio-danger" />
              <p className="text-sm text-biblio-danger text-center">
                {errorMsg}
              </p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg text-sm font-medium transition-colors"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* ── Conteneur scan en direct (html5-qrcode) ── */}
          <div
            id={containerId.current}
            className={`rounded-lg overflow-hidden ${status !== "scanning" ? "hidden" : ""}`}
          />

          {scanMethod === "camera" && status === "scanning" && (
            <p className="text-xs text-biblio-muted text-center">
              {mode === "isbn"
                ? "Pointez la caméra vers le code-barre du livre."
                : "Pointez la caméra vers le QR code du livre."}
            </p>
          )}
        </div>

        {/* Éléments cachés nécessaires au scanning */}
        {/* Div requise par Html5Qrcode pour le scan de fichier image */}
        <div id={fileScanId.current} className="hidden" />
        {/* Input file avec capture="environment" : ouvre la caméra arrière nativement
            sur iOS Safari, Android Chrome et la plupart des navigateurs mobiles */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileCapture}
        />

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
