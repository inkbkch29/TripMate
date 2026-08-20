export function safeFilePart(value, fallback = "file") {
  const cleaned = String(value || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

export function tripFilePath(tripId, userId, kind, extension, now = Date.now(), uuid = crypto.randomUUID()) {
  if (!tripId || !userId) throw new Error("ไม่พบข้อมูลทริปหรือผู้ใช้");
  return `${tripId}/${userId}/${safeFilePart(kind)}-${now}-${uuid}.${safeFilePart(extension, "jpg")}`;
}

export function chooseTrip(trips, selectedId) {
  return trips.find((trip) => trip.id === selectedId) || trips[0] || null;
}

export function distanceMeters(a,b) {
  if(!a||!b)return null;
  const toRad=(value)=>Number(value)*Math.PI/180;
  const lat1=toRad(a.latitude),lat2=toRad(b.latitude);
  const dLat=lat2-lat1,dLon=toRad(b.longitude)-toRad(a.longitude);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}

export function groupNearbyLocations(locations,thresholdMeters=200) {
  const remaining=[...(locations||[])];const groups=[];
  while(remaining.length){const group=[remaining.shift()];for(let index=0;index<group.length;index+=1){for(let candidate=remaining.length-1;candidate>=0;candidate-=1){if(distanceMeters(group[index],remaining[candidate])<=thresholdMeters)group.push(...remaining.splice(candidate,1));}}groups.push(group);}
  return groups.map((items)=>({items,latitude:items.reduce((sum,item)=>sum+Number(item.latitude),0)/items.length,longitude:items.reduce((sum,item)=>sum+Number(item.longitude),0)/items.length}));
}
