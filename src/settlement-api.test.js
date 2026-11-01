import {it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn(async()=>({data:'settlement-id'}))}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>mock}));
it('sends the original debtor to the protected RPC and preserves legacy queued submissions',async()=>{
 vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('VITE_SUPABASE_ANON_KEY','test');
 const {submitSettlement}=await import('./supabase');
 await submitSettlement('trip','receiver',100,'trip/friend/slip.png','debtor');
 expect(mock.rpc).toHaveBeenLastCalledWith('submit_settlement_for_member',{target_trip:'trip',target_to:'receiver',target_amount:100,target_slip:'trip/friend/slip.png',target_from:'debtor'});
 await submitSettlement('trip','receiver',100,'trip/debtor/slip.png');
 expect(mock.rpc).toHaveBeenLastCalledWith('submit_settlement',{target_trip:'trip',target_to:'receiver',target_amount:100,target_slip:'trip/debtor/slip.png'});
 vi.unstubAllEnvs();
});

it('routes collection rejection with the expected slip and propagates failure without a false success',async()=>{
 vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('VITE_SUPABASE_ANON_KEY','test');
 const {rejectCollectionPayment}=await import('./supabase');
 await rejectCollectionPayment('collection','debtor','trip/friend/old.png','ยอดผิด');
 expect(mock.rpc).toHaveBeenLastCalledWith('reject_collection_payment',{target_collection:'collection',target_user:'debtor',target_slip:'trip/friend/old.png',target_reason:'ยอดผิด'});
 mock.rpc.mockResolvedValueOnce({error:new Error('permission denied')});
 await expect(rejectCollectionPayment('collection','debtor','trip/friend/old.png','ยอดผิด')).rejects.toThrow('permission denied');
 vi.unstubAllEnvs();
});
