import React,{useEffect,useState} from 'react';
import {Alert,Button,Stack,Typography} from '@mui/material';
import {DownloadRounded,ShareRounded} from '@mui/icons-material';
import {loadPaymentQrFile,downloadPaymentQr} from './payment-qr';
export default function PaymentQrSaveButton({member,label='บันทึก QR เพื่อไปจ่าย',fullWidth=false}){
 const [file,setFile]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setFile(null);setError('');loadPaymentQrFile(member).then(f=>{if(active)setFile(f);}).catch(()=>{if(active)setError('เตรียมรูป QR ไม่สำเร็จ กรุณาลองใหม่');});return()=>{active=false;};},[member?.paymentQr,member?.paymentQrPath,attempt]);
 const canShare=!!file&&!!navigator.canShare?.({files:[file]});
 const share=async()=>{try{await navigator.share({files:[file],title:'QR รับเงิน'});}catch(e){if(e.name!=='AbortError')setError('เปิดเมนูแชร์ไม่ได้ ลองดาวน์โหลด PNG');}};
 return <Stack spacing={1} sx={fullWidth?{width:'100%'}:undefined}>
  <Button fullWidth={fullWidth} variant={fullWidth?'contained':'outlined'} startIcon={<DownloadRounded/>} disabled={!file} onClick={()=>{try{downloadPaymentQr(file);}catch{setError('บันทึกรูปไม่สำเร็จ ลองใหม่หรือใช้เมนูแชร์');}}}>{file?label:error?'โหลด QR ไม่สำเร็จ':'กำลังเตรียม QR…'}</Button>
  {canShare&&<Button fullWidth={fullWidth} startIcon={<ShareRounded/>} onClick={share}>บันทึกลงรูปภาพ / แชร์</Button>}
  {file&&<Typography variant="caption" color="text.secondary">{canShare?'ไฟล์ PNG · บนมือถือเลือก “บันทึกลงรูปภาพ / แชร์” แล้วเลือก “บันทึกรูปภาพ” เพื่อเปิดจากอัลบั้มในแอปธนาคาร':'ไฟล์ PNG · หากรูปอยู่ในแอปไฟล์ ให้บันทึกเข้ารูปภาพก่อนเลือกในแอปธนาคาร'}</Typography>}
  {error&&<Alert severity="error" action={<Button onClick={()=>setAttempt(v=>v+1)}>ลองใหม่</Button>}>{error}</Alert>}
 </Stack>;
}
