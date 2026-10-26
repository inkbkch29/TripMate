import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import {pollPriceData,formatPollPrice} from './poll-price';
import PollOptionEditor,{editableOption} from './PollOptionEditor';
it('formats fixed and range prices with both units and hides unspecified prices',()=>{
 for(const [priceType,priceUnit,expected] of [['fixed','person','฿1,500 / คน'],['range','person','ประมาณ ฿1,200–฿1,800 / คน'],['fixed','total','฿15,900 / ทั้งหมด'],['range','total','ประมาณ ฿15,000–฿18,000 / ทั้งหมด']]){
 const p={priceType,priceUnit,priceMin:priceType==='fixed'?(priceUnit==='person'?1500:15900):(priceUnit==='person'?1200:15000),priceMax:priceUnit==='person'?1800:18000};expect(formatPollPrice(p)).toBe(expected);
 }
 expect(formatPollPrice({priceType:'none',price:100})).toBe('');expect(formatPollPrice({price:15900})).toBe('฿15,900');expect(formatPollPrice({})).toBe('');expect(pollPriceData({priceType:'none',priceMin:-5})).toMatchObject({price:null,priceMin:null,priceMax:null});
});
it('rejects negative, incomplete, reversed, nonfinite and excessive precision prices, but accepts zero',()=>{
 for(const p of [{priceMin:-1},{priceMin:''},{priceMin:'NaN'},{priceMin:'Infinity'},{priceMin:'12.345'},{priceMin:10,priceMax:9,priceType:'range'},{priceMin:10,priceMax:'',priceType:'range'}])expect(()=>pollPriceData({priceType:'fixed',priceUnit:'person',...p})).toThrow();
 expect(pollPriceData({priceType:'fixed',priceMin:0,priceUnit:'total'})).toMatchObject({price:0,priceMin:0,priceMax:null});
});
it('preserves a legacy price without inferring a unit until the user changes pricing',()=>{
 const legacy=editableOption({id:'old',name:'ที่พัก',price:100});expect(legacy.priceType).toBeUndefined();expect(pollPriceData(legacy)).toEqual({price:100});
 expect(editableOption().priceType).toBe('none');
});
it('reveals only relevant price fields, keeps options independent, and retains custom values when switching type',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let draft;
 function Harness(){const [options,setOptions]=useState([editableOption(),editableOption()]);draft=options;return options.map((o,i)=><PollOptionEditor key={i} index={i} value={o} onChange={v=>setOptions(old=>old.map((x,n)=>n===i?v:x))}/>);}
 const click=async el=>act(async()=>el.click());
 const choose=async text=>{await act(async()=>host.querySelector('[role="combobox"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));await click([...document.querySelectorAll('[role="option"]')].find(el=>el.textContent===text));};
 const fill=async(label,value)=>{const l=[...host.querySelectorAll('label')].find(el=>el.textContent===label);await act(async()=>{const el=document.getElementById(l.htmlFor);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});};
 try{await act(async()=>root.render(<Harness/>));expect(host.querySelectorAll('input[type="number"]')).toHaveLength(0);host.querySelector('details').open=true;
 await choose('ช่วงราคาประมาณ');expect(host.querySelectorAll('input[type="number"]')).toHaveLength(2);await fill('ราคาต่ำสุด ฿','1200');await fill('ราคาสูงสุด ฿','1800');await click([...host.querySelectorAll('button')].find(el=>el.textContent==='ต่อคน'));expect(draft[0]).toMatchObject({priceType:'range',priceMin:'1200',priceMax:'1800',priceUnit:'person'});expect(draft[1].priceType).toBe('none');expect(host.textContent).toContain('ประมาณ ฿1,200–฿1,800 / คน');
 await choose('ราคาคงที่');expect(host.querySelectorAll('input[type="number"]')).toHaveLength(1);await choose('ไม่ระบุราคา');expect(host.querySelectorAll('input[type="number"]')).toHaveLength(0);expect(formatPollPrice(draft[0])).toBe('');await choose('ช่วงราคาประมาณ');expect(draft[0].priceMax).toBe('1800');
 }finally{await act(async()=>root.unmount());host.remove();}
});
