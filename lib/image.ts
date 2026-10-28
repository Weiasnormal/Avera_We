// Browser replacement for the mobile acquisition path (ML Kit document scanner +
// expo-image-manipulator). The mobile app converted every scan to PNG before
// upload (caseStore.normalizeToPng); this does the same with a canvas, after an
// optional crop the user draws — the scanner's crop step.

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const ACCEPTED_IMAGE_EXTENSIONS = ".png,.jpg,.jpeg,.webp";
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MIN_DIMENSION = 32;

export class ImageValidationError extends Error {}

export function validateImageFile(file: File) {
  const type = file.type.toLowerCase();
  const extensionOk = /\.(png|jpe?g|webp)$/i.test(file.name);
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type) && !extensionOk) {
    throw new ImageValidationError("Unsupported file type. Choose a PNG, JPEG or WebP image.");
  }
  if (file.size === 0) throw new ImageValidationError("This file is empty. Choose another image.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(`This image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB. Choose a smaller file.`);
  }
}

export interface CropRect {
  /** Fractions of the source image, 0–1. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageValidationError("This image could not be read. It may be corrupted or in an unsupported format.");
  }
}

/** Crops (optional) and re-encodes to PNG at full source resolution. */
export async function toPng(source: Blob, crop?: CropRect | null): Promise<Blob> {
  const bitmap = await decodeImage(source);
  try {
    const sx = crop ? Math.round(crop.x * bitmap.width) : 0;
    const sy = crop ? Math.round(crop.y * bitmap.height) : 0;
    const sw = crop ? Math.max(1, Math.round(crop.width * bitmap.width)) : bitmap.width;
    const sh = crop ? Math.max(1, Math.round(crop.height * bitmap.height)) : bitmap.height;
    if (sw < MIN_DIMENSION || sh < MIN_DIMENSION) {
      throw new ImageValidationError("The selected area is too small. Draw a larger crop around the signature.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const context = canvas.getContext("2d");
    if (!context) throw new ImageValidationError("Your browser could not process this image.");
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new ImageValidationError("Failed to process the selected image. Choose a different image and try again.");
    return blob;
  } finally {
    bitmap.close();
  }
}
