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
