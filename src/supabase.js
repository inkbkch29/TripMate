import {expenseAttachments,receiptMetadata} from './expense-attachments';
import {packingItem} from './packing-list';
import {satang} from './trip-fund';
import {mapStop} from "./trip-mode";
import { splitAmount } from "./finance";
import { createClient } from "@supabase/supabase-js";
import { tripFilePath } from "./trip-utils";
import { compressImage } from "./image-utils";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("YOUR_PROJECT") &&
  !supabaseAnonKey.includes("YOUR_PUBLIC")
);

const createSupabaseClient=()=>createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
export const supabase = isSupabaseConfigured
  ? (globalThis.__tripmateSupabaseClient||(globalThis.__tripmateSupabaseClient=createSupabaseClient()))
  : null;

const withTimeout=(promise,ms=12000,message="การเชื่อมต่อใช้เวลานานเกินไป")=>Promise.race([
  Promise.resolve(promise),
  new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms)),
]);

export async function getMyTripContext() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, trips: [] };

  const [{ data: profile }, { data: memberships, error }] = await withTimeout(Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("trip_members")
      .select("trip_role, can_manage_fund, can_approve_expenses, can_confirm_payments, trips(*)")
      .eq("user_id", user.id),
  ]),10000,"โหลดบัญชีช้าเกินไป กรุณาลองอีกครั้ง");
  if (error) throw error;
  return {
    user,
    profile,
    trips: (memberships || []).map((row) => ({ ...row.trips, trip_role: row.trip_role,can_manage_fund:row.can_manage_fund,can_approve_expenses:row.can_approve_expenses,can_confirm_payments:row.can_confirm_payments })),
  };
}

export async function claimInvite(token) {
  const { data, error } = await supabase.rpc("request_trip_join", { invite_token: token });
  if (error) throw error;
  return data;
}

export async function getInviteStatus(token){
  const {data,error}=await supabase.rpc("get_trip_join_status",{invite_token:token});
  if(error)throw error;
  return data;
}

export async function loadGuestTrip(token){
  const {data,error}=await supabase.rpc("guest_trip_snapshot",{invite_token:token});
  if(error)throw error;
  return data;
}

export async function loadStayPoll(token){const {data,error}=await supabase.rpc("stay_poll_snapshot",{poll_token:token});if(error)throw error;return data;}
export async function castStayVote(token,voter,optionIds){const {error}=await supabase.rpc("cast_stay_vote",{poll_token:token,voter,option_ids:optionIds});if(error)throw error;return true;}
export async function createStayPoll(tripId,title,options,pollType="stay",autoClose=true){const {data,error}=await supabase.rpc("create_stay_poll",{target_trip:tripId,poll_title:title,poll_options:options});if(error)throw error;const {error:configError}=await supabase.rpc("configure_trip_poll",{poll_token:data,target_type:pollType,should_auto_close:autoClose});if(configError)throw configError;return data;}
export async function listStayPolls(tripId){const {data,error}=await supabase.rpc("list_stay_polls",{target_trip:tripId});if(error)throw error;return data||[];}
export async function listTripVoteLinks(tripId){const {data,error}=await supabase.rpc("list_trip_vote_links",{target_trip:tripId});if(error)throw error;return data||[];}
export async function updateStayPoll(token,title,status,options,pollType="stay",autoClose=true){const {error}=await supabase.rpc("update_stay_poll",{poll_token:token,poll_title:title,poll_status:status,poll_options:options});if(error)throw error;const {error:configError}=await supabase.rpc("configure_trip_poll",{poll_token:token,target_type:pollType,should_auto_close:autoClose});if(configError)throw configError;return true;}
export async function resetStayPollVotes(token){const {error}=await supabase.rpc("reset_stay_poll_votes",{poll_token:token});if(error)throw error;return true;}
export async function selectStayPollWinner(token,optionId){const {error}=await supabase.rpc("select_stay_poll_winner",{poll_token:token,option_id:optionId});if(error)throw error;return true;}

export async function createInvite(tripId, label) {
  const { data, error } = await supabase.rpc("create_trip_invite", {
    target_trip: tripId,
    invite_label: label || null,
  });
  if (error) throw error;
  return data;
}

export async function loadTripInvites(tripId) {
  const { data, error } = await supabase.from("trip_invites").select("id,label,token,expires_at,claimed_at,revoked_at,created_at,is_reusable").eq("trip_id",tripId).order("created_at",{ascending:false});
  if (error) throw error;
  return data || [];
}

export async function loadTripJoinRequests(tripId){
  const {data,error}=await supabase.rpc("list_trip_join_requests",{target_trip:tripId});
  if(error)throw error;
  return data||[];
}

export async function reviewTripJoinRequest(requestId,status){
  const {data,error}=await supabase.rpc("review_trip_join_request",{target_request:requestId,target_status:status});
  if(error)throw error;
  return data;
}

export function subscribeToJoinRequests(tripId,onChange){
  const channel=supabase.channel(`join-requests-${tripId}-${crypto.randomUUID()}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"trip_join_requests",filter:`trip_id=eq.${tripId}`},onChange)
    .subscribe();
  return()=>supabase.removeChannel(channel);
}

export async function revokeTripInvite(inviteId) {
  const { error } = await supabase.rpc("revoke_trip_invite",{target_invite:inviteId});
  if (error) throw error;
}

export async function deleteTripInvite(inviteId) {
  const { error } = await supabase.rpc("delete_trip_invite",{target_invite:inviteId});
  if (error) throw error;
}

export async function removeTripMember(tripId,userId) {
  const { error } = await supabase.rpc("remove_trip_member",{target_trip:tripId,target_user:userId});
  if (error) throw error;
}

async function signedTripFile(path) {
  if (!path) return "";
  const { data } = await supabase.storage.from("trip-files").createSignedUrl(path, 3600);
  return data?.signedUrl || "";
}

export async function loadTripData(tripId) {
  const [memberResult, stopResult, expenseResult, collectionResult, locationResult, settlementResult, checkinResult, historyResult, routeStatsResult, checklistResult, installmentResult] = await withTimeout(Promise.all([
    supabase.from("trip_members").select("trip_role, can_manage_fund, can_approve_expenses, can_confirm_payments, profiles(*)").eq("trip_id", tripId),
    supabase.from("trip_stops").select("*").eq("trip_id", tripId).order("day_number").order("sort_order"),
    supabase.from("expenses").select("*, expense_participants(user_id,share_amount)").eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("collections").select("*, collection_payments(user_id,amount,status,slip_url,submitted_by,received_amount,installment_superseded_at)").eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.rpc("trip_live_locations",{target_trip:tripId}),
    supabase.from("trip_settlements").select("*").eq("trip_id",tripId),
    supabase.from("trip_stop_checkins").select("*, trip_stops!inner(trip_id)").eq("trip_stops.trip_id",tripId),
    supabase.from("trip_location_history").select("user_id,latitude,longitude,recorded_at").eq("trip_id",tripId).order("recorded_at"),
    supabase.from("trip_route_stats").select("user_id,distance_m").eq("trip_id",tripId),
    supabase.from("trip_checklist_items").select("*").eq("trip_id",tripId).order("created_at"),
    supabase.rpc("installment_trip_snapshot",{target_trip:tripId}),
  ]),12000,"โหลดข้อมูลทริปช้าเกินไป กรุณาลองใหม่");
  const failed = [memberResult, stopResult, expenseResult, collectionResult, locationResult, settlementResult, checkinResult, installmentResult].find((result) => result.error);
  if (failed) throw failed.error;
  const filePaths=[
    ...memberResult.data.map(({profiles:p})=>p.payment_qr_path),
    ...collectionResult.data.map(c=>c.receiving_account_snapshot?.payment_qr_path),
    ...expenseResult.data.flatMap(item=>[item.receipt_path,...(item.receipt_attachments||[]).map(row=>row.path)]),
    ...collectionResult.data.flatMap((item)=>item.collection_payments.map((payment)=>payment.slip_url)),
    ...settlementResult.data.map((item)=>item.slip_path),
  ].filter(Boolean);
  const uniquePaths=[...new Set(filePaths)];
  const signedByPath={};
  if(uniquePaths.length){
    const {data:signedRows}=await withTimeout(supabase.storage.from("trip-files").createSignedUrls(uniquePaths,3600),8000,"โหลดรูปประกอบช้าเกินไป").catch(()=>({data:[]}));
    (signedRows||[]).forEach((row,index)=>{signedByPath[row.path||uniquePaths[index]]=row.signedUrl||row.signedURL||"";});
  }
  const members = memberResult.data.map(({ trip_role, can_manage_fund, can_approve_expenses, can_confirm_payments, profiles: p }, index) => {
    const paymentQr = signedByPath[p.payment_qr_path]||"";
    const roleLabels={owner:"เจ้าของทริป",planner:"ผู้ดูแลแพลน",treasurer:"สมาชิก",member:"สมาชิก"};
    return { id: p.id, name: p.display_name, avatar: p.avatar_url, promptpay: p.promptpay_id || "", bankName: p.bank_name || "", accountName: p.account_name || "", paymentQr, paymentQrPath: p.payment_qr_path || "", tripRole:trip_role,finance:{fund:can_manage_fund??trip_role==="treasurer",approve:can_approve_expenses??trip_role==="treasurer",confirm:can_confirm_payments??trip_role==="treasurer"}, role:roleLabels[trip_role]||"สมาชิก", color: ["#86c9ed","#e8cf88","#a8daf3","#ddc173","#c8eaff"][index % 5], emoji: "🙂", online: false };
  });
  return {
    members,
    stops: stopResult.data.map(mapStop),
    expenses: expenseResult.data.map((e) => {
      const receiptUrl = signedByPath[e.receipt_path]||"";
      return { id: e.id, title: e.title,isInstallmentParent:Boolean(e.is_installment_parent),installmentSource:collectionResult.data.some(c=>c.expense_id===e.id&&c.installment_id),installmentPlan:(installmentResult.data||[]).find(p=>p.expense_id===e.id)||null, amount: e.fund_only?Number(e.fund_paid_satang)/100:Number(e.amount), fundPaidSatang:Number(e.fund_paid_satang||0),fundOnly:Boolean(e.fund_only), paidBy: e.paid_by, participants: e.expense_participants.map((p) => p.user_id), shares: Object.fromEntries(e.expense_participants.map((p) => [p.user_id, Number(p.share_amount)])), category: e.category, expenseDate: e.expense_date || e.created_at?.slice(0,10), mealPeriod: e.meal_period || "other", splitMethod: e.split_method || "equal", approvalStatus: e.approval_status || "approved", receiptBreakdown:e.receipt_breakdown||null, receiptPath: e.receipt_path || "", receiptUrl, receiptAttachments:expenseAttachments({receiptPath:e.receipt_path,receiptUrl,receiptAttachments:(e.receipt_attachments||[]).map(row=>({...row,url:signedByPath[row.path]||""}))}), createdBy: e.created_by, reviewNote: e.review_note || "", revision:e.revision||1, updatedAt:e.updated_at };
    }).filter(e=>!e.fundOnly||e.amount>0),
    collections: collectionResult.data.map((c) => ({ id: c.id, createdBy:c.created_by, title: c.title,installmentId:c.installment_id||null,installmentBillSatang:c.installment_bill_satang==null?null:Number(c.installment_bill_satang),installmentFundPaidSatang:Number((installmentResult.data||[]).flatMap(p=>p.receipts).find(p=>p.collection_id===c.id)?.fund_paid_satang||0), createdAt:c.created_at, expenseId:c.expense_id||null, fundShares:c.fund_shares||null, amount: Number(c.amount), originalAmount:Number(c.original_amount??c.amount), fundRemainder:Number(c.fund_remainder||0), isFund:Boolean(c.is_fund),fundAccountLabel:c.fund_account_label||"",collectionType:c.collection_type,collectionOnly:Boolean(c.collection_only),receivingAccount:c.receiving_account_snapshot?{...c.receiving_account_snapshot,paymentQr:signedByPath[c.receiving_account_snapshot.payment_qr_path]||""}:null, perPerson: c.collection_payments.length ? Number(c.collection_payments[0].amount) : 0, receiver: c.receiver_id, due: c.due_date, participants: c.collection_payments.map((p) => p.user_id), paid: c.collection_payments.filter((p) => p.status === "paid").map((p) => p.user_id), payments: Object.fromEntries(c.collection_payments.map((p) => [p.user_id, { status: p.status,superseded:Boolean(p.installment_superseded_at),cashReceivedSatang:(installmentResult.data||[]).flatMap(plan=>plan.receipts).find(row=>row.collection_id===c.id&&row.user_id===p.user_id)?.cash_satang??null, amount:Number(p.amount), receivedAmount:p.received_amount==null?null:Number(p.received_amount), submittedBy:p.submitted_by||p.user_id, slipPath: p.slip_url || "", slipUrl:signedByPath[p.slip_url]||"" }])) })),
    locations: locationResult.data,
    settlements: settlementResult.data.map((s)=>({id:s.id,from:s.from_user,to:s.to_user,amount:Number(s.amount),status:s.status,slipPath:s.slip_path||"",slipUrl:signedByPath[s.slip_path]||"",submittedAt:s.submitted_at})),
    checkins: checkinResult.data.map((item)=>({stopId:item.stop_id,userId:item.user_id,checkedInAt:item.checked_in_at})),
    locationHistory: historyResult.error ? [] : (historyResult.data || []),
    routeDistance: routeStatsResult.error ? 0 : (routeStatsResult.data || []).reduce((sum,item)=>sum+Number(item.distance_m||0),0),
    checklist: checklistResult.error ? [] : (checklistResult.data||[]).map(packingItem),
  };
}

export async function loadChecklistItems(tripId){const {data,error}=await supabase.from('trip_checklist_items').select('*').eq('trip_id',tripId).order('created_at');if(error)throw error;return (data||[]).map(packingItem);}
export async function manageChecklistItem(tripId,item,operation,payload={}){const {data,error}=await supabase.rpc('manage_trip_packing',{target_trip:tripId,target_item:item.id,operation,payload,expected_revision:item.revision??null});if(error)throw error;return data.deleted?data:packingItem(data);}
export async function createChecklistItem(tripId,userId,item){return manageChecklistItem(tripId,item,'create',item);}
export async function toggleChecklistItem(tripId,item,done){return manageChecklistItem(tripId,item,'toggle',{done});}
export async function deleteChecklistItem(tripId,item){return manageChecklistItem(tripId,item,'delete');}
export async function trackEvent(eventName,tripId=null,surface=null){const {data:{user}}=await supabase.auth.getUser();if(!user)return;await supabase.from("product_analytics").insert({user_id:user.id,trip_id:tripId,event_name:eventName,surface});}

export async function saveLiveLocation(tripId,userId,coords) {
  const {error}=await supabase.from("live_locations").upsert({trip_id:tripId,user_id:userId,latitude:coords.latitude,longitude:coords.longitude,accuracy_m:coords.accuracy,sharing_enabled:true,updated_at:new Date().toISOString()});
  if(error) throw error;
}

export async function savePushSubscription(subscription){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("กรุณาเข้าสู่ระบบก่อนเปิดการแจ้งเตือน");
  const json=subscription.toJSON();
  const {error}=await supabase.from("push_subscriptions").upsert({
    user_id:user.id,
    endpoint:json.endpoint,
    p256dh:json.keys?.p256dh,
    auth:json.keys?.auth,
    user_agent:navigator.userAgent,
    updated_at:new Date().toISOString(),
  },{onConflict:"endpoint"});
  if(error)throw error;
}

export async function loadNotifications(limit=100){const {data,error}=await supabase.from("user_notifications").select("*").order("created_at",{ascending:false}).limit(limit);if(error)throw error;return data||[];}
export async function markNotificationRead(id){const {error}=await supabase.from("user_notifications").update({read_at:new Date().toISOString()}).eq("id",id);if(error)throw error;}
export async function markAllNotificationsRead(){const {error}=await supabase.from("user_notifications").update({read_at:new Date().toISOString()}).is("read_at",null);if(error)throw error;}
export async function loadNotificationPreferences(){const {data,error}=await supabase.from("notification_preferences").select("type,enabled");if(error)throw error;return Object.fromEntries((data||[]).map(row=>[row.type,row.enabled]));}
export async function saveNotificationPreference(userId,type,enabled){const {error}=await supabase.from("notification_preferences").upsert({user_id:userId,type,enabled,updated_at:new Date().toISOString()});if(error)throw error;}
export function subscribeToNotifications(userId,onChange){const channel=supabase.channel(`notifications-${userId}-${crypto.randomUUID()}`).on("postgres_changes",{event:"*",schema:"public",table:"user_notifications",filter:`recipient_id=eq.${userId}`},onChange).subscribe();return()=>supabase.removeChannel(channel);}

export async function loadLocationConsent(tripId,userId){const {data,error}=await supabase.from("location_consents").select("*").eq("trip_id",tripId).eq("user_id",userId).maybeSingle();if(error)throw error;return data;}
export async function saveLocationConsent(tripId,userId,autoStopAt){const {data,error}=await supabase.from("location_consents").upsert({trip_id:tripId,user_id:userId,policy_version:"2026-09-21",consented_at:new Date().toISOString(),revoked_at:null,auto_stop_at:autoStopAt||null}).select().single();if(error)throw error;return data;}
export async function revokeLocationConsent(tripId,userId){const {error}=await supabase.from("location_consents").update({revoked_at:new Date().toISOString(),auto_stop_at:null}).eq("trip_id",tripId).eq("user_id",userId);if(error)throw error;}

export async function sendLocationPush(tripId,eventType,distance=0){
  const {error}=await supabase.functions.invoke("send-location-push",{body:{tripId,eventType,distanceMeters:distance}});
  if(error)throw error;
}

export async function sendActivityPush(activityId){
  const {error}=await supabase.functions.invoke("send-activity-push",{body:{activityId}});
  if(error)throw error;
}

export async function stopLiveLocation(tripId,userId) {
  const {error}=await supabase.from("live_locations").update({sharing_enabled:false,updated_at:new Date().toISOString()}).eq("trip_id",tripId).eq("user_id",userId);
  if(error) throw error;
}

export function subscribeToLocations(tripId,onChange) {
  const channel=supabase.channel(`trip-locations-${tripId}-${crypto.randomUUID()}`).on("postgres_changes",{event:"*",schema:"public",table:"live_locations",filter:`trip_id=eq.${tripId}`},onChange).subscribe();
  return ()=>supabase.removeChannel(channel);
}

export function subscribeToTripActivity(tripId,onChange) {
  const channel=supabase.channel(`trip-activity-${tripId}-${crypto.randomUUID()}`);
  channel
    .on("postgres_changes",{event:"*",schema:"public",table:"trip_stops",filter:`trip_id=eq.${tripId}`},(payload)=>onChange("plan",payload))
    .on("postgres_changes",{event:"*",schema:"public",table:"expenses",filter:`trip_id=eq.${tripId}`},(payload)=>onChange("expense",payload))
    .on("postgres_changes",{event:"*",schema:"public",table:"collections",filter:`trip_id=eq.${tripId}`},(payload)=>onChange("collection",payload))
    .on("postgres_changes",{event:"*",schema:"public",table:"trip_stop_checkins"},(payload)=>onChange("checkin",payload))
    .on("postgres_changes",{event:"*",schema:"public",table:"trip_checklist_items",filter:`trip_id=eq.${tripId}`},(payload)=>onChange("checklist",payload))
    .on("postgres_changes",{event:"*",schema:"public",table:"trip_members",filter:`trip_id=eq.${tripId}`},(payload)=>onChange("member",payload))
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"trip_activity_log",filter:`trip_id=eq.${tripId}`},(payload)=>onChange("activity",payload))
    .subscribe();
  // Keep payment updates independent of optional trip tables. A missing
  // publication on another table must not prevent slip status updates.
  const financeChannel=supabase.channel(`trip-payments-${tripId}-${crypto.randomUUID()}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"collection_payments"},payload=>onChange("payment",payload))
    .on("postgres_changes",{event:"*",schema:"public",table:"trip_settlements",filter:`trip_id=eq.${tripId}`},payload=>onChange("settlement",payload))
    .subscribe();
  return ()=>{supabase.removeChannel(channel);supabase.removeChannel(financeChannel);};
}

export function subscribeToProfiles(onChange){
  const channel=supabase.channel(`profile-updates-${crypto.randomUUID()}`)
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},onChange)
    .subscribe();
  return ()=>supabase.removeChannel(channel);
}

export async function cleanupTripLocations(tripId){
  const {error}=await supabase.rpc("cleanup_trip_locations",{target_trip:tripId});
  if(error&&error.code!=="42883")throw error;
}

export async function loadLiveLocations(tripId){
  const {data,error}=await supabase.rpc("trip_live_locations",{target_trip:tripId});
  if(error)throw error;
  return data||[];
}

export async function saveStop(tripId, userId, stop) {
  const row={ id: stop.id, trip_id: tripId, day_number: stop.day, start_time: stop.time || null, title: stop.title, place_name: stop.place, latitude:stop.latitude??null, longitude:stop.longitude??null, google_maps_url:stop.googleMapsUrl||null, note: stop.note || null, is_done: stop.done, sort_order: stop.sortOrder ?? stop.day * 1000, created_by: userId };
  if(stop.price!==undefined)row.price=stop.price===""?null:stop.price;if(stop.links!==undefined)row.links=stop.links;if(stop.images!==undefined)row.images=stop.images;
  const query=stop.revision
    ?supabase.from("trip_stops").update(row).eq("id",stop.id).eq("trip_id",tripId).eq("revision",stop.revision).select("revision,updated_at").maybeSingle()
    :supabase.from("trip_stops").insert(row).select("revision,updated_at").single();
  const {data,error}=await query;if(error)throw error;
  if(!data){const conflict=new Error("แพลนนี้ถูกแก้จากอีกเครื่องแล้ว กรุณาโหลดข้อมูลล่าสุด");conflict.code="TRIPMATE_CONFLICT";throw conflict;}
  return {...stop,revision:data.revision,updatedAt:data.updated_at};
}

export async function deleteStop(tripId,stopId){
  const {error}=await supabase.rpc("delete_trip_item",{target_trip:tripId,target_type:"stop",target_id:stopId});
  if(error)throw error;
}

export async function toggleTripStopDone(stopId,done){
  const {error}=await supabase.rpc("toggle_trip_stop_done",{target_stop:stopId,target_done:done});
  if(error)throw error;
}

export async function reorderTripStops(tripId,orderedStops){
  const rows=orderedStops.map((item,index)=>typeof item==="string"?{id:item,time:null,sortOrder:index}:{...item,sortOrder:index});
  const results=await Promise.all(rows.map((item)=>supabase.from("trip_stops").update({sort_order:item.sortOrder,start_time:item.time||null}).eq("trip_id",tripId).eq("id",item.id)));
  const failed=results.find((result)=>result.error);
  if(failed)throw failed.error;
}

export async function saveExpense(tripId, userId, expense) {
  const row={ id: expense.id, trip_id: tripId, title: expense.title, amount: Math.round(Number(expense.amount)*100)/100, paid_by: expense.paidBy, category: expense.category, expense_date: expense.expenseDate, meal_period: expense.category === "อาหาร" ? expense.mealPeriod || "other" : "other", created_by: expense.createdBy || userId, split_method: expense.splitMethod || "equal", approval_status: expense.approvalStatus || "pending", receipt_path: expenseAttachments(expense)[0]?.path || null, receipt_attachments:receiptMetadata(expenseAttachments(expense)), receipt_breakdown: expense.receiptBreakdown || null };
  const fallback=Object.fromEntries(splitAmount(expense.amount,expense.participants).map(share=>[share.userId,share.amount]));
  const shares=expense.participants.map(id=>Math.round(Number(expense.shares?.[id]??fallback[id])*100)/100);
  const {data,error}=await supabase.rpc("save_expense_with_shares",{payload:row,participant_ids:expense.participants,share_amounts:shares,expected_revision:expense.revision||null});
  if(error)throw error;
  if(!data){const conflict=new Error("รายจ่ายนี้ถูกแก้จากอีกเครื่องแล้ว กรุณาโหลดข้อมูลล่าสุด");conflict.code="TRIPMATE_CONFLICT";throw conflict;}
  return {...expense,revision:data.revision,updatedAt:data.updated_at};
}

export async function reviewExpense(expenseId, status, note = "") {
  const { error } = await supabase.rpc("review_expense", { target_expense: expenseId, target_status: status, review_comment: note || null });
  if (error) throw error;
}

export async function uploadTripFile(tripId, userId, kind, file) {
  if (!file) return { path: "", signedUrl: "" };
  const allowedTypes={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"};
  if(!allowedTypes[file.type])throw new Error("รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF");
  if(kind==="payment-qr"&&file.type==="application/pdf")throw new Error("QR รับเงินต้องเป็นไฟล์รูปภาพ");
  if (file.size > 15 * 1024 * 1024) throw new Error("ไฟล์ต้นฉบับต้องมีขนาดไม่เกิน 15 MB");
  const uploadFile=file.type==="application/pdf"?file:await compressImage(file,{maxWidth:kind==="payment-qr"?1800:1600,maxHeight:kind==="payment-qr"?1800:1600,quality:kind==="payment-qr"?.9:.84});
  const extension = allowedTypes[uploadFile.type];
  const path = tripFilePath(tripId,userId,kind,extension);
  const { error } = await supabase.storage.from("trip-files").upload(path, uploadFile, { upsert: false,contentType:uploadFile.type });
  if (error) throw error;
  const { data } = await supabase.storage.from("trip-files").createSignedUrl(path, 3600);
  const {data:trip}=await supabase.from("trips").select("end_date").eq("id",tripId).maybeSingle();
  const retentionBase=trip?.end_date?new Date(`${trip.end_date}T23:59:59`):new Date();retentionBase.setDate(retentionBase.getDate()+90);
  await supabase.from("trip_file_retention").upsert({path,trip_id:tripId,kind,created_by:userId,retain_until:retentionBase.toISOString()});
  return { path, signedUrl: data?.signedUrl || "" };
}

export async function deleteTripFile(path) {
  if (!path) return;
  const { error }=await supabase.storage.from("trip-files").remove([path]);
  if (error) throw error;
  await supabase.from("trip_file_retention").delete().eq("path",path);
}

export async function deleteExpense(tripId,expenseId) {
  if(!expenseId){expenseId=tripId;const {data,error:lookupError}=await supabase.from("expenses").select("trip_id").eq("id",expenseId).single();if(lookupError)throw lookupError;tripId=data.trip_id;}
  const { error }=await supabase.rpc("delete_trip_item",{target_trip:tripId,target_type:"expense",target_id:expenseId});
  if (error) throw error;
}

export async function deleteCollection(tripId,collectionId) {
  if(!collectionId){collectionId=tripId;const {data,error:lookupError}=await supabase.from("collections").select("trip_id").eq("id",collectionId).single();if(lookupError)throw lookupError;tripId=data.trip_id;}
  const { error }=await supabase.rpc("delete_trip_item",{target_trip:tripId,target_type:"collection",target_id:collectionId});
  if (error) throw error;
}

export async function loadTripActivity(tripId){const {data,error}=await supabase.from("trip_activity_log").select("*").eq("trip_id",tripId).order("created_at",{ascending:false}).limit(100);if(error)throw error;return data||[];}
export async function loadTripTrash(tripId){const {data,error}=await supabase.from("trip_trash").select("id,item_type,item_id,label,deleted_at,expires_at").eq("trip_id",tripId).gt("expires_at",new Date().toISOString()).order("deleted_at",{ascending:false});if(error)throw error;return data||[];}
export async function restoreTripItem(trashId){const {error}=await supabase.rpc("restore_trip_item",{target_trash:trashId});if(error)throw error;return true;}

export async function uploadTripCover(tripId,file) {
  if (!file) return "";
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("ภาพปกรองรับ JPG, PNG หรือ WebP");
  if (file.size>15*1024*1024) throw new Error("ภาพปกต้นฉบับต้องมีขนาดไม่เกิน 15 MB");
  const uploadFile=await compressImage(file,{maxWidth:1800,maxHeight:1100,quality:.84});
  const extension=uploadFile.type==="image/webp"?"webp":"jpg";
  const path=`${tripId}/cover-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error }=await supabase.storage.from("trip-covers").upload(path,uploadFile,{upsert:false,cacheControl:"3600",contentType:uploadFile.type});
  if (error) throw error;
  return supabase.storage.from("trip-covers").getPublicUrl(path).data.publicUrl;
}

export async function saveTripSettings(tripId, settings) {
  const { data, error } = await supabase.from("trips").update(settings).eq("id", tripId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTrip(tripId) {
  const { error }=await supabase.from("trips").delete().eq("id",tripId);
  if (error) throw error;
}

export async function deleteTripStorage(tripId) {
  const removeFolder=async(bucket,folder)=>{
    const {data,error}=await supabase.storage.from(bucket).list(folder,{limit:1000});
    if(error)throw error;
    const directFiles=(data||[]).filter((item)=>item.id).map((item)=>`${folder}/${item.name}`);
    const folders=(data||[]).filter((item)=>!item.id);
    for(const child of folders)await removeFolder(bucket,`${folder}/${child.name}`);
    if(directFiles.length){const {error:removeError}=await supabase.storage.from(bucket).remove(directFiles);if(removeError)throw removeError;}
  };
  await removeFolder("trip-files",tripId).catch(()=>{});
  await removeFolder("trip-covers",tripId).catch(()=>{});
}

export async function saveCollection(tripId, userId, collection) {
  if(collection.collectionOnly){
    const {error}=await supabase.rpc('save_collection_request',{target_trip:tripId,target_id:collection.id,payload:{title:collection.title,receiver_id:collection.receiver,due:collection.due||null,amounts:Object.fromEntries(collection.participants.map(id=>[id,satang(collection.requestAmounts?.[id]??collection.payments?.[id]?.amount??collection.perPerson)]))}});
    if(error)throw error;return;
  }
  if(collection.isFund){
    const amounts=Object.fromEntries(collection.participants.map(id=>[id,satang(collection.contributionAmounts?.[id]??collection.payments?.[id]?.amount??collection.perPerson)]));
    const {error}=await supabase.rpc('trip_fund_action',{target_trip:tripId,action:'contribution',request_id:collection.requestId||collection.id,payload:{collection_id:collection.id,title:collection.title,custodian_id:collection.receiver,date:collection.due||null,amounts}});
    if(error)throw error;return;
  }

  const { error } = await supabase.from("collections").upsert({ id: collection.id, trip_id: tripId, title: collection.title, amount: collection.amount, original_amount:collection.originalAmount??collection.amount, fund_remainder:collection.fundRemainder||0, is_fund:Boolean(collection.isFund), receiver_id: collection.receiver, due_date: collection.due, created_by: userId });
  if (error) throw error;
  const { error: paymentError } = await supabase.rpc("replace_collection_payments",{target_collection:collection.id,target_users:collection.participants,target_amount:collection.perPerson,target_paid:collection.paid||[]});
  if (paymentError) throw paymentError;
}

export async function confirmCollectionPayment(collectionId, memberId, receivedAmount) {
  const {error}=await supabase.rpc("confirm_collection_received",{target_collection:collectionId,target_user:memberId,actual_amount:receivedAmount});
  if(error)throw error;
}

export async function submitCollectionPayment(collectionId,userId,slipPath,paidForUserId=userId){
  const {error}=await supabase.rpc("submit_collection_payment",{target_collection:collectionId,target_slip:slipPath,target_user:paidForUserId});
  if(error)throw error;
}

export async function submitSettlement(tripId,toUser,amount,slipPath){
  const {data,error}=await supabase.rpc("submit_settlement",{target_trip:tripId,target_to:toUser,target_amount:amount,target_slip:slipPath||null});
  if(error)throw error;
  return data;
}

export async function reviewSettlement(settlementId,status){
  const {error}=await supabase.rpc("review_settlement",{target_id:settlementId,target_status:status});
  if(error)throw error;
}

export async function updateTripMemberRole(tripId,userId,role,finance={},requestId=crypto.randomUUID()){
  const {error}=await supabase.rpc("set_trip_member_access",{target_trip:tripId,target_user:userId,target_role:role,finance,request_id:requestId});if(error)throw error;
}
export async function transferTripOwnership(tripId,userId,confirmation,requestId=crypto.randomUUID()){
  const {error}=await supabase.rpc("transfer_trip_ownership",{target_trip:tripId,target_user:userId,confirmation,request_id:requestId});if(error)throw error;
}

export async function setStopCheckin(stopId,userId,checkedIn){
  const query=supabase.from("trip_stop_checkins");
  const {error}=checkedIn?await query.upsert({stop_id:stopId,user_id:userId,checked_in_at:new Date().toISOString()}):await query.delete().eq("stop_id",stopId).eq("user_id",userId);
  if(error)throw error;
}
