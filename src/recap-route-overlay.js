import {recapRoutePlaces} from './recap-places';
// Decorative itinerary layout. Coordinates describe the cover, never geography.
export function numberedRouteLayout(count,{x=100,y=180,width=880,height=350}={}){
 const total=Math.max(0,Math.floor(Number(count)||0));if(!total)return [];
 const columns=Math.min(total,Math.max(2,Math.ceil(Math.sqrt(total*2.5)))),rows=Math.ceil(total/columns);
 const stepX=columns>1?width/(columns-1):0,stepY=rows>1?height/(rows-1):0;
 const radius=Math.min(23,stepX?stepX*.24:23,stepY?stepY*.24:23);
 return Array.from({length:total},(_,index)=>{const row=Math.floor(index/columns),column=index%columns,reverse=row%2===1;
  return {number:index+1,x:total===1?x+width*.5:x+(reverse?columns-1-column:column)*stepX,y:rows===1?y+height*.5+Math.sin(index*1.7)*height*.22:y+row*stepY,radius};
 });
}
export function routeCurve(a,b){const dx=b.x-a.x,dy=b.y-a.y;return {cx:(a.x+b.x)/2+(Math.abs(dx)<1?(a.x>=540?120:-120):0),cy:(a.y+b.y)/2+(Math.abs(dx)>1?(a.number%2? -45:45):0)};}
export function routeLabel(point,count,area,text){
 const columns=Math.min(count,Math.max(2,Math.ceil(Math.sqrt(count*2.5)))),step=columns>1?area.width/(columns-1):280;
 const width=Math.min(240,step*.82),fontSize=Math.max(8,Math.min(23,width/8));
 const letters=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('th',{granularity:'grapheme'}).segment(String(text||''))].map(item=>item.segment):Array.from(String(text||''));
 const limit=Math.max(3,Math.floor(width/(fontSize*.86))),lines=[];
 while(letters.length&&lines.length<2){let line=letters.splice(0,limit).join('').trim();if(lines.length===1&&letters.length)line=line.slice(0,-1)+'…';lines.push(line);}
 return {width,fontSize,lines,y:point.y+point.radius+16};
}
export function drawNumberedRoute(ctx,places,area,{dark=false,color='#638ca7'}={}){
 places=recapRoutePlaces(places);
 const points=numberedRouteLayout(places.length,area);if(!points.length)return;
 ctx.save();ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;ctx.strokeStyle=dark?'#638ca7':'#e4f6ff';ctx.lineWidth=3;ctx.lineCap='round';ctx.shadowColor=dark?'#ffffffaa':'#17384b88';ctx.shadowBlur=9;ctx.setLineDash([3,11]);
 points.slice(1).forEach((point,index)=>{const previous=points[index],control=routeCurve(previous,point);ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.quadraticCurveTo(control.cx,control.cy,point.x,point.y);ctx.stroke();});ctx.setLineDash([]);
 points.forEach(point=>{ctx.beginPath();ctx.arc(point.x,point.y,point.radius,0,Math.PI*2);ctx.fillStyle=dark?'#eef8ff':'#fffffff0';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#547b96';ctx.font=`700 ${Math.max(7,point.radius*.86)}px Nunito,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(point.number),point.x,point.y+1);const label=routeLabel(point,places.length,area,places[point.number-1].place);ctx.fillStyle='#fff';ctx.font=`600 ${label.fontSize}px \"Anuphan\",sans-serif`;ctx.textBaseline='top';ctx.shadowColor='#17313bbb';ctx.shadowBlur=5;label.lines.forEach((line,index)=>ctx.fillText(line,point.x,label.y+index*(label.fontSize+5)));ctx.shadowBlur=9;});ctx.restore();
}
