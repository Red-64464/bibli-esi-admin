import Papa from "papaparse";

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportCSV = (data, filename) => {
  const csv = Papa.unparse(data);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename + ".csv");
};

export const exportJSON = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  downloadBlob(blob, filename + ".json");
};

export const exportExcel = (data, filename, sheetName = "Données") => {
  const xmlEscape = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const safeCell = (value) => {
    const text = String(value ?? "");
    // Empêche les formules Excel injectées depuis des données utilisateur.
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
  };
  const columns = [...new Set(data.flatMap((row) => Object.keys(row || {})))];
  const row = (cells) => `<Row>${cells.map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(safeCell(cell))}</Data></Cell>`).join("")}</Row>`;
  const content = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${xmlEscape(sheetName)}"><Table>${row(columns)}${data.map((item) => row(columns.map((column) => item?.[column]))).join("")}</Table></Worksheet></Workbook>`;
  downloadBlob(new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8" }), filename + ".xls");
};
