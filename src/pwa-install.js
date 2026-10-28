// Capture installability at app startup, including while authentication is loading.
export function createPwaInstallController(target){
 const media=target?.matchMedia?.('(display-mode: standalone)');
 const isStandalone=()=>Boolean(media?.matches||target?.navigator?.standalone);
 let state={installed:isStandalone(),prompt:null,busy:false,installEvent:false,checking:!isStandalone()&&typeof target?.navigator?.getInstalledRelatedApps==='function'};const listeners=new Set();let disposed=false,checking=null;
 const publish=patch=>{state={...state,...patch};listeners.forEach(listener=>listener());};
 const ready=event=>{if(state.installed)return;event.preventDefault();if(!state.busy)publish({prompt:event});};
 const markInstalled=()=>publish({installed:true,prompt:null,busy:false,checking:false});
 const installed=()=>publish({installed:true,installEvent:true,prompt:null,busy:false,checking:false});
 const ownWebApp=app=>{if(app.platform!=='webapp')return false;try{const origin=target.location.origin,manifest=new URL('/manifest.webmanifest',origin),url=app.url?new URL(app.url,origin):null,id=app.id?new URL(app.id,origin):null;return Boolean(url&&url.origin===manifest.origin&&url.pathname===manifest.pathname||id&&id.href===new URL('/',origin).href);}catch{return false;}};
 const checkInstalled=()=>{if(disposed||state.installed||typeof target?.navigator?.getInstalledRelatedApps!=='function')return Promise.resolve();if(checking)return checking;let timer;checking=(async()=>{try{const apps=await Promise.race([Promise.resolve().then(()=>target.navigator.getInstalledRelatedApps()),new Promise(resolve=>{timer=setTimeout(()=>resolve([]),1500);})]);if(!disposed&&Array.isArray(apps)&&apps.some(ownWebApp))markInstalled();}catch{}finally{clearTimeout(timer);checking=null;if(!disposed)publish({checking:false});}})();return checking;};
 const displayChanged=()=>{if(isStandalone())markInstalled();};
 target?.addEventListener('beforeinstallprompt',ready);target?.addEventListener('appinstalled',installed);target?.addEventListener('focus',checkInstalled);target?.addEventListener('pageshow',checkInstalled);
 if(media?.addEventListener)media.addEventListener('change',displayChanged);else media?.addListener?.(displayChanged);
 const initialCheck=checkInstalled();
 return {
  ready:initialCheck,
  getSnapshot:()=>state,
  subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
  install:async()=>{
   if(state.installed)return {kind:'installed'};
   if(state.busy)return {kind:'busy'};
   const event=state.prompt;if(!event)return {kind:'manual'};
   publish({prompt:null,busy:true});
   try{
    // Must happen directly inside the user's click, before any asynchronous work.
    const result=await event.prompt();const choice=event.userChoice?await event.userChoice:result;
    return {kind:'native',outcome:choice?.outcome||'unknown'};
   }catch{return {kind:'manual',failed:true};}
   finally{publish({busy:false});}
  },
  dispose:()=>{disposed=true;target?.removeEventListener('focus',checkInstalled);target?.removeEventListener('pageshow',checkInstalled);target?.removeEventListener('beforeinstallprompt',ready);target?.removeEventListener('appinstalled',installed);if(media?.removeEventListener)media.removeEventListener('change',displayChanged);else media?.removeListener?.(displayChanged);listeners.clear();},
 };
}
export const pwaInstall=createPwaInstallController(typeof window!=='undefined'?window:null);
if(import.meta.hot)import.meta.hot.dispose(()=>pwaInstall.dispose());
