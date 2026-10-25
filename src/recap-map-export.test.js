import {it,expect,vi,afterEach} from 'vitest';
import {renderRecapStory} from './recap-story';
vi.mock('./participant-images',()=>({loadParticipantImages:async members=>members.map(()=>null)}));
afterEach(()=>vi.restoreAllMocks());
it('blocks map exports until the real map image is ready',async()=>{await expect(renderRecapStory({trip:{name:'QA'},places:[],showRoute:true})).rejects.toThrow('รอแผนที่');});
it.each([['story',1920],['post',1350]])('exports %s with the same map image and every avatar',async(format,height)=>{
 const context={measureText:text=>({width:String(text).length*10}),createLinearGradient:()=>({addColorStop:vi.fn()})};for(const method of ['fillRect','beginPath','arc','fill','rect','clip','drawImage','save','restore','fillText','roundRect','stroke'])context[method]=vi.fn();
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);let dimensions;vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(function(callback){dimensions=[this.width,this.height];callback(new Blob(['png']));});
 const original=globalThis.Image;const map={naturalWidth:960,naturalHeight:600};globalThis.Image=class{set src(value){this.value=value;Object.assign(this,map);queueMicrotask(()=>this.onload());}};
 try{await renderRecapStory({trip:{name:'QA'},dateLabel:'Oct',members:Array.from({length:30},(_,i)=>({name:String(i)})),places:[{title:'Start'},{title:'End'}],showRoute:true,mapImage:{src:'data:image/png;base64,test',distance:1000},format});expect(dimensions).toEqual([1080,height]);expect(context.drawImage).toHaveBeenCalledTimes(1);expect(context.drawImage.mock.calls[0][0].value).toContain('data:image/png');expect(context.arc).toHaveBeenCalledTimes(60);expect(context.fillText.mock.calls.some(([t])=>t==='เส้นทางความทรงจำ')).toBe(true);}finally{globalThis.Image=original;}
});
