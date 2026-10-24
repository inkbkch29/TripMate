import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import { CloseRounded, ReceiptLongRounded, ZoomInRounded, ZoomOutRounded } from '@mui/icons-material';
import { supabase } from './supabase';
const money=value=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(Number(value||0));

export default function PaymentSlipButton({payment,title,memberName,receiverName,submittedByName,amount}){
 const [open,setOpen]=useState(false),[url,setUrl]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(''),[zoom,setZoom]=useState(1),[attempt,setAttempt]=useState(0);
 const path=payment?.slipPath;
 const available=Boolean(path||payment?.slipUrl);
 useEffect(()=>{
  if(!open)return;
  let active=true;setLoading(true);setError('');setUrl('');setZoom(1);
  (async()=>{
   try{
    let next=payment.slipUrl||'';
    if(path&&supabase){const {data,error}=await supabase.storage.from('trip-files').createSignedUrl(path,3600);if(error)throw error;next=data?.signedUrl||'';}
    if(!next)throw new Error('missing');
    if(active)setUrl(next);
   }catch{if(active)setError('เปิดสลิปไม่ได้ ลองใหม่อีกครั้ง หากไฟล์ถูกลบแล้วจะไม่สามารถแสดงได้');}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[open,path,payment?.slipUrl,attempt]);
 if(!available)return null;
 const pdf=/\.pdf(?:\?|$)/i.test(path||payment.slipUrl||'');
 const confirmed=payment.status==='paid'||payment.status==='confirmed';
 return <><Button size="small" startIcon={<ReceiptLongRounded/>} onClick={()=>setOpen(true)} aria-label={`ดูสลิป ${title} ของ ${memberName}`}>ดูสลิป</Button>
  <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="payment-slip-title" className="payment-slip-dialog">
   <DialogTitle id="payment-slip-title"><Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}><Typography component="span" fontWeight={800}>สลิป · {title}</Typography><IconButton aria-label="ปิดสลิป" onClick={()=>setOpen(false)}><CloseRounded/></IconButton></Stack></DialogTitle>
   <DialogContent><Stack spacing={1.5}><Box><Typography fontWeight={800}>ยอดของ {memberName} · {money(amount)}</Typography>{payment.receivedAmount!=null&&<><Typography variant="body2">รับจริง {money(payment.receivedAmount)}</Typography>{Number(payment.receivedAmount)>Number(amount)&&<Typography variant="body2" color="success.main">ส่วนเกิน {money(Math.round((Number(payment.receivedAmount)-Number(amount))*100)/100)} เข้ากองกลาง</Typography>}</>}{receiverName&&<Typography variant="body2">ผู้รับ: {receiverName}</Typography>}{submittedByName&&submittedByName!==memberName&&<Typography variant="body2">ผู้โอนแทน: {submittedByName}</Typography>}<Typography variant="caption" color="text.secondary">{confirmed?'ยืนยันรับเงินแล้ว':'รอตรวจสลิป'}</Typography></Box>
    {loading?<Box textAlign="center" p={4} role="status"><CircularProgress size={28}/><Typography>กำลังเปิดสลิป…</Typography></Box>:error?<Alert severity="warning" action={<Button onClick={()=>setAttempt(value=>value+1)}>ลองใหม่</Button>}>{error}</Alert>:url&&<>{!pdf&&<Stack direction="row" justifyContent="flex-end" alignItems="center"><IconButton aria-label="ย่อสลิป" disabled={zoom<=1} onClick={()=>setZoom(value=>Math.max(1,value-.5))}><ZoomOutRounded/></IconButton><Typography variant="caption">{Math.round(zoom*100)}%</Typography><IconButton aria-label="ขยายสลิป" disabled={zoom>=3} onClick={()=>setZoom(value=>Math.min(3,value+.5))}><ZoomInRounded/></IconButton></Stack>}<Box className="payment-slip-media">{pdf?<iframe src={url} title={`ไฟล์สลิป ${title}`} onError={()=>setError('แสดง PDF ไม่สำเร็จ ลองเปิดไฟล์ในแท็บใหม่ได้')}/>:<img src={url} alt={`สลิป ${title} ของ ${memberName}`} style={{width:zoom>1?`${zoom*100}%`:'100%',maxHeight:zoom===1?'60vh':'none'}} onError={()=>setError('โหลดรูปไม่สำเร็จ กรุณาลองใหม่')}/>}</Box></>}
   </Stack></DialogContent><DialogActions>{url&&!loading&&<Button href={url} target="_blank" rel="noopener noreferrer">เปิดไฟล์ต้นฉบับ</Button>}<Button onClick={()=>setOpen(false)}>ปิด</Button></DialogActions>
  </Dialog>
 </>;
}
