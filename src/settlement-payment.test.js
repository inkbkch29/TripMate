import {it,expect} from 'vitest';
import {canSubmitSettlement} from './settlement-payment';
import {tripLedger} from './trip-ledger';
it('allows a friend to pay, while keeping receiver and pending slips protected',()=>{
 const transfer={from:'debtor',to:'receiver'};
 expect(canSubmitSettlement(transfer,null,'friend')).toBe(true);
 expect(canSubmitSettlement(transfer,null,'debtor')).toBe(true);
 expect(canSubmitSettlement(transfer,null,'receiver')).toBe(false);
 expect(canSubmitSettlement(transfer,{status:'pending'},'friend')).toBe(false);
 expect(canSubmitSettlement(transfer,{status:'confirmed'},'friend')).toBe(false);
 expect(canSubmitSettlement(transfer,{status:'rejected'},'friend')).toBe(true);
});
it('deducts the original debtor only after a friend’s payment is confirmed',()=>{
 const expense={amount:100,paidBy:'receiver',participants:['debtor'],shares:{debtor:100}};
 const payment={from:'debtor',to:'receiver',submittedBy:'friend',amount:100,status:'pending'};
 const ledger=status=>tripLedger([expense],[],[{...payment,status}],['debtor','receiver','friend']);
 expect(ledger('pending').totals.debtor.pay).toBe(100);
 expect(ledger('confirmed').totals.debtor.pay).toBe(0);
 expect(ledger('confirmed').totals.friend).toEqual({pay:0,receive:0,fundPay:0,fundReceive:0});
});
