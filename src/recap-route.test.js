import {describe,it,expect,vi} from 'vitest';
import {stopCoordinate,orderRecapStops,markerLabel,routeChunks,routeBounds,routeKey,getRoadRoute} from './recap-route';
const stop=(longitude,latitude)=>({longitude,latitude});
describe('real recap routing',()=>{
 it('rejects missing and invalid coordinates without interpreting null as zero',()=>{for(const value of [null,undefined,'',' ',NaN,Infinity])expect(stopCoordinate(stop(value,14))).toBe(null);expect(stopCoordinate(stop(0,0))).toEqual([0,0]);expect(stopCoordinate(stop(181,14))).toBe(null);});
 it('orders numeric days and explicit itinerary order and retains return to start',()=>{const stops=[{id:'c',day:10,sortOrder:0},{id:'b',day:2,sortOrder:1},{id:'a',day:2,sortOrder:0}];expect(orderRecapStops(stops).map(s=>s.id)).toEqual(['a','b','c']);const points=[stop(100,14),stop(101,15),stop(100,14)];expect(JSON.parse(routeKey(points))).toEqual([[100,14],[101,15],[100,14]]);});
 it('chunks with exactly one shared waypoint and includes every stop',()=>{const points=Array.from({length:60},(_,i)=>[i,0]),chunks=routeChunks(points);expect(chunks.map(c=>c.length)).toEqual([25,25,12]);expect(chunks[0].at(-1)).toEqual(chunks[1][0]);expect(chunks.flatMap((c,i)=>i?c.slice(1):c)).toEqual(points);});
 it('fits the full road detour and labels beyond Z',()=>{expect(routeBounds([[100,14],[98,17],[101,13]])).toEqual([[98,13],[101,17]]);expect([0,25,26,51,52].map(markerLabel)).toEqual(['A','Z','AA','AZ','BA']);});
 it('deduplicates cached route requests and never reroutes on title changes',async()=>{const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>({code:'Ok',routes:[{distance:10,geometry:{type:'LineString',coordinates:[[100.1,14],[100.2,14.1]]}}]})});const stops=[stop(100.1,14),stop(100.2,14.1)];const [a,b]=await Promise.all([getRoadRoute(stops),getRoadRoute(stops.map(s=>({...s,title:'renamed'})))]);expect(a).toBe(b);expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][0]).toContain('100.1,14;100.2,14.1?overview=full&geometries=geojson');fetch.mockRestore();});
});
it('does not cache failed routes or substitute a straight line, so retry can recover',async()=>{
 const mock=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce({ok:true,json:async()=>({code:'NoRoute'})}).mockResolvedValueOnce({ok:true,json:async()=>({code:'Ok',routes:[{distance:50,geometry:{type:'LineString',coordinates:[[102.1,15],[102.2,15.1]]}}]})});
 const points=[stop(102.1,15),stop(102.2,15.1)];await expect(getRoadRoute(points)).rejects.toThrow('ไม่พบเส้นทาง');expect((await getRoadRoute(points)).distance).toBe(50);expect(mock).toHaveBeenCalledTimes(2);mock.mockRestore();
});
