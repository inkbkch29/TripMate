// The same geometry is used for the responsive page and the full-size export.
export function participantLayout(memberCount, containerWidth, {avatarSize=40, defaultOverlap=10, minAvatarSize=24}={}) {
 const count=Number.isFinite(Number(memberCount))?Math.max(0,Math.floor(Number(memberCount))):0;
 const available=Number.isFinite(Number(containerWidth))?Math.max(0,Number(containerWidth)):0;
 if(!count||!available)return {count,avatarSize:0,step:0,width:0};
 const preferred=Math.max(1,avatarSize),minimum=Math.min(preferred,Math.max(1,minAvatarSize));
 let size=Math.min(available,preferred);
 if(count>1){
  size=Math.min(size,Math.max(minimum,available/(1+(count-1)*.3)));
  // Even a tiny container must leave room for a visible edge of every avatar.
  if(available<=size)size=available*.75;
 }
 const overlap=Math.max(0,Math.min(defaultOverlap/preferred,1))*size;
 const step=count>1?Math.min(size-overlap,Math.max(0,available-size)/(count-1)):0;
 return {count,avatarSize:size,step,width:Math.min(available,size+step*(count-1))};
}
export function participantInitial(name){return [...String(name||'').trim()][0]?.toLocaleUpperCase()||'?';}
