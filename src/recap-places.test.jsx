import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi,afterEach} from 'vitest';
import {recapPlaceName,recapRoutePlaces} from './recap-places';
import {routeLabel,drawNumberedRoute} from './recap-route-overlay';
import NumberedRouteOverlay from './NumberedRouteOverlay';
import {renderRecapStory} from './recap-story';
vi.mock('./participant-images',()=>({loadParticipantImages:async()=>[]}));
vi.mock('./recap-stat-icons',()=>({loadTravelStatIcons:async()=>({places:{},expenses:{}})}));
afterEach(()=>vi.restoreAllMocks());
const stops=[{id:'a',day:1,time:'10:00',sortOrder:9,title:'กินข้าว',place:'ครัวน้ำปลาพริก'},{id:'b',day:1,time:'12:00',sortOrder:0,title:'เข้าที่พัก',place:'บ้านอิงภู'},{id:'c',day:1,time:'13:00',title:'พักผ่อน',place:' '},{id:'d',day:2,time:'09:00',title:'ขับ ATV',place:'Khao Yai ATV'}];
it('selects only real place fields, sorts by day/time before manual order and leaves source data unchanged',()=>{
 const before=JSON.stringify(stops);expect(recapRoutePlaces([...stops].reverse()).map(s=>s.place)).toEqual(['ครัวน้ำปลาพริก','บ้านอิงภู','Khao Yai ATV']);expect(JSON.stringify(stops)).toBe(before);
 expect(recapRoutePlaces([{day:10,time:'9:00',place:'Ten'},{day:2,time:'10:00',sortOrder:0,place:'Later'},{day:2,time:'9:00',sortOrder:9,place:'Earlier'}]).map(s=>s.place)).toEqual(['Earlier','Later','Ten']);
 expect(recapPlaceName({place:'7-11'})).toBe('7-11');expect(recapPlaceName({place:'Cafe 14'})).toBe('Cafe 14');expect(recapPlaceName({title:'Activity',name_en:'English',place:''})).toBe('');expect(recapRoutePlaces([{place:'Hidden',enabled:false}])).toEqual([]);
});
it.each(['','  ','https://maps.app.goo.gl/abc','www.google.com/maps/place/test','maps.google.com/?q=14,100','14.2, 100.5','(14.2,100.5)','lat:14.2, lng:100.5','14.2 100.5','สถานที่','Stop','—'])('never substitutes an activity for invalid place %s',place=>{expect(recapRoutePlaces([{title:'DO NOT SHOW',place}])).toEqual([]);});
it('keeps every caption to two lines with no generic fallback',()=>{
 const label=routeLabel({x:200,y:100,radius:23},3,{width:840},'ชื่อสถานที่จริงที่ยาวมากและมีรายละเอียดเพิ่มเติมยาวมากกว่าที่จะแสดงในสองบรรทัดได้ทั้งหมด');expect(label.lines).toHaveLength(2);expect(label.lines[1]).toContain('…');expect(routeLabel({y:100,radius:23},1,{width:840},'').lines).toEqual([]);
});
it('SVG and canvas share exactly the same filtered and numbered place-only route',()=>{
 const svg=renderToStaticMarkup(<NumberedRouteOverlay places={[...stops,{title:'Wrong',place:'https://maps.app.goo.gl/test'}]}/>);expect(svg).toContain('เส้นทางตกแต่ง 3 สถานที่');expect(svg).toContain('1 · ครัวน้ำปลาพริก');expect(svg).toContain('2 · บ้านอิงภู');expect(svg).toContain('3 · Khao Yai ATV');for(const bad of ['กินข้าว','เข้าที่พัก','พักผ่อน','ขับ ATV','https://maps'])expect(svg).not.toContain(bad);
 const ctx={save:vi.fn(),restore:vi.fn(),setLineDash:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),quadraticCurveTo:vi.fn(),stroke:vi.fn(),arc:vi.fn(),fill:vi.fn(),fillText:vi.fn()};drawNumberedRoute(ctx,stops,{x:130,y:360,width:820,height:430});const copy=ctx.fillText.mock.calls.map(c=>c[0]);expect(copy).toEqual(['1','ครัวน้ำปลาพริก','2','บ้านอิงภู','3','Khao Yai ATV']);expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(2);
});
it.each(['image/png','image/jpeg'])('renders the same valid captions for preview/download/share %s blobs',async fileType=>{
 const ctx={measureText:t=>({width:t.length*10}),createLinearGradient:()=>({addColorStop(){}})};for(const m of ['fillRect','beginPath','arc','fill','clip','drawImage','save','restore','fillText','stroke','moveTo','lineTo','quadraticCurveTo','setLineDash'])ctx[m]=vi.fn();vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx);vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation((cb,type)=>cb(new Blob(['test'],{type})));
 const blob=await renderRecapStory({trip:{name:'Unchanged',start_date:'2026-10-21',end_date:'2026-10-23'},places:stops,total:13940,fileType});expect(blob.type).toBe(fileType);const copy=ctx.fillText.mock.calls.map(c=>c[0]);for(const name of ['ครัวน้ำปลาพริก','บ้านอิงภู','Khao Yai ATV','Unchanged','Oct 21–23, 2026 · 3D2N','฿13,940'])expect(copy).toContain(name);for(const bad of ['กินข้าว','เข้าที่พัก','พักผ่อน','ขับ ATV','Stop','สถานที่'])expect(copy).not.toContain(bad);
});
