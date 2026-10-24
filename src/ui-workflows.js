export function storedTripKey(name,userId,tripId){
 return userId?`tripmate-account:${userId}:${tripId||'none'}:${name}`:`tripmate-demo:${name}`;
}
export function attachmentError(file){
 if(!file)return 'กรุณาเลือกไฟล์';
 if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))return 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF';
 if(file.size>15*1024*1024)return 'ไฟล์ต้นฉบับต้องมีขนาดไม่เกิน 15 MB';
 if(file.size===0)return 'ไฟล์นี้ไม่มีข้อมูล กรุณาเลือกไฟล์ใหม่';
 return '';
}
