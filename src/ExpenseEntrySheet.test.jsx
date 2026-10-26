import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import ExpenseEntrySheet from './ExpenseEntrySheet';
import CollectionDialog from './CollectionDialog';
import {tripLedger,collectionFundTotals} from './trip-ledger';
import {receiptQuantity,splitReceipt} from './receipt-split';
async function mount(node,run){globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);try{await act(async()=>root.render(node));await run();}finally{await act(async()=>root.unmount());host.remove();}}
const button=t=>[...document.querySelectorAll('button,[role="button"]')].find(b=>b.textContent.includes(t));
const click=async b=>act(async()=>b.click());
const fill=async(text,value)=>{const label=[...document.querySelectorAll('label')].find(l=>l.textContent.includes(text));const input=document.getElementById(label.htmlFor);await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});};
it('offers exactly three actions, closes before opening each existing form',async()=>{
 const events=[],close=()=>events.push('close'),general=()=>events.push('general'),food=()=>events.push('food'),collection=()=>events.push('collect');
 await mount(<ExpenseEntrySheet open onClose={close} onExpense={general} onFood={food} onCollection={collection}/>,async()=>{
 expect(document.querySelectorAll('.MuiListItemButton-root')).toHaveLength(3);expect(document.body.textContent).not.toContain('หลายงวด');expect(document.body.textContent).not.toContain('กองกลาง');
 await click(button('เพิ่มค่าใช้จ่ายทั่วไป'));await click(button('แยกบิลอาหาร'));await click(button('เก็บเงินจากสมาชิก'));expect(events).toEqual(['close','general','close','food','close','collect']);
 });
});
it('preserves collection permission without hiding the available workflow',async()=>{
 const save=vi.fn();await mount(<ExpenseEntrySheet open canCollect={false} onClose={()=>{}} onCollection={save}/>,async()=>{expect(button('เก็บเงินจากสมาชิก').getAttribute('aria-disabled')).toBe('true');await click(button('เก็บเงินจากสมาชิก'));expect(save).not.toHaveBeenCalled();});
});
it('new collection-only form keeps requested money out of cost and fund, and never auto-confirms receiver',async()=>{
 const save=vi.fn();await mount(<CollectionDialog defaultRequest open members={[{id:'a',name:'หนึ่ง'},{id:'b',name:'สอง'}]} currentUserId="a" onClose={()=>{}} onSave={save}/>,async()=>{
 await fill('ชื่อรายการ','เงินสำหรับรถ');await fill('จำนวนเงินต่อคน','100.25');await click(button('สร้างรายการ'));expect(save).toHaveBeenCalledOnce();const request=save.mock.calls[0][0];expect(request).toMatchObject({collectionOnly:true,isFund:false,amount:200.5,paid:[],requestAmounts:{a:100.25,b:100.25}});
 const ledger=tripLedger([],[request],[],['a','b']);expect(ledger.cost).toBe(0);expect(ledger.costEntryCount).toBe(0);expect(ledger.dues[0].amount).toBe(100.25);expect(collectionFundTotals({...request,paid:['a','b']})).toMatchObject({expected:0,received:0});
 });
});
it('quantity multiplies the unit price in satang and preserves old line totals',()=>{
 const old={id:'x',name:'ข้าว',amount:99.99,participants:['a','b']};expect(splitReceipt({items:[old]},['a','b']).total).toBe(99.99);
 const updated={...old,...receiptQuantity(old,{quantity:'3',unitAmount:'33.33'})};const result=splitReceipt({items:[updated]},['a','b']);expect(result.total).toBe(99.99);expect(result.shares).toEqual({a:50,b:49.99});expect(receiptQuantity(old,{quantity:'1.5'}).amount).toBe('');
});
