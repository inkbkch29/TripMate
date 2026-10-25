import {tripLedger} from './trip-ledger';
export function bangkokDate(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),get=type=>parts.find(p=>p.type===type)?.value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function tripPhase(trip,today=bangkokDate()){
 if(trip?.status==='completed'||trip?.end_date&&today>trip.end_date)return 'completed';
 if(trip?.start_date&&today<trip.start_date)return 'upcoming';
 return trip?.status==='active'||trip?.start_date&&today>=trip.start_date?'active':'upcoming';
}
export function departureDays(trip,today=bangkokDate()){
 if(!trip?.start_date)return null;
 const days=Math.round((Date.parse(`${trip.start_date}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000);
 return Number.isFinite(days)?Math.max(0,days):null;
}
export function nextPlanningStop(stops,trip,now=new Date()){
 const rows=[...stops].filter(s=>!s.done).sort((a,b)=>Number(a.day||1)-Number(b.day||1)||String(a.time||'').localeCompare(String(b.time||''))||(a.sortOrder??0)-(b.sortOrder??0));
 if(tripPhase(trip,bangkokDate(now))!=='active'||!trip?.start_date)return rows[0]||null;
 const start=Date.parse(`${trip.start_date}T00:00:00+07:00`),day=Math.floor((Date.parse(`${bangkokDate(now)}T00:00:00+07:00`)-start)/86400000)+1;
 return rows.find(s=>start+(Number(s.day||1)-1)*86400000+(Number(s.time?.slice(0,2)||0)*60+Number(s.time?.slice(3,5)||0))*60000>=now.getTime())||rows.find(s=>Number(s.day||1)>=day)||rows[0]||null;
}
export function visitedStopCount(stops,checkins=[]){const checked=new Set(checkins.filter(c=>c.checkedInAt||c.checked_in_at).map(c=>c.stopId||c.stop_id));return new Set(stops.filter(s=>s.done||checked.has(s.id)).map(s=>s.id)).size;}
export function homeExpenseSummary(expenses,collections,settlements,members){
 const ledger=tripLedger(expenses,collections,settlements,members.map(m=>m.id));
 const outstanding=[...ledger.expenseTransfers,...ledger.dues].reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100;
 const pending=ledger.dues.filter(row=>row.status==='pending').length+settlements.filter(row=>row.status==='pending'&&ledger.expenseTransfers.some(debt=>debt.from===row.from&&debt.to===row.to)).length;
 return {spent:ledger.cost,outstanding,pending};
}
