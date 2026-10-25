import {moveReceiptItemToExtra} from "./receipt-split";
import {describe,it,expect} from 'vitest';
import {splitReceipt,parseReceiptText} from './receipt-split';
import {calculateBalances,expenseShares} from './finance';
describe('receipt splits',()=>{
 it('charges only the people eating each line and allocates extras proportionally',()=>{
 const bill=splitReceipt({items:[{name:'ข้าว',amount:100,participants:['a']},{name:'ของกลาง',amount:200,participants:['a','b']}],serviceCharge:30,tax:21,discount:15},['a','b','c']);
 expect(bill.errors).toEqual([]);expect(bill.total).toBe(336);expect(bill.shares).toEqual({a:224,b:112});
 expect(calculateBalances([{amount:336,paidBy:'a',participants:bill.participants,shares:bill.shares}],['a','b','c'])).toEqual({a:112,b:-112,c:0});
 });
 it('preserves cents after several shared dishes',()=>{
 const bill=splitReceipt({items:[{name:'A',amount:100,participants:['a','b','c']},{name:'B',amount:99.99,participants:['b','c']}],tax:14,discount:10},['a','b','c']);
 expect(Object.values(bill.shares).reduce((s,v)=>s+Math.round(v*100),0)).toBe(20399);
 });
 it('rejects missing consumers, invalid prices and excessive discounts',()=>{
 expect(splitReceipt({items:[{name:'A',amount:10,participants:[]}]},['a']).errors.length).toBeGreaterThan(0);
 expect(splitReceipt({items:[{name:'A',amount:10,participants:['a']}],discount:11},['a']).errors.length).toBeGreaterThan(0);
 });
 it('extracts food and totals without treating totals as food',()=>{
 const parsed=parseReceiptText('Rice 100.00\nTea 50.00\nSubtotal 150.00\nService 15.00\nVAT 11.55\nDiscount -5.00\nGrand Total 171.55\nCash 200.00\nChange 28.45');
 expect(parsed.items.map(i=>i.name)).toEqual(['Rice','Tea']);expect(parsed.expectedTotal).toBe(171.55);expect(parsed.discount).toBe(5);
 });
 it('reads Thai digits and keeps custom amounts in summaries',()=>{
 expect(parseReceiptText('ข้าว ๑๐๐.๐๐\nยอดสุทธิ ๑๐๐.๐๐').items[0].amount).toBe(100);
 expect(expenseShares({amount:100,participants:['a','b'],shares:{a:80,b:20}})).toEqual([{userId:'a',amount:80},{userId:'b',amount:20}]);
 });
});

describe('progressive allocation',()=>{
 it('shows allocated amounts even when some dishes are unassigned',async()=>{
 const {receiptProgress}=await import('./receipt-split');
 const result=receiptProgress({items:[{name:'shared',amount:1300,participants:['a','b','c','d','e','f','g']},{name:'not selected',amount:170,participants:[]}]},['a','b','c','d','e','f','g']);
 expect(result.subtotal).toBe(1470);expect(result.allocated).toBe(1300);expect(result.unallocated).toBe(170);expect(result.unallocatedCount).toBe(1);expect(result.complete).toBe(false);
 expect(Object.values(result.shares).reduce((sum,v)=>sum+Math.round(v*100),0)).toBe(130000);
 });
 it('only includes extras after every dish is allocated',async()=>{
 const {receiptProgress}=await import('./receipt-split');
 const bill={items:[{name:'rice',amount:100,participants:['a']},{name:'tea',amount:50,participants:[]}],serviceCharge:15};
 expect(receiptProgress(bill,['a','b']).shares).toEqual({a:100});
 bill.items[1].participants=['b'];expect(receiptProgress(bill,['a','b']).shares).toEqual({a:110,b:55});
 });
 it('does not allocate to a removed member',async()=>{
 const {receiptProgress,receiptItemCategory}=await import('./receipt-split');
 expect(receiptProgress({items:[{name:'rice',amount:100,participants:['removed']}]},['a']).allocated).toBe(0);
 expect(receiptItemCategory('Rice')).toBe('food');expect(receiptItemCategory('น้ำแข็ง')).toBe('water');expect(receiptItemCategory('ชาไทย')).toBe('drink');
 });
});

describe('rounded food charges',()=>{
 it('rounds each final person total after tax and discount',async()=>{
  const {receiptProgress}=await import('./receipt-split');
  const result=receiptProgress({roundUp:true,items:[{name:'Rice',amount:100,participants:['a']},{name:'Tea',amount:50,participants:['a','b']}],serviceCharge:15,tax:11.55,discount:5},['a','b','c']);
  expect(result.costTotal).toBe(171.55);expect(result.costShares).toEqual({a:142.96,b:28.59});expect(result.shares).toEqual({a:143,b:29});expect(result.total).toBe(172);expect(result.fundShares).toEqual({a:.04,b:.41});expect(result.fundRemainder).toBe(.45);
 });
 it('rounds once per person rather than once per food line',async()=>{
  const {receiptProgress}=await import('./receipt-split');
  const result=receiptProgress({roundUp:true,items:[{name:'A',amount:10.2,participants:['a']},{name:'B',amount:10.2,participants:['a']}]},['a','b']);
  expect(result.shares).toEqual({a:21});expect(result.fundRemainder).toBe(.6);
 });
 it('keeps a whole baht bill unchanged and does not charge people who ate nothing',async()=>{
  const {receiptProgress}=await import('./receipt-split');
  const result=receiptProgress({roundUp:true,items:[{name:'A',amount:100,participants:['a']}]},['a','b']);expect(result.shares).toEqual({a:100});expect(result.fundRemainder).toBe(0);
 });
});

describe('Thai receipt headers and totals',()=>{
 it('ignores tax identifiers before interpreting tax amounts',()=>{
 const result=parseReceiptText('TAX ID 0123456789012\nเลขประจำตัวผู้เสียภาษี 0123456789012\nข้าวผัด 100.00\nชาเย็น 50.00\nค่าบริการ 15.00\nภาษี 11.55\nส่วนลด 5.00\nรวม 171.55');
 expect(result.items.map(i=>i.name)).toEqual(['ข้าวผัด','ชาเย็น']);
 expect(result.tax).toBe(11.55);expect(result.expectedTotal).toBe(171.55);
 });
});

describe('correct misclassified OCR lines',()=>{
 it('moves an extra out of food and preserves the amount exactly once',()=>{
 const original={items:[{id:'food',name:'ข้าว',amount:100,participants:['a']},{id:'fee',name:'คอาบรธิการ',amount:15,participants:[]}],serviceCharge:5,reviewed:true};
 const corrected=moveReceiptItemToExtra(original,'fee','serviceCharge');
 expect(corrected.items).toHaveLength(1);expect(corrected.serviceCharge).toBe(20);expect(corrected.reviewed).toBe(false);
 expect(splitReceipt(corrected,['a']).total).toBe(120);expect(original.items).toHaveLength(2);
 });
 it('rejects invalid prices without removing the line',()=>{expect(()=>moveReceiptItemToExtra({items:[{id:'bad',amount:'bad'}]},'bad','discount')).toThrow();});
});
