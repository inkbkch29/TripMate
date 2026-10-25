import React,{useState} from 'react';
import {Alert,Box,Button,Dialog,DialogTitle,DialogContent,DialogActions,Stack,Typography} from '@mui/material';
import {PollLink} from './PollOptionEditor';
import {pollApi} from './poll-api';
import PollDetail from './PollDetail';
export default function StopExtraDetails({stop,userId,onPlanAdded,onViewPlan}){
 const [open,setOpen]=useState(false),[media,setMedia]=useState([]),[source,setSource]=useState(false),[error,setError]=useState('');
 const details=async()=>{setOpen(true);setError('');try{setMedia(await pollApi.stopMedia(stop));}catch{setError('โหลดรูปไม่ได้ ลองเปิดรายละเอียดอีกครั้ง');}};
 const showSource=async()=>{try{await pollApi.snapshot(stop.sourcePollToken);setSource(true);setError('');}catch{setError('โพลต้นทางไม่พร้อมใช้งาน แต่ข้อมูลในแพลนยังอยู่ครบ');}};
 if(!stop.sourcePollId&&!stop.links?.length&&!stop.images?.length&&stop.price==null)return null;
 return <Box className="travel-plan-metadata"><Stack direction="row" gap={1} flexWrap="wrap">{stop.sourcePollId&&<Button className="poll-source-link" size="small" disabled={!stop.sourcePollToken} onClick={showSource}>จากผลโหวต</Button>}<Button size="small" onClick={details}>ดูรายละเอียด</Button></Stack>{error&&<Alert severity="info" onClose={()=>setError('')}>{error}</Alert>}<Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="sm" className="travel-sheet"><DialogTitle>{stop.title}</DialogTitle><DialogContent><Stack spacing={1.25}>{stop.place&&<Typography>{stop.place}</Typography>}{stop.note&&<Typography variant="body2" whiteSpace="pre-wrap">{stop.note}</Typography>}{stop.price!=null&&<Typography fontWeight={700}>{new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(stop.price)}</Typography>}{stop.links?.map(v=><PollLink key={v} value={v}/>)}{media.map(m=><Box component="img" key={m.source} src={m.url} alt={`รูป ${stop.place||stop.title}`} loading="lazy" sx={{width:'100%',borderRadius:2}}/>)}</Stack></DialogContent><DialogActions><Button onClick={()=>setOpen(false)}>ปิด</Button></DialogActions></Dialog>{source&&<PollDetail token={stop.sourcePollToken} userId={userId} api={pollApi} onClose={()=>setSource(false)} onPlanAdded={onPlanAdded} onViewPlan={s=>{setSource(false);onViewPlan?.(s);}}/>}</Box>;
}
