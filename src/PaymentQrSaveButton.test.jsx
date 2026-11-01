import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({load:vi.fn(),download:vi.fn()}));vi.mock('./payment-qr',()=>({loadPaymentQrFile:mock.load,downloadPaymentQr:mock.download}));
import PaymentQrSaveButton from './PaymentQrSaveButton';import {PaymentQrDialog} from './main';
async function mounted(el,run){globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);try{await act(async()=>root.render(el));await run(host,root);}finally{await act(async()=>root.unmount());host.remove();}}
const btn=t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t);
it('the actual payment dialog downloads a prepared PNG and shares it from a direct user gesture',async()=>{
 const file=new File(['png'],'TripMate-payment-QR.png',{type:'image/png'}),share=vi.fn(async()=>{});mock.load.mockResolvedValue(file);Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:share});
 await mounted(<PaymentQrDialog member={{id:'a',name:'เอ',paymentQr:'qr',paymentQrPath:'trip/a/qr.webp'}} onClose={()=>{}}/>,async()=>{await act(async()=>btn('บันทึก QR เพื่อไปจ่าย').click());expect(mock.download).toHaveBeenCalledWith(file);await act(async()=>btn('บันทึกลงรูปภาพ / แชร์').click());expect(share).toHaveBeenCalledWith({files:[file],title:'QR รับเงิน'});});
});
it('shows fetch failure and allows retry; cancelling share is harmless',async()=>{
 const file=new File(['png'],'qr.png',{type:'image/png'});mock.load.mockRejectedValueOnce(new Error('expired')).mockResolvedValueOnce(file);Object.defineProperty(navigator,'share',{configurable:true,value:vi.fn().mockRejectedValue({name:'AbortError'})});
 await mounted(<PaymentQrSaveButton member={{paymentQr:'old'}}/>,async()=>{expect(document.body.textContent).toContain('เตรียมรูป QR ไม่สำเร็จ');await act(async()=>btn('ลองใหม่').click());await act(async()=>btn('บันทึกลงรูปภาพ / แชร์').click());expect(document.body.textContent).not.toContain('เปิดเมนูแชร์ไม่ได้');});
});
