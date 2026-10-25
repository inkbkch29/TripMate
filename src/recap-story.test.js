import {describe,it,expect} from 'vitest';
import {coverImageRect,storyDateLabel} from './recap-story';
describe('recap photo cropping',()=>{
 it('covers a portrait story without stretching a landscape image',()=>{const rect=coverImageRect(1600,900,1080,1240);expect(rect.height).toBe(1240);expect(rect.width/rect.height).toBeCloseTo(1600/900);expect(rect.x).toBeLessThan(0);expect(rect.y).toBeCloseTo(0);});
 it('keeps all edges covered at both positioning extremes and zoom',()=>{for(const x of [0,50,100])for(const y of [0,50,100]){const r=coverImageRect(800,1600,1080,1240,{zoom:2,x,y});expect(r.x).toBeLessThanOrEqual(0);expect(r.y).toBeLessThanOrEqual(0);expect(r.x+r.width).toBeGreaterThanOrEqual(1080);expect(r.y+r.height).toBeGreaterThanOrEqual(1240);}});
});

it('formats English Gregorian dates and inclusive days/nights',()=>{const trip={start_date:'2026-10-21',end_date:'2026-10-23'};expect(storyDateLabel(trip,'21–23 ตุลาคม 2569')).toBe('Oct 21–23, 2026 · 3D2N');});
