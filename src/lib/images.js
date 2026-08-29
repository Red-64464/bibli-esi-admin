import imageCompression from "browser-image-compression";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function validateImageFile(file, maxSizeMb = 8) {
  if (!file) return "Image manquante.";
  if (!file.type?.startsWith("image/") || !ALLOWED_TYPES.includes(file.type)) {
    return "Utilisez une image JPG, PNG, WebP ou HEIC.";
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    return `L'image doit faire moins de ${maxSizeMb} Mo.`;
  }
  return "";
}

export async function compressImage(file, options = {}) {
  const validation = validateImageFile(file, options.maxInputSizeMb || 8);
  if (validation) throw new Error(validation);

  return imageCompression(file, {
    maxSizeMB: options.maxSizeMB ?? 0.8,
    maxWidthOrHeight: options.maxWidthOrHeight ?? 1600,
    useWebWorker: true,
    fileType: options.fileType ?? "image/jpeg",
    initialQuality: options.initialQuality ?? 0.82,
  });
}

export function imageExtension(file) {
  if (file?.type === "image/png") return "png";
  if (file?.type === "image/webp") return "webp";
  return "jpg";
}
