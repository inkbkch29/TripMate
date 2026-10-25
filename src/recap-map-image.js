import {getRoadRoute,markerLabel,routeBounds,routeKey} from './recap-route';
const images=new Map();
export const MAP_CREDIT='OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors · Routing: FOSSGIS / OSRM';
export function pastelStyle(route){
 const layer=(id,type,sourceLayer,paint,extra={})=>({id,type,source:'basemap','source-layer':sourceLayer,paint,...extra});
 return {version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources:{basemap:{type:'vector',url:'https://tiles.openfreemap.org/planet'},journey:{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route.coordinates.length>1?route.coordinates:[]}}}},layers:[
  {id:'background',type:'background',paint:{'background-color':'#DCE8D5'}},
  layer('landuse','fill','landuse',{'fill-color':'#F8F5EE','fill-opacity':.65}),
  layer('forest','fill','landcover',{'fill-color':'#BBD6B2','fill-opacity':.7},{filter:['in',['get','class'],['literal',['wood','grass']]]}),
  layer('parks','fill','park',{'fill-color':'#BBD6B2','fill-opacity':.7}),
  layer('water','fill','water',{'fill-color':'#B9DCEB'}),
  layer('waterways','line','waterway',{'line-color':'#B9DCEB','line-width':1.5}),
  layer('roads','line','transportation',{'line-color':'#E4E4DE','line-width':['interpolate',['linear'],['zoom'],5,.6,10,1.6,15,5]}),
  layer('boundaries','line','boundary',{'line-color':'#AEBCAA','line-width':.6,'line-dasharray':[3,3]}),
  {id:'route-halo',type:'line',source:'journey',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fffdf8','line-width':7}},
  {id:'route',type:'line',source:'journey',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#547FA8','line-width':4}},
  layer('towns','symbol','place',{'text-color':'#667A72','text-halo-color':'#F8F5EE','text-halo-width':1.5},{filter:['in',['get','class'],['literal',['city','town','village']]],layout:{'text-field':['coalesce',['get','name:latin'],['get','name_en'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':12,'text-max-width':10}})
 ]};
}
export function createRecapMap(stops){
 const key=routeKey(stops);if(images.has(key))return images.get(key);
 const promise=render(stops).catch(error=>{images.delete(key);throw error;});images.set(key,promise);if(images.size>6)images.delete(images.keys().next().value);return promise;
}
async function render(stops){
 const route=await getRoadRoute(stops);if(!route.points.length)throw new Error('ยังไม่มีสถานที่ในแพลน');
 const [{Map:MapLibreMap,setWorkerUrl},{default:workerUrl}]=await Promise.all([import('maplibre-gl'),import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url')]);setWorkerUrl(workerUrl);
 const container=document.createElement('div');Object.assign(container.style,{position:'fixed',left:'-10000px',top:'0',width:'960px',height:'600px',pointerEvents:'none'});container.setAttribute('aria-hidden','true');document.body.appendChild(container);
 let map;
 try{
  map=new MapLibreMap({container,style:pastelStyle(route),interactive:false,attributionControl:false,canvasContextAttributes:{preserveDrawingBuffer:true},pixelRatio:1,fadeDuration:0});
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>done(new Error('แผนที่โหลดไม่ครบ กรุณาลองใหม่')),35000);
   let settled=false;
   function done(error){if(settled)return;settled=true;clearTimeout(timeout);map.off('error',fail);map.off('idle',ready);error?reject(error):resolve();}
   const fail=()=>done(new Error('เปิดแผนที่ไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่'));
   const ready=()=>{if(map.areTilesLoaded())done();};
   map.on('error',fail);map.on('idle',ready);
   map.fitBounds(routeBounds([...route.coordinates,...route.points]),{padding:{top:110,bottom:110,left:110,right:110},maxZoom:13,duration:0});
  });
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=600;const ctx=canvas.getContext('2d');ctx.drawImage(map.getCanvas(),0,0);
  // Offset co-located start/end markers so returning to the start remains visible.
  const groups=new Map();route.points.forEach((point,index)=>{const p=map.project(point),key=`${Math.round(p.x/28)},${Math.round(p.y/28)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({p,index});});
  groups.forEach(group=>group.forEach(({p,index},position)=>{const columns=Math.ceil(Math.sqrt(group.length)),rows=Math.ceil(group.length/columns),size=Math.min(30,160/columns,160/rows),x=p.x+(position%columns-(columns-1)/2)*size,y=p.y+(Math.floor(position/columns)-(rows-1)/2)*size;
   ctx.fillStyle=index===0?'#698B76':index===stops.length-1?'#B88078':'#6387A7';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font=`700 ${size*.43}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(markerLabel(index),x,y);
  }));
  ctx.fillStyle='rgba(248,245,238,.94)';ctx.fillRect(0,570,960,30);ctx.fillStyle='#526769';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(MAP_CREDIT,480,585);
  return {src:canvas.toDataURL('image/png'),distance:route.distance,count:stops.length};
 }catch(error){throw new Error(/^[ก-๙]/.test(error.message)?error.message:'อุปกรณ์นี้เปิดแผนที่ไม่ได้ กรุณาลองเบราว์เซอร์ที่รองรับ WebGL2');}
 finally{map?.remove();container.remove();}
}
