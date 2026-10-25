import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlaceOutlined,AccountBalanceWalletOutlined} from '@mui/icons-material';
let pending;
export function loadTravelStatIcons(){
 if(!pending)pending=(async()=>{const entries=await Promise.all([['places',PlaceOutlined],['expenses',AccountBalanceWalletOutlined]].map(async([name,Icon])=>{
  const markup=renderToStaticMarkup(<Icon htmlColor="#fff" style={{color:'#fff',width:24,height:24}}/>),svg=markup.slice(markup.indexOf('<svg')).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" fill="#fff" width="24" height="24" ');
  const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('เตรียมไอคอนไม่สำเร็จ กรุณาลองใหม่'));img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;});return [name,image];}));return Object.fromEntries(entries);})().catch(error=>{pending=null;throw error;});
 return pending;
}
