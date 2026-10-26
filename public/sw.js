// Replaced with a unique value by Vite on every production build. This makes
// installed iOS/Android PWAs detect a deployment even when this source file
// itself did not otherwise change.
const BUILD_ID="__TRIPMATE_BUILD_ID__";
const CACHE=`tripmate-brand-20261027-${BUILD_ID}`;
const APP_SHELL=["/","/manifest.webmanifest","/manifest.webmanifest?v=20261027","/favicon-32.png?v=20261027","/app-icon-192.png","/app-icon-512.png","/apple-touch-icon.png","/app-icon.svg?v=20261027","/brand/tripmate-mark.svg?v=20261027","/app-icon-192.png?v=20261027","/app-icon-512.png?v=20261027","/apple-touch-icon.png?v=20261027"];

self.addEventListener("install",(event)=>{
  event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",(event)=>{
  event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",(event)=>{
  const {request}=event;
  if(request.method!=="GET"||new URL(request.url).origin!==self.location.origin)return;

  if(request.mode==="navigate"){
    event.respondWith(fetch(request).then((response)=>{
      if(response.ok){const cachedResponse=response.clone();event.waitUntil(caches.open(CACHE).then((cache)=>cache.put("/",cachedResponse)));}
      return response;
    }).catch(()=>caches.match("/")));
    return;
  }

  event.respondWith(caches.match(request).then((cached)=>cached||fetch(request).then((response)=>{
    if(response.ok&&["script","style","image","font"].includes(request.destination)){
      const cachedResponse=response.clone();event.waitUntil(caches.open(CACHE).then((cache)=>cache.put(request,cachedResponse)));
    }
    return response;
  })));
});
self.addEventListener("message",(event)=>{if(event.data?.type!=="SHOW_NOTIFICATION")return;const {title="TripMate",body="มีรายการใหม่ที่ต้องตรวจสอบ",tag="tripmate-update",url="/"}=event.data;event.waitUntil(self.registration.showNotification(title,{body,icon:"/app-icon-192.png?v=20261027",badge:"/app-icon-192.png?v=20261027",tag,data:{url}}));});
self.addEventListener("push",(event)=>{
  let payload={title:"TripMate",body:"มีอัปเดตใหม่จากทริป",url:"/",tag:"tripmate-push"};
  try{if(event.data)payload={...payload,...event.data.json()};}catch{if(event.data)payload.body=event.data.text();}
  event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:"/app-icon-192.png?v=20261027",badge:"/app-icon-192.png?v=20261027",tag:payload.tag,data:{url:payload.url||"/"}}));
});
self.addEventListener("notificationclick",(event)=>{event.notification.close();event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then((windows)=>{const existing=windows[0];if(existing){existing.focus();return existing.navigate(event.notification.data?.url||"/");}return clients.openWindow(event.notification.data?.url||"/");}));});
