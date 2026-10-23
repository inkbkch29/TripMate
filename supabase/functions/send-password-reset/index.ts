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
    const {tripId,memberId,password}=await req.json();
    if(typeof tripId!=="string"||typeof memberId!=="string"||typeof password!=="string"||password.length<8||password.length>72)return reply({error:"Invalid request"},400);
    const {data:owner,error:ownerError}=await admin.from("trip_members").select("user_id").eq("trip_id",tripId).eq("user_id",user.id).eq("trip_role","owner").maybeSingle();
    if(ownerError)throw ownerError;
    if(!owner)return reply({error:"Only the trip owner can set member passwords"},403);
    if(memberId===user.id)return reply({error:"Use account settings to change your own password"},400);
    const {data:member,error:memberError}=await admin.from("trip_members").select("user_id").eq("trip_id",tripId).eq("user_id",memberId).maybeSingle();
    if(memberError)throw memberError;
    if(!member)return reply({error:"Member not found"},404);
    const {error:updateError}=await admin.auth.admin.updateUserById(memberId,{password});
    if(updateError)throw updateError;
    return reply({updated:true});
  }catch(error){
    console.error("Set member password failed",error);
    return reply({error:"ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง"},500);
  }
});
