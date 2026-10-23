import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const reply=(body:Record<string,unknown>,status=200)=>Response.json(body,{status,headers:corsHeaders});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  try{
    const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
    if(!token)return reply({error:"Unauthorized"},401);
    const url=Deno.env.get("SUPABASE_URL")!;
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user)return reply({error:"Unauthorized"},401);
    const {tripId,memberId}=await req.json();
    if(typeof tripId!=="string"||typeof memberId!=="string")return reply({error:"Invalid request"},400);
    const {data:owner,error:ownerError}=await admin.from("trip_members").select("user_id").eq("trip_id",tripId).eq("user_id",user.id).eq("trip_role","owner").maybeSingle();
    if(ownerError)throw ownerError;
    if(!owner)return reply({error:"Only the trip owner can send reset emails"},403);
    const {data:member,error:memberError}=await admin.from("trip_members").select("user_id").eq("trip_id",tripId).eq("user_id",memberId).maybeSingle();
    if(memberError)throw memberError;
    if(!member)return reply({error:"Member not found"},404);
    const {data:{user:target},error:targetError}=await admin.auth.admin.getUserById(memberId);
    if(targetError||!target?.email)return reply({error:"Member email not found"},404);
    const appUrl=Deno.env.get("APP_URL")||"https://trip-mate-eta-weld.vercel.app";
    const redirectTo=new URL("?auth=recovery",appUrl).toString();
    const {data,error:resetError}=await admin.auth.admin.generateLink({type:"recovery",email:target.email,options:{redirectTo}});
    if(resetError)throw resetError;
    const link=data?.properties?.action_link;
    if(!link)throw new Error("Recovery link missing");
    return reply({link});
  }catch(error){
    console.error("Password reset link failed",error);
    return reply({error:"สร้างลิงก์รีเซ็ตไม่สำเร็จ กรุณาลองอีกครั้ง"},500);
  }
});
