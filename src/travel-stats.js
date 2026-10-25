export function travelStatsItems({places=0,total=0,showExpenses=true}){
 const items=[{id:'places',value:String(places),label:'สถานที่ในทริป'}];
 if(showExpenses)items.push({id:'expenses',value:`฿${new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(total)}`,label:'ค่าใช้จ่ายรวม'});
 return items;
}
export function drawTravelStats(ctx,options,icons){
 const items=travelStatsItems(options),single=items.length===1;
 ctx.save();ctx.shadowBlur=0;
 if(!single){ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(540,1380);ctx.lineTo(540,1485);ctx.stroke();}
 items.forEach((stat,index)=>{
  let size=48;do{ctx.font=`700 ${size}px "Anuphan",sans-serif`;if(ctx.measureText(stat.value).width<=330)break;size-=2;}while(size>24);
  const width=ctx.measureText(stat.value).width,center=single?540:310+index*460,left=center-(width+70)/2;
  ctx.drawImage(icons[stat.id],left,1388,54,54);ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.shadowColor='rgba(9,24,32,.3)';ctx.shadowBlur=5;ctx.fillText(stat.value,left+70,1436);
  ctx.font='500 23px "Anuphan",sans-serif';ctx.fillStyle='rgba(255,255,255,.82)';ctx.textAlign='center';ctx.fillText(stat.label,center,1480);
 });ctx.restore();
}
