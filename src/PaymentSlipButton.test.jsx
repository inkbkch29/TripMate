import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import PaymentSlipButton from './PaymentSlipButton';
const {sign}=vi.hoisted(()=>({sign:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{storage:{from:()=>({createSignedUrl:sign})}}}));
let host,root;
const click=async node=>{await act(async()=>{node.dispatchEvent(new MouseEvent('click',{bubbles:true}));});};
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;sign.mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const mount=async payment=>act(async()=>root.render(<PaymentSlipButton payment={payment} title="ค่ารถ" memberName="เพื่อน" receiverName="ผู้เก็บ" amount={100}/>));
describe('payment slip history',()=>{
 it('opens an approved payment in a popup and refreshes its signed link',async()=>{
 sign.mockResolvedValue({data:{signedUrl:'https://example.test/fresh.png'}});
 await mount({status:'paid',receivedAmount:100.43,slipPath:'trip/receipt.png',slipUrl:'https://example.test/expired.png'});
 await click(host.querySelector('button'));
 expect(sign).toHaveBeenCalledWith('trip/receipt.png',3600);
 expect(document.querySelector('[role="dialog"]').textContent).toContain('ยืนยันรับเงินแล้ว');
 expect(document.querySelector('img').src).toBe('https://example.test/fresh.png');
 const zoom=document.querySelector('button[aria-label="ขยายสลิป"]');await click(zoom);expect(document.querySelector('img').style.width).toBe('150%');
 await click(document.querySelector('button[aria-label="ปิดสลิป"]'));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,250));});
 expect(document.querySelector('[role="dialog"]')).toBeNull();
 });
 it('does not invent a receipt for a payment without an attachment',async()=>{await mount({status:'paid'});expect(host.querySelector('button')).toBeNull();});
 it('shows a recoverable error instead of a broken image when signing fails',async()=>{
 sign.mockResolvedValueOnce({error:new Error('denied')}).mockResolvedValueOnce({data:{signedUrl:'https://example.test/retry.png'}});
 await mount({status:'confirmed',slipPath:'trip/receipt.png'});await click(host.querySelector('button'));
 expect(document.querySelector('[role="alert"]')).not.toBeNull();
 await click([...document.querySelectorAll('button')].find(b=>b.textContent==='ลองใหม่'));
 expect(document.querySelector('img').src).toBe('https://example.test/retry.png');
 });
 it('supports existing PDF slip attachments',async()=>{
 sign.mockResolvedValue({data:{signedUrl:'https://example.test/slip.pdf'}});
 await mount({status:'paid',slipPath:'trip/slip.pdf'});await click(host.querySelector('button'));
 expect(document.querySelector('iframe').title).toContain('ค่ารถ');expect(document.querySelector('img')).toBeNull();
 });
});
