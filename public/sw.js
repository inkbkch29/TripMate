const CACHE="tripmate-v3";
const APP_SHELL=["/","/manifest.webmanifest","/app-icon-192.png","/app-icon-512.png","/apple-touch-icon.png"];

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
      if(response.ok)caches.open(CACHE).then((cache)=>cache.put("/",response.clone()));
      return response;
    }).catch(()=>caches.match("/")));
    return;
  }

  event.respondWith(caches.match(request).then((cached)=>cached||fetch(request).then((response)=>{
    if(response.ok&&["script","style","image","font"].includes(request.destination)){
      caches.open(CACHE).then((cache)=>cache.put(request,response.clone()));
    }
    return response;
  })));
});
self.addEventListener("message",(event)=>{if(event.data?.type!=="SHOW_NOTIFICATION")return;const {title="TripMate",body="มีรายการใหม่ที่ต้องตรวจสอบ"}=event.data;event.waitUntil(self.registration.showNotification(title,{body,icon:"/app-icon-192.png",badge:"/app-icon-192.png",tag:"tripmate-update",data:{url:"/"}}));});
self.addEventListener("notificationclick",(event)=>{event.notification.close();event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then((windows)=>{const existing=windows[0];if(existing){existing.focus();return existing.navigate(event.notification.data?.url||"/");}return clients.openWindow(event.notification.data?.url||"/");}));});
