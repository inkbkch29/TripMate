import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, MenuItem, IconButton, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import { AddRounded, CameraAltRounded, DeleteOutlineRounded, ContentCopyRounded } from '@mui/icons-material';
import { cents, parseReceiptText, splitReceipt, receiptProgress, receiptItemCategory, moveReceiptItemToExtra } from './receipt-split';
import { splitAmount } from './finance';
import { readReceipt } from './receipt-ocr';

const money = value => new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(value || 0);
export const blankReceipt = () => ({items:[{id:crypto.randomUUID(),name:'',amount:'',participants:[],category:'food'}],serviceCharge:'',tax:'',discount:'',expectedTotal:'',roundUp:true,reviewed:false});

export default function ReceiptSplitEditor({ value, onChange, members, receiptFile, receiptUrl, onFile, disabled=false, onReadingChange=()=>{} }) {
  const [reading,setReading]=useState(false); const [progress,setProgress]=useState(null); const [error,setError]=useState('');
  const [filter,setFilter]=useState('all'); const [copied,setCopied]=useState(false);
  const [rawText,setRawText]=useState(''); const [preview,setPreview]=useState('');
  const operation=useRef(null);
  useEffect(()=>()=>operation.current?.abort(),[]);
  useEffect(()=>{if(!receiptFile?.type.startsWith('image/')){setPreview('');return;}const url=URL.createObjectURL(receiptFile);setPreview(url);return()=>URL.revokeObjectURL(url);},[receiptFile]);
  const change = patch => {setCopied(false);onChange({...value,...patch,reviewed:false});};
  const update = (id,patch) => change({items:value.items.map(item=>item.id===id?{...item,...patch}:item)});
  const memberIds=members.map(member=>member.id);
  const result=splitReceipt(value,memberIds);
  const progressTotals=receiptProgress(value,memberIds);
  const categories={all:'ทั้งหมด',food:'อาหาร',drink:'น้ำหวาน / เครื่องดื่ม',water:'น้ำเปล่า / น้ำแข็ง',other:'อื่น ๆ'};
  const visibleItems=value.items.map((item,index)=>({item,index})).filter(({item})=>filter==='all'||(item.category||receiptItemCategory(item.name))===filter);
  const personLines=id=>value.items.filter(item=>item.participants?.includes(id)&&item.participants.every(person=>memberIds.includes(person))&&item.name?.trim()&&Number.isFinite(Number(item.amount))&&Number(item.amount)>0).map(item=>({name:item.name,amount:splitAmount(Number(item.amount),[...new Set(item.participants)]).find(share=>share.userId===id)?.amount||0}));
  const copySummary=async()=>{
    const text=[progressTotals.complete?'สรุปยอดแยกบิล':'ร่างสรุปยอด (ยังจัดสรรไม่ครบ)',`ยอดรายการอาหาร ${money(progressTotals.subtotal)}`,`จัดสรรแล้ว ${money(progressTotals.allocated)}`,...members.map(member=>`${member.name}: ${money(progressTotals.shares[member.id]||0)}\n${personLines(member.id).map(line=>`  • ${line.name} ${money(line.amount)}`).join('\n')}`),...(progressTotals.unallocatedCount?[`ยังไม่ได้จัดสรร ${progressTotals.unallocatedCount} รายการ (${money(progressTotals.unallocated)})`]:[]),progressTotals.complete?`บิลจริง ${money(result.total)} · เรียกเก็บรวม ${money(progressTotals.total)} · ส่วนต่างเข้ากองกลาง ${money(progressTotals.fundRemainder)}`:'ยอดชั่วคราวยังไม่รวมค่าบริการ ภาษี และส่วนลด'].join('\n');
    try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setError('คัดลอกไม่ได้ กรุณาลองอีกครั้ง');}
  };
  const mismatch=value.expectedTotal!==''&&cents(value.expectedTotal)!==cents(result.total);
  const scan=async file=>{
    if(!file)return;
    if(value.items.some(item=>item.name.trim()||Number(item.amount)>0)&&!window.confirm('อ่านบิลใหม่จะแทนรายการที่กรอกไว้ ต้องการอ่านใหม่ไหม?'))return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024){setError('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 15 MB');return;}
    onFile(file);setError('');setReading(true);onReadingChange(true);setProgress(null);
    const controller=new AbortController();operation.current=controller;
    const timer=setTimeout(()=>{setError("อ่านรูปนานเกินไป ลองรูปที่ชัดขึ้นหรือกรอกรายการเองได้");controller.abort();},90000);
    try{
      const data=await readReceipt(file,{signal:controller.signal,onProgress:message=>{if(!controller.signal.aborted)setProgress(message);}});
      if(controller.signal.aborted)return;
      setRawText(data.text);setFilter('all');setCopied(false);
      const parsed=parseReceiptText(data.text);
      onChange({...parsed,roundUp:value.roundUp===true,items:parsed.items.length?parsed.items.map(item=>({...item,id:crypto.randomUUID(),category:receiptItemCategory(item.name)})):blankReceipt().items,reviewed:false});
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
    {rawText&&<Alert severity="info">อ่านรายการแล้ว กรุณาตรวจชื่อ ราคา และยอดสุทธิให้ตรงใบเสร็จก่อนเลือกคน หากค่าบริการ ภาษี หรือส่วนลดถูกอ่านเป็นอาหาร ให้เปลี่ยนหมวดของรายการนั้นเพื่อย้ายไปยอดรวม</Alert>}
    <Box className="receipt-progress" aria-live="polite"><Box><Typography variant="caption">ยอดรายการที่กรอก</Typography><Typography variant="h6">{money(progressTotals.subtotal)}</Typography></Box><Box><Typography variant="caption">ยอดที่จัดสรรแล้ว</Typography><Typography variant="h6">{money(progressTotals.allocated)}</Typography></Box></Box>
    <fieldset disabled={disabled||reading} className="receipt-fieldset"><Stack spacing={1.5}>
      <Typography fontWeight={800}>ติ๊กว่าใครกินอะไรบ้าง · {members.length} คน</Typography>
      <Stack direction="row" gap={.7} flexWrap="wrap">{Object.entries(categories).map(([key,label])=><Chip disabled={reading||disabled} key={key} label={label} color={filter===key?'primary':'default'} variant={filter===key?'filled':'outlined'} onClick={()=>setFilter(key)} aria-pressed={filter===key}/>)}</Stack>
      {!visibleItems.length&&<Typography variant="body2" color="text.secondary">ยังไม่มีรายการในหมวดนี้ เลือกทั้งหมดหรือเพิ่มรายการใหม่ได้</Typography>}
      {visibleItems.map(({item,index})=><Box key={item.id} className="receipt-item">
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography variant="caption" color="text.secondary">รายการที่ {index+1}</Typography><IconButton size="small" aria-label={`ลบรายการอาหารที่ ${index+1}`} onClick={()=>change({items:value.items.filter(row=>row.id!==item.id)})}><DeleteOutlineRounded fontSize="small"/></IconButton></Stack>
        <Box className="receipt-item-inputs"><TextField size="small" label={`ชื่อรายการที่ ${index+1}`} value={item.name} onChange={event=>update(item.id,{name:event.target.value})}/><TextField size="small" label={`ราคารวมรายการที่ ${index+1}`} type="number" inputProps={{min:0,step:'0.01',inputMode:'decimal'}} value={item.amount} onChange={event=>update(item.id,{amount:event.target.value})}/></Box>
        <TextField disabled={reading||disabled} select size="small" label={`หมวดรายการที่ ${index+1}`} value={item.category||receiptItemCategory(item.name)} onChange={event=>{const category=event.target.value;if(["serviceCharge","tax","discount"].includes(category)){try{onChange(moveReceiptItemToExtra(value,item.id,category));setCopied(false);setError("");}catch(err){setError(err.message);}}else update(item.id,{category});}} sx={{mt:1}}>{Object.entries(categories).filter(([key])=>key!=='all').map(([key,label])=><MenuItem key={key} value={key}>{label}</MenuItem>)}<MenuItem value="serviceCharge">ค่าบริการ · ย้ายไปยอดรวม</MenuItem><MenuItem value="tax">ภาษีเพิ่ม · ย้ายไปยอดรวม</MenuItem><MenuItem value="discount">ส่วนลด · ย้ายไปยอดรวม</MenuItem></TextField>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mt={.5}><Typography variant="caption" color="text.secondary">{item.participants.length?`${item.participants.length} คนร่วมจ่าย`:'ยังไม่เลือกคน'}</Typography><Stack direction="row"><Button size="small" onClick={()=>update(item.id,{participants:memberIds})}>เลือกทั้ง {members.length} คน</Button><Button size="small" onClick={()=>update(item.id,{participants:[]})}>ล้าง</Button></Stack></Stack>
        <Box className="receipt-people">{members.map(member=><FormControlLabel key={member.id} control={<Checkbox size="small" checked={item.participants.includes(member.id)} onChange={event=>update(item.id,{participants:event.target.checked?[...item.participants,member.id]:item.participants.filter(id=>id!==member.id)})}/>} label={member.name}/>)}</Box>
        {item.participants.length>0&&Number(item.amount)>0&&<Typography variant="caption" color="primary.dark">ประมาณ {money(Number(item.amount)/item.participants.length)} / คน · ยอดจริงจัดเศษสตางค์ให้รวมตรงบิล</Typography>}
        {!item.participants.length&&<Typography variant="caption" color="warning.main">ยังไม่ได้เลือกว่าใครกินรายการนี้</Typography>}
      </Box>)}
      <Button startIcon={<AddRounded/>} onClick={()=>{setFilter('all');change({items:[...value.items,{id:crypto.randomUUID(),name:'',amount:'',participants:[],category:filter==='all'?'food':filter}]});}}>เพิ่มรายการเอง</Button>
      <Box className="receipt-extras">{[['serviceCharge','ค่าบริการ (บาท)'],['tax','ภาษีเพิ่ม (บาท)'],['discount','ส่วนลด (บาท)']].map(([key,label])=><TextField key={key} size="small" type="number" label={label} value={value[key]} inputProps={{min:0,step:'0.01',inputMode:'decimal'}} onChange={event=>change({[key]:event.target.value})}/>)}</Box>
      <Typography variant="caption" color="text.secondary">ค่าบริการ ภาษี และส่วนลดแบ่งตามยอดอาหารแต่ละคน ใส่เฉพาะที่ยังไม่รวมในราคาอาหาร</Typography>
      <TextField size="small" type="number" label="ยอดสุทธิบนใบเสร็จ (ไว้ตรวจยอด)" value={value.expectedTotal} inputProps={{min:0,step:'0.01',inputMode:'decimal'}} onChange={event=>change({expectedTotal:event.target.value})}/>
      <Typography fontWeight={800}>สรุปยอดที่แต่ละคนต้องจ่าย</Typography>
      <Box className="receipt-split-summary" aria-live="polite"><Stack direction="row" justifyContent="space-between"><Typography fontWeight={850}>{progressTotals.complete?(value.roundUp?'ยอดเรียกเก็บรวม (ปัดขึ้นแล้ว)':'ยอดรวมสุทธิ'):'ยอดที่หารแล้ว (ชั่วคราว)'}</Typography><Typography fontWeight={850}>{money(progressTotals.total)}</Typography></Stack></Box>
      {value.roundUp&&<Alert severity="info">รวมอาหาร ค่าบริการ ภาษี และส่วนลดของแต่ละคนก่อน แล้วปัดขึ้นเป็นบาทเต็มครั้งเดียวต่อคน{progressTotals.complete?` · บิลจริง ${money(result.total)} · เรียกเก็บ ${money(progressTotals.total)} · ส่วนต่าง ${money(progressTotals.fundRemainder)} เข้ากองกลางอัตโนมัติ`:''}</Alert>}
      {members.map(member=>{const lines=personLines(member.id);return <Box key={member.id} className="receipt-person-summary"><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography fontWeight={800}>{member.name}</Typography><Typography variant="caption" color="text.secondary">{lines.length} รายการ</Typography></Box><Box textAlign="right"><Typography fontWeight={850}>{money(progressTotals.shares[member.id]||0)}</Typography>{value.roundUp&&progressTotals.complete&&<Typography variant="caption" color="text.secondary">ก่อนปัด {money(progressTotals.costShares[member.id]||0)} · กองกลาง {money(progressTotals.fundShares[member.id]||0)}</Typography>}</Box></Stack>{lines.length>0&&<details><summary>ดูรายการที่ต้องจ่ายของ {member.name}</summary>{lines.map((line,index)=><Stack key={index} direction="row" justifyContent="space-between" gap={1}><Typography variant="body2">{line.name}</Typography><Typography variant="body2">{money(line.amount)}</Typography></Stack>)}{progressTotals.complete&&<Typography variant="caption" color="text.secondary">ยอดรวมด้านบนรวมค่าบริการ ภาษี และหักส่วนลดตามสัดส่วนแล้ว</Typography>}</details>}</Box>})}
      {progressTotals.unallocatedCount>0&&<Alert severity="warning">ยังมี {progressTotals.unallocatedCount} รายการที่ต้องตรวจหรือเลือกคน รวม {money(progressTotals.unallocated)} ยังไม่รวมในยอดรายคน ยอดชั่วคราวยังไม่รวมค่าบริการ ภาษี และส่วนลด</Alert>}
      <Button variant="outlined" startIcon={<ContentCopyRounded/>} onClick={copySummary}>{copied?'คัดลอกแล้ว ✓':`คัดลอกสรุปยอดทั้ง ${members.length} คน`}</Button>
      {mismatch&&<Alert severity="warning">ยอดยังไม่ตรงใบเสร็จ ต่างกัน {money(Math.abs(Number(value.expectedTotal)-result.total))} ตรวจรายการหรือเพิ่มรายการที่ขาดก่อนบันทึก</Alert>}
      <FormControlLabel control={<Checkbox checked={Boolean(value.reviewed)} onChange={event=>onChange({...value,reviewed:event.target.checked})}/>} label="ตรวจรายการ ราคา และคนที่หารแล้ว"/>
    </Stack></fieldset>
    {rawText&&<details><summary>ดูข้อความที่อ่านจากรูป</summary><pre className="receipt-raw-text">{rawText}</pre></details>}
  </Stack>;
}
