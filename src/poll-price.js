const money=value=>'฿'+new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(value));
export function pollPriceData(option={}){
 // Missing structured type belongs to the legacy contract, with no inferred unit.
 if(option.priceType==null)return {price:option.price===''?null:option.price??null};
 const {priceType,priceUnit='person'}=option;
 if(!['none','fixed','range'].includes(priceType)||!['person','total'].includes(priceUnit))throw new Error('เลือกรูปแบบและหน่วยราคา');
 if(priceType==='none')return {price:null,priceType,priceMin:null,priceMax:null,priceUnit};
 const parse=value=>{if(value==null||String(value).trim()==='')throw new Error('กรอกราคา หรือเลือกไม่ระบุราคา');const n=Number(value);if(!Number.isFinite(n)||n<0||n>9999999999.99||Math.abs(n*100-Math.round(n*100))>.0001)throw new Error('ใช้ราคาไม่ติดลบ และทศนิยมไม่เกิน 2 ตำแหน่ง');return n;};
 const min=parse(option.priceMin),max=priceType==='range'?parse(option.priceMax):null;
 if(max!=null&&max<min)throw new Error('ราคาสูงสุดต้องไม่น้อยกว่าราคาต่ำสุด');
 return {price:priceType==='fixed'?min:null,priceType,priceMin:min,priceMax:max,priceUnit};
}
export function formatPollPrice(option){
 if(!option)return '';
 if(option.priceType==null)return option.price==null||option.price===''?'':money(option.price);
 try{const p=pollPriceData(option);if(p.priceType==='none')return '';const unit=p.priceUnit==='person'?'คน':'ทั้งหมด';return `${p.priceType==='range'?'ประมาณ ':''}${money(p.priceMin)}${p.priceType==='range'?'–'+money(p.priceMax):''} / ${unit}`;}catch{return '';}
}
