export function bangkokDate(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),get=type=>parts.find(p=>p.type===type)?.value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function tripPhase(trip,today=bangkokDate()){
 if(trip?.status==='completed'||trip?.end_date&&today>trip.end_date)return 'completed';
 if(trip?.start_date&&today<trip.start_date)return 'upcoming';
 return trip?.status==='active'||trip?.start_date&&today>=trip.start_date?'active':'upcoming';
}
export function scheduledMinute(stop){const match=String(stop.time||'').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);return match&&Number(match[1])<24&&Number(match[2])<60?Number(match[1])*60+Number(match[2]):Infinity;}
export function orderedTimeline(stops=[]){return stops.map((stop,index)=>({stop,index})).sort((a,b)=>Number(a.stop.day||1)-Number(b.stop.day||1)||scheduledMinute(a.stop)-scheduledMinute(b.stop)||(a.stop.sortOrder??a.index)-(b.stop.sortOrder??b.index)||a.index-b.index).map(row=>row.stop);}
export function timelineState(trip,stops=[],now=new Date()){
 const today=bangkokDate(now),phase=tripPhase(trip,today),start=trip?.start_date?Date.parse(`${trip.start_date}T00:00:00+07:00`):NaN,day=phase==='active'&&Number.isFinite(start)?Math.floor((Date.parse(`${today}T00:00:00+07:00`)-start)/86400000)+1:null,ordered=orderedTimeline(stops);
 const timed=ordered.map(stop=>({stop,at:start+(Number(stop.day||1)-1)*86400000+scheduledMinute(stop)*60000})).filter(row=>Number.isFinite(row.at));
 const current=phase==='active'?timed.filter(row=>row.at<=now.getTime()).at(-1)?.stop||null:null;
 const next=phase==='completed'?null:timed.find(row=>row.at>now.getTime())?.stop||ordered.find(s=>!Number.isFinite(scheduledMinute(s))&&(day==null||Number(s.day||1)>=day))||null;
 return {phase,today,day,ordered,current,next,todayStops:ordered.filter(s=>Number(s.day||1)===day)};
}
export function swapTimelineStops(rows,id,direction){const index=rows.findIndex(s=>s.id===id),target=index+direction;if(index<0||target<0||target>=rows.length)return rows;const times=rows.map(s=>s.time),next=[...rows];[next[index],next[target]]=[next[target],next[index]];return next.map((s,n)=>({...s,time:times[n],sortOrder:n}));}
