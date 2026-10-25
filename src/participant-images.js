export function loadParticipantImage(src,{timeoutMs=8000}={}){
 if(!src)return Promise.resolve(null);
 return new Promise(resolve=>{
  const image=new Image();let settled=false;
  const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;resolve(value);};
  const timer=setTimeout(()=>{finish(null);image.src='';},timeoutMs);
  image.crossOrigin='anonymous';
  image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0?image:null);
  image.onerror=()=>finish(null);
  image.src=src;
 });
}
export function loadParticipantImages(members,load=loadParticipantImage){
 const images=new Map();
 return Promise.all(members.map(member=>{
  const src=typeof member.avatar==='string'?member.avatar:'';
  if(!src)return null;
  if(!images.has(src))images.set(src,Promise.resolve().then(()=>load(src)).catch(()=>null));
  return images.get(src);
 }));
}
