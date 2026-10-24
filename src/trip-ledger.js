import {calculateBalances, simplifyDebts} from './finance';
const cents=value=>Math.round(Number(value||0)*100);
export const collectionPaymentAmount=(collection,id)=>Number(collection.payments?.[id]?.amount??(collection.lateJoin?.newcomers?.includes(id)?collection.lateJoin.perPerson:collection.perPerson)??0);
export const collectionPaymentConfirmed=(collection,id)=>collection.paid?.includes(id)||collection.payments?.[id]?.status==='paid';

// Legacy per-person dues may be short of the bill by a few cents. Once all
// actual receipts are known, reconcile against the real bill, not rounded dues.
export function collectionFundTotals(collection) {
 const participants=[...new Set(collection.participants||[])];
 const original=participants.filter(id=>!collection.lateJoin?.newcomers?.includes(id));
 const expected=cents(collection.fundRemainder||0);
 let target=0,received=0;
 for(const id of participants){
  const amount=cents(collectionPaymentAmount(collection,id));
  const newcomer=collection.lateJoin?.newcomers?.includes(id);
  const index=original.indexOf(id);
  const planned=collection.isFund?amount:collection.fundShares?.[id]!=null?cents(collection.fundShares[id]):newcomer?(collection.lateJoin.mode==='fund'?amount:0):Math.floor(expected/Math.max(1,original.length))+(index<expected%Math.max(1,original.length)?1:0);
  const paid=collectionPaymentConfirmed(collection,id);
  const extra=paid?Math.max(0,cents(collection.payments?.[id]?.receivedAmount??amount/100)-amount):0;
  target+=planned+extra;if(paid)received+=planned+extra;
 }
 let adjustment=0;
 if(!collection.isFund&&!collection.lateJoin&&participants.length&&participants.every(id=>collectionPaymentConfirmed(collection,id)&&collection.payments?.[id]?.receivedAmount!=null)){
  const actual=participants.reduce((sum,id)=>sum+cents(collection.payments[id].receivedAmount),0);
  const surplus=Math.max(0,actual-cents(collection.originalAmount??(Number(collection.amount)-Number(collection.fundRemainder||0))));
  adjustment=received-surplus;received=surplus;target=Math.max(0,target-adjustment);
 }
 return {expected:target/100,received:received/100,roundingAdjustment:adjustment/100};
}

// Collection dues retain their recipient and payment record. Never use the
// unallocated expense-settlement action to pay a collection a second time.
export function tripLedger(expenses,collections,settlements,memberIds){
 const approved=expenses.filter(e=>!e.approvalStatus||e.approvalStatus==='approved');
 const eligibleCollections=collections.filter(c=>!c.expenseId||approved.some(e=>e.id===c.expenseId));
 const linkedIds=new Set(eligibleCollections.map(c=>c.expenseId).filter(Boolean));
 const expenseBalances=calculateBalances(approved.filter(e=>!linkedIds.has(e.id)),memberIds);
 for(const payment of settlements.filter(p=>p.status==='confirmed')){
  if(!memberIds.includes(payment.from)||!memberIds.includes(payment.to))continue;
  expenseBalances[payment.from]+=Number(payment.amount);expenseBalances[payment.to]-=Number(payment.amount);
 }
 const expenseTransfers=simplifyDebts(expenseBalances);
 const dues=[];let cost=cents(approved.reduce((sum,e)=>sum+Number(e.amount),0));let fundExpected=0,fundReceived=0;
 for(const collection of eligibleCollections){
  const participants=[...new Set(collection.participants||[])];
  const fundOnly=Boolean(collection.isFund);
  if(!fundOnly&&!collection.expenseId)cost+=cents(collection.originalAmount??(Number(collection.amount)-Number(collection.fundRemainder||0)));
  const funding=collectionFundTotals(collection);
  fundExpected+=cents(funding.expected);fundReceived+=cents(funding.received);
  participants.forEach(id=>{
   const amount=cents(collectionPaymentAmount(collection,id));
   const paid=collectionPaymentConfirmed(collection,id);
   if(id!==collection.receiver&&!paid&&amount>0)dues.push({collectionId:collection.id,title:collection.title,from:id,to:collection.receiver,amount:amount/100,fund:fundOnly,status:collection.payments?.[id]?.status||'unpaid'});
  });
 }
 const totals=Object.fromEntries(memberIds.map(id=>[id,{pay:0,receive:0,fundPay:0,fundReceive:0}]));
 for(const debt of [...expenseTransfers,...dues]){
  const pay=debt.fund?'fundPay':'pay',receive=debt.fund?'fundReceive':'receive';
  if(totals[debt.from])totals[debt.from][pay]+=cents(debt.amount);
  if(totals[debt.to])totals[debt.to][receive]+=cents(debt.amount);
 }
 for(const row of Object.values(totals))for(const key of Object.keys(row))row[key]/=100;
 return {approved,expenseBalances,expenseTransfers,dues,totals,cost:cost/100,fundExpected:fundExpected/100,fundReceived:fundReceived/100};
}
