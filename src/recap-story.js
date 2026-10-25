import {drawNumberedRoute} from './recap-route-overlay';
import {participantInitial,participantLayout} from './participant-layout';
import {loadParticipantImages} from './participant-images';
export const recapThemes={nature:{label:'มิ้นต์',colors:['#edf8f1','#d5eee4'],accent:'#328b76'},sky:{label:'ท้องฟ้า',colors:['#edf7ff','#d5eaf6'],accent:'#3786ad'},sunset:{label:'พีช',colors:['#fff3ec','#f6ddda'],accent:'#bb7467'},minimal:{label:'ทราย',colors:['#fffcf5','#f0e9dc'],accent:'#877b62'},night:{label:'กลางคืน',colors:['#20394e','#375c70'],accent:'#9ed7e7',dark:true}};
export function coverImageRect(width,height,targetWidth,targetHeight,{zoom=1,x=50,y=50}={}){
 const scale=Math.max(targetWidth/width,targetHeight/height)*Math.max(1,Number(zoom)||1);
 const w=width*scale,h=height*scale;
 return {x:-(w-targetWidth)*Math.min(100,Math.max(0,x))/100,y:-(h-targetHeight)*Math.min(100,Math.max(0,y))/100,width:w,height:h};
}
export function loadRecapImage(src){return new Promise((resolve,reject)=>{if(!src)return resolve(null);const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('เปิดรูปพื้นหลังไม่ได้ กรุณาเลือกรูปใหม่หรือใช้พื้นหลังสี'));image.src=src;});}
function fit(ctx,text,maxWidth,size,min=20){while(size>min){ctx.font=`700 ${size}px "Anuphan",sans-serif`;if(ctx.measureText(text).width<=maxWidth)break;size-=2;}return size;}
function ellipsis(ctx,text,maxWidth){let value=String(text||'');if(ctx.measureText(value).width<=maxWidth)return value;while(value.length&&ctx.measureText(value+'…').width>maxWidth)value=value.slice(0,-1);return value+'…';}
export function storyDateLabel(trip,dateLabel=''){
 const start=Date.parse(`${trip?.start_date}T00:00:00Z`),end=Date.parse(`${trip?.end_date}T00:00:00Z`),days=Math.round((end-start)/86400000)+1;
 return dateLabel&&!dateLabel.includes('วัน')&&Number.isFinite(days)&&days>0?`${dateLabel} · ${days} วัน`:dateLabel;
}
export async function renderRecapStory({trip,dateLabel,members=[],places=[],total=0,themeId='minimal',imageSrc='',crop={},showExpenses=true,showRoute=true,fileType='image/png'}){
 await document.fonts?.ready;
 const [photo,avatars]=await Promise.all([loadRecapImage(imageSrc),loadParticipantImages(members)]);
 const height=1920,theme=recapThemes[themeId]||recapThemes.minimal;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('อุปกรณ์นี้ยังสร้างรูปไม่ได้');
 if(photo){const rect=coverImageRect(photo.naturalWidth,photo.naturalHeight,1080,height,crop);ctx.drawImage(photo,rect.x,rect.y,rect.width,rect.height);}
 else{const fallback=ctx.createLinearGradient(0,0,1080,height);fallback.addColorStop(0,'#7796a1');fallback.addColorStop(.5,'#446f78');fallback.addColorStop(1,'#1b3740');ctx.fillStyle=fallback;ctx.fillRect(0,0,1080,height);}
 const shade=ctx.createLinearGradient(0,0,0,height);shade.addColorStop(0,'rgba(15,31,40,.16)');shade.addColorStop(.3,'rgba(15,31,40,0)');shade.addColorStop(.5,'rgba(15,31,40,.22)');shade.addColorStop(.68,'rgba(15,31,40,.66)');shade.addColorStop(1,'rgba(10,25,32,.88)');ctx.fillStyle=shade;ctx.fillRect(0,0,1080,height);
 ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.shadowColor='rgba(9,24,32,.38)';ctx.shadowBlur=6;ctx.shadowOffsetY=2;
 ctx.font='800 25px Nunito,sans-serif';ctx.fillText('TRIPMATE / THE MEMORY EDIT',80,110);
 if(showRoute)drawNumberedRoute(ctx,places,{x:130,y:240,width:820,height:530},{color:theme.dark?'#3f6574':theme.accent});
 ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='alphabetic';
 fit(ctx,String(trip?.name||'ทริปของเรา'),920,100,42);ctx.fillText(ellipsis(ctx,trip?.name||'ทริปของเรา',920),80,1105);
 ctx.font='500 29px "Anuphan",sans-serif';ctx.fillText(ellipsis(ctx,storyDateLabel(trip,dateLabel),920),80,1170);
 ctx.font='700 26px Nunito,sans-serif';ctx.fillStyle='#f1f7fb';ctx.fillText(`Our Travel Crew · ${members.length}`,80,1362);
 const size=82,people=participantLayout(members.length,920,{avatarSize:size,defaultOverlap:20,minAvatarSize:49.2});
 members.forEach((member,index)=>{const s=people.avatarSize,left=80+index*people.step,top=1385+(size-s)/2,cx=left+s/2,cy=top+s/2,r=(s-5)/2;ctx.save();ctx.shadowBlur=0;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();ctx.fillStyle=theme.dark?'#3f6574':theme.accent;ctx.fillRect(left,top,s,s);if(avatars[index]){const image=avatars[index],rect=coverImageRect(image.naturalWidth,image.naturalHeight,s,s);ctx.drawImage(image,left+rect.x,top+rect.y,rect.width,rect.height);}else{ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${s*.4}px "Anuphan",sans-serif`;ctx.fillText(participantInitial(member.name),cx,cy);}ctx.restore();ctx.strokeStyle='#ffffffd9';ctx.lineWidth=5;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();});
 ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(80,1520);ctx.lineTo(1000,1520);ctx.moveTo(540,1550);ctx.lineTo(540,1650);ctx.stroke();
 const stats=[{value:String(places.length),label:'สถานที่ในทริป'},{value:showExpenses?`${new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(total)} ฿`:'—',label:showExpenses?'ค่าใช้จ่ายรวม':'ซ่อนค่าใช้จ่าย'}];
 ctx.textBaseline='alphabetic';ctx.shadowBlur=5;ctx.shadowColor='rgba(9,24,32,.3)';
 stats.forEach((stat,index)=>{const x=80+index*490;ctx.fillStyle='#fff';ctx.textAlign='left';fit(ctx,stat.value,400,48,24);ctx.fillText(ellipsis(ctx,stat.value,400),x,1596);ctx.font='500 23px "Anuphan",sans-serif';ctx.fillStyle='#e7eff2';ctx.fillText(stat.label,x,1640);});
 ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='600 30px Nunito,sans-serif';ctx.fillText("Trip's over, memories aren't. ♡",540,1798);ctx.fillStyle='#d1dfe5';ctx.font='500 21px Nunito,sans-serif';ctx.fillText('Made with TripMate',540,1845);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('สร้างรูปไม่สำเร็จ กรุณาลองใหม่')),fileType==='image/jpeg'?'image/jpeg':'image/png',.94));
}
