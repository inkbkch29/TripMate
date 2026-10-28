import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert,Box,Button,Drawer,IconButton,Stack,Typography} from '@mui/material';
import {AddToHomeScreenOutlined,CheckRounded,CloseRounded,MoreVertRounded,ShareOutlined} from '@mui/icons-material';
import FeatureIcon from './FeatureIcon';
import {pwaInstall} from './pwa-install';
export default function InstallAppAction({controller=pwaInstall,onInstalled}){
 const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
 const [help,setHelp]=useState(false),[failed,setFailed]=useState(false),previous=useRef(state.installEvent);
 useEffect(()=>{if(state.installed)setHelp(false);if(state.installEvent&&!previous.current)onInstalled?.();previous.current=state.installEvent;},[state.installed,state.installEvent,onInstalled]);
 const install=async()=>{const result=await controller.install();if(result.kind==='manual'){setFailed(Boolean(result.failed));setHelp(true);}};
 if(state.installed||state.checking)return null;
 return <>
  <Button fullWidth variant="outlined" startIcon={<AddToHomeScreenOutlined/>} disabled={state.busy} onClick={install} sx={{minHeight:48,borderRadius:2}}>{state.busy?'กำลังเปิดหน้าติดตั้ง…':'เพิ่มลงหน้าจอหลัก'}</Button>
  <Drawer anchor="bottom" open={help} onClose={()=>setHelp(false)} PaperProps={{sx:{maxHeight:'90dvh',maxWidth:560,mx:'auto',borderRadius:'20px 20px 0 0',pb:'env(safe-area-inset-bottom)'}}}>
   <Stack direction="row" alignItems="center" gap={1} sx={{px:2,py:1,borderBottom:1,borderColor:'divider'}}><Typography fontWeight={700} flex={1}>เพิ่ม TripMate ลงหน้าจอหลัก</Typography><IconButton aria-label="ปิดวิธีเพิ่มลงหน้าจอหลัก" onClick={()=>setHelp(false)}><CloseRounded/></IconButton></Stack>
   <Stack spacing={1.5} sx={{p:2,overflowY:'auto'}}>{failed&&<Alert severity="info">เปิดหน้าติดตั้งไม่ได้ เพิ่มผ่านเมนูของเบราว์เซอร์ได้</Alert>}
    <Typography variant="body2" color="text.secondary">เบราว์เซอร์นี้ต้องเพิ่มผ่านเมนู</Typography>
    <Stack direction="row" gap={1.25} alignItems="center"><FeatureIcon tone="plan"><ShareOutlined/></FeatureIcon><Typography variant="body2" flex={1}>1. เปิดเมนูแชร์ หรือเมนู <MoreVertRounded sx={{fontSize:18,verticalAlign:'middle'}}/> ของเบราว์เซอร์</Typography></Stack>
    <Stack direction="row" gap={1.25} alignItems="center"><FeatureIcon tone="travel"><AddToHomeScreenOutlined/></FeatureIcon><Typography variant="body2" flex={1}>2. เลือก “เพิ่มลงในหน้าจอหลัก” หรือ “ติดตั้งแอป”</Typography></Stack>
    <Stack direction="row" gap={1.25} alignItems="center"><FeatureIcon tone="members"><CheckRounded/></FeatureIcon><Typography variant="body2" flex={1}>3. กด “เพิ่ม” หรือ “ติดตั้ง” เพื่อยืนยัน</Typography></Stack>
    <Typography variant="caption" color="text.secondary">หากไม่พบเมนูนี้ ให้เปิดลิงก์ผ่านเบราว์เซอร์ก่อน</Typography>
   </Stack>
   <Box sx={{px:2,pb:2}}><Button fullWidth variant={state.prompt?'contained':'text'} disabled={state.busy} onClick={state.prompt?install:()=>setHelp(false)}>{state.prompt?'เพิ่มลงหน้าจอหลัก':'เข้าใจแล้ว'}</Button></Box>
  </Drawer>
 </>;
}
