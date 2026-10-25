import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import FinanceDeleteDialog from './FinanceDeleteDialog';
it('requires a deliberate confirmation and blocks repeat actions while deleting',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const onClose=vi.fn(),onConfirm=vi.fn();
 const render=busy=>root.render(<FinanceDeleteDialog request={{item:{title:'บิลทดสอบ',expenseId:'receipt'}}} recoverable busy={busy} onClose={onClose} onConfirm={onConfirm}/>);
 try{
 await act(async()=>render(false));let buttons=[...document.querySelectorAll('[role="dialog"] button')];
 expect(document.querySelector('[role="dialog"]').textContent).toContain('7 วัน');expect(onConfirm).not.toHaveBeenCalled();
 await act(async()=>buttons.find(b=>b.textContent==='ยกเลิก').click());expect(onClose).toHaveBeenCalledOnce();expect(onConfirm).not.toHaveBeenCalled();
 await act(async()=>render(true));buttons=[...document.querySelectorAll('[role="dialog"] button')];expect(buttons.every(b=>b.disabled)).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();}
});
