import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('./MemberLocationMap',()=>({default:({rows})=><div data-testid="member-map">{rows.map(r=>r.user_id).join(',')}</div>}));
import TripModeDashboard from './TripModeDashboard';import PollToPlanSheet from './PollToPlanSheet';
let root,host;beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
const click=async e=>{expect(e).toBeTruthy();await act(async()=>e.click());};const btn=t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t);
const members=Array.from({length:20},(_,i)=>({id:'u'+i,name:'เพื่อน '+i,avatar:i===0?'/profile.jpg':''}));const trip={name:'ทริปจริง',start_date:'2026-10-25',end_date:'2026-10-27'};
const base={trip,members,now:'2026-10-24T10:00:00+07:00',onPlan:vi.fn(),account:{user:{id:'u0'}},checklist:Array.from({length:8},(_,i)=>({id:'p'+i,title:'ของ '+i,done:i<3,visibility:'shared',createdBy:'u0'})),onChecklistAdd:vi.fn(),onChecklistToggle:vi.fn(async()=>{}),onChecklistDelete:vi.fn()};
it('shows a compact upcoming header, four inline packing items, full members in a sheet and no empty map',async()=>{
 await act(async()=>root.render(<TripModeDashboard {...base}/>));expect(host.textContent).toContain('เตรียมตัวก่อนเดินทาง');expect(host.textContent).not.toMatch(/DAY|วันที่ 1/);expect(host.textContent).toContain('3/8');expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(4);expect(host.querySelector('[data-testid="member-map"]')).toBeNull();
 await click(host.querySelector('input[type="checkbox"]'));expect(base.onChecklistToggle).toHaveBeenCalledWith(expect.objectContaining({id:'p0'}),false);
 await click(host.querySelector('[aria-label="ดูสมาชิกทั้งหมด 20 คน"]'));expect(document.querySelectorAll('.home-member-option')).toHaveLength(20);expect(document.body.textContent).toContain('ไม่ได้แชร์ตำแหน่ง');
});
it('shows current activity, location freshness, check-in and a consented member map during the trip',async()=>{
 const check=vi.fn(async()=>{}),now='2026-10-25T10:00:00+07:00',locations=[{user_id:'u0',latitude:14,longitude:100,sharing_enabled:true,updated_at:'2026-10-25T09:59:00+07:00'},{user_id:'u1',latitude:14.1,longitude:100.1,sharing_enabled:true,updated_at:'2026-10-25T09:50:00+07:00'},{user_id:'u2',latitude:14,longitude:100,sharing_enabled:true,updated_at:'2026-10-24T09:59:00+07:00'}];
 await act(async()=>root.render(<TripModeDashboard {...base} now={now} onCheckin={check} locations={locations} stops={[{id:'s',day:1,time:'11:00',title:'กินข้าว',place:'ร้านจริง'}]}/>));expect(host.textContent).toContain('กำลังเดินทาง · วันที่ 1');expect(host.querySelector('[data-testid="member-map"]').textContent).toBe('u0,u1');await click(btn('เช็กอินว่าถึงแล้ว'));expect(check).toHaveBeenCalledWith(expect.objectContaining({id:'s'}),true);
 await click(btn('ดูแผนที่เพื่อน'));expect(document.body.textContent).toContain('ตำแหน่งเก่า');expect(document.body.textContent).toContain('ยังไม่มีตำแหน่งล่าสุด');
});
it('keeps packing/history accessible after the trip, removes live locations and opens the existing recap',async()=>{
 await act(async()=>root.render(<TripModeDashboard {...base} now="2026-10-28T10:00:00+07:00" recap={<div>Recap เดิม</div>}/>));expect(host.textContent).toContain('ทริปจบแล้ว');expect(host.textContent).toContain('ของที่ต้องเตรียม');expect(host.textContent).not.toContain('เริ่มแชร์ตำแหน่ง');expect(host.querySelector('[data-testid="member-map"]')).toBeNull();await click(btn('ดูความทรงจำ'));expect(document.body.textContent).toContain('Recap เดิม');
});
it('requires a different day and explicit confirmation when adding a poll option already in the plan',async()=>{
 const api={addToPlan:vi.fn()},option={id:'o',name:'ที่พัก',links:[],planned_stops:[{id:'s',day:1}]},onViewPlan=vi.fn();await act(async()=>root.render(<PollToPlanSheet option={option} poll={{id:'p',trip}} api={api} onClose={()=>{}} onViewPlan={onViewPlan}/>));expect(btn('เพิ่มในแพลน').disabled).toBe(true);expect(document.body.textContent).toContain('อยู่ในแพลนแล้ว');await click(btn('ดูแพลน'));expect(onViewPlan).toHaveBeenCalledWith({id:'s',day:1});expect(api.addToPlan).not.toHaveBeenCalled();
});
