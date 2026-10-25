import React,{useEffect,useState} from 'react';
import {Alert,Box,Button,CircularProgress,Stack,Typography} from '@mui/material';
import {createRecapMap} from './recap-map-image';
import {markerLabel,routeKey,stopCoordinate} from './recap-route';
export function useRecapMap(stops){
 const [state,setState]=useState({status:'empty'}),[retry,setRetry]=useState(0),key=routeKey(stops);
 useEffect(()=>{let active=true;const missing=stops.filter(stop=>!stopCoordinate(stop));
  if(!stops.length){setState({status:'empty',key});return;}
  if(missing.length){setState({status:'missing',key});return;}
  setState({status:'loading',key});const timer=setTimeout(()=>createRecapMap(stops).then(image=>{if(active)setState({status:'ready',key,...image});}).catch(error=>{if(active)setState({status:'error',key,message:error.message});}),450);return()=>{active=false;clearTimeout(timer);};
 },[key,retry]);
 return {...(state.key===key?state:{status:'loading',key}),retry:()=>setRetry(value=>value+1)};
}
export default function RecapRouteMap({stops,state}){
 const missing=stops.filter(stop=>!stopCoordinate(stop));
 return <Stack spacing={1.3} sx={{p:{xs:2,sm:2.5},borderRadius:5,bgcolor:'#F8F5EE',minWidth:0}}>
  <Box><Typography variant="overline" sx={{color:'#6387A7'}}>OUR LITTLE JOURNEY</Typography><Typography variant="h6">เส้นทางความทรงจำ</Typography></Box>
  {state.status==='ready'?<><Box component="img" src={state.src} alt={`แผนที่เส้นทางตามถนน ${stops.length} สถานที่`} sx={{width:'100%',display:'block',borderRadius:3}}/><Typography variant="caption" color="text.secondary">{stops.length} สถานที่{state.distance>0?` · ${(state.distance/1000).toFixed(1)} กม. ตามถนน`:''} · สีเขียวเริ่มต้น / สีพีชจุดสุดท้าย</Typography></>:state.status==='loading'?<Stack direction="row" gap={1.5} alignItems="center" role="status" py={4}><CircularProgress size={22}/><Typography>กำลังวาดเส้นทางตามถนน…</Typography></Stack>:state.status==='missing'?<Alert severity="info">ยังไม่มีพิกัด: {missing.map(stop=>stop.title||stop.place||'สถานที่').join(' · ')} กรุณาเพิ่มพิกัดในหน้าแพลนก่อนสร้างแผนที่</Alert>:state.status==='error'?<Alert severity="warning" action={<Button onClick={state.retry}>ลองใหม่</Button>}>{state.message}</Alert>:<Typography color="text.secondary">เพิ่มสถานที่ในแพลน แล้วเก็บเส้นทางไว้ใน Recap ได้เลย</Typography>}
  {!!stops.length&&<Box component="ol" sx={{m:0,pl:0,listStyle:'none',display:'grid',gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr'},gap:1,maxHeight:200,overflowY:'auto'}}>{stops.map((stop,index)=><Typography component="li" key={stop.id||index} variant="body2" sx={{overflowWrap:'anywhere'}}><Box component="span" sx={{fontWeight:800,color:'#547FA8',mr:1}}>{markerLabel(index)}</Box>{stop.title||stop.place}{stop.day?` · วันที่ ${stop.day}`:''}</Typography>)}</Box>}
  <Typography variant="caption" color="text.secondary" sx={{fontSize:10}}>แผนที่ <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · ถนน <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">FOSSGIS / OSRM</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">แก้ไขข้อมูลแผนที่</a></Typography>
 </Stack>;
}
