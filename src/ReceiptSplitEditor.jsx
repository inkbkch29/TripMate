import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, IconButton, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import { AddRounded, CameraAltRounded, DeleteOutlineRounded } from '@mui/icons-material';
import { cents, parseReceiptText, splitReceipt } from './receipt-split';
import { readReceipt } from './receipt-ocr';

const money = value => new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(value || 0);
export const blankReceipt = () => ({items:[{id:crypto.randomUUID(),name:'',amount:'',participants:[]}],serviceCharge:'',tax:'',discount:'',expectedTotal:'',reviewed:false});

export default function ReceiptSplitEditor({ value, onChange, members, receiptFile, receiptUrl, onFile, disabled=false, onReadingChange }) {
  const [reading,setReading]=useState(false); const [progress,setProgress]=useState(null); const [error,setError]=useState('');
  const [rawText,setRawText]=useState(''); const [preview,setPreview]=useState('');
  const operation=useRef(null);
  useEffect(()=>()=>operation.current?.abort(),[]);
  useEffect(()=>{if(!receiptFile?.type.startsWith('image/')){setPreview('');return;}const url=URL.createObjectURL(receiptFile);setPreview(url);return()=>URL.revokeObjectURL(url);},[receiptFile]);
  const change = patch => onChange({...value,...patch,reviewed:false});
  const update = (id,patch) => change({items:value.items.map(item=>item.id===id?{...item,...patch}:item)});
  const result=splitReceipt(value,members.map(member=>member.id));
  const mismatch=value.expectedTotal!==''&&cents(value.expectedTotal)!==cents(result.total);
  const scan=async file=>{
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024){setError('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 15 MB');return;}
    onFile(file);setError('');setReading(true);onReadingChange(true);setProgress(null);
    const controller=new AbortController();operation.current=controller;
    const timer=setTimeout(()=>{setError("อ่านรูปนานเกินไป ลองรูปที่ชัดขึ้นหรือกรอกรายการเองได้");controller.abort();},90000);
    try{
      const data=await readReceipt(file,{signal:controller.signal,onProgress:message=>{if(!controller.signal.aborted)setProgress(message);}});
      if(controller.signal.aborted)return;
      setRawText(data.text);
      const parsed=parseReceiptText(data.text);
      onChange({...parsed,items:parsed.items.length?parsed.items.map(item=>({...item,id:crypto.randomUUID()})):blankReceipt().items,reviewed:false});
      if(!parsed.items.length)setError('ยังแยกรายการจากรูปนี้ไม่ได้ ลองถ่ายให้ตรงและชัดขึ้น หรือเพิ่มรายการเองด้านล่าง');
    }catch(err){if(!controller.signal.aborted)setError('อ่านรูปไม่สำเร็จ ลองใหม่หรือกรอกรายการเองได้');}
    finally{clearTimeout(timer);if(operation.current===controller){setReading(false);onReadingChange(false);operation.current=null;}}
  };
  return <Stack spacing={1.5} className="receipt-editor">
    <Box className="receipt-intro"><Typography fontWeight={850}>ใครกินอะไร จ่ายตามนั้น</Typography><Typography variant="body2" color="text.secondary">เลือกคนในแต่ละรายการ ของที่กินร่วมกันจะหารเฉพาะคนที่เลือก</Typography></Box>
    <Button component="label" variant="outlined" startIcon={<CameraAltRounded/>} disabled={disabled||reading}>เลือกรูปใบเสร็จให้อ่านรายการ<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];event.target.value='';scan(file);}}/></Button>
    {(preview||receiptUrl)&&<img className="receipt-photo" src={preview||receiptUrl} alt="ใบเสร็จสำหรับตรวจราคา"/>}
    {reading&&<Box role="status"><LinearProgress variant={progress?.status==='recognizing text'?'determinate':'indeterminate'} value={(progress?.progress||0)*100}/><Typography variant="caption">กำลังอ่านใบเสร็จ… ครั้งแรกอาจใช้เวลาสักครู่</Typography><Button size="small" onClick={()=>{operation.current?.abort();setError('ยกเลิกการอ่านแล้ว เพิ่มรายการเองได้');}}>ยกเลิกการอ่าน</Button></Box>}
    {error&&<Alert severity="warning">{error}</Alert>}
    {rawText&&<Alert severity="info">อ่านรายการแล้ว กรุณาตรวจชื่อ ราคา และยอดสุทธิให้ตรงใบเสร็จก่อนเลือกคน</Alert>}
    <fieldset disabled={disabled||reading} className="receipt-fieldset"><Stack spacing={1.5}>
      {value.items.map((item,index)=><Box key={item.id} className="receipt-item">
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography variant="caption" color="text.secondary">รายการที่ {index+1}</Typography><IconButton size="small" aria-label={`ลบรายการอาหารที่ ${index+1}`} onClick={()=>change({items:value.items.filter(row=>row.id!==item.id)})}><DeleteOutlineRounded fontSize="small"/></IconButton></Stack>
        <Box className="receipt-item-inputs"><TextField size="small" label={`ชื่อรายการที่ ${index+1}`} value={item.name} onChange={event=>update(item.id,{name:event.target.value})}/><TextField size="small" label={`ราคารวมรายการที่ ${index+1}`} type="number" inputProps={{min:0,step:'0.01',inputMode:'decimal'}} value={item.amount} onChange={event=>update(item.id,{amount:event.target.value})}/></Box>
        <Stack direction="row" gap={.6} flexWrap="wrap" mt={1}><Button size="small" onClick={()=>update(item.id,{participants:members.map(member=>member.id)})}>ทุกคน</Button>{members.map(member=><Button size="small" key={member.id} variant={item.participants.includes(member.id)?'contained':'outlined'} aria-pressed={item.participants.includes(member.id)} onClick={()=>update(item.id,{participants:item.participants.includes(member.id)?item.participants.filter(id=>id!==member.id):[...item.participants,member.id]})}>{member.name}</Button>)}</Stack>
        {!item.participants.length&&<Typography variant="caption" color="warning.main">ยังไม่ได้เลือกว่าใครกินรายการนี้</Typography>}
      </Box>)}
      <Button startIcon={<AddRounded/>} onClick={()=>change({items:[...value.items,{id:crypto.randomUUID(),name:'',amount:'',participants:[]}]})}>เพิ่มรายการเอง</Button>
      <Box className="receipt-extras">{[['serviceCharge','ค่าบริการ (บาท)'],['tax','ภาษีเพิ่ม (บาท)'],['discount','ส่วนลด (บาท)']].map(([key,label])=><TextField key={key} size="small" type="number" label={label} value={value[key]} inputProps={{min:0,step:'0.01',inputMode:'decimal'}} onChange={event=>change({[key]:event.target.value})}/>)}</Box>
      <Typography variant="caption" color="text.secondary">ค่าบริการ ภาษี และส่วนลดแบ่งตามยอดอาหารแต่ละคน ใส่เฉพาะที่ยังไม่รวมในราคาอาหาร</Typography>
      <TextField size="small" type="number" label="ยอดสุทธิบนใบเสร็จ (ไว้ตรวจยอด)" value={value.expectedTotal} inputProps={{min:0,step:'0.01',inputMode:'decimal'}} onChange={event=>change({expectedTotal:event.target.value})}/>
      <Box className="receipt-split-summary" aria-live="polite"><Stack direction="row" justifyContent="space-between"><Typography fontWeight={850}>รวมที่หาร</Typography><Typography fontWeight={850}>{money(result.total)}</Typography></Stack>{result.participants.map(id=><Stack key={id} direction="row" justifyContent="space-between"><Typography variant="body2">{members.find(member=>member.id===id)?.name}</Typography><Typography variant="body2">{money(result.shares[id])}</Typography></Stack>)}</Box>
      {mismatch&&<Alert severity="warning">ยอดยังไม่ตรงใบเสร็จ ต่างกัน {money(Math.abs(Number(value.expectedTotal)-result.total))} ตรวจรายการหรือเพิ่มรายการที่ขาดก่อนบันทึก</Alert>}
      <FormControlLabel control={<Checkbox checked={Boolean(value.reviewed)} onChange={event=>onChange({...value,reviewed:event.target.checked})}/>} label="ตรวจรายการ ราคา และคนที่หารแล้ว"/>
    </Stack></fieldset>
    {rawText&&<details><summary>ดูข้อความที่อ่านจากรูป</summary><pre className="receipt-raw-text">{rawText}</pre></details>}
  </Stack>;
}
