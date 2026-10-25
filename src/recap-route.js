export const ROUTE_PROVIDER='https://routing.openstreetmap.de/routed-car/route/v1/driving/';
export function stopCoordinate(stop){
 const valid=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value));
 if(!valid(stop.longitude)||!valid(stop.latitude))return null;
 const point=[Number(stop.longitude),Number(stop.latitude)];
 return Math.abs(point[0])<=180&&Math.abs(point[1])<=85.051128?point:null;
}
export function orderRecapStops(stops){return stops.map((stop,index)=>({stop,index})).sort((a,b)=>String(a.stop.day||'').localeCompare(String(b.stop.day||''),undefined,{numeric:true})||((Number.isFinite(a.stop.sortOrder)?a.stop.sortOrder:a.index)-(Number.isFinite(b.stop.sortOrder)?b.stop.sortOrder:b.index))||String(a.stop.time||'').localeCompare(String(b.stop.time||''))||a.index-b.index).map(({stop})=>stop);}
export function markerLabel(index){let label='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;return label;}
export function routeKey(stops){return JSON.stringify(stops.map(stopCoordinate));}
export function routeChunks(points,size=25){if(size<2)throw new Error('Chunk size must be at least 2');const chunks=[];for(let i=0;i<points.length-1;i+=size-1)chunks.push(points.slice(i,i+size));return chunks;}
export function routeBounds(points){return points.reduce((bounds,[x,y])=>[[Math.min(bounds[0][0],x),Math.min(bounds[0][1],y)],[Math.max(bounds[1][0],x),Math.max(bounds[1][1],y)]],[[Infinity,Infinity],[-Infinity,-Infinity]]);}
const cache=new Map();let queue=Promise.resolve(),lastRequest=0;
function enqueue(task){const pending=queue.catch(()=>{}).then(async()=>{await new Promise(resolve=>setTimeout(resolve,Math.max(0,1050-(Date.now()-lastRequest))));lastRequest=Date.now();return task();});queue=pending;return pending;}
export function getRoadRoute(stops){
 const points=stops.map(stopCoordinate);if(points.some(point=>!point))return Promise.reject(new Error('กรุณาเพิ่มพิกัดให้ครบทุกสถานที่ในหน้าแพลน'));
 const key=routeKey(stops);if(cache.has(key))return cache.get(key);
 const promise=(async()=>{
  if(points.length<2)return {coordinates:points,distance:0,points};
  const coordinates=[];let distance=0;
  for(const chunk of routeChunks(points)){
   const data=await enqueue(async()=>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);try{const response=await fetch(`${ROUTE_PROVIDER}${chunk.map(point=>point.join(',')).join(';')}?overview=full&geometries=geojson&steps=false&alternatives=false&radiuses=${chunk.map(()=>1000).join(';')}`,{signal:controller.signal});if(!response.ok)throw new Error();return await response.json();}finally{clearTimeout(timeout);}});
   const route=data.routes?.[0],geometry=route?.geometry?.coordinates;
   if(data.code!=='Ok'||route?.geometry?.type!=='LineString'||!Array.isArray(geometry)||geometry.length<2||geometry.some(p=>!Array.isArray(p)||p.length<2||!p.every(Number.isFinite)))throw new Error('ไม่พบเส้นทางรถยนต์ตามถนนระหว่างสถานที่เหล่านี้');
   // OSRM chunks share a waypoint. Keep all real geometry; never create a straight connector.
   if(coordinates.length){const previous=coordinates.at(-1),next=geometry[0];if(Math.abs(previous[0]-next[0])>0.00001||Math.abs(previous[1]-next[1])>0.00001)throw new Error('เส้นทางแต่ละช่วงไม่ต่อกัน กรุณาลองใหม่');coordinates.push(...geometry.slice(1));}else coordinates.push(...geometry);
   distance+=Number(route.distance)||0;
  }
  return {coordinates,distance,points};
 })().catch(error=>{cache.delete(key);throw new Error(error.message?.startsWith('ไม่พบ')||error.message?.startsWith('เส้นทาง')?error.message:'คำนวณถนนไม่ได้ในขณะนี้ กรุณาลองใหม่');});
 cache.set(key,promise);if(cache.size>12)cache.delete(cache.keys().next().value);return promise;
}
