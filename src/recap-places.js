// Recap labels come exclusively from the itinerary's place field, never activity titles.
export function recapPlaceName(stop){
 if(typeof stop?.place!=='string')return '';
 const name=stop.place.trim().replace(/\s+/g,' ');
 if(!name||/^(?:สถานที่|ไม่ระบุ|ยังไม่ระบุ|place|location|stop|n\/?a|[-–—]+)$/i.test(name))return '';
 if(/(?:\b[a-z][a-z\d+.-]*:\/\/|\bwww\.|maps\.app\.goo\.gl|maps\.google\.|google\.[a-z.]+\/maps|goo\.gl\/maps)/i.test(name))return '';
 if(/^[\d\s.,;:/+−'"NSEW°º()\-]+$/i.test(name)&&(/[°º'"]|\d\s*[NSWE]\b/i.test(name))&&(name.match(/\d+(?:\.\d+)?/g)||[]).length>=2)return '';
 const coordinate=name.replace(/\b(?:latitude|longitude|lat|lng|lon)\s*[:=]?\s*/gi,'').replace(/[()°º]/g,'').trim();
 if(/^[+-]?\d+(?:\.\d+)?\s*[NS]?\s*[,;\/]\s*[+-]?\d+(?:\.\d+)?\s*[EW]?$/i.test(coordinate)||/^[+-]?\d+\.\d+\s+[+-]?\d+\.\d+$/.test(coordinate)||/^[+-]?\d+(?:\.\d+)?$/.test(coordinate))return '';
 return name;
}
function scheduledMinute(stop){const m=String(stop.time||'').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);return m&&Number(m[1])<24&&Number(m[2])<60?Number(m[1])*60+Number(m[2]):Infinity;}
export function recapRoutePlaces(stops=[]){
 return stops.map((stop,index)=>({stop,index,name:recapPlaceName(stop)})).filter(row=>row.name&&row.stop.enabled!==false).sort((a,b)=>
  (Number(a.stop.day)||Infinity)-(Number(b.stop.day)||Infinity)||scheduledMinute(a.stop)-scheduledMinute(b.stop)||(a.stop.sortOrder??a.index)-(b.stop.sortOrder??b.index)||a.index-b.index
 ).map(({stop,name})=>({...stop,place:name}));
}
