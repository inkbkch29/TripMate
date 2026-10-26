import {describe,it,expect} from 'vitest';
import {storyDateLabel,storyPlaceTitle,storyTripTitle} from './recap-text';
describe('English cover copy',()=>{
 it('uses English month and Gregorian year across same-day, month and year boundaries',()=>{
  expect(storyDateLabel({start_date:'2026-10-21',end_date:'2026-10-23'})).toBe('Oct 21–23, 2026 · 3D2N');
  expect(storyDateLabel({start_date:'2026-10-21',end_date:'2026-10-21'})).toBe('Oct 21, 2026 · 1D0N');
  expect(storyDateLabel({start_date:'2026-10-31',end_date:'2026-11-02'})).toBe('Oct 31 – Nov 2, 2026 · 3D2N');
  expect(storyDateLabel({start_date:'2026-12-31',end_date:'2027-01-02'})).toBe('Dec 31, 2026 – Jan 2, 2027 · 3D2N');
 });
 it('handles absent or invalid dates without Thai fallback or invalid duration',()=>{
  expect(storyDateLabel({})).toBe('');expect(storyDateLabel({start_date:'2026-02-30'})).toBe('');
  expect(storyDateLabel({start_date:'2026-10-21',end_date:'2026-10-20'})).toBe('Oct 21, 2026');
 });
 it('uses the actual place field without translations or activity/English-name fallbacks',()=>{
  expect(storyPlaceTitle({place:'น้ำตกเอราวัณ',title:'ไปเที่ยวน้ำตก',name_en:'Erawan Falls'})).toBe('น้ำตกเอราวัณ');
  expect(storyPlaceTitle({title:'เข้าที่พัก'})).toBe('');
  expect(storyPlaceTitle({place:'บ้านอิงภู',title:'เข้าที่พัก'})).toBe('บ้านอิงภู');
  expect(storyTripTitle({name:'กาญจนบุรี'})).toBe('Kanchanaburi');
  expect(storyTripTitle({name:'ทดสอบ',english_name:'Weekend Escape'})).toBe('Weekend Escape');
  expect(storyTripTitle({name:'Weekend Escape'})).toBe('Weekend Escape');
  expect(storyTripTitle({name:'ทดสอบ'})).toBe('Our Trip');
 });
});
