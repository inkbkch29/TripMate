import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
vi.mock('./supabase',()=>({supabase:null,uploadTripFile:vi.fn(async(t,u,k,f)=>({path:`${t}/${u}/${f.name}`}))}));
import InstallmentExpenses from './InstallmentExpenses';
it('offers proof attachments only on vendor payment and shows each saved proof in history',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const plan={expense_id:'p',revision:1,total_satang:10000,members:[{user_id:'a',scope:'full',start_number:1}],installments:[{id:'i',number:1,title:'มัดจำ',bill_satang:10000,vendor_paid_satang:0,vendor_payments:[{id:'v',amount_satang:50,paid_on:'2026-10-28',recorded_by:'a',note:'หลักฐาน',receipt_attachments:[{path:'t/a/one.png'},{path:'t/a/two.png'}]}]}],audit:[]};
 const click=async text=>act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent===text).click());
 try{await act(async()=>root.render(<InstallmentExpenses tripId="t" currentUserId="a" members={[{id:'a',name:'ผู้จ่าย'}]} expenses={[{id:'p',title:'ค่าที่พัก',amount:100,isInstallmentParent:true,installmentPlan:plan}]} canManage/>));await click('ดูรายละเอียด');await click('จ่ายให้ร้าน');expect(document.body.textContent).toContain('แนบหลักฐานโอน');const input=document.querySelector('input[type="file"]');expect(input.multiple).toBe(true);expect(input.accept).not.toContain('pdf');await act(async()=>document.querySelector('button[aria-label="กลับรายละเอียด"]').click());await click('ประวัติชำระ');expect(document.body.textContent).toContain('หลักฐาน 1');expect(document.body.textContent).toContain('หลักฐาน 2');expect(document.querySelectorAll('button[aria-label="ดูสลิป"]').length||[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('สลิป')).length).toBeGreaterThanOrEqual(2);}finally{await act(async()=>root.unmount());host.remove();}
});
