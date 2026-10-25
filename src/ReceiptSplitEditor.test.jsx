import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import ReceiptSplitEditor,{blankReceipt} from './ReceiptSplitEditor';
let host,root,current;
const members=Array.from({length:11},(_,i)=>({id:String(i),name:`เพื่อน ${i+1}`,avatar:i===0?'/photo.png':''}));
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
function Harness(){const [bill,setBill]=useState({...blankReceipt(),items:[{id:'a',name:'ข้าว',amount:100,participants:[]},{id:'b',name:'น้ำ',amount:50,participants:['0']}]});current=bill;return <ReceiptSplitEditor value={bill} onChange={setBill} members={members} onFile={()=>{}}/>;}
const click=async button=>act(async()=>button.click());
it('keeps each item selection independent, shows four avatars plus surplus, and preserves choices on reopening',async()=>{
 await act(async()=>root.render(<Harness/>));expect(host.textContent).not.toContain('น้ำหวาน / เครื่องดื่ม');expect(host.querySelectorAll('.split-item-row')).toHaveLength(2);
 await click(host.querySelector('[aria-label="เลือกคนที่หารรายการ 1 ข้าว"]'));
 let dialog=document.querySelector('[role="dialog"]');expect(dialog.querySelectorAll('[role="checkbox"]')).toHaveLength(11);
 await click([...dialog.querySelectorAll('button')].find(b=>b.textContent==='เลือกทั้งหมด'));
 expect(current.items[0].participants).toHaveLength(11);expect(current.items[1].participants).toEqual(['0']);
 await click([...dialog.querySelectorAll('button')].find(b=>b.textContent==='เสร็จสิ้น'));
 const group=host.querySelector('[aria-label="เลือกคนที่หารรายการ 1 ข้าว"]');expect(group.querySelectorAll('.MuiAvatar-root')).toHaveLength(5);expect(group.textContent).toContain('+7');expect(group.textContent).toContain('ทุกคน');
 await click(group);dialog=document.querySelector('[role="dialog"]');expect(dialog.querySelectorAll('[aria-checked="true"]')).toHaveLength(11);
 await click([...dialog.querySelectorAll('button')].find(b=>b.textContent==='ล้าง'));expect(current.items[0].participants).toEqual([]);expect(current.items[1].participants).toEqual(['0']);expect(host.querySelector('.split-summary').textContent).toContain('฿50.00');
});
it('focuses the appended item and deletes the requested row',async()=>{
 await act(async()=>root.render(<Harness/>));await click([...host.querySelectorAll('button')].find(b=>b.textContent==='เพิ่มรายการ'));
 expect(current.items).toHaveLength(3);expect(document.activeElement.getAttribute('aria-label')).toBe('ชื่ออาหาร 3');
 await click(host.querySelector('[aria-label="ลบรายการอาหารที่ 2"]'));expect(current.items.map(i=>i.name)).toEqual(['ข้าว','']);
});
it('attaches, replaces and removes a photo without changing manual items',async()=>{
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=>'/preview.png'),revokeObjectURL:vi.fn()}));
 const files=[];function Photos(){const [file,setFile]=useState(null);return <ReceiptSplitEditor value={{...blankReceipt(),items:[{id:'a',name:'ข้าว',amount:100,participants:['0']}]}} onChange={()=>{}} members={members} receiptFile={file} onFile={next=>{files.push(next);setFile(next);}}/>;}
 await act(async()=>root.render(<Photos/>));const input=host.querySelector('input[type="file"]');
 const first=new File(['first'],'bill.png',{type:'image/png'}),second=new File(['second'],'replacement.jpg',{type:'image/jpeg'});
 for(const file of [first,second]){Object.defineProperty(input,'files',{configurable:true,value:[file]});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));}
 expect(files).toEqual([first,second]);expect(host.querySelector('input[aria-label="ชื่ออาหาร 1"]').value).toBe('ข้าว');
 await click([...host.querySelectorAll('button')].find(b=>b.textContent==='ดูรูป'));expect(document.querySelector('img[alt="รูปบิลที่แนบ"]').getAttribute('src')).toBe('/preview.png');
 await click(document.querySelector('button[aria-label="ปิดรูปบิล"]'));await click(host.querySelector('button[aria-label="ลบรูปบิล"]'));expect(files.at(-1)).toBeNull();expect(host.textContent).not.toContain('ดูรูป');vi.unstubAllGlobals();
});
