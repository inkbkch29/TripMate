import {it,expect} from 'vitest';
import {normalizePollLink,pollImageSources,pollPercent,pollLinks} from './poll-utils';
it('normalizes public HTTPS links and identifies platforms without trusting lookalike domains',()=>{
 expect(normalizePollLink(' vt.tiktok.com/ABC/ ')).toMatchObject({url:'https://vt.tiktok.com/ABC/',platform:'TikTok'});
 expect(normalizePollLink('https://maps.app.goo.gl/ABC').platform).toBe('Google Maps');
 expect(normalizePollLink('https://tiktok.com.evil.example/path').platform).toBe('เว็บไซต์');
 expect(normalizePollLink('https://123travel.example/path').domain).toBe('123travel.example');
 expect(pollLinks('example.com\nhttps://vt.tiktok.com/a')).toHaveLength(2);
});
it.each(['javascript:alert(1)','data:text/html,test','http://example.com','https://user:pass@example.com','https://127.0.0.1','https://0x7f000001','https://2130706433','https://[::1]','https://a.local/','https://a.localhost/','https://example.com:8080','https://example.com\\@evil.test','https://example.com/a b'])('rejects unsafe link %s',v=>expect(()=>normalizePollLink(v)).toThrow());
it('retains legacy newline photo sources and computes percentages using ballots',()=>{
 expect(pollImageSources({images:['a'],image_url:'a\\nb\nc'})).toEqual(['a','b','c']);
 expect(pollPercent(1,3)).toBe(33);expect(pollPercent(0,0)).toBe(0);expect(pollPercent(2,2)).toBe(100);
});
