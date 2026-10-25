import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import CollectionPaymentSummary from './CollectionPaymentSummary';
it('updates the payment amount and recipient when paying for another diner',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const collection={perPerson:143,payments:{a:{amount:143},b:{amount:29}}};
 const render=userId=>root.render(<CollectionPaymentSummary collection={collection} userId={userId} currentUserId="a" members={[{id:'a',name:'เอ'},{id:'b',name:'บี'}]}/>);
 try{
 await act(async()=>render('a'));expect(host.textContent).toContain('฿143.00');expect(host.textContent).toContain('ตัวเอง');
 await act(async()=>render('b'));expect(host.textContent).toContain('฿29.00');expect(host.textContent).not.toContain('฿143.00');expect(host.textContent).toContain('บี');
 }finally{await act(async()=>root.unmount());host.remove();}
});
