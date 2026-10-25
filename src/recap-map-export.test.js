import {it,expect,vi,afterEach} from 'vitest';
import {renderRecapStory} from './recap-story';
import {numberedRouteLayout} from './recap-route-overlay';
vi.mock('./participant-images',()=>({loadParticipantImages:async members=>members.map(()=>null)}));
afterEach(()=>vi.restoreAllMocks());
it.each([0,1,2,4,14,30,100])('keeps all %i numbered stops inside the decorative cover area',count=>{const points=numberedRouteLayout(count);expect(points).toHaveLength(count);points.forEach((p,i)=>{expect(p.number).toBe(i+1);expect(p.x-p.radius).toBeGreaterThan(0);expect(p.x+p.radius).toBeLessThan(1080);expect(p.y-p.radius).toBeGreaterThan(100);expect(p.y+p.radius).toBeLessThan(610);});});
it.each([['story',1920,'image/png'],['post',1920,'image/png'],['post',1920,'image/jpeg']])('exports %s %s as %s with every numbered pin and avatar without a map',async(format,height,fileType)=>{
 const context={measureText:text=>({width:String(text).length*10}),createLinearGradient:()=>({addColorStop:vi.fn()})};for(const method of ['fillRect','beginPath','arc','fill','rect','clip','drawImage','save','restore','fillText','roundRect','stroke','moveTo','lineTo','quadraticCurveTo','setLineDash'])context[method]=vi.fn();
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);let dimensions,type;vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(function(callback,mime){dimensions=[this.width,this.height];type=mime;callback(new Blob(['image'],{type:mime}));});
 const places=Array.from({length:14},(_,i)=>({title:`Actual stop ${i+1}`}));
 await renderRecapStory({trip:{name:'QA'},members:Array.from({length:30},(_,i)=>({name:`Person ${i}`})),places,showRoute:true,format,fileType});
 expect(dimensions).toEqual([1080,height]);expect(type).toBe(fileType);expect(context.drawImage).not.toHaveBeenCalled();expect(context.quadraticCurveTo).toHaveBeenCalledTimes(13);expect(context.arc).toHaveBeenCalledTimes(74);
 const pins=context.fillText.mock.calls.filter(call=>call[1]>=100&&call[2]<900&&/^\d+$/.test(call[0]));expect(pins.map(([text])=>text)).toEqual(places.map((_,i)=>String(i+1)));expect(context.fillText.mock.calls.some(([text])=>text==='เส้นทางความทรงจำ')).toBe(false);expect(context.roundRect).not.toHaveBeenCalled();expect(context.fillText.mock.calls.some(([text])=>text==="Trip's over, memories aren't. ♡")).toBe(true);
});
