import RecapPlaceSelection from "./RecapPlaceSelection";
import React,{useEffect,useRef,useState} from 'react';
import {Alert,Box,Button,Checkbox,CircularProgress,Dialog,DialogActions,DialogContent,DialogTitle,FormControlLabel,IconButton,Chip,Slider,Stack,Switch,TextField,Typography} from '@mui/material';
import {CameraAltRounded,ChevronLeftRounded,CloseRounded,DownloadRounded,EditRounded,ShareRounded,PlaceOutlined,AccountBalanceWalletOutlined} from '@mui/icons-material';
import {compressImage} from './image-utils';
import {renderRecapStory} from './recap-story';
import {tripLedger} from './trip-ledger';
import {recapRoutePlaces} from './recap-places';
import AvatarColorPicker from './AvatarColorPicker';
import RecapCoverPreview from './RecapCoverPreview';
import {loadRecapConfiguration,normalizeHex,saveRecapColor} from './recap-color';
import NumberedRouteOverlay from './NumberedRouteOverlay';
import ParticipantsAvatarGroup from './ParticipantsAvatarGroup';
const money=v=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',minimumFractionDigits:0,maximumFractionDigits:2}).format(v);
export default function TripRecap({trip,members,stops,expenses,collections=[],traveled=0,dateLabel='',showHeading=true}){
 const total=tripLedger(expenses,collections,[],members.map(m=>m.id)).cost;
 const [selecting,setSelecting]=useState(false);
 const [open,setOpen]=useState(false),[avatarColor,setAvatarColor]=useState(()=>loadRecapConfiguration(trip?.id).avatarColor),[source,setSource]=useState('cover'),[custom,setCustom]=useState(''),[crop,setCrop]=useState({zoom:1,x:50,y:50}),[showExpenses,setShowExpenses]=useState(true),[showRoute,setShowRoute]=useState(true),[fileType,setFileType]=useState('image/png'),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState({url:'',blob:null,busy:false});
 const generation=useRef(0);
 const [draft,setDraft]=useState([]);
 const [coverTitle,setCoverTitle]=useState(()=>trip?.name||'');
 useEffect(()=>setCoverTitle(trip?.name||''),[trip?.id,trip?.name]);
 useEffect(()=>{setDraft(recapRoutePlaces(stops).map(p=>({...p,enabled:false})));setOpen(false);setSelecting(false);setCustom('');setSource('cover');setCrop({zoom:1,x:50,y:50});setAvatarColor(loadRecapConfiguration(trip?.id).avatarColor);},[trip?.id]);
 useEffect(()=>{setDraft(old=>recapRoutePlaces(stops).map(p=>{const saved=old.find(d=>d.id===p.id);return {...p,enabled:saved?.enabled??false};}));},[JSON.stringify(stops.map(p=>[p.id,p.place,p.day,p.time,p.sortOrder]))]);
 useEffect(()=>{return()=>{if(custom)URL.revokeObjectURL(custom);};},[custom]);
 const imageSrc=source==='custom'?custom:source==='cover'?(trip?.cover_url||'/assets/trip-hero-landscape-v4.webp'):'';
 const places=recapRoutePlaces(draft);
 useEffect(()=>{
  if(!open)return;
  let active=true;const id=++generation.current;setPreview(old=>({...old,busy:true}));
  const timer=setTimeout(()=>renderRecapStory({trip,dateLabel,coverTitle,members,places,total,traveled,avatarColor,imageSrc,crop,showExpenses,showRoute,fileType}).then(blob=>{if(!active||id!==generation.current)return;const url=URL.createObjectURL(blob);setPreview(old=>({...old,url,blob,busy:false}));setError('');}).catch(err=>{if(active){setError(err.message);setPreview(old=>({...old,busy:false,blob:null,url:''}));}}),0);
  return()=>{active=false;clearTimeout(timer);};
 },[open,coverTitle,trip?.name,trip?.start_date,trip?.end_date,dateLabel,JSON.stringify(members.map(m=>[m.id,m.name,m.avatar])),JSON.stringify(places),total,traveled,avatarColor,imageSrc,crop.zoom,crop.x,crop.y,showExpenses,showRoute,fileType]);
 useEffect(()=>()=>{if(preview.url)URL.revokeObjectURL(preview.url);},[preview.url]);
 const upload=async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return setError('เลือกรูป JPG, PNG หรือ WebP');if(file.size>15*1024*1024)return setError('เลือกรูปไม่เกิน 15 MB');setUploading(true);setError('');try{const compressed=await compressImage(file,{maxWidth:2200,maxHeight:2200});setCustom(URL.createObjectURL(compressed));setSource('custom');setCrop({zoom:1,x:50,y:50});}catch{setError('อ่านรูปไม่ได้ กรุณาเลือกรูปใหม่');}finally{setUploading(false);}};
 const download=()=>{if(!preview.blob||preview.busy)return;const a=document.createElement('a');a.href=preview.url;a.download=`TripMate-${(trip?.name||'recap').replace(/[\\/:*?"<>|]/g,'-')}.${fileType==='image/jpeg'?'jpg':'png'}`;a.click();};
 const share=async()=>{try{const file=new File([preview.blob],`TripMate-recap.${fileType==='image/jpeg'?'jpg':'png'}`,{type:fileType});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:trip?.name||'Trip Recap'});else download();}catch(err){if(err.name!=='AbortError')setError('แชร์ไม่ได้ ลองบันทึกรูปแล้วแชร์จากอัลบั้ม');}};

 const close=()=>setOpen(false);
 return <Stack spacing={1.5} className="trip-recap recap-redesign">
  {showHeading&&<Typography component="h1" variant="h5">Recap</Typography>}
  <Box className="recap-memory-cover"><img src={trip?.cover_url||'/assets/trip-hero-landscape-v4.webp'} alt={`รูปปกทริป ${trip?.name||''}`}/><NumberedRouteOverlay places={places} color={avatarColor}/><Box><Typography variant="h4">{trip?.name||'ทริปของเรา'}</Typography><Typography>{dateLabel}</Typography></Box></Box>
  <ParticipantsAvatarGroup members={members}/>
  <Stack direction="row" gap={1} flexWrap="wrap" className="recap-memory-facts"><Chip size="small" icon={<PlaceOutlined/>} label={`${recapRoutePlaces(stops).length} สถานที่`}/><Chip size="small" icon={<AccountBalanceWalletOutlined/>} label={money(total)} aria-label={`ค่าใช้จ่ายรวม ${money(total)}`}/>{traveled>0&&<Chip size="small" label={`${(traveled/1000).toFixed(1)} กม.`} aria-label={`ระยะทางที่บันทึก ${(traveled/1000).toFixed(1)} กิโลเมตร`}/>}</Stack>
  <Button variant="contained" size="large" startIcon={<EditRounded/>} onClick={()=>setSelecting(true)}>แต่งรูป</Button>
  {trip?.google_photos_url&&<Button variant="text" startIcon={<CameraAltRounded/>} href={trip.google_photos_url} target="_blank" rel="noopener noreferrer">เปิดอัลบั้ม</Button>}
  <Dialog open={open} onClose={close} fullWidth maxWidth="md" className="recap-editor-dialog" aria-labelledby="recap-editor-title"><DialogTitle id="recap-editor-title"><Stack direction="row" alignItems="center" gap={1}><IconButton onClick={close} aria-label="กลับจากแต่ง Recap"><ChevronLeftRounded/></IconButton><Typography component="span" fontWeight={850} flex={1}>แต่งรูป</Typography><IconButton onClick={close} aria-label="ปิด Recap"><CloseRounded/></IconButton></Stack></DialogTitle>
   <DialogContent><Box className="recap-editor-grid"><RecapCoverPreview preview={preview} name={trip?.name} places={places.length} total={total} showExpenses={showExpenses}/>
    <Stack spacing={2} className="recap-editor-controls">{error&&<Alert severity="warning">{error}</Alert>}
     <TextField label="ตั้งชื่อทริป" value={coverTitle} onChange={e=>setCoverTitle(e.target.value)} inputProps={{maxLength:100}} helperText="ใช้เฉพาะบนรูป Recap ไม่เปลี่ยนชื่อทริปเดิม" size="small" fullWidth/>
     <Box><Typography fontWeight={800} mb={1}>รูปพื้นหลัง</Typography><Stack direction="row" gap={1} flexWrap="wrap"><Button variant={source==='cover'?'contained':'outlined'} onClick={()=>{setSource('cover');setCrop({zoom:1,x:50,y:50});}}>รูปปกทริป</Button><Button component="label" variant={source==='custom'?'contained':'outlined'} disabled={uploading} startIcon={<CameraAltRounded/>}>{uploading?'กำลังอ่านรูป…':'เลือกรูป'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={upload}/></Button><Button variant={source==='color'?'contained':'text'} onClick={()=>setSource('color')}>พื้นหลังสี</Button></Stack><Typography variant="caption" color="text.secondary">ใช้เฉพาะ Recap ไม่เปลี่ยนรูปปกทริป</Typography></Box>
     {source!=='color'&&<Box component="details" className="recap-crop-controls"><Typography component="summary" variant="body2" fontWeight={800} sx={{cursor:'pointer'}}>จัดตำแหน่งรูป</Typography>{[['zoom','ซูมรูปพื้นหลัง',1,3,.05],['x','เลื่อนรูปซ้าย–ขวา',0,100,1],['y','เลื่อนรูปขึ้น–ลง',0,100,1]].map(([key,label,min,max,step])=><Box key={key}><Typography variant="caption" color="text.secondary">{label}</Typography><Slider aria-label={label} value={crop[key]} min={min} max={max} step={step} onChange={(_,value)=>setCrop(old=>({...old,[key]:value}))}/></Box>)}<Button size="small" onClick={()=>setCrop({zoom:1,x:50,y:50})}>คืนตำแหน่งรูป</Button></Box>}
     <AvatarColorPicker value={avatarColor} onChange={value=>{const color=normalizeHex(value);if(color){setAvatarColor(color);saveRecapColor(trip?.id,color);}}}/>
     <Box className="recap-display-options"><FormControlLabel control={<Switch checked={showExpenses} onChange={e=>{setPreview({url:'',blob:null,busy:true});setShowExpenses(e.target.checked);}}/>} label="แสดงค่าใช้จ่ายในรูป"/><FormControlLabel control={<Switch checked={showRoute} onChange={e=>setShowRoute(e.target.checked)}/>} label="แสดงเส้นทาง"/><Typography variant="caption" color="text.secondary">เส้นทางตกแต่ง ไม่ใช่แผนที่จริง</Typography></Box>
     <Typography variant="caption" color="text.secondary">9:16 · 1080 × 1920 px</Typography>
     <Box><Typography fontWeight={800} mb={1}>ไฟล์ภาพ</Typography><Stack direction="row" gap={1}>{[['image/png','PNG'],['image/jpeg','JPG']].map(([type,label])=><Button key={type} variant={fileType===type?'contained':'outlined'} onClick={()=>setFileType(type)}>{label}</Button>)}</Stack></Box>
     <Button startIcon={<EditRounded/>} onClick={()=>setSelecting(true)}>เลือกสถานที่ที่ไปจริง · {places.length} แห่ง</Button>

    </Stack></Box></DialogContent><DialogActions><Button onClick={close}>ปิด</Button><Button startIcon={<DownloadRounded/>} disabled={preview.busy||uploading||!preview.blob} onClick={download}>บันทึกรูป</Button><Button variant="contained" startIcon={<ShareRounded/>} disabled={preview.busy||uploading||!preview.blob} onClick={share}>แชร์</Button></DialogActions>
  </Dialog>
  <RecapPlaceSelection open={selecting} places={draft} onChange={setDraft} onClose={()=>setSelecting(false)} editing={open} onConfirm={()=>{setSelecting(false);setOpen(true);}}/>
 </Stack>;
}
