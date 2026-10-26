import {supabase} from './supabase';
export async function loadTripFund(tripId){const {data,error}=await supabase.rpc('trip_fund_snapshot',{target_trip:tripId});if(error)throw error;return data;}
export async function mutateTripFund(tripId,action,payload,requestId){const {data,error}=await supabase.rpc('trip_fund_action',{target_trip:tripId,action,payload,request_id:requestId});if(error)throw error;return data;}
export function subscribeTripFund(tripId,onChange){const channel=supabase.channel(`fund-${tripId}-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'trip_fund_transactions',filter:`trip_id=eq.${tripId}`},onChange).subscribe();return()=>supabase.removeChannel(channel);}
