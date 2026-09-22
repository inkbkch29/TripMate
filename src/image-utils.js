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

export function drawSquareCrop(context,image,size,{rotation=0,zoom=1,offsetX=0,offsetY=0}={}){
  const width=image.naturalWidth||image.width;const height=image.naturalHeight||image.height;
  const quarterTurn=Math.abs(rotation/90)%2===1;const rotatedWidth=quarterTurn?height:width;const rotatedHeight=quarterTurn?width:height;
  const scale=Math.max(size/rotatedWidth,size/rotatedHeight)*zoom;
  const maxX=Math.max(0,(rotatedWidth*scale-size)/2);const maxY=Math.max(0,(rotatedHeight*scale-size)/2);
  context.save();context.clearRect(0,0,size,size);context.fillStyle="#eef6fb";context.fillRect(0,0,size,size);context.translate(size/2+(offsetX/100)*maxX,size/2+(offsetY/100)*maxY);context.rotate(rotation*Math.PI/180);context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";context.drawImage(image,-width*scale/2,-height*scale/2,width*scale,height*scale);context.restore();
}

export async function cropProfileImage(file,options={}){
  const {image,url}=await loadImage(file);
  try{const canvas=document.createElement("canvas");canvas.width=PROFILE_IMAGE_SIZE;canvas.height=PROFILE_IMAGE_SIZE;const context=canvas.getContext("2d",{alpha:false});if(!context)throw new Error("อุปกรณ์นี้ไม่รองรับการครอปรูป");drawSquareCrop(context,image,PROFILE_IMAGE_SIZE,options);let blob;try{blob=await canvasToBlob(canvas,"image/webp",PROFILE_IMAGE_QUALITY);}catch{blob=await canvasToBlob(canvas,"image/jpeg",.86);}const extension=blob.type==="image/webp"?"webp":"jpg";return new File([blob],`avatar-${Date.now()}.${extension}`,{type:blob.type,lastModified:Date.now()});}finally{URL.revokeObjectURL(url);}
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
