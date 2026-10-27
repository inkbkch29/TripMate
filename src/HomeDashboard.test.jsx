import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import HomeDashboard from './HomeDashboard';
import MemberAvatarGroup from './MemberAvatarGroup';
import TripPollSection from './TripPollSection';
let host,root;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
const members=Array.from({length:20},(_,i)=>({id:String(i),name:`เพื่อน ${i+1}`,avatar:i===0?'/photo.jpg':'',email:'private@example.test',promptpay:'secret-number'}));
const click=async target=>act(async()=>target.click());
it('has compact members with four avatars and a full list/profile without private details',async()=>{
 await act(async()=>root.render(<MemberAvatarGroup members={members}/>));expect(host.querySelectorAll('.home-avatar-stack .MuiAvatar-root')).toHaveLength(5);expect(host.textContent).toContain('+16');
 await click(host.querySelector('[aria-label="ดูสมาชิกทั้งหมด 20 คน"]'));let dialog=document.querySelector('[role="dialog"]');expect(dialog.querySelectorAll('.home-member-option')).toHaveLength(20);
 await click(dialog.querySelector('[aria-label="ดูโปรไฟล์ เพื่อน 1"]'));dialog=document.querySelector('[role="dialog"]');expect(dialog.querySelector('img').getAttribute('src')).toBe('/photo.jpg');expect(dialog.textContent).not.toMatch(/private|secret-number/);
 await click(dialog.querySelector('[aria-label="กลับไปรายชื่อสมาชิก"]'));expect(document.querySelectorAll('.home-member-option')).toHaveLength(20);
});
it('renders upcoming planning action and completed memories using the same layout',async()=>{
 const onAddStop=vi.fn(),trip={name:'ทริปจริง',start_date:'2026-10-31',end_date:'2026-11-02'},now=new Date('2026-10-25T10:00:00+07:00');
 await act(async()=>root.render(<HomeDashboard trip={trip} members={members} now={now} onAddStop={onAddStop}/>));expect(host.textContent).toContain('อีก 6 วัน');expect(host.textContent).toContain('ยังไม่มีแพลนเที่ยว');expect(host.textContent).not.toMatch(/โหวต|ยังไม่ได้ตั้งงบ/);await click([...host.querySelectorAll('button')].find(b=>b.textContent==='เพิ่มสถานที่แรก'));expect(onAddStop).toHaveBeenCalledOnce();
 await act(async()=>root.render(<HomeDashboard trip={{...trip,status:'completed'}} members={members} now={now}/>));expect(host.textContent).toContain('ดูความทรงจำ');expect(host.textContent).not.toContain('เตรียมพร้อมก่อนเดินทาง');expect(host.querySelector('.home-member-section')).not.toBeNull();expect(host.textContent).toContain('ชำระครบแล้ว');await act(async()=>root.render(<HomeDashboard trip={trip} members={members} now={now} canAddStops={false}/>));expect(host.textContent).not.toContain('เพิ่มสถานที่แรก');
});
it('keeps completed poll history read-only, loads results for ordinary members and preserves active voting links',async()=>{
 const poll={id:'p',token:'token',title:'เลือกที่พัก',status:'open'},load=vi.fn(async()=>({...poll,options:[{id:'o',name:'บ้านริมน้ำ',votes:3}]})),create=vi.fn();
 await act(async()=>root.render(<TripPollSection polls={[poll]} completed canCreate onCreate={create} loadResults={load}/>));expect(host.textContent).not.toContain('สร้างโหวต');expect(host.querySelector('a')).toBeNull();await click([...host.querySelectorAll('button')].find(b=>b.textContent==='ดูผล'));expect(load).toHaveBeenCalledWith(poll);expect(document.querySelector('[role="dialog"]').textContent).toContain('3 คะแนน');expect(create).not.toHaveBeenCalled();
 await act(async()=>root.render(<TripPollSection polls={[poll]} canCreate onCreate={create} loadResults={load}/>));expect(host.querySelector('a').getAttribute('href')).toContain('?vote=token');expect(host.textContent).toContain('สร้างโหวต');await click([...host.querySelectorAll('button')].find(b=>b.textContent==='สร้างโหวต'));expect(create).toHaveBeenCalledOnce();await act(async()=>root.render(<TripPollSection polls={[poll]} canCreate={false} onCreate={create} loadResults={load}/>));expect(host.textContent).not.toContain('สร้างโหวต');expect(host.querySelector('a')).not.toBeNull();
});

it('shows an unissued installment instead of a false settled status',async()=>{
 const expenses=[{id:'p',amount:16900,isInstallmentParent:true,installmentPlan:{installments:[{id:'i1',bill_satang:845000},{id:'i2',bill_satang:845000}]}}];
 const collections=[{installmentId:'i1',receiver:'0',participants:['1'],paid:['1'],payments:{'1':{amount:8456,status:'paid',receivedAmount:8456}}}];
 await act(async()=>root.render(<HomeDashboard trip={{name:'QA',status:'completed'}} members={members} expenses={expenses} collections={collections}/>));
 expect(host.textContent).toContain('รอเรียกเก็บงวดถัดไป');expect(host.textContent).toContain('ยังไม่เรียกเก็บ ฿8,450.00');expect(host.textContent).not.toContain('ชำระครบแล้ว');
});
