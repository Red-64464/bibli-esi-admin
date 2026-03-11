import { useRef } from "react";
import QRCode from "react-qr-code";
import { X, Download, QrCode } from "lucide-react";

/**
 * Modal affichant le QR code d'un livre.
 * La valeur encodée dans le QR est l'ID du livre (UUID).
 * On peut également scanner ce QR depuis la page Prêts pour lancer un prêt.
 */
export default function QRCodeModal({ livre, onClose }) {
  const qrRef = useRef(null);

  const qrValue = `bibliogest://livre/${livre.id}`;

  const handleDownload = () => {
    // Récupérer le SVG et le télécharger comme PNG via canvas
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 80;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);

      // Titre du livre
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        livre.titre?.slice(0, 40) || "Livre",
        canvas.width / 2,
        img.height + 50,
      );

      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `qr_${livre.titre?.replace(/\s+/g, "_") || livre.id}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-biblio-card rounded-xl border border-white/10 w-full max-w-xs space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <QrCode className="w-5 h-5 text-biblio-accent" />
            QR Code livre
          </h2>
          <button
            onClick={onClose}
            className="text-biblio-muted hover:text-biblio-danger transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-3 px-5" ref={qrRef}>
          <div className="bg-white p-3 rounded-xl">
            <QRCode value={qrValue} size={180} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-biblio-text">
              {livre.titre}
            </p>
            {livre.auteur && (
              <p className="text-xs text-biblio-muted">{livre.auteur}</p>
            )}
            {livre.isbn && (
              <p className="text-xs text-biblio-muted mt-0.5">
                ISBN : {livre.isbn}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Télécharger
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg text-sm font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
