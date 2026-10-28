import {it,expect}from 'vitest';
import {conciseNotificationCopy}from '../supabase/functions/_shared/notification-copy';
import {notificationCopy}from './notification-ui';
it('renders the same short copy for a bell row and its push payload',()=>{
 const row={type:'collections',body:'มีสลิปรอตรวจ · ค่าบ้าน',title:'TripMate',target:{event:'payment_submitted',actorName:'ออม'}};
 expect(conciseNotificationCopy(row)).toEqual({title:'สลิปรอตรวจ',description:'ออม · ค่าบ้าน'});
 expect(notificationCopy({type:row.type,text:row.body,event:row.target.event,actorName:row.target.actorName})).toEqual(conciseNotificationCopy(row));
});
it('keeps amounts and user names without adding the app name',()=>{
 expect(conciseNotificationCopy({type:'trip_fund_transactions',body:'บันทึกจ่ายจากกองกลาง · ค่าบ้าน ฿1,900'})).toEqual({title:'กองกลาง',description:'จ่าย · ค่าบ้าน ฿1,900'});
 expect(conciseNotificationCopy({type:'collections',body:'เพิ่ม “ค่าที่พัก”',target:{event:'insert'}})).toEqual({title:'บิลใหม่',description:'“ค่าที่พัก”'});
 expect(conciseNotificationCopy({type:'trip_members',body:'เพิ่มสมาชิกในทริป',target:{actorName:'แน็ค'}})).toEqual({title:'เพื่อนเข้าร่วม',description:'แน็ค · เพิ่มสมาชิก'});
});
