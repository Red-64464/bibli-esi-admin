// Les fiches historiques stockent 1A ; l'interface affiche A1.
export function formatShelfLocation(value) {
  return typeof value === "string" ? value.replace(/^([1-5])([A-E])$/, "$2$1") : value;
}
