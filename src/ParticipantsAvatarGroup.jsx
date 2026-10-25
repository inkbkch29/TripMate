import React,{useId,useLayoutEffect,useRef,useState} from 'react';
import {Avatar,Box,Button,ButtonBase,Dialog,DialogActions,DialogContent,DialogTitle,IconButton,List,ListItem,ListItemText,Typography} from '@mui/material';
import {CloseRounded} from '@mui/icons-material';
import {participantInitial,participantLayout} from './participant-layout';

export default function ParticipantsAvatarGroup({members=[]}){
 const container=useRef(null),titleId=useId();
 const [width,setWidth]=useState(0),[open,setOpen]=useState(false);
 useLayoutEffect(()=>{
  const element=container.current;if(!element)return;
  const measure=()=>setWidth(element.getBoundingClientRect().width);
  measure();
  if(typeof ResizeObserver!=='undefined'){
   const observer=new ResizeObserver(entries=>{const entry=entries.find(row=>row.target===element);if(entry)setWidth(entry.contentRect.width);});
   observer.observe(element);return()=>observer.disconnect();
  }
  window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);
 },[]);
 const layout=participantLayout(members.length,width);
 return <Box ref={container} sx={{width:'100%',minWidth:0}}>
  <ButtonBase type="button" disabled={!members.length} aria-label={`ดูสมาชิกทั้งหมด ${members.length} คน`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)} sx={{width:'100%',display:'flex',alignItems:'flex-start',flexDirection:'column',gap:1,borderRadius:2,textAlign:'left','&.Mui-focusVisible':{outline:'2px solid',outlineColor:'primary.main',outlineOffset:4}}}>
   <Box className="recap-participant-row" sx={{position:'relative',isolation:'isolate',width:layout.width,maxWidth:'100%',height:40,flexShrink:0}}>
    {members.map((member,index)=><Avatar key={member.id??index} src={member.avatar||undefined} alt={member.name||'สมาชิก'} className="recap-participant-avatar" sx={{position:'absolute',left:index*layout.step,top:(40-layout.avatarSize)/2,width:layout.avatarSize,height:layout.avatarSize,boxSizing:'border-box',border:'2px solid #fff',zIndex:index+1,bgcolor:'primary.light',color:'primary.dark',fontSize:layout.avatarSize*.4,fontWeight:800}}>{participantInitial(member.name)}</Avatar>)}
   </Box>
   <Typography component="span" variant="caption" color="text.secondary">เพื่อนร่วมทริป · {members.length} คน</Typography>
  </ButtonBase>
  <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="xs" aria-labelledby={titleId}>
   <DialogTitle id={titleId} sx={{display:'flex',alignItems:'center',gap:1}}>เพื่อนร่วมทริป · {members.length} คน<IconButton aria-label="ปิดรายชื่อสมาชิก" sx={{ml:'auto'}} onClick={()=>setOpen(false)}><CloseRounded/></IconButton></DialogTitle>
   <DialogContent dividers><List disablePadding>{members.map((member,index)=><ListItem key={member.id??index} disableGutters sx={{gap:1.5}}><Avatar src={member.avatar||undefined} alt="" sx={{width:40,height:40,border:'2px solid #fff',bgcolor:'primary.light',color:'primary.dark'}}>{participantInitial(member.name)}</Avatar><ListItemText primary={member.name||'สมาชิก'} primaryTypographyProps={{fontWeight:700,sx:{overflowWrap:'anywhere'}}}/></ListItem>)}</List></DialogContent>
   <DialogActions><Button onClick={()=>setOpen(false)}>ปิด</Button></DialogActions>
  </Dialog>
 </Box>;
}
