// Images stay on the device; only OCR code and language models are downloaded.
export async function readReceipt(file, { onProgress = () => {}, signal } = {}) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use a JPG, PNG or WebP image');
  if (file.size > 15 * 1024 * 1024) throw new Error('Image exceeds 15 MB');
  let worker; let canvas; let abort;
  const cancelled = new Promise((_,reject)=>{
    abort=()=>reject(new DOMException('Cancelled','AbortError'));
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
  });
  const work=async()=>{
    const bitmap=await createImageBitmap(file);
    if(signal?.aborted){bitmap.close();throw new DOMException('Cancelled','AbortError');}
    const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));
    canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const {createWorker}=await import('tesseract.js');
    worker=await createWorker(['tha','eng'],1,{logger:message=>onProgress({status:message.status,progress:message.progress||0})});
    if(signal?.aborted){await worker.terminate();worker=null;throw new DOMException('Cancelled','AbortError');}
    const {data}=await worker.recognize(canvas);
    return {text:data.text,confidence:data.confidence};
  };
  try{return await Promise.race([work(),cancelled]);}
  finally{
    signal?.removeEventListener('abort',abort);
    if(worker){await worker.terminate();worker=null;}
    if(canvas){canvas.width=0;canvas.height=0;}
  }
}
