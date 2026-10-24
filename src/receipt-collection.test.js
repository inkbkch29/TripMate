import {describe,it,expect} from 'vitest';
import {upsertReceiptCollection} from './receipt-collection';
import {tripLedger,collectionFundTotals} from './trip-ledger';
const bill={id:'food',title:'Food',amount:171.55,paidBy:'a',participants:['a','b'],shares:{a:142.96,b:28.59},expenseDate:'2026-10-24',approvalStatus:'approved',receiptBreakdown:{roundUp:true}};
describe('rounded receipt collection accounting',()=>{
 it('creates one linked collection with exact person charges and fund contributions',()=>{
  const [c]=upsertReceiptCollection([],bill);expect(c.amount).toBe(172);expect(c.originalAmount).toBe(171.55);expect(c.fundRemainder).toBe(.45);expect(c.payments.b.amount).toBe(29);expect(c.paid).toEqual(['a']);
  const ledger=tripLedger([bill],[c],[],['a','b']);expect(ledger.cost).toBe(171.55);expect(ledger.expenseTransfers).toEqual([]);expect(ledger.dues.map(d=>d.amount)).toEqual([29]);expect(ledger.fundExpected).toBe(.45);expect(ledger.fundReceived).toBe(.04);
 });
 it('adds only that payer fund share after confirmation and does not create another expense debt',()=>{
  const [c]=upsertReceiptCollection([],bill);c.paid.push('b');c.payments.b.status='paid';const ledger=tripLedger([bill],[c],[],['a','b']);expect(ledger.dues).toHaveLength(0);expect(ledger.fundReceived).toBe(.45);expect(ledger.fundExpected).toBe(.45);expect(ledger.cost).toBe(171.55);
 });
 it('does not create collection charges for a receipt awaiting approval',()=>{expect(upsertReceiptCollection([],{...bill,approvalStatus:'pending'})).toEqual([]);const [c]=upsertReceiptCollection([],bill);expect(tripLedger([{...bill,approvalStatus:'pending'}],[c],[],['a','b']).dues).toEqual([]);});
 it('repeated saves preserve payment slips and do not duplicate the linked collection',()=>{
  let collections=upsertReceiptCollection([],bill);collections[0].payments.b={...collections[0].payments.b,status:'pending',slipPath:'test.webp'};collections=upsertReceiptCollection(collections,{...bill,title:'Renamed'});expect(collections).toHaveLength(1);expect(collections[0].payments.b.slipPath).toBe('test.webp');expect(collectionFundTotals(collections[0]).received).toBe(.04);
 });
});
