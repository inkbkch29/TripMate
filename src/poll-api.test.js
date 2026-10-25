import {it,expect,vi,beforeEach} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn(),upload:vi.fn(),remove:vi.fn(),createSignedUrls:vi.fn(),compressImage:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{rpc:mock.rpc,storage:{from:()=>({upload:mock.upload,remove:mock.remove,createSignedUrls:mock.createSignedUrls})}}}));
vi.mock('./image-utils',()=>({compressImage:mock.compressImage}));
import {pollApi} from './poll-api';
beforeEach(()=>{Object.values(mock).forEach(fn=>fn.mockReset());mock.upload.mockResolvedValue({});mock.remove.mockResolvedValue({});mock.rpc.mockResolvedValue({data:'token'});mock.compressImage.mockImplementation(async()=>new File(['compressed'],'photo.webp',{type:'image/webp'}));});
it('uploads optimized photos and normalizes price/links before the atomic poll save',async()=>{
 await pollApi.save('trip','user',{title:'ทดสอบ',status:'open',settings:{},options:[{name:'A',images:[new File(['image'],'input.jpg',{type:'image/jpeg'})],price:'',linkText:'vt.tiktok.com/review'}]});
 expect(mock.compressImage).toHaveBeenCalledWith(expect.any(File),{maxWidth:1400,maxHeight:1400,quality:.82});
 expect(mock.upload.mock.calls[0][0]).toMatch(/^trip\/user\/poll-photo-/);
 const args=mock.rpc.mock.calls[0][1];expect(args.poll_options[0]).toMatchObject({price:null,links:['https://vt.tiktok.com/review']});expect(args.poll_options[0].images[0]).not.toBeInstanceOf(File);
});
it('removes only newly uploaded photos when saving fails',async()=>{
 mock.rpc.mockResolvedValue({error:new Error('conflict')});await expect(pollApi.save('trip','user',{options:[{name:'A',images:['existing',new File(['x'],'x.jpg',{type:'image/jpeg'})]}]})).rejects.toThrow('conflict');expect(mock.remove).toHaveBeenCalledWith([mock.upload.mock.calls[0][0]]);
});
it('renews legacy signed URLs, preserves public legacy images and safely skips malformed image URLs',async()=>{
 mock.rpc.mockResolvedValue({data:{options:[{id:'a',image_url:'https://project.supabase.co/storage/v1/object/sign/trip-files/trip/user/old.jpg?token=expired\\nhttps://example.com/public.jpg',images:['javascript:alert(1)']}]}});mock.createSignedUrls.mockResolvedValue({data:[{path:'trip/user/old.jpg',signedUrl:'https://project.supabase.co/fresh.jpg'}]});
 const data=await pollApi.snapshot('t');expect(mock.createSignedUrls).toHaveBeenCalledWith(['trip/user/old.jpg'],3600);expect(data.options[0].media.map(m=>m.url)).toEqual(['','https://project.supabase.co/fresh.jpg','https://example.com/public.jpg']);
});
it('passes ballot choices and option revisions to the protected RPCs',async()=>{
 await pollApi.vote('t',['a','b']);expect(mock.rpc).toHaveBeenLastCalledWith('trip_poll_vote',{poll_token:'t',option_ids:['a','b']});await pollApi.option({token:'t',trip_id:'trip',revision:5},'user',{id:'a',name:'A'});expect(mock.rpc.mock.calls[1][1].option_data.expected_revision).toBe(5);
});
it('adds a source option in one atomic RPC and maps the persisted stop metadata',async()=>{
 mock.rpc.mockResolvedValue({data:{already_exists:false,stop:{id:'stop',trip_id:'trip',day_number:2,start_time:'10:30:00',title:'เข้าที่พัก',source_poll_id:'p',source_poll_option_id:'o',source_poll_token:'t',price:1200,images:['image'],links:['https://example.com']}}});
 const result=await pollApi.addToPlan({token:'t',round:1},{id:'o'},{day:2,time:'10:30'},true,'request');expect(mock.rpc).toHaveBeenCalledWith('poll_option_to_plan',{poll_token:'t',source_option:'o',plan_data:{day:2,time:'10:30',round:1},allow_another_day:true,request_key:'request'});expect(result.stop).toMatchObject({id:'stop',tripId:'trip',day:2,time:'10:30',sourcePollId:'p',sourcePollOptionId:'o',images:['image'],price:1200});
});
