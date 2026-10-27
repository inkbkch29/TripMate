import {tripLedger} from './trip-ledger';
import {bangkokDate,tripPhase,timelineState} from './travel-timeline';
export {bangkokDate,tripPhase} from './travel-timeline';
export function departureDays(trip,today=bangkokDate()){
 if(!trip?.start_date)return null;
 const days=Math.round((Date.parse(`${trip.start_date}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000);
 return Number.isFinite(days)?Math.max(0,days):null;
}
export function nextPlanningStop(stops,trip,now=new Date()){const state=timelineState(trip,stops,now);return state.current||state.next;}
export function visitedStopCount(stops,checkins=[]){const checked=new Set(checkins.filter(c=>c.checkedInAt||c.checked_in_at).map(c=>c.stopId||c.stop_id));return new Set(stops.filter(s=>s.done||checked.has(s.id)).map(s=>s.id)).size;}
export function homeExpenseSummary(expenses,collections,settlements,members){
 const ledger=tripLedger(expenses,collections,settlements,members.map(m=>m.id));
 const outstanding=[...ledger.expenseTransfers,...ledger.dues].reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100;
 const pending=ledger.dues.filter(row=>row.status==='pending').length+settlements.filter(row=>row.status==='pending'&&ledger.expenseTransfers.some(debt=>debt.from===row.from&&debt.to===row.to)).length;
 // An installment without an active collection is still awaiting billing.
 // Keep this separate from issued debts, so it cannot be charged twice.
 const unissued=expenses.filter(e=>e.isInstallmentParent).reduce((total,e)=>total+(e.installmentPlan?.installments||[]).reduce((sum,part)=>{
  const issued=collections.some(c=>c.installmentId===part.id&&(c.participants||[]).some(id=>!c.payments?.[id]?.superseded));
  return sum+(issued?0:Math.max(0,Number(part.bill_satang||0)-Number(part.fund_paid_satang||0)));
 },0),0)/100;
 return {spent:ledger.cost,outstanding,pending,unissued};
}
