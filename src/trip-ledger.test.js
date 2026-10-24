import {describe,it,expect} from 'vitest';
import {tripLedger} from './trip-ledger';
const collection={id:'c',title:'รถ',amount:140,originalAmount:140,receiver:'a',participants:['a','b','c'],perPerson:46.67,paid:['a'],payments:{a:{amount:46.66,status:'paid'},b:{amount:46.67,status:'paid'},c:{amount:46.67,status:'pending'}}};
describe('unified ledger',()=>{
 it('includes collections without any expenses, subtracting confirmed and retaining pending',()=>{
 const result=tripLedger([],[collection],[],['a','b','c']);expect(result.cost).toBe(140);expect(result.dues).toEqual([{collectionId:'c',title:'รถ',from:'c',to:'a',amount:46.67,fund:false,status:'pending'}]);expect(result.totals.b.pay).toBe(0);expect(result.totals.a.receive).toBe(46.67);
 });
 it('subtracts old paid arrays and uses exact individual payment amounts',()=>{
 const result=tripLedger([],[{...collection,paid:['a','c']}],[],['a','b','c']);expect(result.dues).toHaveLength(0);
 });
 it('keeps fund contributions out of expenses and in their own due amounts',()=>{
 const result=tripLedger([],[{...collection,isFund:true,fundRemainder:140}],[],['a','b','c']);expect(result.cost).toBe(0);expect(result.fundExpected).toBe(140);expect(result.fundReceived).toBe(93.33);expect(result.totals.c).toMatchObject({pay:0,fundPay:46.67});
 });
 it('counts expense settlements once and never applies them to collections',()=>{
 const expense={amount:100,paidBy:'a',participants:['a','b'],shares:{a:20,b:80}};
 const result=tripLedger([expense],[{...collection,participants:['a','b'],paid:['a'],payments:{b:{amount:30,status:'unpaid'}}}],[{from:'b',to:'a',amount:20,status:'confirmed'}],['a','b']);expect(result.expenseTransfers).toEqual([{from:'b',to:'a',amount:60}]);expect(result.totals.b.pay).toBe(90);
 });
 it('allocates rounding contributions only to the fund, and pending money is not received',()=>{
 const result=tripLedger([],[{id:'x',receiver:'a',participants:['a','b','c'],amount:102,originalAmount:100,fundRemainder:2,perPerson:34,paid:['a'],payments:{b:{status:'pending'}}}],[],['a','b','c']);expect(result.cost).toBe(100);expect(result.fundExpected).toBe(2);expect(result.fundReceived).toBe(.67);
 });
});
