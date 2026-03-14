/**
 * Ouvre une fenêtre d'impression avec un contenu HTML formaté.
 * @param {string} title - Titre du document
 * @param {string} bodyHtml - Contenu HTML du document
 */
function printHtml(title, bodyHtml) {
  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; padding: 20px; }
    h1 { font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
    h2 { font-size: 14px; margin: 16px 0 8px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    th { background: #f1f5f9; font-weight: 600; color: #475569; }
    .label-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .label-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; page-break-inside: avoid; }
    .label-card .isbn { font-family: monospace; font-size: 11px; color: #64748b; }
    .label-card .titre { font-size: 12px; font-weight: 600; margin: 4px 0; }
    .label-card .auteur { font-size: 11px; color: #64748b; }
    .fiche { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 12px 0; page-break-inside: avoid; }
    .fiche-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
    .fiche-label { color: #64748b; }
    .fiche-value { font-weight: 600; }
    .signature { margin-top: 40px; display: flex; justify-content: space-between; }
    .signature div { width: 200px; border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center; font-size: 11px; color: #64748b; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

/**
 * Imprime des étiquettes ISBN pour une liste de livres.
 * @param {Array} livres - [{titre, auteur, isbn, categorie}]
 */
export function printLabels(livres) {
  const cards = livres
    .map(
      (l) => `
    <div class="label-card">
      <div class="isbn">${l.isbn || "—"}</div>
      <div class="titre">${l.titre || "—"}</div>
      <div class="auteur">${l.auteur || "—"}</div>
      <div class="isbn">${l.categorie || ""}</div>
    </div>`,
    )
    .join("");

  printHtml(
    "Étiquettes livres",
    `<h1>Étiquettes — Bibl'ESI</h1>
     <div class="label-grid">${cards}</div>`,
  );
}

/**
 * Imprime une fiche de prêt (reçu).
 * @param {object} pret - Objet prêt avec livres et etudiants joints
 */
export function printFichePret(pret) {
  const body = `
    <h1>Fiche de prêt — Bibl'ESI</h1>
    <div class="fiche">
      <h2>Informations du prêt</h2>
      <div class="fiche-row">
        <span class="fiche-label">Livre</span>
        <span class="fiche-value">${pret.livres?.titre || "—"}</span>
      </div>
      <div class="fiche-row">
        <span class="fiche-label">ISBN</span>
        <span class="fiche-value">${pret.livres?.isbn || "—"}</span>
      </div>
      <div class="fiche-row">
        <span class="fiche-label">Étudiant</span>
        <span class="fiche-value">${pret.etudiants ? `${pret.etudiants.prenom} ${pret.etudiants.nom}` : "—"}</span>
      </div>
      <div class="fiche-row">
        <span class="fiche-label">Date du prêt</span>
        <span class="fiche-value">${pret.date_pret ? new Date(pret.date_pret).toLocaleDateString("fr-FR") : "—"}</span>
      </div>
      <div class="fiche-row">
        <span class="fiche-label">Date de retour prévue</span>
        <span class="fiche-value">${pret.date_retour_prevue ? new Date(pret.date_retour_prevue).toLocaleDateString("fr-FR") : "—"}</span>
      </div>
      ${pret.notes ? `<div class="fiche-row"><span class="fiche-label">Notes</span><span class="fiche-value">${pret.notes}</span></div>` : ""}
    </div>
    <div class="signature">
      <div>Signature bibliothécaire</div>
      <div>Signature étudiant</div>
    </div>`;

  printHtml("Fiche de prêt", body);
}
