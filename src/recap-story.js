import {drawNumberedRoute} from './recap-route-overlay';
import {participantInitial,participantLayout} from './participant-layout';
import {loadParticipantImages} from './participant-images';
export const recapThemes={nature:{label:'มิ้นต์',colors:['#edf8f1','#d5eee4'],accent:'#328b76'},sky:{label:'ท้องฟ้า',colors:['#edf7ff','#d5eaf6'],accent:'#3786ad'},sunset:{label:'พีช',colors:['#fff3ec','#f6ddda'],accent:'#bb7467'},minimal:{label:'ครีม',colors:['#fffcf5','#f0e9dc'],accent:'#877b62'},night:{label:'กลางคืน',colors:['#20394e','#375c70'],accent:'#9ed7e7',dark:true}};
export function coverImageRect(width,height,targetWidth,targetHeight,{zoom=1,x=50,y=50}={}){
 const scale=Math.max(targetWidth/width,targetHeight/height)*Math.max(1,Number(zoom)||1);
 const w=width*scale,h=height*scale;
 return {x:-(w-targetWidth)*Math.min(100,Math.max(0,x))/100,y:-(h-targetHeight)*Math.min(100,Math.max(0,y))/100,width:w,height:h};
}
export function loadRecapImage(src){return new Promise((resolve,reject)=>{if(!src)return resolve(null);const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('เปิดรูปพื้นหลังไม่ได้ กรุณาเลือกรูปใหม่หรือใช้พื้นหลังสี'));image.src=src;});}
function fit(ctx,text,maxWidth,size,min=20){while(size>min){ctx.font=`700 ${size}px "Anuphan",sans-serif`;if(ctx.measureText(text).width<=maxWidth)break;size-=2;}return size;}
function ellipsis(ctx,text,maxWidth){let value=String(text||'');if(ctx.measureText(value).width<=maxWidth)return value;while(value.length&&ctx.measureText(value+'…').width>maxWidth)value=value.slice(0,-1);return value+'…';}
export async function renderRecapStory({trip,dateLabel,members=[],places=[],total=0,traveled=0,themeId='minimal',imageSrc='',crop={},showExpenses=false,showRoute=true,format='post',fileType='image/png'}){
 await document.fonts?.ready;
 const [photo,avatars]=await Promise.all([loadRecapImage(imageSrc),loadParticipantImages(members)]);
 const story=format==='story',height=story?1920:1350,cover=story?1260:790,theme=recapThemes[themeId]||recapThemes.minimal;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('อุปกรณ์นี้ยังสร้างรูปไม่ได้');
 ctx.fillStyle=theme.colors[0];ctx.fillRect(0,0,1080,height);
 if(photo){const rect=coverImageRect(photo.naturalWidth,photo.naturalHeight,1080,cover,crop);ctx.save();ctx.beginPath();ctx.rect(0,0,1080,cover);ctx.clip();ctx.drawImage(photo,rect.x,rect.y,rect.width,rect.height);ctx.restore();const shade=ctx.createLinearGradient(0,0,0,cover);shade.addColorStop(0,'#14272844');shade.addColorStop(.5,'#14272808');shade.addColorStop(1,'#112326dd');ctx.fillStyle=shade;ctx.fillRect(0,0,1080,cover);}
 else{const gradient=ctx.createLinearGradient(0,0,1080,cover);gradient.addColorStop(0,theme.colors[0]);gradient.addColorStop(1,theme.colors[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,cover);}
 const ink=photo||theme.dark?'#fff':'#263e43';ctx.fillStyle=ink;ctx.textAlign='left';ctx.font='900 25px Nunito,sans-serif';ctx.fillText('TripMate. / OUR LITTLE GETAWAY',70,76);
 if(showRoute)drawNumberedRoute(ctx,places.length,{x:120,y:story?240:170,width:840,height:story?590:280},{dark:!photo&&!theme.dark});
 ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle=ink;
 fit(ctx,String(trip?.name||'ทริปของเรา'),940,story?88:76,36);ctx.fillText(ellipsis(ctx,trip?.name||'ทริปของเรา',940),70,cover-150);ctx.font='500 28px "Anuphan",sans-serif';ctx.fillText(ellipsis(ctx,dateLabel||'',940),70,cover-92);
 if(showRoute&&places.length){ctx.font='500 22px "Anuphan",sans-serif';const first=places[0].title||places[0].place,last=places.at(-1).title||places.at(-1).place;ctx.fillText(ellipsis(ctx,places.length===1?`1 · ${first}`:`1 · ${first}   →   ${places.length} · ${last}`,940),70,cover-48);}
 ctx.fillStyle='#fffdf8';ctx.beginPath();ctx.roundRect(0,cover-18,1080,height-cover+18,[38,38,0,0]);ctx.fill();
 const accent=theme.dark?'#37657a':theme.accent;ctx.fillStyle=accent;ctx.font='800 24px "Anuphan",sans-serif';ctx.fillText(`เพื่อนร่วมทริป · ${members.length} คน`,70,cover+45);
 const size=98,people=participantLayout(members.length,940,{avatarSize:size,defaultOverlap:25,minAvatarSize:58.8});
 members.forEach((member,index)=>{const s=people.avatarSize,left=70+index*people.step,top=cover+65+(size-s)/2,cx=left+s/2,cy=top+s/2,r=(s-6)/2;ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();ctx.fillStyle=theme.colors[1];ctx.fillRect(left,top,s,s);if(avatars[index]){const image=avatars[index],rect=coverImageRect(image.naturalWidth,image.naturalHeight,s,s);ctx.drawImage(image,left+rect.x,top+rect.y,rect.width,rect.height);}else{ctx.fillStyle=accent;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${s*.4}px "Anuphan",sans-serif`;ctx.fillText(participantInitial(member.name),cx,cy);}ctx.restore();ctx.strokeStyle='#fff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();});
 const stats=[{value:String(places.length),label:'สถานที่ในทริป'}];if(traveled>0)stats.push({value:`${(traveled/1000).toFixed(1)} กม.`,label:'ระยะทางที่บันทึก'});if(showExpenses)stats.push({value:`${new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(total)} ฿`,label:'ค่าใช้จ่ายรวม'});
 const gap=18,w=(940-gap*(stats.length-1))/stats.length,statY=cover+205;ctx.textBaseline='alphabetic';
 stats.forEach((stat,index)=>{const left=70+index*(w+gap);ctx.fillStyle=theme.colors[0];ctx.beginPath();ctx.roundRect(left,statY,w,120,22);ctx.fill();ctx.fillStyle=accent;ctx.textAlign='center';fit(ctx,stat.value,w-28,38,22);ctx.fillText(ellipsis(ctx,stat.value,w-28),left+w/2,statY+53);ctx.fillStyle='#657577';ctx.font='500 21px "Anuphan",sans-serif';ctx.fillText(stat.label,left+w/2,statY+91);});
 ctx.fillStyle=accent;ctx.textAlign='center';ctx.font='700 27px "Anuphan",sans-serif';ctx.fillText('ทริปจบแล้ว แต่ความทรงจำยังอยู่ ♡',540,height-88);ctx.fillStyle='#91a09b';ctx.font='500 19px Nunito,sans-serif';ctx.fillText('Made with TripMate',540,height-48);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('สร้างรูปไม่สำเร็จ กรุณาลองใหม่')),fileType==='image/jpeg'?'image/jpeg':'image/png',.94));
}
