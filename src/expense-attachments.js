import {attachmentError} from './ui-workflows';
export const MAX_RECEIPTS=10;
export function expenseAttachments(expense={}){
 const rows=Array.isArray(expense.receiptAttachments)?expense.receiptAttachments:[];
 const all=[...rows];
 if(expense.receiptPath&&!all.some(row=>row.path===expense.receiptPath))all.unshift({path:expense.receiptPath,url:expense.receiptUrl||''});
 if(!all.length&&expense.receiptUrl)all.push({url:expense.receiptUrl});
 const seen=new Set();return all.filter(row=>{const key=row.path||row.url;if(!key||seen.has(key))return false;seen.add(key);return true;}).map(row=>({path:row.path||'',url:row.url||(row.path===expense.receiptPath?expense.receiptUrl:'')||'',name:row.name||row.path?.split('/').at(-1)||'บิล',type:row.type||(/\.pdf(?:\?|$)/i.test(row.path||row.url||'')?'application/pdf':'image/jpeg')}));
}
export const receiptMetadata=rows=>rows.filter(row=>row.path).map(row=>({path:row.path,name:(row.name||'บิล').slice(0,160),type:row.type||'image/jpeg'}));
export function validateReceipts(files,existingCount=0,{allowPdf=true}={}){
 if(existingCount+files.length>MAX_RECEIPTS)return `แนบได้สูงสุด ${MAX_RECEIPTS} ไฟล์ต่อรายจ่าย`;
 for(const file of files){const error=attachmentError(file);if(error)return `${file.name}: ${error}`;if(!allowPdf&&file.type==='application/pdf')return 'เลือกรูป JPG, PNG หรือ WebP';}
 return '';
}
// Persist one expense only. Partial upload/save failure cleans newly uploaded files;
// retained historical attachments are never deleted as a side effect of editing.
export async function saveExpenseAttachments({expense,files=[],upload,save,remove}){
 const error=validateReceipts(files,expenseAttachments(expense).length);if(error)throw new Error(error);
 const uploaded=[];
 try{
  for(const file of files){const result=await upload(file);uploaded.push({path:result.path,url:result.signedUrl||'',name:file.name,type:file.type});}
  const receiptAttachments=[...expenseAttachments(expense),...uploaded];
  const saved={...expense,receiptAttachments,receiptPath:receiptAttachments[0]?.path||'',receiptUrl:receiptAttachments[0]?.url||''};
  return await save(saved);
 }catch(error){await Promise.allSettled(uploaded.map(row=>remove(row.path)));throw error;}
}
