import React from 'react';
import {Card,CardContent,Typography} from '@mui/material';
import {collectionPaymentAmount} from './trip-ledger';
const money=value=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(value);
export default function CollectionPaymentSummary({collection,userId,currentUserId,members}){
 const name=id=>members.find(member=>member.id===id)?.name||'—';
 return <Card variant="outlined" className="pay-for-summary"><CardContent><Typography variant="caption" color="text.secondary">ผู้โอน</Typography><Typography fontWeight={800}>{name(currentUserId)}</Typography><Typography variant="caption" color="text.secondary">ยอดของ</Typography><Typography fontWeight={800}>{userId===currentUserId?'ตัวเอง':name(userId)}</Typography><Typography mt={1} color="primary.dark" fontWeight={900}>{money(collectionPaymentAmount(collection,userId))}</Typography></CardContent></Card>;
}
