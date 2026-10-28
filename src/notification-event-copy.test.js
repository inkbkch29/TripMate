import {it,expect} from 'vitest';
import {notificationCategory,notificationCopy} from './notification-ui';
it('keeps fund updates in expense filters and labels membership by structured type',()=>{
 expect(notificationCategory({type:'trip_fund_transactions'})).toBe('expense');
 expect(notificationCopy({type:'trip_fund_transactions',text:'รับเงินสมทบกองกลาง',actorName:'หนึ่ง'})).toEqual({title:'อัปเดตกองกลาง',description:'หนึ่ง · รับเงินสมทบกองกลาง'});
 expect(notificationCopy({type:'trip_members',text:'เพิ่มสมาชิกในทริป'}).title).toBe('สมาชิกในทริปอัปเดต');
 expect(notificationCopy({type:'collections',text:'เพิ่ม “ค่าบ้าน”'}).description).toContain('ค่าบ้าน');
});
