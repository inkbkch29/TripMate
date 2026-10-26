import { splitAmount } from './finance';

export const cents = value => Math.round(Number(value || 0) * 100);
export function splitReceipt({ items = [], serviceCharge = 0, tax = 0, discount = 0 }, memberIds) {
  const allowed = new Set(memberIds);
  const base = Object.fromEntries(memberIds.map(id => [id, 0]));
  const errors = [];
  if (!items.length) errors.push('เพิ่มรายการอาหารอย่างน้อย 1 รายการ');
  let subtotal = 0;
  items.forEach((item, index) => {
    const amount = cents(item.amount);
    const people = [...new Set(item.participants || [])];
    if (!item.name?.trim() || !Number.isFinite(amount) || amount <= 0) errors.push(`ตรวจชื่อและราคาของรายการที่ ${index + 1}`);
    if (!people.length || people.some(id => !allowed.has(id))) errors.push(`เลือกว่าใครกินรายการที่ ${index + 1}`);
    if (amount > 0 && Number.isFinite(amount)) {
      subtotal += amount;
      splitAmount(amount / 100, people).forEach(share => { if (allowed.has(share.userId)) base[share.userId] += cents(share.amount); });
    }
  });
  const extras = [serviceCharge, tax, discount].map(cents);
  if (extras.some(value => !Number.isFinite(value) || value < 0)) errors.push('ค่าบริการ ภาษี และส่วนลดต้องไม่ติดลบ');
  if (extras[2] > subtotal) errors.push('ส่วนลดต้องไม่เกินยอดอาหาร');
  const total = subtotal + extras[0] + extras[1] - extras[2];
  if (!Number.isSafeInteger(total) || total <= 0) errors.push('ยอดรวมต้องมากกว่า 0');
  if (errors.length) return { errors, subtotal: subtotal / 100, total: Number.isFinite(total) ? total / 100 : 0, participants: [], shares: {} };
  // Allocate the final total in cents using largest remainders. Extras and discounts
  // follow each person's food share; nobody is charged for food they did not select.
  const participants = memberIds.filter(id => base[id] > 0);
  const rows = participants.map((id, order) => {
    const exact = subtotal ? base[id] * total / subtotal : 0;
    return { id, order, amount: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = total - rows.reduce((sum, row) => sum + row.amount, 0);
  [...rows].sort((a,b) => b.remainder-a.remainder || a.order-b.order).forEach(row => { if (remaining-- > 0) row.amount += 1; });
  return { errors, subtotal: subtotal / 100, total: total / 100, participants, shares: Object.fromEntries(rows.map(row => [row.id, row.amount / 100])) };
}

export function parseReceiptText(text) {
  const result = { items: [], serviceCharge: 0, tax: 0, discount: 0, expectedTotal: '' };
  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
  const normalized = String(text || '').replace(/[๐-๙]/g, digit => thaiDigits.indexOf(digit));
  for (const raw of normalized.split(/\r?\n/)) {
    const line = raw.trim();
    const match = line.match(/^(.*?)\s+[-฿฿\s]*([\d,]+(?:\.\d{1,2})?)\s*(?:บาท|THB|฿)?\s*$/i);
    if (!match) continue;
    const name = match[1].trim(); const amount = Number(match[2].replaceAll(',', ''));
    if (!/[a-zA-Zก-๙]/.test(name) || !Number.isFinite(amount) || amount <= 0) continue;
    if (/tax\s*id|เลขประจำตัว|เลขที่ใบ|ใบเสร็จ|receipt|invoice|โทร|tel|วันที่|date|time|table|โต๊ะ|cash|change|เงินสด|เงินทอน|รับเงิน/i.test(name)) continue;
    if (/subtotal|sub total|รวมรายการ|รวมเป็นเงิน|ยอดก่อน/i.test(name)) continue;
    if (/grand\s*total|net\s*total|ยอดสุทธิ|รวมสุทธิ|ยอดชำระ|^total\b|ยอดรวม|รวมทั้งสิ้น|^รวม(?:เงิน)?$/i.test(name)) { result.expectedTotal = amount; continue; }
    if (/service|ค่าบริการ/i.test(name)) { result.serviceCharge = amount; continue; }
    if (/vat|tax|ภาษี/i.test(name)) { result.tax = amount; continue; }
    if (/discount|ส่วนลด/i.test(name)) { result.discount = amount; continue; }
    if (/cash|change|เงินสด|เงินทอน|รับเงิน|โทร|tel|tax id|เลขประจำตัว|วันที่|date|time|ใบเสร็จ|receipt|invoice|table|โต๊ะ/i.test(name)) continue;
    result.items.push({ name, amount, participants: [] });
  }
  return result;
}

export function receiptItemCategory(name='') {
  if (/น้ำเปล่า|น้ำดื่ม|น้ำแข็ง|drinking water|\bice\b|bottled water/i.test(name)) return 'water';
  if (/น้ำหวาน|น้ำอัดลม|ชาเย็น|ชาไทย|ชาเขียว|กาแฟ|ลาเต้|โค้ก|เป๊ปซี่|น้ำผลไม้|เบียร์|coffee|latte|tea\b|cola|beer|juice/i.test(name)) return 'drink';
  return 'food';
}

// Show useful provisional totals while some dishes still have no consumers.
// Extras are only included after the entire bill is valid and allocated.
export function receiptProgress(receipt,memberIds) {
  const allowed=new Set(memberIds);
  const items=receipt.items||[];
  const validAmount=item=>Number.isFinite(Number(item.amount))&&cents(item.amount)>0;
  const assigned=items.filter(item=>validAmount(item)&&item.name?.trim()&&item.participants?.length&&item.participants.every(id=>allowed.has(id)));
  const subtotal=items.filter(validAmount).reduce((sum,item)=>sum+cents(item.amount),0)/100;
  const allocated=assigned.reduce((sum,item)=>sum+cents(item.amount),0)/100;
  const result=splitReceipt(receipt,memberIds);
  const complete=result.errors.length===0;
  const preview=complete?result:splitReceipt({items:assigned},memberIds);
  const rounded=complete&&receipt.roundUp?roundReceiptShares(preview.shares):null;
  return {costShares:preview.shares,fundShares:rounded?.fundShares||{},fundRemainder:rounded?.fundRemainder||0,costTotal:preview.total,subtotal,allocated,unallocated:Math.round((subtotal-allocated)*100)/100,unallocatedCount:items.length-assigned.length,complete,shares:rounded?.chargedShares||preview.shares,total:rounded?.chargedTotal??preview.total,errors:result.errors};
}

// Round once per person's final bill share, after service/tax/discount.
export function roundReceiptShares(shares) {
 const chargedShares={},fundShares={};let cost=0,charged=0;
 for(const [id,value] of Object.entries(shares||{})){
  const amount=cents(value);if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Invalid receipt share');
  const rounded=Math.ceil(amount/100)*100;
  chargedShares[id]=rounded/100;fundShares[id]=(rounded-amount)/100;
  cost+=amount;charged+=rounded;
 }
 return {chargedShares,fundShares,originalTotal:cost/100,chargedTotal:charged/100,fundRemainder:(charged-cost)/100};
}

// Let people correct an OCR line classified as food without typing its amount twice.
export function moveReceiptItemToExtra(receipt,itemId,field){
 if(!['serviceCharge','tax','discount'].includes(field))throw new Error('Invalid receipt extra');
 const item=receipt.items.find(row=>row.id===itemId);
 const amount=cents(item?.amount),existing=cents(receipt[field]);
 if(!item||!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(existing)||existing<0)throw new Error('ตรวจราคาของรายการก่อนย้าย');
 return {...receipt,items:receipt.items.filter(row=>row.id!==itemId),[field]:(existing+amount)/100,reviewed:false};
}

// Quantity is optional metadata. Legacy amount remains the line total.
export function receiptQuantity(item,patch){
 const quantity=patch.quantity??item.quantity??1;
 const unitAmount=patch.unitAmount??item.unitAmount??item.amount??'';
 const valid=Number.isSafeInteger(Number(quantity))&&Number(quantity)>0;
 return {...patch,quantity,unitAmount,amount:valid&&unitAmount!==''?String(cents(unitAmount)*Number(quantity)/100):''};
}
