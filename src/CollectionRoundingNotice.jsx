import React from 'react';
import {Button,Stack,Typography} from '@mui/material';
import {collectionPaymentConfirmed} from './trip-ledger';
export function unknownCollectionReceipts(collection){
 return (collection.participants||[]).filter(id=>{const p=collection.payments?.[id];return !p?.superseded&&collectionPaymentConfirmed(collection,id)&&p?.receivedAmount==null&&p?.cashReceivedSatang==null;});
}
export default function CollectionRoundingNotice({collection,canReview=false,onReview,onFund}){
 if(collection.isFund||collection.collectionOnly||!(Number(collection.fundRemainder)>0))return null;
 const unknown=unknownCollectionReceipts(collection),complete=(collection.participants||[]).length>0&&collection.participants.every(id=>collectionPaymentConfirmed(collection,id));
 return <Stack direction="row" alignItems="center" gap={.5} flexWrap="wrap" mt={1}>
  <Typography variant="caption" color="text.secondary" flex="1 1 180px">{unknown.length?`รอตรวจยอดรับเดิม ${unknown.length} คน · ยังไม่เข้ากองกลาง`:complete?'รับครบแล้ว · กองกลางนับเฉพาะส่วนเกินที่ยืนยันจัดสรร':'ส่วนเกินยังไม่เข้ากองกลาง · รอยืนยันรับครบ'}</Typography>
  {unknown.length&&canReview&&onReview?<Button size="small" onClick={onReview}>ตรวจยอดรับเดิม</Button>:onFund?<Button size="small" onClick={onFund}>ดูกองกลาง</Button>:null}
 </Stack>;
}
