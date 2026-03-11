import { useEffect, useRef, useState } from "react";
import { Camera, X, Loader2, AlertCircle } from "lucide-react";

/**
 * Scanner caméra pour codes-barres ISBN et QR codes.
 * Utilise html5-qrcode (chargé dynamiquement).
 *
 * @param {function} onScan   - Appelé avec la valeur scannée (string)
 * @param {function} onClose  - Appelé quand l'utilisateur ferme le scanner
 * @param {"isbn"|"qr"} mode  - "isbn" = code-barre, "qr" = QR code
 */
export default function ISBNScanner({ onScan, onClose, mode = "isbn" }) {
  const [status, setStatus] = useState("loading"); // loading | scanning | error
  const [errorMsg, setErrorMsg] = useState("");
  const [scanned, setScanned] = useState(false);

  // ID unique pour éviter les conflits si le composant est monté plusieurs fois
  const containerId = useRef(
    "isbn-scanner-" + Math.random().toString(36).slice(2, 8),
  );
  const scannerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

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
            if (scanned) return;
            setScanned(true);
            // Arrêter le scanner après succès
            scanner
              .stop()
              .then(() => {
                if (mounted) onScan(decodedText);
              })
              .catch(() => {
                if (mounted) onScan(decodedText);
              });
          },
          () => {}, // ignore erreurs de décodage (normales)
        );

        if (mounted) setStatus("scanning");
      } catch (err) {
        if (!mounted) return;
        const msg = err?.message || String(err);
        if (msg.includes("Permission") || msg.includes("NotAllowed")) {
          setErrorMsg(
            "Accès à la caméra refusé. Autorisez la caméra dans votre navigateur.",
          );
        } else if (
          msg.includes("NotFound") ||
          msg.includes("DevicesNotFound")
        ) {
          setErrorMsg("Aucune caméra détectée sur cet appareil.");
        } else {
          setErrorMsg("Impossible d'ouvrir la caméra : " + msg);
        }
        setStatus("error");
      }
    };

    startScanner();

    return () => {
      mounted = false;
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

        <p className="text-xs text-biblio-muted px-5">
          {mode === "isbn"
            ? "Pointez la caméra vers le code-barre du livre."
            : "Pointez la caméra vers le QR code du livre."}
        </p>

        {/* Zone de scan */}
        <div className="px-5">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
              <span className="text-sm text-biblio-muted">
                Initialisation de la caméra…
              </span>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <AlertCircle className="w-8 h-8 text-biblio-danger" />
              <p className="text-sm text-biblio-danger text-center">
                {errorMsg}
              </p>
            </div>
          )}

          {/* Conteneur html5-qrcode */}
          <div
            id={containerId.current}
            className={`rounded-lg overflow-hidden ${status !== "scanning" ? "hidden" : ""}`}
          />
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
