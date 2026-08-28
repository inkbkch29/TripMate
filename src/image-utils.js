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

export async function compressProfileImage(file) {
  const { image, url } = await loadImage(file);
  try {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error("รูปโปรไฟล์ไม่มีขนาดที่ถูกต้อง");

    const cropSize = Math.min(sourceWidth, sourceHeight);
    const sourceX = (sourceWidth - cropSize) / 2;
    const sourceY = (sourceHeight - cropSize) / 2;
    const outputSize = Math.min(PROFILE_IMAGE_SIZE, cropSize);
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("อุปกรณ์นี้ไม่รองรับการย่อรูป");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, outputSize, outputSize);

    let blob;
    try {
      blob = await canvasToBlob(canvas, "image/webp", PROFILE_IMAGE_QUALITY);
    } catch {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
    }
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `avatar-${Date.now()}.${extension}`, { type: blob.type, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}
