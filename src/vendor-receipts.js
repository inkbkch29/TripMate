import {validateReceipts} from './expense-attachments';
// Keep successfully uploaded files across RPC retries; never re-upload on double tap.
export function createVendorReceiptUpload(upload){
 const cache=new Map();
 return async(tripId,userId,files=[])=>{
  const issue=validateReceipts(files,0,{allowPdf:false});if(issue)throw new Error(issue);
  const rows=[];
  for(const file of files){let row=cache.get(file);if(!row){const value=await upload(tripId,userId,'vendor-slip',file);row={path:value.path,name:file.name,type:file.type};cache.set(file,row);}rows.push(row);}
  return rows;
 };
}
