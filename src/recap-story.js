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
export async function renderRecapStory({trip,dateLabel,members=[],places,total,traveled=0,themeId='nature',imageSrc='',crop={},showExpenses=false,showRoute=false,mapImage=null,format='story'}){
 if(showRoute&&!mapImage?.src)throw new Error('รอแผนที่พร้อมก่อนบันทึกรูป หรือปิดแผนที่ในรูป');
 if(showRoute||format==='post')return renderMapPoster({trip,dateLabel,members,places,total,traveled,themeId,imageSrc,crop,showExpenses,mapImage:showRoute?mapImage:null,format});
 await document.fonts?.ready;
 const [photo,avatars]=await Promise.all([loadRecapImage(imageSrc),loadParticipantImages(members)]);
 const theme=recapThemes[themeId]||recapThemes.nature;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('อุปกรณ์นี้ยังสร้างรูปไม่ได้');
 const gradient=ctx.createLinearGradient(0,0,1080,1920);gradient.addColorStop(0,theme.colors[0]);gradient.addColorStop(1,theme.colors[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1920);
 if(photo){const rect=coverImageRect(photo.naturalWidth,photo.naturalHeight,1080,1240,crop);ctx.save();ctx.beginPath();ctx.rect(0,0,1080,1240);ctx.clip();ctx.drawImage(photo,rect.x,rect.y,rect.width,rect.height);ctx.restore();const shade=ctx.createLinearGradient(0,0,0,1240);shade.addColorStop(0,'rgba(20,39,40,.28)');shade.addColorStop(.45,'rgba(20,39,40,0)');shade.addColorStop(1,'rgba(17,35,38,.84)');ctx.fillStyle=shade;ctx.fillRect(0,0,1080,1240);}else{ctx.fillStyle=theme.dark?'#ffffff10':'#ffffff88';ctx.beginPath();ctx.arc(1000,230,400,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(80,700,230,0,Math.PI*2);ctx.fill();ctx.fillStyle=theme.accent;ctx.textAlign='center';ctx.font='500 160px sans-serif';ctx.fillText('✦',540,600);ctx.font='600 28px "Anuphan",sans-serif';ctx.fillText('ช่วงเวลาดี ๆ ของเรา',540,680);}
 const ink=photo||theme.dark?'#fff':'#263e43';ctx.textAlign='left';ctx.fillStyle=ink;ctx.font='900 30px Nunito,sans-serif';ctx.fillText('TripMate.  /  OUR LITTLE GETAWAY',70,105);
 const name=String(trip?.name||'ทริปของเรา');fit(ctx,name,940,90,40);ctx.fillText(ellipsis(ctx,name,940),70,1040);ctx.font='500 29px "Anuphan",sans-serif';ctx.fillText(ellipsis(ctx,dateLabel||'',940),72,1102);ctx.font='500 30px "Anuphan",sans-serif';ctx.fillText('เก็บความทรงจำดี ๆ ไว้ด้วยกัน ♡',72,1163);
 const footerAccent=theme.dark?'#37657a':theme.accent;
 ctx.fillStyle=theme.dark?'#f4f8fa':'#fffdf8';ctx.beginPath();ctx.roundRect(0,1220,1080,730,[52,52,0,0]);ctx.fill();ctx.fillStyle=footerAccent;ctx.font='800 26px "Anuphan",sans-serif';ctx.fillText(`เพื่อนร่วมทริป · ${members.length} คน`,70,1276);
 const people=participantLayout(members.length,940,{avatarSize:108,defaultOverlap:27,minAvatarSize:64.8});
 members.forEach((member,index)=>{
  const size=people.avatarSize,left=70+index*people.step,top=1290+(108-size)/2,border=6;
  const centerX=left+size/2,centerY=top+size/2,radius=Math.max(0,(size-border)/2);
  ctx.save();ctx.beginPath();ctx.arc(centerX,centerY,radius,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=theme.colors[1];ctx.fillRect(left,top,size,size);
  const avatar=avatars[index];
  if(avatar){const rect=coverImageRect(avatar.naturalWidth,avatar.naturalHeight,size,size);ctx.drawImage(avatar,left+rect.x,top+rect.y,rect.width,rect.height);}
  else{ctx.fillStyle=theme.dark?'#fff':footerAccent;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${size*.4}px "Anuphan",sans-serif`;ctx.fillText(participantInitial(member.name),centerX,centerY);}
  ctx.restore();ctx.strokeStyle='#fff';ctx.lineWidth=border;ctx.beginPath();ctx.arc(centerX,centerY,radius,0,Math.PI*2);ctx.stroke();
 });
 const stats=[{value:String(places.length),label:'สถานที่ในความทรงจำ'}];if(traveled>0)stats.push({value:`${(traveled/1000).toFixed(1)} กม.`,label:'ระยะทางที่บันทึก'});if(showExpenses)stats.push({value:new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2}).format(total),label:'ค่าใช้จ่ายรวม'});
 const gap=20,w=(940-gap*(stats.length-1))/stats.length;stats.forEach((stat,index)=>{const left=70+index*(w+gap);ctx.fillStyle=theme.dark?'#e3edf2':theme.colors[0];ctx.beginPath();ctx.roundRect(left,1410,w,155,24);ctx.fill();ctx.fillStyle=footerAccent;ctx.textAlign='center';fit(ctx,stat.value,w-30,47,24);ctx.fillText(stat.value,left+w/2,1476);ctx.fillStyle=theme.dark?'#49606a':'#657577';ctx.font='500 22px "Anuphan",sans-serif';ctx.fillText(stat.label,left+w/2,1523);});
 ctx.textAlign='left';ctx.fillStyle='#647876';ctx.font='500 26px "Anuphan",sans-serif';
 if(places.length)ctx.fillText(ellipsis(ctx,places.map(p=>p.title||p.place).join('  ·  '),940),70,1670);else ctx.fillText('แค่ได้ไปด้วยกัน ก็เป็นความทรงจำแล้ว',70,1670);
 ctx.textAlign='center';ctx.fillStyle=footerAccent;ctx.font='700 29px "Anuphan",sans-serif';ctx.fillText('ทริปจบแล้ว แต่ความทรงจำยังอยู่ ♡',540,1840);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('สร้างรูปไม่สำเร็จ กรุณาลองใหม่')),'image/png'));
}

async function renderMapPoster({trip,dateLabel,members,places,total,traveled,themeId,imageSrc,crop,showExpenses,mapImage,format}){
 await document.fonts?.ready;
 const [photo,avatars,mapPhoto]=await Promise.all([loadRecapImage(imageSrc),loadParticipantImages(members),loadRecapImage(mapImage?.src)]);
 const post=format==='post',height=post?1350:1920,cover=post?380:670,theme=recapThemes[themeId]||recapThemes.nature;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('อุปกรณ์นี้ยังสร้างรูปไม่ได้');
 ctx.fillStyle=theme.colors[0];ctx.fillRect(0,0,1080,height);
 if(photo){const rect=coverImageRect(photo.naturalWidth,photo.naturalHeight,1080,cover,crop);ctx.save();ctx.beginPath();ctx.rect(0,0,1080,cover);ctx.clip();ctx.drawImage(photo,rect.x,rect.y,rect.width,rect.height);ctx.restore();const shade=ctx.createLinearGradient(0,0,0,cover);shade.addColorStop(0,'#14272855');shade.addColorStop(.4,'#14272811');shade.addColorStop(1,'#112326dd');ctx.fillStyle=shade;ctx.fillRect(0,0,1080,cover);}
 const ink=photo||theme.dark?'#fff':'#263e43';ctx.fillStyle=ink;ctx.textAlign='left';ctx.font='900 25px Nunito,sans-serif';ctx.fillText('TripMate. / OUR LITTLE GETAWAY',70,70);
 fit(ctx,String(trip?.name||'ทริปของเรา'),940,post?65:80,36);ctx.fillText(ellipsis(ctx,trip?.name||'ทริปของเรา',940),70,cover-150);ctx.font='500 27px "Anuphan",sans-serif';ctx.fillText(ellipsis(ctx,dateLabel||'',940),70,cover-96);ctx.font='500 26px "Anuphan",sans-serif';ctx.fillText('เก็บความทรงจำดี ๆ ไว้ด้วยกัน ♡',70,cover-48);
 ctx.fillStyle='#fffdf8';ctx.beginPath();ctx.roundRect(0,cover-18,1080,height-cover+18,[35,35,0,0]);ctx.fill();
 const accent=theme.dark?'#37657a':theme.accent;ctx.fillStyle=accent;ctx.font='800 24px "Anuphan",sans-serif';ctx.fillText(`เพื่อนร่วมทริป · ${members.length} คน`,70,cover+34);
 const size=post?88:108,people=participantLayout(members.length,940,{avatarSize:size,defaultOverlap:size/4,minAvatarSize:size*.6});
 members.forEach((member,index)=>{const s=people.avatarSize,left=70+index*people.step,top=cover+50+(size-s)/2,cx=left+s/2,cy=top+s/2,r=(s-6)/2;ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();ctx.fillStyle=theme.colors[1];ctx.fillRect(left,top,s,s);if(avatars[index]){const image=avatars[index],rect=coverImageRect(image.naturalWidth,image.naturalHeight,s,s);ctx.drawImage(image,left+rect.x,top+rect.y,rect.width,rect.height);}else{ctx.fillStyle=accent;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${s*.4}px "Anuphan",sans-serif`;ctx.fillText(participantInitial(member.name),cx,cy);}ctx.restore();ctx.strokeStyle='#fff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();});
 const statY=cover+(post?158:185),stats=[`${places.length} สถานที่`];if(mapImage?.distance>0)stats.push(`${(mapImage.distance/1000).toFixed(1)} กม. ตามถนน`);else if(traveled>0)stats.push(`${(traveled/1000).toFixed(1)} กม. ที่บันทึก`);if(showExpenses)stats.push(`${new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(total)} ฿`);
 ctx.textBaseline='alphabetic';ctx.fillStyle=theme.colors[0];ctx.beginPath();ctx.roundRect(70,statY,940,post?75:100,22);ctx.fill();ctx.fillStyle=accent;ctx.textAlign='center';ctx.font='700 28px "Anuphan",sans-serif';ctx.fillText(ellipsis(ctx,stats.join('   ·   '),900),540,statY+(post?47:60));
 const mapY=statY+(post?126:170),mapHeight=post?485:650;ctx.textAlign='left';ctx.fillStyle=accent;ctx.font='800 28px "Anuphan",sans-serif';ctx.fillText(mapPhoto?'เส้นทางความทรงจำ':'สถานที่ในความทรงจำ',70,mapY-25);
 if(mapPhoto){ctx.fillStyle='#F8F5EE';ctx.beginPath();ctx.roundRect(70,mapY,940,mapHeight,25);ctx.fill();const scale=Math.min(940/mapPhoto.naturalWidth,mapHeight/mapPhoto.naturalHeight),w=mapPhoto.naturalWidth*scale,h=mapPhoto.naturalHeight*scale;ctx.save();ctx.beginPath();ctx.roundRect(70,mapY,940,mapHeight,25);ctx.clip();ctx.drawImage(mapPhoto,70+(940-w)/2,mapY+(mapHeight-h)/2,w,h);ctx.restore();}
 else{ctx.fillStyle='#647876';ctx.font='500 27px "Anuphan",sans-serif';ctx.fillText(ellipsis(ctx,places.map(p=>p.title||p.place).join(' · ')||'แค่ได้ไปด้วยกัน ก็เป็นความทรงจำแล้ว',940),70,mapY+70);}
 ctx.fillStyle='#647876';ctx.font='500 23px "Anuphan",sans-serif';ctx.textAlign='left';if(mapPhoto)ctx.fillText(ellipsis(ctx,`A · ${places[0]?.title||places[0]?.place||''}  →  ${places.at(-1)?.title||places.at(-1)?.place||''}`,940),70,mapY+mapHeight+36);
 ctx.fillStyle=accent;ctx.textAlign='center';ctx.font='700 28px "Anuphan",sans-serif';ctx.fillText('ทริปจบแล้ว แต่ความทรงจำยังอยู่ ♡',540,height-55);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('สร้างรูปไม่สำเร็จ กรุณาลองใหม่')),'image/png'));
}
