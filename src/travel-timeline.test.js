import {it,expect} from 'vitest';
import {timelineState,orderedTimeline,swapTimelineStops} from './travel-timeline';
import {stopNavigation} from './trip-mode';
const trip={start_date:'2026-10-26',end_date:'2026-10-27'},stops=[{id:'a',day:1,time:'08:00',title:'อาหารเช้า',place:'ร้าน A',done:true},{id:'b',day:1,time:'12:00',title:'กินข้าว',place:'ร้าน B'},{id:'c',day:2,time:'09:00',title:'เดินเล่น',place:'อุทยาน'}];
it('selects only one scheduled interval automatically, ignoring historical completion and never claiming actual arrival',()=>{
 expect(timelineState(trip,stops,new Date('2026-10-26T07:59:00+07:00'))).toMatchObject({current:null,next:stops[0]});
 expect(timelineState(trip,stops,new Date('2026-10-26T08:00:00+07:00'))).toMatchObject({current:stops[0],next:stops[1]});
 expect(timelineState(trip,stops,new Date('2026-10-26T11:59:59+07:00')).current.id).toBe('a');
 expect(timelineState(trip,stops,new Date('2026-10-26T12:00:00+07:00')).current.id).toBe('b');
 expect(timelineState(trip,stops,new Date('2026-10-27T15:00:00+07:00'))).toMatchObject({current:stops[2],next:null});
 expect(timelineState(trip,stops,new Date('2026-10-28T00:00:00+07:00'))).toMatchObject({phase:'completed',current:null,next:null});expect(stops[0].done).toBe(true);
});
it('handles overnight intervals, Bangkok midnight, missing times and equal-time ties deterministically',()=>{
 expect(timelineState(trip,stops,new Date('2026-10-26T18:00:00Z'))).toMatchObject({day:2,current:stops[1],next:stops[2]});
 const rows=[{id:'untimed',day:1,time:''},{id:'second',day:1,time:'08:00',sortOrder:2},{id:'first',day:1,time:'08:00',sortOrder:1},{id:'bad',day:1,time:'28:00'}];
 expect(orderedTimeline(rows).map(s=>s.id)).toEqual(['first','second','untimed','bad']);expect(timelineState(trip,rows,new Date('2026-10-26T08:30:00+07:00')).current.id).toBe('second');
 expect(timelineState({...trip,status:'completed'},rows,new Date('2026-10-26T08:30:00+07:00')).current).toBeNull();expect(timelineState({},rows,new Date()).current).toBeNull();
});
it('keeps manual reordering on chronological time slots without mutating the old itinerary',()=>{
 const before=JSON.stringify(stops),moved=swapTimelineStops(stops.slice(0,2),'b',-1);expect(moved.map(s=>[s.id,s.time,s.sortOrder])).toEqual([['b','08:00',0],['a','12:00',1]]);expect(JSON.stringify(stops)).toBe(before);expect(swapTimelineStops(stops,'a',-1)).toBe(stops);
});
it('navigates directly with Maps short links, zero coordinates or the actual place search',()=>{
 expect(stopNavigation({googleMapsUrl:'https://maps.app.goo.gl/abc'})).toBe('https://maps.app.goo.gl/abc');expect(stopNavigation({title:'กิจกรรมไม่มีสถานที่'})).toBe('');expect(stopNavigation({latitude:0,longitude:0})).toContain('query=0,0');expect(stopNavigation({googleMapsUrl:'javascript:alert(1)',place:'ร้านจริง'})).toContain(encodeURIComponent('ร้านจริง'));expect(stopNavigation({googleMapsUrl:'https://example.com',place:'ร้านจริง'})).toContain('google.com/maps');
});
