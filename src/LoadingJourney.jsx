import React from 'react';
import BrandLogo from './BrandLogo';
export default function LoadingJourney(){return <div className="loading-journey" aria-hidden="true">
 <svg viewBox="0 0 240 136" width="240" height="136" fill="none"><path d="M24 110C6 53 111 141 111 77S172 31 208 48" stroke="#EAF6FC" strokeWidth="24" strokeLinecap="round"/><path d="M24 110C6 53 111 141 111 77S172 31 208 48" stroke="#AACFDF" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 7"/></svg>
 <BrandLogo className="loading-destination"/>
 <span className="loading-journey-car"><span>🚙</span></span>
 </div>;}
