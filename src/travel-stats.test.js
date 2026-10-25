import {it,expect,vi} from 'vitest';
import {travelStatsItems,drawTravelStats} from './travel-stats';
it('omits every expense field when disabled, including true zero amounts',()=>{for(const total of [0,13940]){const items=travelStatsItems({places:2,total,showExpenses:false});expect(items).toEqual([{id:'places',value:'2',label:'สถานที่ในทริป'}]);expect(JSON.stringify(items)).not.toMatch(/—|฿|ค่าใช้จ่าย/);}});
it('uses the real expense amount with leading baht sign when enabled',()=>{expect(travelStatsItems({places:2,total:4250,showExpenses:true})[1].value).toBe('฿4,250');});
it('draws a centered single stat with no wallet or divider, and restores two balanced stats',()=>{
 const ctx={save:vi.fn(),restore:vi.fn(),drawImage:vi.fn(),fillText:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),measureText:text=>({width:text.length*20})},icons={places:{id:'place'},expenses:{id:'wallet'}};
 drawTravelStats(ctx,{places:2,total:4250,showExpenses:false},icons);expect(ctx.drawImage.mock.calls.map(c=>c[0])).toEqual([icons.places]);expect(ctx.stroke).not.toHaveBeenCalled();expect(ctx.fillText.mock.calls).toContainEqual(['สถานที่ในทริป',540,1480]);expect(ctx.fillText.mock.calls.some(([t])=>String(t).includes('4250')||String(t).includes('—'))).toBe(false);
 ctx.drawImage.mockClear();drawTravelStats(ctx,{places:2,total:4250,showExpenses:true},icons);expect(ctx.drawImage.mock.calls.map(c=>c[0])).toEqual([icons.places,icons.expenses]);expect(ctx.stroke).toHaveBeenCalledTimes(1);expect(ctx.fillText.mock.calls.some(([t])=>t==='฿4,250')).toBe(true);
});
