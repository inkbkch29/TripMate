import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import CollectionDialog from './CollectionDialog';
import CollectionReceiptConfirmation from './CollectionReceiptConfirmation';
import {collectionReceiver} from './collection-receiver';
const members=[{id:'a',name:'หนึ่ง',accountName:'บัญชีเดิม',paymentQr:'old-qr'},{id:'b',name:'สอง'}];
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const click=async el=>act(async()=>el.click());
const fill=async(label,value)=>{const input=[...document.querySelectorAll('input')].find(i=>i.id&&document.querySelector(`label[for="${i.id}"]`)?.textContent.includes(label));await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});};
async function mounted(element,run){globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);try{await act(async()=>root.render(element));await run(host);}finally{await act(async()=>root.unmount());host.remove();}}
it('uses the shared collection form without bank fields or required due date and never auto-pays the receiver',async()=>{
 const save=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(null);
 await mounted(<CollectionDialog open defaultFund members={members} currentUserId="a" onSave={save} onClose={()=>{}}/>,async()=>{
 expect(document.body.textContent).not.toContain('บัญชีรับเงินจริง / พร้อมเพย์');expect(document.querySelector('input[type="date"]').required).toBe(false);
 await fill('รายการ','สมทบค่าเดินทาง');await fill('จำนวนเงินต่อคน','100.33');await click(button('สร้างรายการ'));expect(document.body.textContent).toContain('offline');await click(button('สร้างรายการ'));
 expect(save).toHaveBeenCalledTimes(2);expect(save.mock.calls[0][0].id).toBe(save.mock.calls[1][0].id);expect(save.mock.calls[0][0].requestId).toBe(save.mock.calls[1][0].requestId);
 expect(save.mock.calls[1][0]).toMatchObject({isFund:true,paid:[],due:'',amount:200.66,contributionAmounts:{a:100.33,b:100.33}});
 });
});
it('links missing receiving settings and rejects precision beyond satang',async()=>{
 const save=vi.fn(),settings=vi.fn();await mounted(<CollectionDialog open defaultFund members={[{id:'a',name:'หนึ่ง'}]} currentUserId="a" onSave={save} onPaymentSettings={settings} onClose={()=>{}}/>,async()=>{
 await click(button('ตั้งค่าข้อมูลรับเงิน'));expect(settings).toHaveBeenCalledOnce();await fill('รายการ','เงินสมทบ');await fill('จำนวนเงินต่อคน','10.001');await click(button('สร้างรายการ'));expect(save).not.toHaveBeenCalled();expect(document.body.textContent).toContain('ไม่เกิน 2 ตำแหน่ง');
 });
});
it('preserves ordinary collection validation and rounding behavior',async()=>{
 const save=vi.fn();await mounted(<CollectionDialog open members={members} currentUserId="a" onSave={save} onClose={()=>{}}/>,async()=>{
 await fill('รายการ','ค่าที่พัก');await fill('ยอดรวม','8450');await click(button('สร้างรายการ'));expect(save).not.toHaveBeenCalled();await fill('ครบกำหนด','2026-11-01');await click(button('สร้างรายการ'));expect(save.mock.calls[0][0]).toMatchObject({isFund:false,originalAmount:8450,perPerson:4225,paid:['a']});
 });
});
it('confirms the reviewed actual receipt rather than substituting the requested amount',async()=>{
 const confirm=vi.fn(async()=>true),close=vi.fn();await mounted(<CollectionReceiptConfirmation request={{title:'สมทบ',memberName:'สอง',expectedSatang:50000,isFund:true}} onConfirm={confirm} onClose={close}/>,async()=>{
 await fill('ยอดรับเงินจริง','499.99');await click(button('ยืนยันรับเงินจริง'));expect(confirm).not.toHaveBeenCalled();await fill('ยอดรับเงินจริง','500.01');await click(button('ยืนยันรับเงินจริง'));expect(confirm).toHaveBeenCalledWith(500.01);expect(close).toHaveBeenCalledOnce();
 });
});
it('uses the historical receiving snapshot and never falls back to a changed QR',()=>{
 const request={receiver:'a',receivingAccount:{account_name:'บัญชีเดิม',display_name:'ผู้รับเดิม',payment_qr_path:'old-path',paymentQr:'signed-old'}};
 expect(collectionReceiver(request,[{id:'a',accountName:'บัญชีใหม่',paymentQr:'new'}])).toMatchObject({accountName:'บัญชีเดิม',paymentQr:'signed-old',name:'ผู้รับเดิม'});
 expect(collectionReceiver({...request,receivingAccount:{...request.receivingAccount,paymentQr:''}},members).paymentQr).toBe('');
 expect(collectionReceiver({receiver:'a'},members).paymentQr).toBe('old-qr');
});
