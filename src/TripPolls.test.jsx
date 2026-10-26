import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import TripPolls from './TripPolls';
import PollDetail from './PollDetail';
import PollFormDialog from './PollFormDialog';
let root,host;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
const click=async el=>{expect(el).toBeTruthy();await act(async()=>el.click());};
const button=(text)=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const input=async(el,value)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});
const base={id:'p',token:'token',trip_id:'trip',title:'กินอะไรดี',creator_name:'เพื่อน',status:'open',vote_mode:'multiple',result_visibility:'live',can_vote:true,can_manage:false,can_add_options:true,results_visible:true,round:1,current_round:1,my_votes:[],member_count:2,voter_count:2,total_ballots:2,leader_ids:['a','b'],options:[{id:'a',name:'ร้านริมน้ำ',price:100,votes:1,media:[{source:'a.jpg',url:'/a.jpg'},{source:'b.jpg',url:'/b.jpg'}],voters:[{id:'u',name:'เพื่อนหนึ่ง',avatar:'/u.jpg'}],links:['https://vt.tiktok.com/abc']},{id:'b',name:'ร้านในสวน',votes:1,media:[],voters:[]}]};
it('submits multiple choices then replaces the current ballot without adding a second member',async()=>{
 let snapshot={...base};const api={snapshot:vi.fn(async()=>snapshot),vote:vi.fn(async(t,ids)=>{snapshot={...snapshot,my_votes:ids};})};
 await act(async()=>root.render(<PollDetail token="token" api={api} userId="u" onClose={()=>{}}/>));
 await click(document.querySelector('[aria-label="เลือก ร้านริมน้ำ"]'));await click(document.querySelector('[aria-label="เลือก ร้านในสวน"]'));await click(button('ส่งคะแนน'));
 expect(api.vote).toHaveBeenLastCalledWith('token',['a','b']);
 await click(document.querySelector('[aria-label="เลือก ร้านริมน้ำ"]'));await click(button('อัปเดตคะแนน'));expect(api.vote).toHaveBeenLastCalledWith('token',['b']);
});
it('does not expose hidden result counts; closed ties show both leaders and disable all voting',async()=>{
 let snapshot={...base,results_visible:false,result_visibility:'closed',total_ballots:null,options:base.options.map(o=>({...o,votes:null,voters:[]}))};const api={snapshot:vi.fn(async()=>snapshot)};
 await act(async()=>root.render(<PollDetail token="token" api={api} onClose={()=>{}}/>));expect(document.body.textContent).toContain('ผลจะแสดงเมื่อปิดโหวต');expect(document.querySelector('[aria-label="ดูผู้โหวต ร้านริมน้ำ"]')).toBeNull();
 snapshot={...base,read_only:true,can_vote:false,status:'closed'};await click(button('ลองใหม่')||document.querySelector('[aria-label="ปิดหน้าต่างโหวต"]'));
 await act(async()=>root.render(<PollDetail key="closed" token="token" api={api} onClose={()=>{}}/>));expect(document.body.textContent.match(/เสมอกัน/g)).toHaveLength(2);expect([...document.querySelectorAll('input[type="checkbox"]')].every(i=>i.disabled)).toBe(true);expect(button('ส่งคะแนน')).toBeUndefined();
});
it('opens photos and named voters without navigating away',async()=>{
 const api={snapshot:vi.fn(async()=>base)};await act(async()=>root.render(<PollDetail token="token" api={api} onClose={()=>{}}/>));
 await click(document.querySelector('[aria-label="ดูรูป ร้านริมน้ำ"]'));expect(document.querySelector('img[alt="รูปตัวเลือก 1"]').getAttribute('src')).toBe('/a.jpg');await click(document.querySelector('[aria-label="รูปถัดไป"]'));expect(document.querySelector('img[alt="รูปตัวเลือก 2"]').getAttribute('src')).toBe('/b.jpg');await click(document.querySelector('[aria-label="ปิดรูปโหวต"]'));
 await click(document.querySelector('[aria-label="ดูผู้โหวต ร้านริมน้ำ"]'));expect(document.body.textContent).toContain('เพื่อนหนึ่ง');expect(document.querySelector('img[src="/u.jpg"]')).toBeTruthy();
});
it('lets an ordinary member create a draft with compact optional fields',async()=>{
 const api={save:vi.fn(async()=> 'token')},saved=vi.fn();await act(async()=>root.render(<PollFormDialog open tripId="trip" userId="member" api={api} onClose={()=>{}} onSaved={saved}/>));
 expect(document.querySelectorAll('details[open]')).toHaveLength(0);const inputs=document.querySelectorAll('input');await input(inputs[0],'ที่พัก');
 const names=[...document.querySelectorAll('label')].filter(l=>/^ตัวเลือก \d+$/.test(l.textContent)).map(l=>document.getElementById(l.htmlFor));await input(names[0],'บ้าน A');await input(names[1],'บ้าน B');await click(button('เก็บเป็นร่าง'));
 expect(api.save).toHaveBeenCalledWith('trip','member',expect.objectContaining({title:'ที่พัก',status:'draft',options:expect.arrayContaining([expect.objectContaining({name:'บ้าน A'})])}));expect(saved).toHaveBeenCalledWith('token');
});
it('restricts overflow actions, confirms reset and keeps completed trips read-only',async()=>{
 let polls=[{...base,can_manage:true}];const api={list:vi.fn(async()=>polls),action:vi.fn(async()=>{})},trip={id:'trip',start_date:'2099-01-01',end_date:'2099-01-03'};
 await act(async()=>root.render(<TripPolls trip={trip} currentUserId="u" api={api}/>));expect(button('สร้างโหวต')).toBeTruthy();await click(document.querySelector('[aria-label="จัดการโหวต กินอะไรดี"]'));await click([...document.querySelectorAll('[role="menuitem"]')].find(e=>e.textContent==='เริ่มโหวตรอบใหม่'));expect(api.action).not.toHaveBeenCalled();expect(document.body.textContent).toContain('คะแนนรอบเดิมยังดูย้อนหลังได้');await click(button('ยืนยัน'));expect(api.action).toHaveBeenCalledWith('token','reset');
 await act(async()=>root.render(<TripPolls key="completed" trip={{...trip,status:'completed'}} currentUserId="u" api={api}/>));expect(button('สร้างโหวต')).toBeUndefined();await click(document.querySelector('[aria-label="จัดการโหวต กินอะไรดี"]'));expect([...document.querySelectorAll('[role="menuitem"]')].map(e=>e.textContent)).toEqual(['คัดลอกลิงก์โหวต']);
});
