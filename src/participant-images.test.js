import {afterEach,describe,it,expect,vi} from 'vitest';
import {loadParticipantImage,loadParticipantImages} from './participant-images';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('export participant images',()=>{
 it('waits for all photos, preserves member order and deduplicates shared URLs',async()=>{
  let release;const photo={naturalWidth:100,naturalHeight:100};const loader=vi.fn(()=>new Promise(resolve=>{release=resolve;}));
  let finished=false;const pending=loadParticipantImages([{avatar:'photo'},{avatar:''},{avatar:'photo'}],loader).then(result=>{finished=true;return result;});
  await Promise.resolve();expect(finished).toBe(false);expect(loader).toHaveBeenCalledTimes(1);release(photo);
  expect(await pending).toEqual([photo,null,photo]);
 });
 it('falls back instead of failing the poster for a broken or CORS-blocked photo',async()=>{
  vi.stubGlobal('Image',class{set src(value){if(value)queueMicrotask(()=>this.onerror?.());}});
  expect(await loadParticipantImage('https://example.test/broken')).toBeNull();
  expect(await loadParticipantImages([{avatar:'bad'}],()=>Promise.reject(new Error('blocked')))).toEqual([null]);
 });
 it('uses anonymous loading and does not wait forever for a profile photo',async()=>{
  vi.useFakeTimers();let image;vi.stubGlobal('Image',class{constructor(){image=this;}set src(value){this.url=value;}});
  const pending=loadParticipantImage('slow',{timeoutMs:100});expect(image.crossOrigin).toBe('anonymous');await vi.advanceTimersByTimeAsync(100);expect(await pending).toBeNull();expect(image.onload).toBeNull();
 });
});
