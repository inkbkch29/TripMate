export function isGoogleMapsUrl(value){
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(['maps.app.goo.gl','maps.google.com'].includes(url.hostname)||(['www.google.com','google.com','www.google.co.th','google.co.th'].includes(url.hostname)&&/^\/maps(?:\/|$)/.test(url.pathname))||(url.hostname==='goo.gl'&&url.pathname.startsWith('/maps/')));}catch{return false;}
}
export function coordinatePair(longitude,latitude){
 if([longitude,latitude].some(value=>value===null||value===undefined||String(value).trim()===''||!Number.isFinite(Number(value))))return null;
 const point=[Number(longitude),Number(latitude)];return Math.abs(point[0])<=180&&Math.abs(point[1])<=85.051128?point:null;
}
// @lat,lng and center/ll are camera positions, not necessarily the selected place.
export function googleMapsCoordinate(value){
 if(!isGoogleMapsUrl(value))return null;
 const url=new URL(value);if(url.pathname.includes('/dir/'))return null;
 let decoded;try{decoded=decodeURIComponent(url.pathname+url.search);}catch{return null;}
 const pins=[...decoded.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
 if(pins.length===1)return coordinatePair(pins[0][2],pins[0][1]);if(pins.length>1)return null;
 for(const key of ['query','q']){const match=url.searchParams.get(key)?.trim().match(/^(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);if(match)return coordinatePair(match[2],match[1]);}
 const place=url.pathname.match(/^\/maps\/place\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:\/|$)/);return place?coordinatePair(place[2],place[1]):null;
}
