import {pollPriceData} from './poll-price';
import {mapStop} from './trip-mode';
import {supabase} from './supabase';
import {compressImage} from './image-utils';
import {tripFilePath} from './trip-utils';
import {pollImageSources,pollLinks,normalizePollLink} from './poll-utils';
async function rpc(name,args){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data;}
function storagePath(source){if(!source.startsWith('https://'))return /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(source)?source:null;try{const u=new URL(source),prefix='/storage/v1/object/sign/trip-files/';return u.pathname.includes(prefix)?decodeURIComponent(u.pathname.split(prefix)[1]):null;}catch{return null;}}
function safeImage(value){try{return normalizePollLink(value)?.url||'';}catch{return '';}}
async function hydrate(poll){
 const paths=[...new Set((poll.options||[]).flatMap(pollImageSources).map(storagePath).filter(Boolean))],signed=new Map();
 if(paths.length){const {data}=await supabase.storage.from('trip-files').createSignedUrls(paths,3600);(data||[]).forEach(row=>signed.set(row.path,row.signedUrl||''));}
 return {...poll,options:(poll.options||[]).map(option=>({...option,media:pollImageSources(option).map(source=>({source,url:storagePath(source)?signed.get(storagePath(source))||'':safeImage(source)}))}))};
}
async function uploadPhoto(tripId,userId,file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024||!file.size)throw new Error('เลือกรูป JPG, PNG หรือ WebP ไม่เกิน 15 MB');
 const photo=await compressImage(file,{maxWidth:1400,maxHeight:1400,quality:.82}),path=tripFilePath(tripId,userId,'poll-photo',photo.type==='image/webp'?'webp':'jpg');
 const {error}=await supabase.storage.from('trip-files').upload(path,photo,{upsert:false,contentType:photo.type});if(error)throw error;return path;
}
async function prepareOptions(options,tripId,userId,uploaded){
 const result=[];for(const option of options){const pricing=pollPriceData(option);const images=[];for(const image of option.images||[]){if(image instanceof File){const path=await uploadPhoto(tripId,userId,image);uploaded.push(path);images.push(path);}else images.push(image);}
 result.push({...option,id:option.id||null,images,links:Array.isArray(option.links)?option.links:pollLinks(option.linkText),...pricing});}return result;
}
async function withPhotos(options,tripId,userId,save){const uploaded=[];try{return await save(await prepareOptions(options,tripId,userId,uploaded));}catch(error){if(uploaded.length)await supabase.storage.from('trip-files').remove(uploaded).catch(()=>{});throw error;}}
export const pollApi={
 async addToPlan(poll,option,form,allowAnotherDay,requestId){const result=await rpc('poll_option_to_plan',{poll_token:poll.token,source_option:option.id,plan_data:{...form,round:poll.round},allow_another_day:allowAnotherDay,request_key:requestId});return {...result,stop:mapStop(result.stop)};},
 async stopMedia(stop){return (await hydrate({options:[{images:stop.images||[],image_url:stop.sourceSnapshot?.image_url}]})).options[0].media;},
 async list(tripId){return await rpc('trip_poll_list',{target_trip:tripId})||[];},
 async snapshot(token,round=null){return hydrate(await rpc('trip_poll_snapshot',{poll_token:token,requested_round:round}));},
 async save(tripId,userId,draft){return withPhotos(draft.options,tripId,userId,options=>rpc('trip_poll_save',{target_trip:tripId,poll_token:draft.token||null,poll_title:draft.title,poll_settings:draft.settings,poll_options:options,target_status:draft.status,expected_revision:draft.revision??null}));},
 async option(poll,userId,option,remove=false){return withPhotos([option],poll.trip_id,userId,options=>rpc('trip_poll_option_save',{poll_token:poll.token,option_data:{...options[0],expected_revision:poll.revision},remove_option:remove}));},
 vote:(token,ids)=>rpc('trip_poll_vote',{poll_token:token,option_ids:ids}),
 action:(token,action)=>rpc('trip_poll_action',{poll_token:token,poll_action:action}),
 async user(){const {data,error}=await supabase.auth.getSession();if(error)throw error;return data.session?.user||null;}
};
