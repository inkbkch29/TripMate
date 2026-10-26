import React,{useEffect,useState} from 'react';
import {Alert,Button,Dialog,DialogTitle,DialogContent,DialogActions,Stack,TextField,Typography} from '@mui/material';
import {fundMoney,satang} from './trip-fund';
export default function CollectionReceiptConfirmation({request,onClose,onConfirm,busy=false}){
 const [value,setValue]=useState(''),[error,setError]=useState('');
 useEffect(()=>{setValue(request?(request.expectedSatang/100).toFixed(2):'');setError('');},[request]);
 const confirm=async()=>{try{const cash=satang(value);if(cash<(request?.expectedSatang||0))throw new Error('ยอดรับต้องไม่น้อยกว่ายอดเรียกเก็บ');if(await onConfirm(cash/100))onClose();}catch(e){setError(e.message);}};
 return <Dialog open={!!request} onClose={()=>!busy&&onClose()} fullWidth maxWidth="xs" sx={{'& .MuiDialog-container':{alignItems:'flex-end'},'& .MuiDialog-paper':{m:0,width:'100%',borderRadius:'18px 18px 0 0',pb:'env(safe-area-inset-bottom)'}}}><DialogTitle>ยืนยันรับเงิน</DialogTitle><DialogContent><Stack spacing={1.5} pt={1}><Typography>{request?.title} · {request?.memberName}</Typography><Typography variant="body2" color="text.secondary">ยอดเรียกเก็บ {fundMoney(request?.expectedSatang)}</Typography><TextField size="small" autoFocus label="ยอดรับเงินจริง (บาท)" type="number" inputProps={{min:0,step:.01,inputMode:'decimal'}} value={value} onChange={e=>setValue(e.target.value)}/>{request?.isFund&&<Typography variant="caption" color="text.secondary">เข้ากองกลางเฉพาะยอดที่ยืนยันนี้</Typography>}{error&&<Alert severity="error">{error}</Alert>}</Stack></DialogContent><DialogActions><Button disabled={busy} onClick={onClose}>ยกเลิก</Button><Button disabled={busy} variant="contained" onClick={confirm}>ยืนยันรับเงินจริง</Button></DialogActions></Dialog>;
}
