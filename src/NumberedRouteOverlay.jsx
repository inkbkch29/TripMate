import React from 'react';
import {numberedRouteLayout,routeCurve} from './recap-route-overlay';
export default function NumberedRouteOverlay({places=[]}){
 const points=numberedRouteLayout(places.length,{x:120,y:70,width:840,height:220});if(!points.length)return null;
 return <svg viewBox="0 0 1080 400" role="img" aria-label={`เส้นทางตกแต่ง ${places.length} สถานที่ตามลำดับแพลน`} style={{position:'absolute',zIndex:1,left:0,top:'8%',width:'100%',height:'52%',pointerEvents:'none',filter:'drop-shadow(0 2px 5px #18384b77)'}}>
  <g fill="none" stroke="#e4f6ff" strokeWidth="3" strokeDasharray="3 11" strokeLinecap="round">{points.slice(1).map((point,index)=>{const previous=points[index],control=routeCurve(previous,point);return <path key={point.number} d={`M ${previous.x} ${previous.y} Q ${control.cx} ${control.cy} ${point.x} ${point.y}`}/>;})}</g>
  {points.map((point,index)=><g key={point.number}><title>{point.number} · {places[index].title||places[index].place||'สถานที่'}</title><circle cx={point.x} cy={point.y} r={point.radius} fill="#fffffff0" stroke="#cee9f8" strokeWidth="2"/><text x={point.x} y={point.y+1} textAnchor="middle" dominantBaseline="central" fill="#547b96" fontFamily="Nunito,sans-serif" fontWeight="700" fontSize={Math.max(7,point.radius*.86)}>{point.number}</text></g>)}
 </svg>;
}
