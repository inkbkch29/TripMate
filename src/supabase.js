import { createClient } from "@supabase/supabase-js";
import { tripFilePath } from "./trip-utils";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("YOUR_PROJECT") &&
  !supabaseAnonKey.includes("YOUR_PUBLIC")
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export async function getMyTripContext() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, trips: [] };

  const [{ data: profile }, { data: memberships, error }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("trip_members")
      .select("trip_role, trips(*)")
      .eq("user_id", user.id),
  ]);
  if (error) throw error;
  return {
    user,
    profile,
    trips: (memberships || []).map((row) => ({ ...row.trips, trip_role: row.trip_role })),
  };
}

export async function claimInvite(token) {
  const { data, error } = await supabase.rpc("claim_trip_invite", { invite_token: token });
  if (error) throw error;
  return data;
}

export async function createInvite(tripId, label) {
  const { data, error } = await supabase.rpc("create_trip_invite", {
    target_trip: tripId,
    invite_label: label || null,
  });
  if (error) throw error;
  return data;
}

export async function loadTripInvites(tripId) {
  const { data, error } = await supabase.from("trip_invites").select("id,label,token,expires_at,claimed_at,revoked_at,created_at").eq("trip_id",tripId).order("created_at",{ascending:false});
  if (error) throw error;
  return data || [];
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
  const [memberResult, stopResult, expenseResult, collectionResult, locationResult, settlementResult, checkinResult] = await Promise.all([
    supabase.from("trip_members").select("trip_role, profiles(*)").eq("trip_id", tripId),
    supabase.from("trip_stops").select("*").eq("trip_id", tripId).order("day_number").order("sort_order"),
    supabase.from("expenses").select("*, expense_participants(user_id,share_amount)").eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("collections").select("*, collection_payments(user_id,amount,status,slip_url)").eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("live_locations").select("*").eq("trip_id",tripId).eq("sharing_enabled",true),
    supabase.from("trip_settlements").select("*").eq("trip_id",tripId),
    supabase.from("trip_stop_checkins").select("*, trip_stops!inner(trip_id)").eq("trip_stops.trip_id",tripId),
  ]);
  const failed = [memberResult, stopResult, expenseResult, collectionResult, locationResult, settlementResult, checkinResult].find((result) => result.error);
  if (failed) throw failed.error;
  const members = await Promise.all(memberResult.data.map(async ({ trip_role, profiles: p }, index) => {
    let paymentQr = "";
    if (p.payment_qr_path) {
      const { data } = await supabase.storage.from("trip-files").createSignedUrl(p.payment_qr_path, 3600);
      paymentQr = data?.signedUrl || "";
    }
    const roleLabels={owner:"เจ้าของทริป",planner:"ผู้ดูแลแพลน",treasurer:"เหรัญญิก",member:"สมาชิก"};
    return { id: p.id, name: p.display_name, avatar: p.avatar_url, promptpay: p.promptpay_id || "", bankName: p.bank_name || "", accountName: p.account_name || "", paymentQr, paymentQrPath: p.payment_qr_path || "", tripRole:trip_role, role:roleLabels[trip_role]||"สมาชิก", color: ["#86c9ed","#e8cf88","#a8daf3","#ddc173","#c8eaff"][index % 5], emoji: "🙂", online: false };
  }));
  return {
    members,
    stops: stopResult.data.map((s) => ({ id: s.id, day: s.day_number, time: s.start_time?.slice(0,5) || "", title: s.title, place: s.place_name, note: s.note || "", latitude:s.latitude, longitude:s.longitude, googleMapsUrl:s.google_maps_url||"", sortOrder:s.sort_order, done: s.is_done })),
    expenses: await Promise.all(expenseResult.data.map(async (e) => {
      let receiptUrl = "";
      if (e.receipt_path) {
        const { data } = await supabase.storage.from("trip-files").createSignedUrl(e.receipt_path, 3600);
        receiptUrl = data?.signedUrl || "";
      }
      return { id: e.id, title: e.title, amount: Number(e.amount), paidBy: e.paid_by, participants: e.expense_participants.map((p) => p.user_id), shares: Object.fromEntries(e.expense_participants.map((p) => [p.user_id, Number(p.share_amount)])), category: e.category, expenseDate: e.expense_date || e.created_at?.slice(0,10), mealPeriod: e.meal_period || "other", splitMethod: e.split_method || "equal", approvalStatus: e.approval_status || "approved", receiptPath: e.receipt_path || "", receiptUrl, createdBy: e.created_by, reviewNote: e.review_note || "" };
    })),
    collections: await Promise.all(collectionResult.data.map(async(c) => ({ id: c.id, title: c.title, amount: Number(c.amount), perPerson: c.collection_payments.length ? Number(c.collection_payments[0].amount) : 0, receiver: c.receiver_id, due: c.due_date, participants: c.collection_payments.map((p) => p.user_id), paid: c.collection_payments.filter((p) => p.status === "paid").map((p) => p.user_id), payments: Object.fromEntries(await Promise.all(c.collection_payments.map(async(p) => [p.user_id, { status: p.status, slipPath: p.slip_url || "", slipUrl:await signedTripFile(p.slip_url) }]))) }))),
    locations: locationResult.data,
    settlements: await Promise.all(settlementResult.data.map(async(s)=>({id:s.id,from:s.from_user,to:s.to_user,amount:Number(s.amount),status:s.status,slipPath:s.slip_path||"",slipUrl:await signedTripFile(s.slip_path),submittedAt:s.submitted_at}))),
    checkins: checkinResult.data.map((item)=>({stopId:item.stop_id,userId:item.user_id,checkedInAt:item.checked_in_at})),
  };
}

export async function saveLiveLocation(tripId,userId,coords) {
  const {error}=await supabase.from("live_locations").upsert({trip_id:tripId,user_id:userId,latitude:coords.latitude,longitude:coords.longitude,accuracy_m:coords.accuracy,sharing_enabled:true,updated_at:new Date().toISOString()});
  if(error) throw error;
}

export async function stopLiveLocation(tripId,userId) {
  const {error}=await supabase.from("live_locations").update({sharing_enabled:false,updated_at:new Date().toISOString()}).eq("trip_id",tripId).eq("user_id",userId);
  if(error) throw error;
}

export function subscribeToLocations(tripId,onChange) {
  const channel=supabase.channel(`trip-locations-${tripId}`).on("postgres_changes",{event:"*",schema:"public",table:"live_locations",filter:`trip_id=eq.${tripId}`},onChange).subscribe();
  return ()=>supabase.removeChannel(channel);
}

export async function saveStop(tripId, userId, stop) {
  const { error } = await supabase.from("trip_stops").upsert({ id: stop.id, trip_id: tripId, day_number: stop.day, start_time: stop.time || null, title: stop.title, place_name: stop.place, latitude:stop.latitude||null, longitude:stop.longitude||null, google_maps_url:stop.googleMapsUrl||null, note: stop.note || null, is_done: stop.done, sort_order: stop.sortOrder ?? stop.day * 1000, created_by: userId });
  if (error) throw error;
}

export async function deleteStop(tripId,stopId){
  const {error}=await supabase.from("trip_stops").delete().eq("trip_id",tripId).eq("id",stopId);
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
  const { error } = await supabase.from("expenses").upsert({ id: expense.id, trip_id: tripId, title: expense.title, amount: expense.amount, paid_by: expense.paidBy, category: expense.category, expense_date: expense.expenseDate, meal_period: expense.category === "อาหาร" ? expense.mealPeriod || "other" : "other", created_by: expense.createdBy || userId, split_method: expense.splitMethod || "equal", approval_status: expense.approvalStatus || "pending", receipt_path: expense.receiptPath || null });
  if (error) throw error;
  const equalShare = Number(expense.amount) / expense.participants.length;
  const shares=expense.participants.map((id)=>Number(expense.shares?.[id]??equalShare));
  const { error: shareError } = await supabase.rpc("replace_expense_participants",{target_expense:expense.id,target_users:expense.participants,target_shares:shares});
  if (shareError) throw shareError;
}

export async function reviewExpense(expenseId, status, note = "") {
  const { error } = await supabase.rpc("review_expense", { target_expense: expenseId, target_status: status, review_comment: note || null });
  if (error) throw error;
}

export async function uploadTripFile(tripId, userId, kind, file) {
  if (!file) return { path: "", signedUrl: "" };
  if (file.size > 5 * 1024 * 1024) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = tripFilePath(tripId,userId,kind,extension);
  const { error } = await supabase.storage.from("trip-files").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = await supabase.storage.from("trip-files").createSignedUrl(path, 3600);
  return { path, signedUrl: data?.signedUrl || "" };
}

export async function deleteTripFile(path) {
  if (!path) return;
  const { error }=await supabase.storage.from("trip-files").remove([path]);
  if (error) throw error;
}

export async function deleteExpense(expenseId) {
  const { error }=await supabase.from("expenses").delete().eq("id",expenseId);
  if (error) throw error;
}

export async function deleteCollection(collectionId) {
  const { error }=await supabase.from("collections").delete().eq("id",collectionId);
  if (error) throw error;
}

export async function uploadTripCover(tripId,file) {
  if (!file) return "";
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("ภาพปกรองรับ JPG, PNG หรือ WebP");
  if (file.size>5*1024*1024) throw new Error("ภาพปกต้องมีขนาดไม่เกิน 5 MB");
  const extension=file.name.split(".").pop()?.toLowerCase()||"jpg";
  const path=`${tripId}/cover-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error }=await supabase.storage.from("trip-covers").upload(path,file,{upsert:false,cacheControl:"3600"});
  if (error) throw error;
  return supabase.storage.from("trip-covers").getPublicUrl(path).data.publicUrl;
}

export async function saveTripSettings(tripId, settings) {
  const { data, error } = await supabase.from("trips").update(settings).eq("id", tripId).select().single();
  if (error) throw error;
  return data;
}

export async function saveCollection(tripId, userId, collection) {
  const { error } = await supabase.from("collections").upsert({ id: collection.id, trip_id: tripId, title: collection.title, amount: collection.amount, receiver_id: collection.receiver, due_date: collection.due, created_by: userId });
  if (error) throw error;
  const { error: paymentError } = await supabase.rpc("replace_collection_payments",{target_collection:collection.id,target_users:collection.participants,target_amount:collection.perPerson,target_paid:collection.paid||[]});
  if (paymentError) throw paymentError;
}

export async function confirmCollectionPayment(collectionId, memberId) {
  const { error } = await supabase.from("collection_payments").update({ status: "paid", confirmed_at: new Date().toISOString() }).eq("collection_id", collectionId).eq("user_id", memberId);
  if (error) throw error;
}

export async function submitCollectionPayment(collectionId,userId,slipPath){
  const {error}=await supabase.rpc("submit_collection_payment",{target_collection:collectionId,target_slip:slipPath});
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

export async function updateTripMemberRole(tripId,userId,role){
  const {error}=await supabase.from("trip_members").update({trip_role:role}).eq("trip_id",tripId).eq("user_id",userId);
  if(error)throw error;
}

export async function setStopCheckin(stopId,userId,checkedIn){
  const query=supabase.from("trip_stop_checkins");
  const {error}=checkedIn?await query.upsert({stop_id:stopId,user_id:userId,checked_in_at:new Date().toISOString()}):await query.delete().eq("stop_id",stopId).eq("user_id",userId);
  if(error)throw error;
}
