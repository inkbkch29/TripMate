import {roundReceiptShares} from './receipt-split';
export function upsertReceiptCollection(collections,expense){
 if(!expense.receiptBreakdown?.roundUp||expense.approvalStatus&&expense.approvalStatus!=='approved')return collections;
 const previous=collections.find(c=>c.expenseId===expense.id);
 const rounded=roundReceiptShares(expense.shares);
 const participants=expense.participants;
 const payments=Object.fromEntries(participants.map(id=>[id,{...previous?.payments?.[id],amount:rounded.chargedShares[id],status:previous?.payments?.[id]?.status||(id===expense.paidBy||rounded.chargedShares[id]===0?'paid':'unpaid')} ]));
 const collection={...previous,id:previous?.id||expense.id,expenseId:expense.id,title:expense.title,amount:rounded.chargedTotal,originalAmount:Number(expense.amount),fundRemainder:rounded.fundRemainder,fundShares:rounded.fundShares,isFund:false,receiver:expense.paidBy,due:expense.expenseDate,participants,perPerson:rounded.chargedShares[participants[0]]||0,payments,paid:participants.filter(id=>payments[id].status==='paid'),syncPending:expense.syncPending,createdAt:previous?.createdAt||expense.updatedAt||new Date().toISOString()};
 return [...collections.filter(c=>c.id!==collection.id),collection];
}
