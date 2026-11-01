import {supabase} from './supabase';

// Keep the original dimensions and quiet zone. PNG avoids WebP gallery import
// limitations and introduces no further lossy compression of existing QR files.
export async function paymentQrPng(blob){
 if(!['image/png','image/jpeg','image/webp'].includes(blob.type))throw new Error('ไฟล์ QR ต้องเป็นรูป PNG, JPG หรือ WebP');
 const url=URL.createObjectURL(blob);
 try{
  const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('เปิดรูป QR ไม่สำเร็จ'));image.src=url;});
  const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  if(!canvas.width||!canvas.height)throw new Error('รูป QR ไม่มีขนาดที่ถูกต้อง');
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('อุปกรณ์นี้บันทึกรูป QR ไม่ได้');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0);
  const png=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?.type==='image/png'?resolve(b):reject(new Error('สร้างไฟล์ PNG ไม่สำเร็จ')),'image/png'));
  return new File([png],'TripMate-payment-QR.png',{type:'image/png'});
 }finally{URL.revokeObjectURL(url);}
}
export async function loadPaymentQrFile(member){
 let url=member?.paymentQr;
 // Signed URLs can expire while a payment dialog is open. Use the exact saved
 // account path, including historical receiving-account snapshots.
 if(member?.paymentQrPath&&supabase){const {data,error}=await supabase.storage.from('trip-files').createSignedUrl(member.paymentQrPath,3600);if(error)throw error;url=data?.signedUrl;}
 if(!url)throw new Error('ยังไม่มีรูป QR รับเงิน');
 const response=await fetch(url);if(!response.ok)throw new Error('โหลด QR ไม่สำเร็จ กรุณาลองใหม่');
 return paymentQrPng(await response.blob());
}
export function downloadPaymentQr(file){
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
 // Mobile browsers may read a blob URL after the click handler completes.
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
