import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    const authorization=req.headers.get("Authorization");
    if(!authorization)throw new Error("Unauthorized");
    const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const publicKey=Deno.env.get("VAPID_PUBLIC_KEY")!;
    const privateKey=Deno.env.get("VAPID_PRIVATE_KEY")!;
    if(!publicKey||!privateKey)throw new Error("Web Push is not configured");

    const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
    const token=authorization.replace(/^Bearer\s+/i,"");
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user)throw new Error("Unauthorized");

    const {tripId,eventType,distanceMeters=0}=await req.json();
    if(!tripId||!["online","movement"].includes(eventType))throw new Error("Invalid request");
    const {data:membership}=await admin.from("trip_members").select("user_id").eq("trip_id",tripId).eq("user_id",user.id).maybeSingle();
    if(!membership)throw new Error("Not a trip member");

    const throttleMinutes=eventType==="movement"?5:30;
    const since=new Date(Date.now()-throttleMinutes*60*1000).toISOString();
    const {data:recent}=await admin.from("push_notification_events").select("id").eq("trip_id",tripId).eq("actor_id",user.id).eq("event_type",eventType).gte("created_at",since).limit(1);
    if(recent?.length)return Response.json({sent:0,throttled:true},{headers:corsHeaders});
    await admin.from("push_notification_events").insert({trip_id:tripId,actor_id:user.id,event_type:eventType});

    const [{data:profile},{data:trip},{data:members}]=await Promise.all([
      admin.from("profiles").select("display_name").eq("id",user.id).maybeSingle(),
      admin.from("trips").select("name").eq("id",tripId).maybeSingle(),
      admin.from("trip_members").select("user_id").eq("trip_id",tripId).neq("user_id",user.id),
    ]);
    const recipientIds=(members||[]).map((item)=>item.user_id);
    if(!recipientIds.length)return Response.json({sent:0},{headers:corsHeaders});
    const {data:subscriptions}=await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id",recipientIds);
    const name=profile?.display_name||"เพื่อน";
    const distance=Number(distanceMeters)||0;
    const body=eventType==="online"
      ?`${name} เปิด TripMate และเริ่มแชร์ตำแหน่งแล้ว`
      :`${name} กำลังเคลื่อนที่${distance>=1000?` · ${(distance/1000).toFixed(1)} กม.`:distance>=100?` · ${Math.round(distance)} ม.`:""}`;
    const payload=JSON.stringify({title:trip?.name||"TripMate",body,url:"/",tag:`trip-location-${user.id}`});
    webpush.setVapidDetails("https://trip-mate-eta-weld.vercel.app",publicKey,privateKey);

    let sent=0;
    for(const subscription of subscriptions||[]){
      try{
        await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload,{TTL:300,urgency:"normal"});
        sent+=1;
      }catch(error:any){
        const status=Number(error?.statusCode||0);
        if(status===404||status===410)await admin.from("push_subscriptions").delete().eq("id",subscription.id);
        else console.error("Push delivery failed",status,error?.message);
      }
    }
    return Response.json({sent},{headers:corsHeaders});
  }catch(error:any){
    const status=["Unauthorized","Not a trip member"].includes(error.message)?401:400;
    return Response.json({error:error.message},{status,headers:corsHeaders});
  }
});
