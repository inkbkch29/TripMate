import { useCallback, useEffect, useRef, useState } from "react";
import { enqueueMutation, flushMutationQueue, listQueuedMutations, removeQueuedMutation, updateQueuedMutation } from "./offline-queue";

export function useOfflineQueue(handlers){
  const handlersRef=useRef(handlers);handlersRef.current=handlers;
  const [items,setItems]=useState([]);
  const refresh=useCallback(()=>listQueuedMutations().then(setItems).catch(()=>{}),[]);
  const flush=useCallback(()=>flushMutationQueue(handlersRef.current,setItems).then(setItems).catch(()=>{}),[]);
  useEffect(()=>{refresh().then(()=>{if(navigator.onLine)flush();});const online=()=>flush();window.addEventListener("online",online);const timer=window.setInterval(()=>{if(navigator.onLine)flush();},30000);return()=>{window.removeEventListener("online",online);window.clearInterval(timer);};},[flush,refresh]);
  const enqueue=useCallback(async(item)=>{await enqueueMutation(item);await refresh();if(navigator.onLine)flush();},[flush,refresh]);
  const retry=useCallback(async(id)=>{const item=(await listQueuedMutations()).find(row=>row.id===id);if(item){await updateQueuedMutation({...item,status:"pending",lastError:""});await refresh();await flush();}},[flush,refresh]);
  const discard=useCallback(async(id)=>{await removeQueuedMutation(id);await refresh();},[refresh]);
  return {items,enqueue,flush,retry,discard,refresh};
}
