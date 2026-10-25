// Cover copy only: never changes the trip or itinerary stored in the app.
const englishName=value=>typeof value==='string'&&value.trim()?value.trim():'';
export function storyTripTitle(trip){
 const explicit=englishName(trip?.english_name||trip?.name_en||trip?.nameEn);if(explicit)return explicit;
 const name=englishName(trip?.name),known={'กาญจนบุรี':'Kanchanaburi','เขาใหญ่':'Khao Yai'};
 return known[name]||(name&&!/[\u0E00-\u0E7F]/.test(name)?name:'Our Trip');
}
function dateOnly(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;const date=new Date(`${value}T00:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?date:null;}
const month=date=>new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'UTC'}).format(date);
export function storyDateLabel(trip){
 const start=dateOnly(trip?.start_date),end=dateOnly(trip?.end_date);if(!start)return '';
 if(!end||end<start)return `${month(start)} ${start.getUTCDate()}, ${start.getUTCFullYear()}`;
 const days=Math.round((end-start)/86400000)+1,year=start.getUTCFullYear(),endYear=end.getUTCFullYear();
 let range=`${month(start)} ${start.getUTCDate()}`;
 if(days>1)range+=year!==endYear?`, ${year} – ${month(end)} ${end.getUTCDate()}`:start.getUTCMonth()!==end.getUTCMonth()?` – ${month(end)} ${end.getUTCDate()}`:`–${end.getUTCDate()}`;
 return `${range}, ${endYear} · ${days}D${days-1}N`;
}
export function storyPlaceTitle(place){
 const explicit=englishName(place?.english_name||place?.title_en||place?.name_en||place?.englishName);if(explicit)return explicit;
 const title=englishName(place?.title||place?.place);
 return ({'เข้าที่พัก':'Check-in','เช็คอิน':'Check-in','เช็กอิน':'Check-in','ออกจากที่พัก':'Check-out','เช็คเอาท์':'Check-out'})[title]||title||'Stop';
}
