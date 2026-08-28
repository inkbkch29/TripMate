const PROFILE_IMAGE_SIZE = 512;
const PROFILE_IMAGE_QUALITY = 0.82;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("อ่านรูปโปรไฟล์ไม่สำเร็จ"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("บีบอัดรูปโปรไฟล์ไม่สำเร็จ")), type, quality);
  });
}

export async function compressImage(file, { maxWidth = 1600, maxHeight = 1600, quality = 0.84, square = false } = {}) {
  const { image, url } = await loadImage(file);
  try {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error("รูปโปรไฟล์ไม่มีขนาดที่ถูกต้อง");

    const cropSize = square ? Math.min(sourceWidth, sourceHeight) : null;
    const sourceX = square ? (sourceWidth - cropSize) / 2 : 0;
    const sourceY = square ? (sourceHeight - cropSize) / 2 : 0;
    const drawWidth = square ? cropSize : sourceWidth;
    const drawHeight = square ? cropSize : sourceHeight;
    const scale = Math.min(1, maxWidth / drawWidth, maxHeight / drawHeight);
    const outputWidth = Math.max(1, Math.round(drawWidth * scale));
    const outputHeight = Math.max(1, Math.round(drawHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("อุปกรณ์นี้ไม่รองรับการย่อรูป");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sourceX, sourceY, drawWidth, drawHeight, 0, 0, outputWidth, outputHeight);

    let blob;
    try {
      blob = await canvasToBlob(canvas, "image/webp", quality);
    } catch {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
    }
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `image-${Date.now()}.${extension}`, { type: blob.type, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function compressProfileImage(file) {
  return compressImage(file, { maxWidth: PROFILE_IMAGE_SIZE, maxHeight: PROFILE_IMAGE_SIZE, quality: PROFILE_IMAGE_QUALITY, square: true });
}
