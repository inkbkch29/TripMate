// Shared by the notification center and Web Push. Keep user-entered names intact.
export function conciseNotificationCopy(item){
 const type=item.type,event=item.event||item.target?.event||'';
 const actor=item.actorName||item.target?.actorName||'';
 let description=String(item.text??item.body??'').trim(),title;
 if(type==='trip_fund_transactions'){
  title='กองกลาง';
  description=description.replace(/^รับเงินสมทบกองกลาง/,'รับเงินสมทบ').replace(/^นำส่วนเกินเข้ากองกลาง/,'รับส่วนเกิน').replace(/^บันทึกจ่ายจากกองกลาง/,'จ่าย').replace(/^กลับรายการกองกลาง/,'กลับรายการ').replace(/^อัปเดตกองกลาง\s*·?\s*/,'');
 }else if(type==='trip_members'){
  title=/^เพิ่มสมาชิกในทริป/.test(description)?'เพื่อนเข้าร่วม':/^นำสมาชิกออกจากทริป/.test(description)?'สมาชิกออกจากทริป':'สมาชิกอัปเดต';
  description=description.replace(/^เพิ่มสมาชิกในทริป/,'เพิ่มสมาชิก').replace(/^นำสมาชิกออกจากทริป/,'นำสมาชิกออก');
 }else if(['collections','collection','payment'].includes(type)){
  title=event==='payment_submitted'?'สลิปรอตรวจ':event==='payment_confirmed'?'รับเงินแล้ว':event==='insert'?'บิลใหม่':event==='delete'?'ลบบิล':'อัปเดตบิล';
  description=description.replace(/^(?:มีสลิปรอตรวจ|ยืนยันรับเงินแล้ว)\s*·\s*/,'').replace(/^(?:เพิ่ม|แก้ไข|อัปเดต|ลบ)\s+/,'').replace(/(ที่พัก)(\d)/g,'$1 $2');
 }else return null;
 if(actor&&!description.includes(actor))description=description?`${actor} · ${description}`:actor;
 return {title,description:description||'ดูรายละเอียดในทริป'};
}
