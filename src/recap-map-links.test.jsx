import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi,afterEach} from 'vitest';
import {useRecapMap} from './RecapRouteMap';
const mocks=vi.hoisted(()=>({invoke:vi.fn(),map:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
vi.mock('./recap-map-image',()=>({createRecapMap:mocks.map}));
let root,container;
afterEach(async()=>{if(root)await act(async()=>root.unmount());container?.remove();vi.useRealTimers();vi.clearAllMocks();});
it('routes with coordinates resolved from the matching stored Maps link and reports only unresolved stops',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();let result;
 const stops=[{id:'resolved',googleMapsUrl:'https://maps.app.goo.gl/valid'},{id:'unknown',googleMapsUrl:'https://maps.app.goo.gl/unknown'}];
 mocks.invoke.mockResolvedValue({data:{places:[{id:'resolved',url:stops[0].googleMapsUrl,point:[99.1439739,14.3686412]},{id:'unknown',url:stops[1].googleMapsUrl,point:null}]}});
 function Probe({items}){result=useRecapMap(items,'trip-links-test');return null;}
 container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
 await act(async()=>root.render(<Probe items={stops}/>));await act(async()=>vi.advanceTimersByTimeAsync(500));
 expect(result.status).toBe('missing');expect(result.missingIds).toEqual(['unknown']);expect(mocks.map).not.toHaveBeenCalled();
 mocks.map.mockResolvedValue({src:'real-map',distance:10});
 await act(async()=>root.render(<Probe items={stops.slice(0,1)}/>));await act(async()=>vi.advanceTimersByTimeAsync(500));
 expect(result.status).toBe('ready');expect(mocks.map.mock.calls[0][0][0]).toMatchObject({latitude:14.3686412,longitude:99.1439739});
 expect(mocks.invoke.mock.calls[0][1].body).toEqual({tripId:'trip-links-test',stopIds:['resolved','unknown']});
});
it('does not apply cached coordinates when the stored URL changed',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();let result;
 mocks.invoke.mockResolvedValue({data:{places:[{id:'changed',url:'https://maps.app.goo.gl/old',point:[99,14]}]}});
 function Probe(){result=useRecapMap([{id:'changed',googleMapsUrl:'https://maps.app.goo.gl/new'}],'trip-stale-link-test');return null;}
 container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);await act(async()=>root.render(<Probe/>));await act(async()=>vi.advanceTimersByTimeAsync(500));
 expect(result.status).toBe('missing');expect(mocks.map).not.toHaveBeenCalled();
});
