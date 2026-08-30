const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];

export const MAX_ROUTE_VIDEO_SIZE_MB = 80;

export function validateVideoFile(file, maxSizeMb = MAX_ROUTE_VIDEO_SIZE_MB) {
  if (!file) return "Vidéo manquante.";
  if (!file.type?.startsWith("video/") || !ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return "Utilisez une vidéo MP4, WebM ou MOV.";
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    return `La vidéo doit faire moins de ${maxSizeMb} Mo.`;
  }
  return "";
}

export function videoExtension(file) {
  if (file?.type === "video/webm") return "webm";
  if (file?.type === "video/quicktime") return "mov";
  if (file?.type === "video/x-m4v") return "m4v";
  return "mp4";
}

export function formatFileSize(bytes = 0) {
  if (!bytes) return "0 Mo";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} Mo`;
  return `${Math.round(bytes / 1024)} Ko`;
}
