import {it,expect} from 'vitest';
import {tripModeState,locationState,visibleLocations,locationLabel,mapStop} from './trip-mode';
import {pollPlanPrefill,planPayload} from './poll-plan';
const trip={start_date:'2026-10-25',end_date:'2026-10-27'},stops=[{id:'a',day:1,time:'08:00',done:false},{id:'b',day:1,time:'14:00',done:false},{id:'c',day:2,time:'09:00'}];
it('uses Bangkok dates, never Day 1 before departure and handles completed trips',()=>{
 expect(tripModeState(trip,stops,new Date('2026-10-24T16:59:00Z'))).toMatchObject({phase:'upcoming',day:null,countdown:1});
 expect(tripModeState(trip,stops,new Date('2026-10-25T05:00:00Z'))).toMatchObject({phase:'active',day:1,next:stops[1]});
 expect(tripModeState(trip,stops,new Date('2026-10-25T18:00:00Z'))).toMatchObject({phase:'active',day:2,next:stops[2]});
 expect(tripModeState({...trip,status:'completed'},stops,new Date('2026-10-25T05:00:00Z'))).toMatchObject({phase:'completed',next:null});
 expect(tripModeState(trip,[],new Date('2026-10-28T05:00:00Z')).phase).toBe('completed');
});
it('distinguishes current, stale, expired, invalid and historical locations without fake map centers',()=>{
 const now=Date.parse('2026-10-25T05:00:00Z'),row={user_id:'u',sharing_enabled:true,latitude:0,longitude:0,updated_at:new Date(now-60000).toISOString(),sharing_until:new Date(now+3600000).toISOString()};
 expect(locationState(row,now)).toBe('recent');expect(locationState({...row,updated_at:new Date(now-6*60000).toISOString()},now)).toBe('stale');
 for(const invalid of [{sharing_enabled:false},{sharing_until:new Date(now-1).toISOString()},{latitude:null},{latitude:91},{updated_at:new Date(now-31*60000).toISOString()}])expect(locationState({...row,...invalid},now)).toBe('unavailable');
 expect(visibleLocations([row],[{id:'u'}],'completed',now)).toEqual([]);expect(visibleLocations([row],[{id:'other'}],'active',now)).toEqual([]);expect(locationLabel({...row,latitude:null},now)).toContain('ยังไม่มีตำแหน่งล่าสุด');
});
it('prefills real option data, preserves links/images and derives coordinates only from explicit Maps pins',()=>{
 const source={name:'ที่พักจริง',price:1200,details:'เงียบสงบ',images:['path/photo.jpg'],links:['https://vt.tiktok.com/123456/','https://www.google.com/maps/search/?api=1&query=14.2%2C100.5']};
 expect(pollPlanPrefill(source)).toMatchObject({title:'ที่พักจริง',place:'ที่พักจริง',note:'เงียบสงบ',price:1200,latitude:14.2,longitude:100.5,images:['path/photo.jpg']});
 expect(pollPlanPrefill({name:'TikTok',links:['https://vt.tiktok.com/14.2,100.5/']})).toMatchObject({latitude:null,longitude:null,googleMapsUrl:''});
 expect(pollPlanPrefill({name:'กล้อง',links:['https://www.google.com/maps/@14.2,100.5,16z']})).toMatchObject({latitude:null,longitude:null});
 expect(planPayload({day:'2',price:'',links:'vt.tiktok.com/abc'})).toMatchObject({day:2,price:null,links:['https://vt.tiktok.com/abc']});
});
it('maps persisted itinerary provenance and metadata back into the one canonical stop shape',()=>{
 expect(mapStop({id:'s',trip_id:'trip',day_number:2,start_time:'10:30:00',source_poll_id:'p',source_poll_option_id:'o',source_poll_token:'t',poll_option_snapshot:{name:'original'},images:['a'],links:['https://example.com'],price:0,revision:3})).toMatchObject({id:'s',tripId:'trip',day:2,time:'10:30',sourcePollId:'p',sourcePollOptionId:'o',sourcePollToken:'t',sourceSnapshot:{name:'original'},images:['a'],price:0,revision:3});
});
