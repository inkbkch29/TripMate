import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {Money,CollectionCard,SettlementCard} from './main';
const members=[{id:'a',name:'ผู้รับ',accountName:'บัญชีผู้รับ'},{id:'b',name:'เจ้าของยอด'},{id:'c',name:'คนจ่ายแทน'}];
const name=id=>members.find(m=>m.id===id)?.name||'—';
const base={id:'collection',createdBy:'c',title:'เก็บค่ารถ',receiver:'a',collectionOnly:true,amount:100,originalAmount:100,participants:['b'],paid:[],payments:{b:{amount:100,status:'unpaid'}},perPerson:100};
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const click=async text=>{const b=button(text);expect(b,`button ${text}`).toBeTruthy();await act(async()=>b.click());};
async function fill(label,value){const input=[...document.querySelectorAll('input,textarea')].find(i=>i.id&&document.querySelector(`label[for="${i.id}"]`)?.textContent.includes(label));expect(input).toBeTruthy();await act(async()=>{Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
async function mount(element,run){globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);try{await act(async()=>root.render(element));await run(host,root);}finally{await act(async()=>root.unmount());host.remove();}}
function Harness({initial=base,...props}){const [collections,setCollections]=useState([initial]);const [settlements,setSettlements]=useState([]);return <Money members={members} expenses={[]} setExpenses={()=>{}} collections={collections} setCollections={setCollections} settlements={settlements} setSettlements={setSettlements} toast={()=>{}} {...props}/>;}
it('gives the creator an edit action independently of confirmation rights and locks submitted requests',async()=>{
 const edit=vi.fn();const render=c=><CollectionCard collection={c} members={members} currentUserId="c" canApprove={false} canEdit canDelete={false} name={name} busy="" onEdit={edit}/>;
 await mount(render(base),async(host,root)=>{const editButton=()=>document.querySelector('[aria-label="แก้รายการเรียกเก็บ"]');expect(editButton()).toBeTruthy();await act(async()=>editButton().click());expect(edit).toHaveBeenCalledWith(base);await act(async()=>root.render(render({...base,payments:{b:{amount:100,status:'pending',slipPath:'t/c/slip.png'}}})));expect(editButton().disabled).toBe(true);});
});
it('rejects a pending proxy slip with a reason, preserves debt, and makes resubmission available',async()=>{
 const reject=vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce();
 const initial={...base,payments:{b:{amount:100,status:'pending',submittedBy:'c',slipPath:'t/c/old.png'}}};
 await mount(<Harness initial={initial} currentUserId="a" onRejectCollectionSlip={reject}/>,async()=>{
 await click('ดูสมาชิก / สลิปย้อนหลัง');await click('สลิปไม่ถูกต้อง');await fill('เหตุผลที่ต้องแก้ไข','ยอดในสลิปไม่ตรง');await click('ส่งกลับ');expect(button('ส่งกลับ')).toBeTruthy();await click('ส่งกลับ');expect(reject).toHaveBeenLastCalledWith('collection','b','t/c/old.png','ยอดในสลิปไม่ตรง');expect(document.body.textContent).toContain('แก้ไขสลิป');await click('สรุปยอด');expect(document.body.textContent).toContain('฿100.00');
 });
});
it('shows the rejected reason to a proxy payer, uploads for the original debtor, then awaits recipient review',async()=>{
 const submit=vi.fn(async()=>({status:'pending',submittedBy:'c',slipPath:'t/c/new.png'}));
 const initial={...base,payments:{b:{amount:100,status:'unpaid',rejectionReason:'ยอดไม่ตรง',slipPath:'t/c/old.png'}}};
 await mount(<Harness initial={initial} currentUserId="c" onSubmitCollectionSlip={submit}/>,async()=>{
 await click('แจ้งชำระ / จ่ายแทนเพื่อน');expect(document.body.textContent).toContain('กรุณาแก้ไขสลิป: ยอดไม่ตรง');expect(document.body.textContent).toContain('คนจ่ายแทน');expect(document.body.textContent).toContain('เจ้าของยอด');const input=document.querySelector('input[type="file"]');const file=new File(['proof'],'new.png',{type:'image/png'});await act(async()=>{Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new Event('change',{bubbles:true}));});await click('ส่งให้ตรวจ');expect(submit).toHaveBeenCalledWith(initial,file,'b');await click('ดูสมาชิก / สลิปย้อนหลัง');expect(document.body.textContent).toContain('รอตรวจ · คนจ่ายแทน จ่ายแทน');expect(button('แจ้งชำระ / จ่ายแทนเพื่อน')).toBeFalsy();
 });
});
it('confirms received cash once and removes the due from the balance summary',async()=>{
 const persist=vi.fn(async()=>{});const initial={...base,payments:{b:{amount:100,status:'pending',submittedBy:'c'}}};
 await mount(<Harness initial={initial} currentUserId="a" onPersistCollection={persist}/>,async()=>{await click('ดูสมาชิก / สลิปย้อนหลัง');await click('ยืนยัน');await click('ยืนยันรับเงินจริง');expect(persist).toHaveBeenCalledTimes(1);expect(persist.mock.calls[0].slice(1)).toEqual(['b',100]);await click('สรุปยอด');expect(document.body.textContent).toContain('ทุกคนเคลียร์ยอดครบแล้ว');});
});
it('offers proxy settlement uploads, blocks pending reuploads and exposes receiver review only',async()=>{
 const send=vi.fn();const transfer={from:'b',to:'a',amount:100};const render=(user,settlement)=><SettlementCard transfer={transfer} settlement={settlement} members={members} currentUserId={user} busy="" onSend={send} onReview={()=>{}}/>;
 await mount(render('c'),async(host,root)=>{expect(host.textContent).toContain('จ่ายแทนเพื่อน');const input=host.querySelector('input[type="file"]');const file=new File(['proof'],'s.png',{type:'image/png'});await act(async()=>{Object.defineProperty(input,'files',{value:[file]});input.dispatchEvent(new Event('change',{bubbles:true}));});expect(send).toHaveBeenCalledWith(transfer,file);await act(async()=>root.render(render('c',{id:'s',status:'pending'})));expect(host.querySelector('input[type="file"]')).toBeNull();expect(host.textContent).not.toContain('ยืนยันรับเงิน');await act(async()=>root.render(render('a',{id:'s',status:'pending'})));expect(host.textContent).toContain('ยืนยันรับเงิน');expect(host.querySelector('input[type="file"]')).toBeNull();});
});

it.each(['b','c'])('keeps a failed submission retryable for payer %s without marking the debtor paid',async user=>{
 const toast=vi.fn(),submit=vi.fn().mockRejectedValueOnce(new Error('upload failed')).mockResolvedValueOnce({status:'pending',submittedBy:user,slipPath:`t/${user}/retry.png`});
 await mount(<Harness currentUserId={user} toast={toast} onSubmitCollectionSlip={submit}/>,async()=>{
 await click('แจ้งชำระ / จ่ายแทนเพื่อน');
 const input=document.querySelector('input[type="file"]'),file=new File(['proof'],'retry.png',{type:'image/png'});
 await act(async()=>{Object.defineProperty(input,'files',{value:[file]});input.dispatchEvent(new Event('change',{bubbles:true}));});
 await click('ส่งให้ตรวจ');expect(toast).toHaveBeenCalledWith('upload failed','error');expect(button('ส่งให้ตรวจ')).toBeTruthy();
 await click('ส่งให้ตรวจ');expect(submit).toHaveBeenCalledTimes(2);expect(submit.mock.calls[1][2]).toBe('b');expect(button('ส่งให้ตรวจ')).toBeFalsy();
 await click('สรุปยอด');expect(document.body.textContent).toContain('รอตรวจสลิป');expect(document.body.textContent).toContain('฿100.00');
 });
});
