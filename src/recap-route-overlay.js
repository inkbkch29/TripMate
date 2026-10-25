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
export function routeCurve(a,b){const dx=b.x-a.x,dy=b.y-a.y;return {cx:(a.x+b.x)/2+(Math.abs(dx)<1?48:0),cy:(a.y+b.y)/2+(Math.abs(dx)>1?(a.number%2? -45:45):0)};}
export function drawNumberedRoute(ctx,count,area,{dark=false}={}){
 const points=numberedRouteLayout(count,area);if(!points.length)return;
 ctx.save();ctx.strokeStyle=dark?'#638ca7':'#e4f6ff';ctx.lineWidth=3;ctx.lineCap='round';ctx.shadowColor=dark?'#ffffffaa':'#17384b88';ctx.shadowBlur=9;ctx.setLineDash([3,11]);
 points.slice(1).forEach((point,index)=>{const previous=points[index],control=routeCurve(previous,point);ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.quadraticCurveTo(control.cx,control.cy,point.x,point.y);ctx.stroke();});ctx.setLineDash([]);
 points.forEach(point=>{ctx.beginPath();ctx.arc(point.x,point.y,point.radius,0,Math.PI*2);ctx.fillStyle=dark?'#eef8ff':'#fffffff0';ctx.fill();ctx.strokeStyle='#cee9f8';ctx.lineWidth=2;ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#547b96';ctx.font=`700 ${Math.max(7,point.radius*.86)}px Nunito,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(point.number),point.x,point.y+1);ctx.shadowBlur=9;});ctx.restore();
}
