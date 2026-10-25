import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import ParticipantsAvatarGroup from './ParticipantsAvatarGroup';
let host,root,resize,disconnect;
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;disconnect=vi.fn();
 vi.stubGlobal('ResizeObserver',class{constructor(callback){resize=width=>callback([{target:host.firstElementChild,contentRect:{width}}]);}observe(){}disconnect(){disconnect();}});
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
it('renders everyone, responds to container changes, and opens the full member list',async()=>{
 const members=Array.from({length:30},(_,index)=>({id:String(index),name:`เพื่อน ${index+1}`,avatar:index===0?'https://example.test/profile.png':''}));
 await act(async()=>root.render(<ParticipantsAvatarGroup members={members}/>));await act(async()=>resize(342));
 const trigger=host.querySelector('button');let avatars=host.querySelectorAll('.recap-participant-avatar');
 expect(avatars).toHaveLength(30);expect(host.textContent).not.toMatch(/\+\d/);expect(host.textContent).not.toContain('เพื่อน 30');
 expect(avatars[0].querySelector('img').getAttribute('src')).toBe(members[0].avatar);
 const mobileSize=parseFloat(getComputedStyle(avatars[0]).width);await act(async()=>resize(720));avatars=host.querySelectorAll('.recap-participant-avatar');expect(parseFloat(getComputedStyle(avatars[0]).width)).toBeGreaterThan(mobileSize);
 expect(getComputedStyle(avatars[29]).zIndex).toBe('30');
 await act(async()=>trigger.click());const dialog=document.querySelector('[role="dialog"]');expect(dialog).not.toBeNull();expect(dialog.querySelectorAll('li')).toHaveLength(30);expect(dialog.textContent).toContain('เพื่อน 30');
 await act(async()=>document.querySelector('button[aria-label="ปิดรายชื่อสมาชิก"]').click());expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
it('shows an empty group without an unusable popup',async()=>{
 await act(async()=>root.render(<ParticipantsAvatarGroup members={[]}/>));expect(host.querySelector('button').disabled).toBe(true);expect(host.querySelectorAll('.recap-participant-avatar')).toHaveLength(0);expect(host.textContent).toContain('0 คน');
});
