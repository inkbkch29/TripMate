import React from 'react';
import {Avatar,Box,Button,Chip,Dialog,DialogActions,DialogContent,DialogTitle,IconButton,Stack,Typography} from '@mui/material';
import {CheckRounded,CloseRounded} from '@mui/icons-material';
export default function ReceiptMemberPicker({item,members,onChange,onClose,disabled=false}){
 const ids=members.map(member=>member.id),selected=(item?.participants||[]).filter(id=>ids.includes(id));
 return <Dialog open={Boolean(item)} onClose={onClose} fullWidth maxWidth="sm" className="split-member-sheet" aria-labelledby="split-member-heading">
  <DialogTitle id="split-member-heading"><Stack direction="row" alignItems="center" justifyContent="space-between"><Typography component="span" fontWeight={800}>เลือกคนที่หาร</Typography><IconButton aria-label="ปิดเลือกคนที่หาร" onClick={onClose}><CloseRounded/></IconButton></Stack><Typography variant="body2" color="text.secondary">{item?.name||'รายการอาหาร'} · เลือกแล้ว {selected.length}/{members.length} คน</Typography></DialogTitle>
  <DialogContent><Stack direction="row" spacing={1} mb={1}><Button disabled={disabled} onClick={()=>onChange(ids)}>เลือกทั้งหมด</Button><Button disabled={disabled||!selected.length} onClick={()=>onChange([])}>ล้าง</Button></Stack><Box className="split-member-grid">{members.map(member=>{const checked=selected.includes(member.id);return <Chip key={member.id} clickable disabled={disabled} role="checkbox" aria-checked={checked} avatar={<Avatar src={member.avatar}>{member.name?.trim()?.[0]||'?'}</Avatar>} label={<span>{member.name}{checked&&<CheckRounded sx={{fontSize:17,flexShrink:0}}/>}</span>} onClick={()=>onChange(checked?selected.filter(id=>id!==member.id):[...selected,member.id])} className={checked?'selected':''}/>;})}</Box></DialogContent>
  <DialogActions><Button fullWidth variant="contained" onClick={onClose}>เสร็จสิ้น</Button></DialogActions>
 </Dialog>;
}
