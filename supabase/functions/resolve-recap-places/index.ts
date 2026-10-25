import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {googleMapsCoordinate,isGoogleMapsUrl} from './coordinate.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const cache=new Map<string,{point:number[]|null,expires:number}>();
async function resolveLink(link:string){
 const saved=cache.get(link);if(saved&&saved.expires>Date.now())return saved.point;
 let url=link,point=googleMapsCoordinate(url);
 if(!isGoogleMapsUrl(url))return null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
 try{
  for(let hop=0;!point&&hop<6;hop++){
   if(!isGoogleMapsUrl(url))break;
   // Follow only Google Maps redirects. Do not scrape map-center/HTML coordinates.
   const response=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{'User-Agent':'TripMate-Maps-Link-Resolver/1.0'}});
   await response.body?.cancel();
   const location=response.headers.get('location');if(response.status<300||response.status>=400||!location)break;
   url=new URL(location,url).href;if(!isGoogleMapsUrl(url))break;point=googleMapsCoordinate(url);
  }
  cache.set(link,{point,expires:Date.now()+(point?3600000:60000)});if(cache.size>200)cache.delete(cache.keys().next().value!);return point;
 }finally{clearTimeout(timer);}
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers:cors});
 try{
  const authorization=req.headers.get('authorization');if(!authorization)return Response.json({error:'Unauthorized'},{status:401,headers:cors});
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return Response.json({error:'Unauthorized'},{status:401,headers:cors});
  const {tripId,stopIds}=await req.json();if(!Array.isArray(stopIds)||stopIds.length>25||!stopIds.length||stopIds.some(id=>typeof id!=='string'||!/^[a-f\d-]{36}$/i.test(id)))return Response.json({error:'Invalid stops'},{status:400,headers:cors});if(typeof tripId!=='string'||!/^[a-f\d-]{36}$/i.test(tripId))return Response.json({error:'Invalid trip'},{status:400,headers:cors});
  // User-scoped RLS verifies membership. No service-role query and no arbitrary URL input.
  const {data:member,error:memberError}=await client.from('trip_members').select('trip_id').eq('trip_id',tripId).eq('user_id',user.id).maybeSingle();
  if(memberError||!member)return Response.json({error:'Forbidden'},{status:403,headers:cors});
  const {data:stops,error}=await client.from('trip_stops').select('id,google_maps_url,latitude,longitude').eq('trip_id',tripId).in('id',stopIds).limit(25);if(error)throw error;
  const results=[];const pending=(stops||[]).filter(stop=>stop.google_maps_url&&(stop.latitude===null||stop.longitude===null));
  let next=0;await Promise.all(Array.from({length:Math.min(4,pending.length)},async()=>{while(next<pending.length){const stop=pending[next++];let point=null;try{point=await resolveLink(stop.google_maps_url);}catch{/* Retain other successful places. */}results.push({id:stop.id,url:stop.google_maps_url,point});}}));
  return Response.json({places:results},{headers:cors});
 }catch{return Response.json({error:'อ่านลิงก์สถานที่ไม่ได้ กรุณาลองใหม่'},{status:400,headers:cors});}
});
