export function normalizePollLink(value){
 const text=String(value||'').trim();if(!text)return null;
 if(text.length>2048)throw new Error('ลิงก์ยาวเกินไป');
 if(/[\u0000-\u0020\u007f\\]/.test(text))throw new Error('ลิงก์มีอักขระที่ไม่ปลอดภัย');
 let url;try{url=new URL(/^https:\/\//i.test(text)?text:!text.includes(':')?`https://${text}`:text);}catch{throw new Error('ตรวจรูปแบบลิงก์อีกครั้ง');}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||!host.includes('.')||host.endsWith('.local')||host.endsWith('.localhost')||host==='localhost'||(/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)||host.includes(':')||host.includes('[')))throw new Error('ใช้ลิงก์ HTTPS ของเว็บไซต์สาธารณะเท่านั้น');
 return {url:url.href,domain:host.replace(/^www\./,''),platform:/(^|\.)tiktok\.com$/.test(host)?'TikTok':/(^|\.)(google\.[a-z.]+|goo\.gl)$/.test(host)&&(/maps/.test(url.href)||host==='maps.app.goo.gl')?'Google Maps':'เว็บไซต์'};
}
export function pollLinks(value){return String(value||'').split(/\r?\n/).filter(v=>v.trim()).map(v=>normalizePollLink(v).url);}
export function pollImageSources(option){return [...new Set([...(Array.isArray(option.images)?option.images:[]),...String(option.image_url||'').split(/\\n|\r?\n/).filter(Boolean)])].filter(source=>typeof source==='string'&&source.length>0);}
export function pollPercent(votes,ballots){return ballots>0?Math.round(votes/ballots*100):0;}
export function pollStatus(poll){return poll.status==='draft'?'ร่าง':poll.read_only||poll.status==='closed'?'ปิดโหวต':'เปิดโหวต';}
