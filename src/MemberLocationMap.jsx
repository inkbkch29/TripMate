import 'leaflet/dist/leaflet.css';
import React,{useEffect} from 'react';
import {MapContainer,TileLayer,Marker,Popup,useMap} from 'react-leaflet';
import L from 'leaflet';
import {locationLabel,locationState} from './trip-mode';
function Fit({rows}){const map=useMap(),key=rows.map(r=>`${r.latitude},${r.longitude}`).join(';');useEffect(()=>{map.invalidateSize();if(rows.length===1)map.setView([Number(rows[0].latitude),Number(rows[0].longitude)],14);else map.fitBounds(rows.map(r=>[Number(r.latitude),Number(r.longitude)]),{padding:[32,32],maxZoom:15});},[map,key]);return null;}
function icon(member,stale){const node=document.createElement('div');node.className=`travel-map-avatar ${stale?'stale':''}`;node.textContent=member.name?.[0]||'?';node.setAttribute('role','img');node.setAttribute('aria-label',member.name||'สมาชิก');if(member.avatar){const img=document.createElement('img');img.src=member.avatar;img.alt=member.name;img.onerror=()=>img.remove();node.append(img);}return L.divIcon({html:node,className:'travel-map-marker',iconSize:[42,42],iconAnchor:[21,21]});}
export default function MemberLocationMap({rows,members,preview=false,now=Date.now()}){
 if(!rows.length)return null;
 return <MapContainer center={[Number(rows[0].latitude),Number(rows[0].longitude)]} zoom={13} scrollWheelZoom={!preview} dragging={!preview} zoomControl={!preview} className={`travel-member-map ${preview?'preview':''}`}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/><Fit rows={rows}/>{rows.map(row=>{const member=members.find(m=>m.id===row.user_id);return member&&<Marker key={row.user_id} title={member.name} eventHandlers={{add:event=>event.target.getElement()?.setAttribute("aria-label",`ดูตำแหน่ง ${member.name}`)}} position={[Number(row.latitude),Number(row.longitude)]} icon={icon(member,locationState(row,now)==='stale')}><Popup><strong>{member.name}</strong><br/>{locationLabel(row,now)}</Popup></Marker>;})}</MapContainer>;
}
