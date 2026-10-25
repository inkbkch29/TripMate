import {describe,it,expect} from 'vitest';
import {participantInitial,participantLayout} from './participant-layout';
describe('all participants in one row',()=>{
 it('handles empty, unmeasured and single-member groups',()=>{
  expect(participantLayout(0,320).width).toBe(0);expect(participantLayout(30,0).width).toBe(0);
  expect(participantLayout(1,320)).toEqual({count:1,avatarSize:40,step:0,width:40});
 });
 it('keeps every avatar within the row and leaves an edge visible for large groups',()=>{
  for(const count of [2,6,14,30,100,200])for(const width of [12,200,342,720,940]){
   const row=participantLayout(count,width);expect(row.count).toBe(count);expect(row.step).toBeGreaterThan(0);
   expect(row.width).toBeLessThanOrEqual(width);expect(row.avatarSize+row.step*(count-1)).toBeLessThanOrEqual(width+1e-8);
   expect(row.avatarSize).toBeGreaterThan(0);expect(row.step).toBeLessThan(row.avatarSize);
  }
 });
 it('uses gentle overlap with a small group and shrinks only when crowded',()=>{
  expect(participantLayout(3,342).step).toBe(30);expect(participantLayout(3,342).avatarSize).toBe(40);
  expect(participantLayout(30,200).avatarSize).toBeLessThan(40);
  expect(participantLayout(30,720).avatarSize).toBe(40);
 });
 it('scales the same layout to export pixels',()=>{
  const web=participantLayout(30,342),exported=participantLayout(30,1026,{avatarSize:120,defaultOverlap:30,minAvatarSize:72});
  expect(exported.avatarSize).toBeCloseTo(web.avatarSize*3);expect(exported.step).toBeCloseTo(web.step*3);
 });
 it('provides initials for missing pictures and names',()=>{expect(participantInitial(' alice ')).toBe('A');expect(participantInitial('ออม')).toBe('อ');expect(participantInitial('')).toBe('?');});
});
