import {describe,it,expect,vi} from 'vitest';
import {createVendorReceiptUpload} from './vendor-receipts';
const file=name=>({name,type:'image/png',size:100});
describe('vendor proof uploads',()=>{
 it('retains uploaded paths on retries and supports removing one file',async()=>{const upload=vi.fn(async(t,u,k,f)=>({path:`${t}/${u}/${f.name}`})),run=createVendorReceiptUpload(upload),a=file('a.png'),b=file('b.png');const rows=await run('t','u',[a,b]);expect(rows).toHaveLength(2);expect(await run('t','u',[a,b])).toEqual(rows);expect(await run('t','u',[b])).toEqual([rows[1]]);expect(upload).toHaveBeenCalledTimes(2);});
 it('retries only the failed upload after partial success',async()=>{const a=file('a.png'),b=file('b.png'),upload=vi.fn().mockResolvedValueOnce({path:'a'}).mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({path:'b'}),run=createVendorReceiptUpload(upload);await expect(run('t','u',[a,b])).rejects.toThrow('offline');expect((await run('t','u',[a,b])).map(x=>x.path)).toEqual(['a','b']);expect(upload).toHaveBeenCalledTimes(3);});
 it('rejects nonimages before uploading',async()=>{const upload=vi.fn();await expect(createVendorReceiptUpload(upload)('t','u',[{name:'x.pdf',size:1,type:'application/pdf'}])).rejects.toThrow();expect(upload).not.toHaveBeenCalled();});
});
