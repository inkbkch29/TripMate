import {timelineState} from './travel-timeline';
import {bangkokDate,tripPhase,departureDays} from './home-dashboard';
import {normalizePollLink} from './poll-utils';
export function tripModeState(trip,stops=[],now=new Date()){return {...timelineState(trip,stops,now),countdown:departureDays(trip,bangkokDate(now))};}
export function locationState(row,now=Date.now()){
 if(!row?.sharing_enabled||row.sharing_until&&Date.parse(row.sharing_until)<=now)return 'unavailable';
 const age=now-Date.parse(row.updated_at);if(!Number.isFinite(age)||age< -60000||age>30*60000)return 'unavailable';
 if(row.latitude===null||row.longitude===null||row.latitude===undefined||row.longitude===undefined||!Number.isFinite(Number(row.latitude))||!Number.isFinite(Number(row.longitude))||Math.abs(Number(row.latitude))>90||Math.abs(Number(row.longitude))>180)return 'unavailable';
 return age>5*60000?'stale':'recent';
}
export function visibleLocations(rows,members,phase,now=Date.now()){
 if(phase!=='active')return [];
 return rows.filter(r=>members.some(m=>m.id===r.user_id)&&locationState(r,now)!=='unavailable');
}
export function locationLabel(row,now=Date.now()){
 if(!row?.sharing_enabled||row.sharing_until&&Date.parse(row.sharing_until)<=now)return 'ไม่ได้แชร์ตำแหน่ง';
 const state=locationState(row,now);if(state==='unavailable')return 'กำลังแชร์ · ยังไม่มีตำแหน่งล่าสุด';
 const minutes=Math.max(0,Math.floor((now-Date.parse(row.updated_at))/60000));return `${state==='stale'?'ตำแหน่งเก่า':'อัปเดตล่าสุด'} · ${minutes<1?'เมื่อสักครู่':`${minutes} นาทีที่แล้ว`}`;
}
export function stopNavigation(stop){
 if(stop?.googleMapsUrl)try{const url=normalizePollLink(stop.googleMapsUrl);if(url){const parsed=new URL(url.url);if(parsed.hostname==='maps.app.goo.gl'||parsed.hostname==='goo.gl'&&parsed.pathname.startsWith('/maps')||/(^|\.)google\.[a-z.]+$/.test(parsed.hostname)&&(parsed.pathname.startsWith('/maps')||parsed.hostname.startsWith('maps.')))return url.url;}}catch{}
 if(stop?.latitude!=null&&stop?.longitude!=null&&Number.isFinite(Number(stop.latitude))&&Number.isFinite(Number(stop.longitude))&&Math.abs(Number(stop.latitude))<=90&&Math.abs(Number(stop.longitude))<=180)return `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`;
 return stop?.place?.trim()?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.place.trim())}`:'';
}
export function mapStop(row){return {id:row.id,tripId:row.trip_id,day:row.day_number,time:row.start_time?.slice(0,5)||'',title:row.title,place:row.place_name,note:row.note||'',latitude:row.latitude,longitude:row.longitude,googleMapsUrl:row.google_maps_url||'',sortOrder:row.sort_order,done:row.is_done,revision:row.revision||1,updatedAt:row.updated_at,price:row.price,images:row.images||[],links:row.links||[],sourcePollId:row.source_poll_id,sourcePollOptionId:row.source_poll_option_id,sourcePollToken:row.source_poll_token,sourceSnapshot:row.poll_option_snapshot};}
