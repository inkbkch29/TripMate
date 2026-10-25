import React,{useEffect,useState} from 'react';
import {Alert,Box,Button,CircularProgress,Stack,Typography} from '@mui/material';
import {createRecapMap} from './recap-map-image';
import {supabase} from './supabase';
import {markerLabel,routeKey,stopCoordinate} from './recap-route';
const resolvedLinks=new Map();
async function resolveStops(stops,tripId){
 const missing=stops.filter(stop=>!stopCoordinate(stop)&&stop.googleMapsUrl);
 if(!missing.length||!tripId||!supabase)return stops;
 const key=JSON.stringify([tripId,missing.map(stop=>[stop.id,stop.googleMapsUrl])]);
 if(!resolvedLinks.has(key)){
  const pending=(async()=>{const results=[];for(let index=0;index<missing.length;index+=25){const {data,error}=await supabase.functions.invoke('resolve-recap-places',{body:{tripId,stopIds:missing.slice(index,index+25).map(stop=>stop.id)}});if(error)throw new Error('อ่านลิงก์ Google Maps ไม่ได้ กรุณาลองใหม่');results.push(...(data?.places||[]));}return results;})().catch(error=>{resolvedLinks.delete(key);throw error;});
  resolvedLinks.set(key,pending);if(resolvedLinks.size>12)resolvedLinks.delete(resolvedLinks.keys().next().value);
 }
 const places=await resolvedLinks.get(key);
 return stops.map(stop=>{const found=places.find(place=>place.id===stop.id&&place.url===stop.googleMapsUrl);return !stopCoordinate(stop)&&found?.point?{...stop,longitude:found.point[0],latitude:found.point[1]}:stop;});
}
export function useRecapMap(stops,tripId){
 const [state,setState]=useState({status:'empty'}),[retry,setRetry]=useState(0),key=JSON.stringify([tripId,routeKey(stops),stops.map(stop=>[stop.id,stop.googleMapsUrl])]);
 useEffect(()=>{let active=true;
  if(!stops.length){setState({status:'empty',key});return;}
  setState({status:'loading',key});const timer=setTimeout(async()=>{try{
   const resolved=await resolveStops(stops,tripId),missing=resolved.filter(stop=>!stopCoordinate(stop));
   if(missing.length){if(active)setState({status:'missing',key,missingIds:missing.map(stop=>stop.id)});return;}
   const image=await createRecapMap(resolved);if(active)setState({status:'ready',key,...image});
  }catch(error){if(active)setState({status:'error',key,message:error.message});}},450);
  return()=>{active=false;clearTimeout(timer);};
 },[key,retry]);
 return {...(state.key===key?state:{status:'loading',key}),retry:()=>{resolvedLinks.clear();setRetry(value=>value+1);}};
}
export default function RecapRouteMap({stops,state}){
 const missing=stops.filter(stop=>state.missingIds?.includes(stop.id)??!stopCoordinate(stop));
 return <Stack spacing={1.3} sx={{p:{xs:2,sm:2.5},borderRadius:5,bgcolor:'#F8F5EE',minWidth:0}}>
  <Box><Typography variant="overline" sx={{color:'#6387A7'}}>OUR LITTLE JOURNEY</Typography><Typography variant="h6">เส้นทางความทรงจำ</Typography></Box>
  {state.status==='ready'?<><Box component="img" src={state.src} alt={`แผนที่เส้นทางตามถนน ${stops.length} สถานที่`} sx={{width:'100%',display:'block',borderRadius:3}}/><Typography variant="caption" color="text.secondary">{stops.length} สถานที่{state.distance>0?` · ${(state.distance/1000).toFixed(1)} กม. ตามถนน`:''} · สีเขียวเริ่มต้น / สีพีชจุดสุดท้าย</Typography></>:state.status==='loading'?<Stack direction="row" gap={1.5} alignItems="center" role="status" py={4}><CircularProgress size={22}/><Typography>กำลังอ่านสถานที่และวาดเส้นทาง…</Typography></Stack>:state.status==='missing'?<Alert severity="info">ยังอ่านพิกัดหมุดไม่ได้: {missing.map(stop=>stop.title||stop.place||'สถานที่').join(' · ')} ลิงก์บางแบบมีเพียงชื่อหรือรหัสสถานที่ ให้เปิดหมุดใน Google Maps แล้วคัดลอกลิงก์แบบเต็มมาวางในหน้าแพลน หรือใส่พิกัดของหมุดนั้น<Stack spacing={.5} mt={1}>{missing.filter(stop=>stop.googleMapsUrl).map(stop=><Button key={stop.id} href={stop.googleMapsUrl} target="_blank" rel="noopener noreferrer" size="small" sx={{justifyContent:'flex-start'}}>เปิด Google Maps · {stop.title||stop.place}</Button>)}</Stack></Alert>:state.status==='error'?<Alert severity="warning" action={<Button onClick={state.retry}>ลองใหม่</Button>}>{state.message}</Alert>:<Typography color="text.secondary">เพิ่มสถานที่ในแพลน แล้วเก็บเส้นทางไว้ใน Recap ได้เลย</Typography>}
  {!!stops.length&&<Box component="ol" sx={{m:0,pl:0,listStyle:'none',display:'grid',gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr'},gap:1,maxHeight:200,overflowY:'auto'}}>{stops.map((stop,index)=><Typography component="li" key={stop.id||index} variant="body2" sx={{overflowWrap:'anywhere'}}><Box component="span" sx={{fontWeight:800,color:'#547FA8',mr:1}}>{markerLabel(index)}</Box>{stop.title||stop.place}{stop.day?` · วันที่ ${stop.day}`:''}</Typography>)}</Box>}
  <Typography variant="caption" color="text.secondary" sx={{fontSize:10}}>แผนที่ <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · ถนน <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">FOSSGIS / OSRM</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">แก้ไขข้อมูลแผนที่</a></Typography>
 </Stack>;
}
