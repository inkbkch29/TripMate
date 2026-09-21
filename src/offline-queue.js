const DB_NAME="tripmate-offline";
const DB_VERSION=1;
const STORE="mutations";

const openDatabase=()=>new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB)return reject(new Error("อุปกรณ์นี้ไม่รองรับการเก็บงานออฟไลน์"));
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains(STORE)){
      const store=db.createObjectStore(STORE,{keyPath:"id"});
      store.createIndex("dedupeKey","dedupeKey",{unique:true});
      store.createIndex("createdAt","createdAt");
    }
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});

const transaction=async(mode,operation)=>{
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);const store=tx.objectStore(STORE);let result;
    try{result=operation(store);}catch(error){db.close();reject(error);return;}
    tx.oncomplete=()=>{db.close();resolve(result?.result);};
    tx.onerror=()=>{db.close();reject(tx.error||result?.error);};
    tx.onabort=()=>{db.close();reject(tx.error||new Error("บันทึกงานออฟไลน์ไม่สำเร็จ"));};
  });
};

export const queueLabels={checkin:"เช็กอิน",stop:"บันทึกแพลน",expense:"บันทึกรายจ่าย",collectionSlip:"ส่งสลิปชำระเงิน",settlementSlip:"ส่งสลิปปิดยอด"};

export async function listQueuedMutations(){
  const rows=await transaction("readonly",store=>store.getAll());
  return (rows||[]).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}

export async function enqueueMutation({type,payload,dedupeKey,label}){
  const now=new Date().toISOString();
  const item={id:crypto.randomUUID(),type,payload,dedupeKey:dedupeKey||`${type}:${crypto.randomUUID()}`,label:label||queueLabels[type]||"รายการ",status:"pending",attempts:0,lastError:"",createdAt:now,updatedAt:now};
  try{await transaction("readwrite",store=>store.add(item));return item;}
  catch(error){
    if(error?.name!=="ConstraintError")throw error;
    const existing=(await listQueuedMutations()).find(row=>row.dedupeKey===item.dedupeKey);
    if(!existing)return item;
    const merged={...existing,payload:item.payload,label:item.label,status:"pending",lastError:"",updatedAt:now};
    await transaction("readwrite",store=>store.put(merged));return merged;
  }
}

export const updateQueuedMutation=item=>transaction("readwrite",store=>store.put({...item,updatedAt:new Date().toISOString()}));
export const removeQueuedMutation=id=>transaction("readwrite",store=>store.delete(id));

let processing=false;
export async function flushMutationQueue(handlers,onChange=()=>{}){
  if(processing||!navigator.onLine)return listQueuedMutations();
  processing=true;
  try{
    const items=await listQueuedMutations();
    for(const item of items){
      const handler=handlers[item.type];
      if(!handler)continue;
      const syncing={...item,status:"syncing",attempts:item.attempts+1,lastError:""};
      await updateQueuedMutation(syncing);onChange(await listQueuedMutations());
      try{await handler(syncing.payload,syncing);await removeQueuedMutation(item.id);}
      catch(error){await updateQueuedMutation({...syncing,status:error?.code==="TRIPMATE_CONFLICT"?"conflict":"failed",lastError:error?.message||"ส่งข้อมูลไม่สำเร็จ"});}
      onChange(await listQueuedMutations());
    }
    return listQueuedMutations();
  }finally{processing=false;}
}

export function isConnectionError(error){
  if(!navigator.onLine)return true;
  const message=String(error?.message||"").toLowerCase();
  return error instanceof TypeError||/failed to fetch|network|load failed|timeout|connection/.test(message);
}
