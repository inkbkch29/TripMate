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
    const {activityId}=await req.json();
    if(!activityId)throw new Error("Invalid request");
    const {data:activity,error:activityError}=await admin.from("trip_activity_log").select("id,trip_id,actor_id").eq("id",activityId).maybeSingle();
    if(activityError||!activity)throw new Error("Activity not found");
    if(activity.actor_id!==user.id)throw new Error("Only the activity owner can send this push");
    const dedupeKey=`activity:${activity.id}`;
    const {data:notificationRows,error:notificationError}=await admin.from("user_notifications").select("id,recipient_id,title,body,target").eq("dedupe_key",dedupeKey);
    if(notificationError)throw notificationError;
    const notifications=(notificationRows||[]).filter(item=>!item.target?.pushedAt);
    if(!notifications?.length)return Response.json({sent:0,deduped:true},{headers:corsHeaders});
    const recipientIds=[...new Set(notifications.map(item=>item.recipient_id))];
    const {data:subscriptions}=await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id",recipientIds);
    const notificationsByUser=new Map(notifications.map(item=>[item.recipient_id,item]));
    webpush.setVapidDetails("https://trip-mate-eta-weld.vercel.app",publicKey,privateKey);
    let sent=0;
    for(const subscription of subscriptions||[]){
      const notification=notificationsByUser.get(subscription.user_id);
      if(!notification)continue;
      const payload=JSON.stringify({title:notification.title||"TripMate",body:notification.body,url:`/?notification=${notification.id}`,tag:`trip-activity-${activity.id}`});
      try{
        await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload,{TTL:900,urgency:"normal"});
        sent+=1;
      }catch(error:any){
        const status=Number(error?.statusCode||0);
        if(status===404||status===410)await admin.from("push_subscriptions").delete().eq("id",subscription.id);
        else console.error("Push delivery failed",status,error?.message);
      }
    }
    const pushedAt=new Date().toISOString();
    await Promise.all(notifications.map(item=>admin.from("user_notifications").update({target:{...(item.target||{}),pushedAt}}).eq("id",item.id)));
    return Response.json({sent},{headers:corsHeaders});
  }catch(error:any){
    const status=error.message==="Unauthorized"?401:error.message.includes("activity owner")?403:400;
    return Response.json({error:error.message},{status,headers:corsHeaders});
  }
});
