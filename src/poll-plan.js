import {pollImageSources,normalizePollLink,pollLinks} from './poll-utils';
import {googleMapsCoordinate,isGoogleMapsUrl} from './google-maps-coordinate';
export function pollPlanPrefill(option){
 const links=[...new Set([...(option.links||[]),...(option.details||'').match(/https:\/\/[^\s<>]+/g)||[]])].filter(v=>{try{return Boolean(normalizePollLink(v));}catch{return false;}});
 const googleMapsUrl=links.find(isGoogleMapsUrl)||'',point=googleMapsCoordinate(googleMapsUrl);
 return {title:option.name||'',place:option.place_name||option.name||'',note:option.details||'',price:option.price??'',links:links.join('\n'),images:pollImageSources(option),googleMapsUrl,latitude:point?.[1]??null,longitude:point?.[0]??null};
}
export function planPayload(form){const links=pollLinks(form.links);return {...form,day:Number(form.day),price:form.price===''?null:Number(form.price),links,googleMapsUrl:links.find(isGoogleMapsUrl)||''};}
