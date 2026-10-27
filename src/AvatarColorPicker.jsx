import React,{useEffect,useRef,useState} from 'react';
import {Box,Button,Dialog,DialogContent,DialogTitle,IconButton,Popover,Slider,Stack,TextField,Typography,useMediaQuery,useTheme} from '@mui/material';
import {CheckRounded,CloseRounded,PaletteOutlined} from '@mui/icons-material';
import {AVATAR_COLORS,hexToHsv,hsvToHex,normalizeHex} from './recap-color';
export default function AvatarColorPicker({value,onChange}){
 const theme=useTheme(),mobile=useMediaQuery(theme.breakpoints.down('sm')),[anchor,setAnchor]=useState(null),[draft,setDraft]=useState(value),dragging=useRef(false);
 const [hsv,setHsv]=useState(()=>hexToHsv(value)),open=Boolean(anchor);useEffect(()=>{setDraft(value);setHsv(old=>hsvToHex(old)===value?old:hexToHsv(value));},[value]);
 const chooseHsv=next=>{const valid={h:(next.h%360+360)%360,s:Math.max(0,Math.min(1,next.s)),v:Math.max(0,Math.min(1,next.v))};setHsv(valid);onChange(hsvToHex(valid));};
 const choose=color=>onChange(normalizeHex(color));
 const wheel=event=>{const rect=event.currentTarget.getBoundingClientRect(),dx=event.clientX-rect.left-rect.width/2,dy=event.clientY-rect.top-rect.height/2;chooseHsv({...hsv,h:(Math.atan2(dx,-dy)*180/Math.PI+360)%360,s:Math.min(1,Math.hypot(dx,dy)/(rect.width/2))});};
 const panel=<Stack spacing={2} sx={{p:{xs:2.5,sm:3},width:{xs:'100%',sm:320},boxSizing:'border-box'}}>
  <Box role="slider" aria-label="วงล้อเลือกสี" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(hsv.h)} aria-valuetext={value} tabIndex={0}
   onPointerDown={event=>{dragging.current=true;event.currentTarget.setPointerCapture(event.pointerId);wheel(event);}} onPointerMove={event=>{if(dragging.current)wheel(event);}} onPointerUp={()=>{dragging.current=false;}} onPointerCancel={()=>{dragging.current=false;}}
   onKeyDown={event=>{const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];if(!keys.includes(event.key))return;event.preventDefault();chooseHsv({...hsv,h:hsv.h+(event.key==='ArrowLeft'?-5:event.key==='ArrowRight'?5:0),s:hsv.s+(event.key==='ArrowUp'?.05:event.key==='ArrowDown'?-.05:0)});}}
   sx={{position:'relative',width:220,height:220,borderRadius:'50%',mx:'auto!important',touchAction:'none',cursor:'crosshair',background:'radial-gradient(circle closest-side, #fff, #ffffff00), conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',boxShadow:theme.shadows[1],'&:focus-visible':{outline:`3px solid ${theme.palette.primary.main}`,outlineOffset:4}}}>
   <Box sx={{position:'absolute',inset:0,borderRadius:'50%',bgcolor:'#000',opacity:1-hsv.v,pointerEvents:'none'}}/>
   <Box sx={{position:'absolute',left:`${50+Math.sin(hsv.h*Math.PI/180)*hsv.s*50}%`,top:`${50-Math.cos(hsv.h*Math.PI/180)*hsv.s*50}%`,width:18,height:18,border:'3px solid #fff',borderRadius:'50%',transform:'translate(-50%,-50%)',bgcolor:value,boxShadow:'0 0 0 1px #25435480',pointerEvents:'none'}}/>
  </Box>
  <Box><Typography variant="caption" color="text.secondary">ความสว่าง</Typography><Slider aria-label="ความสว่างของสี" min={0} max={100} value={Math.round(hsv.v*100)} onChange={(_,v)=>chooseHsv({...hsv,v:v/100})}/></Box>
  <Stack direction="row" gap={1.5} alignItems="center"><Box sx={{width:42,height:42,borderRadius:2,bgcolor:value,border:'1px solid',borderColor:'divider',flexShrink:0}}/><TextField fullWidth size="small" label="HEX Color" value={draft} inputProps={{maxLength:7,spellCheck:false,autoCapitalize:'characters'}} error={!normalizeHex(draft)} helperText={!normalizeHex(draft)?'ใช้รูปแบบ #AABBCC':undefined} onChange={event=>{setDraft(event.target.value);const color=normalizeHex(event.target.value);if(/^#?[\da-f]{6}$/i.test(event.target.value)&&color)onChange(color);}} onBlur={()=>{const color=normalizeHex(draft);if(color)onChange(color);}}/></Stack>
  <Button variant="contained" disabled={!normalizeHex(draft)} onClick={()=>setAnchor(null)}>ใช้สีนี้</Button>
 </Stack>;
 const selected=normalizeHex(value),customSelected=!AVATAR_COLORS.includes(selected);
 const optionStyle=active=>({width:44,height:44,p:0,flexShrink:0,border:'2px solid',borderColor:active?'primary.main':'transparent',transition:theme.transitions.create('border-color')});
 return <Box><Typography fontWeight={800} mb={.75}>สีสมาชิกและหมุด</Typography><Stack direction="row" gap={.75} flexWrap="nowrap" role="group" aria-label="สี Avatar และขอบหมุด">
  <IconButton aria-label="เลือกสีเอง" aria-pressed={customSelected} onClick={event=>setAnchor(event.currentTarget)} sx={optionStyle(customSelected)}><Box sx={{width:32,height:32,borderRadius:'50%',display:'grid',placeItems:'center',background:'conic-gradient(#f26872,#efbd61,#6abf9a,#59add1,#9d7ec2,#f26872)'}}><PaletteOutlined sx={{color:'#fff',fontSize:20,filter:'drop-shadow(0 1px 2px #33445588)'}}/></Box></IconButton>
  {AVATAR_COLORS.map(color=><IconButton key={color} aria-label={`เลือกสี ${color}`} aria-pressed={selected===color} onClick={()=>choose(color)} sx={optionStyle(selected===color)}><Box sx={{width:32,height:32,bgcolor:color,borderRadius:'50%',display:'grid',placeItems:'center'}}>{selected===color&&<CheckRounded sx={{color:'#fff',fontSize:20}}/>}</Box></IconButton>)}
 </Stack>
 {mobile?<Dialog open={open} onClose={()=>setAnchor(null)} fullWidth maxWidth="xs" aria-labelledby="avatar-color-title" sx={{'& .MuiDialog-container':{alignItems:'flex-end'},'& .MuiDialog-paper':{m:0,width:'100%',borderRadius:'24px 24px 0 0',maxHeight:'92dvh'}}}><DialogTitle id="avatar-color-title"><Stack direction="row" alignItems="center" justifyContent="space-between"><Typography component="span" fontWeight={800}>เลือกสี</Typography><IconButton aria-label="ปิดตัวเลือกสี" onClick={()=>setAnchor(null)}><CloseRounded/></IconButton></Stack></DialogTitle><DialogContent sx={{p:0,pb:'env(safe-area-inset-bottom)'}}>{panel}</DialogContent></Dialog>:<Popover open={open} anchorEl={anchor} onClose={()=>setAnchor(null)} anchorOrigin={{vertical:'bottom',horizontal:'left'}} transformOrigin={{vertical:'top',horizontal:'left'}} PaperProps={{sx:{borderRadius:4}}}><Box role="dialog" aria-label="เลือกสีของเรา">{panel}</Box></Popover>}
 </Box>;
}
