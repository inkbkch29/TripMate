import {it,expect} from 'vitest';
import {bangkokDate,tripPhase,departureDays,nextPlanningStop,visitedStopCount,homeExpenseSummary} from './home-dashboard';
it('uses Bangkok calendar dates and respects explicit completed status',()=>{
 expect(bangkokDate(new Date('2026-10-24T18:00:00Z'))).toBe('2026-10-25');
 const trip={start_date:'2026-10-31',end_date:'2026-11-02'};
 expect(tripPhase(trip,'2026-10-25')).toBe('upcoming');expect(departureDays(trip,'2026-10-25')).toBe(6);
 expect(tripPhase(trip,'2026-11-01')).toBe('active');expect(tripPhase(trip,'2026-11-03')).toBe('completed');
 expect(tripPhase({...trip,status:'completed'},'2026-10-25')).toBe('completed');
});
it('uses the clock rather than old manual completion flags for the planning activity',()=>{
 const stops=[{id:'later',day:2,time:'08:00'},{id:'late',day:1,time:'12:00'},{id:'early',day:1,time:'09:00'},{id:'done',day:1,time:'07:00',done:true}],trip={start_date:'2026-10-26',end_date:'2026-10-28'};
 expect(nextPlanningStop(stops,trip,new Date('2026-10-25T08:00:00+07:00')).id).toBe('done');
 expect(nextPlanningStop(stops,trip,new Date('2026-10-26T10:00:00+07:00')).id).toBe('early');
 expect(nextPlanningStop([],trip)).toBeNull();
});
it('counts a stop once from actual completion/checkins, ignoring orphan checkins',()=>{
 expect(visitedStopCount([{id:'a',done:true},{id:'b'},{id:'c'}],[{stopId:'b',checkedInAt:'now'},{stopId:'b',checkedInAt:'again'},{stopId:'removed',checkedInAt:'now'}])).toBe(2);
});
it('keeps spending separate from outstanding debt and confirmed settlements',()=>{
 const members=[{id:'a'},{id:'b'}],expenses=[{id:'e',amount:100,paidBy:'a',participants:['a','b'],approvalStatus:'approved'}];
 expect(homeExpenseSummary(expenses,[],[],members)).toEqual({spent:100,outstanding:50,pending:0,unissued:0});
 expect(homeExpenseSummary(expenses,[],[{from:'b',to:'a',amount:50,status:'confirmed'},{from:'b',to:'a',amount:50,status:'pending'}],members)).toEqual({spent:100,outstanding:0,pending:0,unissued:0});
 expect(homeExpenseSummary(expenses,[],[{from:'b',to:'a',amount:50,status:'pending'}],members)).toEqual({spent:100,outstanding:50,pending:1,unissued:0});
 const linked={id:'c',expenseId:'e',amount:100,perPerson:50,receiver:'a',participants:['a','b'],paid:['b']};
 expect(homeExpenseSummary(expenses,[linked],[],members)).toEqual({spent:100,outstanding:0,pending:0,unissued:0});
 expect(homeExpenseSummary([],[{...linked,expenseId:null,isFund:true,paid:[]}],[],members)).toEqual({spent:0,outstanding:50,pending:0,unissued:0});
});

it('does not claim settlement while later installments have not been billed',()=>{
 const members=[{id:'a'},{id:'b'}],plan={installments:[{id:'i1',bill_satang:845000},{id:'i2',bill_satang:845000}]};
 const expense={id:'p',amount:16900,isInstallmentParent:true,installmentPlan:plan};
 const first={id:'c1',installmentId:'i1',receiver:'a',participants:['b'],paid:['b'],payments:{b:{amount:8456,status:'paid',receivedAmount:8456}}};
 expect(homeExpenseSummary([expense],[first],[],members)).toEqual({spent:16900,outstanding:0,pending:0,unissued:8450});
 const second={id:'c2',installmentId:'i2',receiver:'a',participants:['b'],paid:[],payments:{b:{amount:8450,status:'unpaid'}}};
 expect(homeExpenseSummary([expense],[first,second],[],members)).toEqual({spent:16900,outstanding:8450,pending:0,unissued:0});
 expect(homeExpenseSummary([expense],[first,{...second,paid:['b'],payments:{b:{amount:8450,status:'paid',receivedAmount:8450}}}],[],members)).toEqual({spent:16900,outstanding:0,pending:0,unissued:0});
});
