import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { divIcon } from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import {
  Alert, AppBar, Avatar, AvatarGroup, Badge, BottomNavigation, BottomNavigationAction, Box, Button,
  Card, CardContent, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, IconButton, LinearProgress, MenuItem, Skeleton,
  Snackbar, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Toolbar, Typography,
} from "@mui/material";
import {
  AddRounded, ArrowForwardRounded, CalendarMonthRounded, CameraAltRounded, CheckCircleRounded,
  CloseRounded, ContentCopyRounded, DirectionsRounded, EditRounded, HomeRounded, LocationOnRounded, LogoutRounded,
  MapRounded, MoreHorizRounded, MyLocationRounded, NotificationsRounded, PaidRounded,
  PaymentsRounded, PersonAddRounded, PlaceRounded, QrCode2Rounded, ReceiptLongRounded, RouteRounded,
  SavingsRounded, SettingsRounded, StopCircleRounded, TravelExploreRounded, CloudUploadRounded, TaskAltRounded,
  KeyboardArrowUpRounded, KeyboardArrowDownRounded, DoneAllRounded, InstallMobileRounded,
  ExploreRounded, GroupRounded, AccessTimeRounded, DeleteOutlineRounded, AddCircleOutlineRounded,
} from "@mui/icons-material";
import { calculateBalances, simplifyDebts } from "./finance";
import { claimInvite, confirmCollectionPayment, createInvite, deleteCollection, deleteExpense, deleteStop, deleteTripFile, getMyTripContext, isSupabaseConfigured, loadTripData, loadTripInvites, removeTripMember, reorderTripStops, reviewExpense, reviewSettlement, revokeTripInvite, saveCollection, saveExpense, saveLiveLocation, saveStop, saveTripSettings, setStopCheckin, stopLiveLocation, submitCollectionPayment, submitSettlement, subscribeToLocations, supabase, toggleTripStopDone, updateTripMemberRole, uploadTripCover, uploadTripFile } from "./supabase";
import { chooseTrip } from "./trip-utils";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const theme = createTheme({
  palette: {
    primary: { main: "#7fc5eb", dark: "#287eae", light: "#dff4ff" },
    secondary: { main: "#ead28e", dark: "#8f6d22", light: "#fff2c8" },
    success: { main: "#57a889" }, warning: { main: "#dfa63b" }, error: { main: "#dd6d72" },
    background: { default: "#f7fbff", paper: "#ffffff" },
    text: { primary: "#203049", secondary: "#6c7c90" },
  },
  shape: { borderRadius: 22 },
  typography: {
    fontFamily: '"Nunito", "Anuphan", "Noto Sans Thai", system-ui, sans-serif',
    h4: { fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1.16 }, h5: { fontWeight: 780, letterSpacing: "-.02em" }, h6: { fontWeight: 750 },
    overline: { fontSize: ".7rem", fontWeight: 800, letterSpacing: ".16em" },
    body1: { lineHeight: 1.68 }, body2: { lineHeight: 1.62 }, button: { textTransform: "none", fontWeight: 750, letterSpacing: "-.01em" },
  },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: 48, borderRadius: 16, boxShadow: "none", transition: "transform .22s ease, box-shadow .22s ease, background-color .22s ease" }, containedPrimary: { color: "#fff", background: "#72bae2", boxShadow: "0 10px 24px rgba(63,153,204,.18)" }, containedSecondary: { color: "#57451f", background: "#ead28e" }, outlined: { borderColor: "#d4eaf6", background: "rgba(255,255,255,.9)" } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 26, border: "1px solid rgba(210,229,245,.94)", boxShadow: "0 14px 40px rgba(61,116,164,.075)" } } },
    MuiTextField: { defaultProps: { fullWidth: true }, styleOverrides: { root: { "& .MuiOutlinedInput-root": { borderRadius: 16, background: "rgba(249,252,255,.96)", "& fieldset": { borderColor: "#d9e8f5" }, "&:hover fieldset": { borderColor: "#a9cce9" }, "&.Mui-focused fieldset": { borderWidth: 1.5 } } } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 10, fontWeight: 750 } } },
    MuiIconButton: { styleOverrides: { root: { transition: "transform .2s ease, background-color .2s ease" } } },
  },
});

const membersSeed = [
  { id: "u1", name: "มินท์", role: "เจ้าของทริป", color: "#86c9ed", emoji: "👩🏻", promptpay: "0812345678", online: true },
  { id: "u2", name: "เอ", role: "สมาชิก", color: "#e8cf88", emoji: "🧑🏻", promptpay: "0891112233", online: true },
  { id: "u3", name: "บี", role: "สมาชิก", color: "#a8daf3", emoji: "👩🏻‍🦰", promptpay: "0865559911", online: true },
  { id: "u4", name: "ซี", role: "สมาชิก", color: "#ddc173", emoji: "👨🏽", promptpay: "", online: false },
  { id: "u5", name: "ดี", role: "สมาชิก", color: "#c8eaff", emoji: "👩🏻‍🦱", promptpay: "", online: true },
];
const stopsSeed = [
  { id: "s1", day: 1, time: "07:00", title: "เจอกันที่สนามบิน", place: "ดอนเมือง อาคาร 2", note: "หน้าเคาน์เตอร์เช็กอิน", done: true },
  { id: "s2", day: 1, time: "11:30", title: "กินข้าวเที่ยง", place: "ร้านเฮือนม่วนใจ๋", note: "จองโต๊ะแล้ว", done: false },
  { id: "s3", day: 1, time: "14:00", title: "คาเฟ่ริมเขา", place: "Nekoemon Cafe", note: "เผื่อเวลา 1 ชั่วโมง", done: false },
  { id: "s4", day: 1, time: "16:00", title: "เช็กอินที่พัก", place: "บ้านม่อนอุ่น", note: "Booking: TM-1028", done: false },
  { id: "s5", day: 2, time: "09:00", title: "ขึ้นดอย", place: "ดอยอินทนนท์", note: "เตรียมเสื้อกันหนาว", done: false },
];
const expensesSeed = [
  { id: "e1", title: "ค่ารถเช่า", amount: 3500, paidBy: "u2", participants: ["u1", "u2", "u3", "u4", "u5"], category: "เดินทาง", expenseDate: "2026-09-12", mealPeriod: "other" },
  { id: "e2", title: "มื้อเย็น", amount: 1850, paidBy: "u1", participants: ["u1", "u2", "u3", "u4", "u5"], category: "อาหาร", expenseDate: "2026-09-12", mealPeriod: "dinner" },
];
const collectionsSeed = [{ id: "c1", title: "ค่าที่พัก 2 คืน", amount: 6000, perPerson: 1200, receiver: "u1", due: "25 ส.ค.", paid: ["u1", "u2", "u3"], participants: ["u1", "u2", "u3", "u4", "u5"] }];
const locationsSeed = [
  { userId: "u2", x: 28, y: 34, ago: "1 นาที" }, { userId: "u3", x: 65, y: 26, ago: "3 นาที" },
  { userId: "u4", x: 54, y: 68, ago: "8 นาที" }, { userId: "u5", x: 79, y: 56, ago: "2 นาที" },
];
const currency = (value) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value || 0);
const mealLabels = { breakfast: "มื้อเช้า", lunch: "มื้อกลางวัน", dinner: "มื้อเย็น", snack: "ของว่าง/คาเฟ่", other: "รายการอื่น" };
const shortThaiDate = (value) => value ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(`${value}T00:00:00`)) : "ไม่ระบุวัน";
const wait = (ms = 650) => new Promise((resolve) => setTimeout(resolve, ms));

function useStoredState(key, initial) {
  const [state, setState] = useState(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState];
}

function BusyButton({ busy, children, ...props }) {
  return <Button {...props} disabled={busy || props.disabled} startIcon={busy ? <CircularProgress size={18} color="inherit" /> : props.startIcon}>{busy ? "กำลังบันทึก..." : children}</Button>;
}

function TopBar({ members, onAddMember, canInvite = true, tripName = "เชียงใหม่กับแก๊งเรา", trips=[], tripId, onTripChange, onNewTrip, notificationCount=0, onNotifications }) {
  return <AppBar position="sticky" color="transparent" elevation={0} className="topbar"><Toolbar>
    <Avatar className="logo"><TravelExploreRounded/></Avatar><Box flex={1} className="brand-copy"><Typography fontWeight={900}>TripMate<span>.</span></Typography>{trips.length>1?<TextField select variant="standard" value={tripId||""} onChange={(e)=>e.target.value==="__new"?onNewTrip?.():onTripChange?.(e.target.value)} sx={{maxWidth:190,"& .MuiInput-root:before":{display:"none"}}}>{trips.map((item)=><MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}<MenuItem value="__new"><AddCircleOutlineRounded fontSize="small" sx={{mr:1}}/>สร้างทริปใหม่</MenuItem></TextField>:<Typography variant="caption" color="text.secondary" onClick={onNewTrip} sx={{cursor:onNewTrip?"pointer":"default"}}>{tripName}</Typography>}</Box>
    {canInvite && <IconButton className="top-action" aria-label="เพิ่มเพื่อน" onClick={onAddMember}><PersonAddRounded /></IconButton>}
    <IconButton className="top-action" aria-label="การแจ้งเตือน" onClick={onNotifications}><Badge color="error" badgeContent={notificationCount} max={9}><NotificationsRounded /></Badge></IconButton>
  </Toolbar></AppBar>;
}

function formatTripDate(start, end) {
  if (!start || !end) return "ยังไม่ได้กำหนดวันเดินทาง";
  const startDate = new Date(`${start}T00:00:00`); const endDate = new Date(`${end}T00:00:00`);
  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const buddhistYear = endDate.getFullYear() + 543; const days = Math.max(1,Math.round((endDate-startDate)/86400000)+1); const nights = Math.max(0,days-1);
  const range = startDate.getMonth() === endDate.getMonth() ? `${startDate.getDate()}–${endDate.getDate()} ${months[endDate.getMonth()]} ${buddhistYear}` : `${startDate.getDate()} ${months[startDate.getMonth()]} – ${endDate.getDate()} ${months[endDate.getMonth()]} ${buddhistYear}`;
  return `${range} · ${days} วัน ${nights} คืน`;
}
function tripDayCount(trip) { if (!trip?.start_date || !trip?.end_date) return 1; return Math.max(1,Math.round((new Date(`${trip.end_date}T00:00:00`)-new Date(`${trip.start_date}T00:00:00`))/86400000)+1); }
function stopDateLabel(trip, day = 1) { if (!trip?.start_date) return { day: "—", month: "" }; const date = new Date(`${trip.start_date}T00:00:00`); date.setDate(date.getDate()+Number(day)-1); return { day: date.getDate(), month: ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][date.getMonth()] }; }

function Hero({ members, onPlan, trip }) {
  const title = trip?.name || "เชียงใหม่กับแก๊งเรา";
  const defaultCovers = ["/assets/trip-friends.png", "/assets/trip-hero-blue-v2.webp", "/assets/trip-hero-cartoon-v3.webp"];
  const cover = !trip?.cover_url || defaultCovers.includes(trip.cover_url) ? "/assets/trip-hero-landscape-v4.webp" : trip.cover_url;
  return <Box className="hero">
    <img src={cover} alt={`ภาพปก ${title}`} />
    <Box className="hero-spark" aria-hidden="true"><TravelExploreRounded/></Box>
    <Box className="hero-copy"><Typography className="hero-eyebrow">{trip?.status === "active" ? "กำลังเดินทาง" : "ทริปถัดไป"}</Typography><Typography variant="h4">{title}</Typography><Typography className="hero-date"><CalendarMonthRounded/> {trip ? formatTripDate(trip.start_date,trip.end_date) : "12–15 กันยายน 2569 · 4 วัน 3 คืน"}</Typography>
      <Stack direction="row" alignItems="center" spacing={1} className="hero-members"><AvatarGroup max={4}>{members.map((m) => <Avatar key={m.id} src={m.avatar} sx={{ bgcolor: m.color }}>{m.emoji}</Avatar>)}</AvatarGroup><Typography variant="caption">{members.length} สมาชิก</Typography></Stack>
      <Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={onPlan}>ดูแผนการเดินทาง</Button>
    </Box>
  </Box>;
}

function Home({ members, stops, collections, expenses, setTab, trip }) {
  const unpaid = collections.reduce((sum, item) => sum + item.participants.filter((id) => !item.paid.includes(id)).length, 0);
  const next = stops.find((s) => !s.done);
  const spent = expenses.reduce((sum, x) => sum + Number(x.amount), 0);
  const hasStops = stops.length > 0; const nextDate = next ? stopDateLabel(trip,next.day) : null;
  const nextTitle = next?.title || (hasStops ? "เที่ยวครบทุกจุดแล้ว" : "ยังไม่มีแพลนเที่ยว");
  const nextSubtitle = next ? `${next.time} · ${next.place}` : hasStops ? "ทุกกิจกรรมถูกทำเครื่องหมายว่าเสร็จแล้ว 🎉" : "เพิ่มสถานที่แรกในหน้าแพลนได้เลย";
  return <Stack spacing={2.2}>
    <Hero members={members} onPlan={() => setTab(1)} trip={trip}/>
    <Stack direction="row" spacing={1.4}>
      <Card className="stat-card" onClick={() => setTab(3)}><CardContent><PaymentsRounded color="primary"/><Typography variant="caption">ต้องจ่ายเร็ว ๆ นี้</Typography><Typography variant="h6">{currency(collections[0]?.perPerson)}</Typography><Chip size="small" color="warning" label={`${unpaid} คนยังไม่จ่าย`}/></CardContent></Card>
      <Card className="stat-card" onClick={() => setTab(3)}><CardContent><SavingsRounded color="secondary"/><Typography variant="caption">ใช้ไปแล้ว</Typography><Typography variant="h6">{currency(spent)}</Typography><Typography variant="caption" color="text.secondary">{trip?.budget ? `จากงบ ${currency(trip.budget)}` : "ยังไม่ได้ตั้งงบทริป"}</Typography></CardContent></Card>
    </Stack>
    <Typography variant="h6">ถัดไป</Typography>
    <Card className="next-card"><CardContent><Stack direction="row" spacing={2} alignItems="center"><Box className="date-box"><strong>{nextDate?.day || (hasStops ? "✓" : "＋")}</strong><span>{nextDate?.month || (hasStops ? "ครบ" : "แพลน")}</span></Box><Box flex={1}><Typography fontWeight={800}>{nextTitle}</Typography><Typography color="text.secondary" variant="body2">{nextSubtitle}</Typography></Box><IconButton aria-label={hasStops ? "ดูแพลนเที่ยว" : "เพิ่มแพลนเที่ยว"} onClick={() => setTab(1)}><ArrowForwardRounded/></IconButton></Stack></CardContent></Card>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">สมาชิกในทริป</Typography><Button size="small" onClick={() => setTab(4)}>ดูทั้งหมด</Button></Stack>
    <Card><CardContent><Stack direction="row" spacing={1.2} className="member-row">{members.map((m) => <Box key={m.id} textAlign="center"><BadgeDot active={m.online}><Avatar sx={{ bgcolor: m.color }}>{m.emoji}</Avatar></BadgeDot><Typography variant="caption">{m.name}</Typography></Box>)}</Stack></CardContent></Card>
  </Stack>;
}

function BadgeDot({ active, children }) { return <Box className="avatar-wrap">{children}<i className={active ? "online" : "offline"}/></Box>; }

function Plan({ stops, setStops, onAdd, onEdit, toast, onPersist, onReorder, dayCount = 4, canAdd = true, canManage = false }) {
  const [day, setDay] = useState(1); const [busyId, setBusyId] = useState("");
  const toggle = async (id) => { setBusyId(id); const updated = { ...stops.find((s) => s.id === id), done: !stops.find((s) => s.id === id).done }; try { if (onPersist) await onPersist(updated); else await wait(); setStops((old) => old.map((s) => s.id === id ? updated : s)); toast("อัปเดตแพลนเรียบร้อย"); } catch (err) { toast(err.message,"error"); } finally { setBusyId(""); } };
  const rows = stops.filter((s) => s.day === day).sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)||a.time.localeCompare(b.time));
  const move=async(index,direction)=>{const target=index+direction;if(target<0||target>=rows.length)return;const timeSlots=rows.map((item)=>item.time);const reordered=[...rows];[reordered[index],reordered[target]]=[reordered[target],reordered[index]];const withOrder=reordered.map((item,position)=>({...item,time:timeSlots[position],sortOrder:position}));const previous=rows;setStops((old)=>[...old.filter((item)=>item.day!==day),...withOrder].sort((a,b)=>a.day-b.day||(a.sortOrder??0)-(b.sortOrder??0)));try{if(onReorder)await onReorder(withOrder);else await wait(250);toast("ย้ายแพลนและปรับเวลาให้แล้ว");}catch(err){setStops((old)=>[...old.filter((item)=>item.day!==day),...previous].sort((a,b)=>a.day-b.day||(a.sortOrder??0)-(b.sortOrder??0)));toast(err.message,"error");}};
  return <Stack spacing={2}>
    <Box><Typography variant="overline">แพลนทริป</Typography><Typography variant="h4">วันนี้ไปไหนกัน</Typography></Box>
    <Stack direction="row" spacing={1} className="days">{Array.from({length:dayCount},(_,i)=>i+1).map((d) => <Button key={d} variant={day === d ? "contained" : "outlined"} onClick={() => setDay(d)}>วันที่ {d}</Button>)}</Stack>
    {rows.length === 0 ? canAdd ? <Empty icon="🗓️" title="วันนี้ยังไม่มีแพลน" action="เพิ่มสถานที่" onClick={onAdd}/> : <Alert severity="info">วันนี้ยังไม่มีแพลน · แอดมินเป็นผู้เพิ่มสถานที่</Alert> : <Stack>{rows.map((s, index) => <Box className={`timeline ${s.done ? "done" : ""}`} key={s.id}><Box className="timeline-line"/><Avatar className="timeline-pin">{s.done ? <CheckCircleRounded/> : index + 1}</Avatar><Card className={canManage?"editable-stop":""}><CardContent><Box><Typography variant="caption" color="primary" fontWeight={800}>{s.time} น.</Typography><Typography variant="h6">{s.title}</Typography><Typography color="text.secondary" variant="body2"><PlaceRounded fontSize="inherit"/> {s.place}</Typography>{s.note && <Typography variant="caption">{s.note}</Typography>}</Box><Divider sx={{my:1.5}}/><Stack direction="row" alignItems="center" justifyContent="space-between" className="plan-actions"><Stack direction="row" spacing={.5}><Button size="small" startIcon={<DirectionsRounded/>} href={s.googleMapsUrl||((s.latitude&&s.longitude)?`https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.place)}`)} target="_blank">แผนที่</Button>{canManage&&<Button size="small" startIcon={<EditRounded/>} onClick={()=>onEdit(s)}>แก้ไข</Button>}</Stack><Stack direction="row" alignItems="center" spacing={.4}>{canManage&&<><IconButton size="small" className="order-button" disabled={index===0} aria-label="เลื่อนแพลนขึ้น" onClick={()=>move(index,-1)}><KeyboardArrowUpRounded/></IconButton><IconButton size="small" className="order-button" disabled={index===rows.length-1} aria-label="เลื่อนแพลนลง" onClick={()=>move(index,1)}><KeyboardArrowDownRounded/></IconButton></>}<Checkbox checked={s.done} disabled={busyId === s.id} inputProps={{"aria-label":`ทำเสร็จ ${s.title}`}} icon={busyId === s.id ? <CircularProgress size={22}/> : undefined} onChange={() => toggle(s.id)}/></Stack></Stack></CardContent></Card></Box>)}</Stack>}
    {rows.length > 0 && canAdd && <Button fullWidth variant="contained" startIcon={<AddRounded/>} onClick={onAdd}>เพิ่มสถานที่ในวันที่ {day}</Button>}
  </Stack>;
}

function MapFocus({ locations }) { const map=useMap(); useEffect(()=>{ if(!locations.length)return; const bounds=locations.map((loc)=>[Number(loc.latitude),Number(loc.longitude)]); map.fitBounds(bounds,{padding:[45,45],maxZoom:16}); },[locations.map((x)=>`${x.latitude}:${x.longitude}:${x.updated_at||x.id}`).join("|")]); return null; }
function relativeLocationTime(value) { const seconds=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/1000)); if(seconds<60)return "เมื่อสักครู่"; if(seconds<3600)return `${Math.floor(seconds/60)} นาทีที่แล้ว`; if(seconds<86400)return `${Math.floor(seconds/3600)} ชม. ที่แล้ว`; return `${Math.floor(seconds/86400)} วันที่แล้ว`; }
function localDateString(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function memberMapIcon(member) {
  const html=renderToStaticMarkup(<div className="friend-map-marker" style={{"--friend-color":member.color||"#7fc5eb"}}>{member.avatar?<img src={member.avatar} alt=""/>:<span>{member.emoji||member.name?.slice(0,1)||"🙂"}</span>}<i/></div>);
  return divIcon({html,className:"friend-map-icon",iconSize:[52,58],iconAnchor:[26,54],popupAnchor:[0,-54]});
}

function MapPage({ members, stops, toast, demo = false, trip, account, locations, setLocations }) {
  const [sharing,setSharing]=useState(false); const [busy,setBusy]=useState(false); const watchRef=useRef(null); const lastSentRef=useRef(0);
  const activeLocations=demo ? locationsSeed.map((loc,index)=>({user_id:members[index+1]?.id,latitude:13.7563+(loc.y-50)/900,longitude:100.5018+(loc.x-50)/900,accuracy_m:20,updated_at:new Date(Date.now()-index*60000).toISOString()})).filter((x)=>x.user_id) : locations.filter((loc)=>loc.sharing_enabled);
  const today=localDateString(); const inTripWindow=demo || (trip && today>=trip.start_date && today<=trip.end_date);
  const stopLocations=(stops||[]).filter((stop)=>stop.latitude&&stop.longitude); const allMapPoints=[...activeLocations,...stopLocations];
  const center=allMapPoints.length ? [Number(allMapPoints[0].latitude),Number(allMapPoints[0].longitude)] : [13.7563,100.5018];
  const stop=async()=>{ if(watchRef.current!==null){navigator.geolocation.clearWatch(watchRef.current);watchRef.current=null;} if(account&&trip)await stopLiveLocation(trip.id,account.user.id); setLocations((old)=>old.map((loc)=>loc.user_id===account?.user.id?{...loc,sharing_enabled:false}:loc)); setSharing(false); };
  useEffect(()=>()=>{ if(watchRef.current!==null){navigator.geolocation.clearWatch(watchRef.current); if(account&&trip)stopLiveLocation(trip.id,account.user.id).catch(()=>{});} },[]);
  const toggle=async()=>{
    if(demo){setSharing((value)=>!value);toast(sharing?"หยุดแชร์ตำแหน่งตัวอย่างแล้ว":"เริ่มแชร์ตำแหน่งตัวอย่างแล้ว",sharing?"info":"success");return;}
    if(sharing){setBusy(true);try{await stop();toast("หยุดแชร์ตำแหน่งแล้ว","info");}catch(err){toast(err.message,"error");}finally{setBusy(false);}return;}
    if(!inTripWindow)return toast("แชร์ตำแหน่งได้เฉพาะช่วงวันเดินทาง","warning");
    if(!navigator.geolocation)return toast("เบราว์เซอร์นี้ไม่รองรับตำแหน่ง","error");
    setBusy(true);
    watchRef.current=navigator.geolocation.watchPosition(async({coords})=>{ if(Date.now()-lastSentRef.current<10000)return; lastSentRef.current=Date.now(); try{await saveLiveLocation(trip.id,account.user.id,coords); const row={trip_id:trip.id,user_id:account.user.id,latitude:coords.latitude,longitude:coords.longitude,accuracy_m:coords.accuracy,sharing_enabled:true,updated_at:new Date().toISOString()}; setLocations((old)=>[...old.filter((x)=>x.user_id!==account.user.id),row]); setSharing(true);setBusy(false);}catch(err){setBusy(false);toast(err.message,"error");} },(error)=>{setBusy(false);setSharing(false);toast(error.code===1?"กรุณาอนุญาตการเข้าถึงตำแหน่ง":"อ่านตำแหน่งไม่สำเร็จ","error");},{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
  };
  return <Stack spacing={2}>
    <Box><Typography variant="overline">แผนที่กลุ่ม</Typography><Typography variant="h4">เพื่อนอยู่ไหนกัน</Typography><Typography color="text.secondary">ตำแหน่งล่าสุดของสมาชิกที่กดอนุญาตแชร์</Typography></Box>
    <Box className="real-map"><MapContainer center={center} zoom={13} scrollWheelZoom className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/><MapFocus locations={allMapPoints}/>{stopLocations.map((stop)=><CircleMarker key={`stop-${stop.id}`} center={[Number(stop.latitude),Number(stop.longitude)]} radius={8} pathOptions={{color:"#fff",weight:3,fillColor:"#5f8ca7",fillOpacity:1}}><Popup><strong>{stop.title}</strong><br/>{stop.place}<br/><a href={stop.googleMapsUrl||`https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`} target="_blank" rel="noreferrer">นำทาง</a></Popup></CircleMarker>)}{activeLocations.map((loc)=>{const member=members.find((m)=>m.id===loc.user_id);if(!member)return null;return <Marker key={loc.user_id} position={[Number(loc.latitude),Number(loc.longitude)]} icon={memberMapIcon(member)} zIndexOffset={500}><Popup><strong>{member.name}</strong><br/>{relativeLocationTime(loc.updated_at)}<br/><small>ความแม่นยำประมาณ {Math.round(loc.accuracy_m||0)} ม.</small><br/><a href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`} target="_blank" rel="noreferrer">เปิดใน Google Maps</a></Popup></Marker>})}</MapContainer></Box>
    {!inTripWindow&&<Alert severity="warning">แชร์ตำแหน่งได้เฉพาะ {formatTripDate(trip?.start_date,trip?.end_date)}</Alert>}
    {!activeLocations.length&&<Alert severity="info">ยังไม่มีสมาชิกแชร์ตำแหน่ง</Alert>}
    <BusyButton busy={busy} disabled={!demo&&!inTripWindow} variant={sharing?"outlined":"contained"} color={sharing?"error":"primary"} startIcon={sharing?<StopCircleRounded/>:<MyLocationRounded/>} onClick={toggle}>{sharing?"หยุดแชร์ตำแหน่ง":inTripWindow?"เริ่มแชร์ตำแหน่ง":"ยังไม่ถึงช่วงทริป"}</BusyButton>
  </Stack>;
}

function TripMode({ trip, members, stops, locations, setLocations, account, checkins, setCheckins, toast, onAddExpense, onCheckin }) {
  const [busy,setBusy]=useState(""); const currentUserId=account?.user.id||"u1";
  const today=localDateString(); const active=Boolean(!trip||today>=trip.start_date&&today<=trip.end_date);
  const day=trip?.start_date?Math.min(tripDayCount(trip),Math.max(1,Math.floor((new Date(`${today}T00:00:00`)-new Date(`${trip.start_date}T00:00:00`))/86400000)+1)):1;
  const next=stops.find((stop)=>stop.day===day&&!stop.done)||stops.find((stop)=>!stop.done)||stops[0];
  const nextCheckins=next?checkins.filter((item)=>item.stopId===next.id):[]; const checkedIn=nextCheckins.some((item)=>item.userId===currentUserId);
  const toggleCheckin=async()=>{if(!next)return;setBusy("checkin");try{await onCheckin(next,!checkedIn);setCheckins((old)=>checkedIn?old.filter((item)=>!(item.stopId===next.id&&item.userId===currentUserId)):[...old,{stopId:next.id,userId:currentUserId,checkedInAt:new Date().toISOString()}]);toast(checkedIn?"ยกเลิกเช็กอินแล้ว":"เช็กอินว่าถึงแล้ว 📍");}catch(err){toast(err.message,"error");}finally{setBusy("");}};
  return <Stack spacing={2}>
    <Box className="trip-mode-heading"><Typography variant="overline">TRIP MODE</Typography><Typography variant="h4">เที่ยวด้วยกันแบบเรียลไทม์</Typography><Typography color="text.secondary">{active?`วันที่ ${day} ของทริป · ทุกอย่างที่ต้องใช้ระหว่างทางอยู่หน้านี้`:`เตรียมทริปล่วงหน้า · Trip Mode จะพร้อมเต็มรูปแบบในวันเดินทาง`}</Typography></Box>
    {next?<Card className="now-card"><CardContent><Typography variant="overline">จุดหมายถัดไป</Typography><Stack direction="row" alignItems="center" spacing={1.5}><Box className="now-time"><AccessTimeRounded/><strong>{next.time}</strong></Box><Box flex={1}><Typography variant="h5">{next.title}</Typography><Typography color="text.secondary"><PlaceRounded fontSize="inherit"/> {next.place}</Typography></Box></Stack><Stack direction="row" spacing={1} mt={2}><Button fullWidth variant="contained" startIcon={<DirectionsRounded/>} href={next.googleMapsUrl||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.place)}`} target="_blank">นำทาง</Button><BusyButton fullWidth busy={busy==="checkin"} variant={checkedIn?"outlined":"contained"} color={checkedIn?"success":"primary"} startIcon={<MyLocationRounded/>} onClick={toggleCheckin}>{checkedIn?"ถึงแล้ว ✓":"เช็กอิน"}</BusyButton></Stack><Box mt={2}><Typography variant="caption" color="text.secondary">ถึงแล้ว {nextCheckins.length}/{members.length} คน</Typography><AvatarGroup max={8} sx={{justifyContent:"flex-end"}}>{nextCheckins.map((checkin)=>{const member=members.find((m)=>m.id===checkin.userId);return <Avatar key={checkin.userId} src={member?.avatar} sx={{bgcolor:member?.color,width:32,height:32}}>{member?.emoji}</Avatar>;})}</AvatarGroup></Box></CardContent></Card>:<Alert severity="info">ยังไม่มีจุดหมายในแพลน</Alert>}
    <Button variant="outlined" startIcon={<ReceiptLongRounded/>} onClick={onAddExpense}>เพิ่มรายจ่ายด่วน</Button>
    <MapPage members={members} stops={stops} toast={toast} demo={!account} trip={trip} account={account} locations={locations} setLocations={setLocations}/>
  </Stack>;
}

function ExpenseReportTable({ group, members, canApprove, busy, onDecide, onEdit, onDelete }) {
  const name=(id)=>members.find((member)=>member.id===id)?.name||"—";
  return <Card className="expense-report"><CardContent><Stack direction="row" alignItems="end" justifyContent="space-between" mb={1.5}><Box><Typography variant="overline" color="text.secondary">{group.items.length} รายการ</Typography><Typography variant="h6">{group.label}</Typography></Box><Box textAlign="right"><Typography variant="caption" color="text.secondary">ยอดอนุมัติแล้ว</Typography><Typography variant="h6" color="primary.dark">{currency(group.total)}</Typography></Box></Stack><TableContainer className="expense-table"><Table size="small"><TableHead><TableRow><TableCell>รายการ</TableCell><TableCell>วันที่ / มื้อ</TableCell><TableCell>ผู้จ่าย</TableCell><TableCell align="right">ยอด</TableCell><TableCell align="center">สถานะ</TableCell></TableRow></TableHead><TableBody>{group.items.map((expense)=>{const status=expense.approvalStatus||"approved";return <TableRow key={expense.id}><TableCell><Typography fontWeight={750} whiteSpace="nowrap">{expense.title}</Typography><Typography variant="caption" color="text.secondary">{expense.category}</Typography></TableCell><TableCell><Typography variant="body2" whiteSpace="nowrap">{shortThaiDate(expense.expenseDate)}</Typography><Typography variant="caption" color="text.secondary">{mealLabels[expense.mealPeriod||"other"]}</Typography></TableCell><TableCell><Typography variant="body2" whiteSpace="nowrap">{name(expense.paidBy)}</Typography></TableCell><TableCell align="right"><Typography fontWeight={800} whiteSpace="nowrap">{currency(expense.amount)}</Typography></TableCell><TableCell align="center"><Chip size="small" color={status==="approved"?"success":status==="rejected"?"error":"warning"} label={status==="approved"?"อนุมัติ":status==="rejected"?"ไม่อนุมัติ":"รอตรวจ"}/>{expense.receiptUrl&&<IconButton size="small" href={expense.receiptUrl} target="_blank" aria-label="ดูใบเสร็จ"><ReceiptLongRounded fontSize="small"/></IconButton>}{canApprove&&<><IconButton size="small" aria-label="แก้รายจ่าย" onClick={()=>onEdit(expense)}><EditRounded fontSize="small"/></IconButton><IconButton size="small" color="error" aria-label="ลบรายจ่าย" onClick={()=>onDelete(expense)}><DeleteOutlineRounded fontSize="small"/></IconButton></>}{canApprove&&status==="pending"&&<Stack direction="row" spacing={.5} mt={.5} justifyContent="center"><BusyButton size="small" variant="contained" color="success" busy={busy===`${expense.id}-approved`} onClick={()=>onDecide(expense,"approved")}>ผ่าน</BusyButton><BusyButton size="small" variant="outlined" color="error" busy={busy===`${expense.id}-rejected`} onClick={()=>onDecide(expense,"rejected")}>ไม่ผ่าน</BusyButton></Stack>}</TableCell></TableRow>})}</TableBody></Table></TableContainer></CardContent></Card>;
}

function SettlementCard({ transfer, settlement, members, currentUserId, busy, onShowQr, onSend, onReview, canApprove }) {
  const from=members.find((m)=>m.id===transfer.from); const receiver=members.find((m)=>m.id===transfer.to);
  const mayReview=settlement?.status==="pending"&&(currentUserId===transfer.to||canApprove);
  return <Card><CardContent><Stack spacing={1.2}>
    <Stack direction="row" alignItems="center" spacing={1}><Avatar sx={{bgcolor:from?.color}}>{from?.emoji}</Avatar><Box flex={1}><Typography fontWeight={800}>{from?.name||"—"} → {receiver?.name||"—"}</Typography><Typography variant="caption">โอนเพื่อปิดยอดทริป</Typography></Box><Typography fontWeight={900}>{currency(transfer.amount)}</Typography></Stack>
    <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
      {receiver&&(receiver.paymentQr||receiver.promptpay)&&<Button size="small" startIcon={<QrCode2Rounded/>} onClick={()=>onShowQr(receiver)}>QR รับเงิน</Button>}
      {settlement?.slipUrl&&<Button size="small" href={settlement.slipUrl} target="_blank">ดูสลิป</Button>}
      {settlement?.status==="pending"&&!mayReview&&<Chip size="small" color="warning" label="รอผู้รับยืนยัน"/>}
      {settlement?.status==="rejected"&&currentUserId!==transfer.from&&<Chip size="small" color="error" label="สลิปไม่ผ่าน"/>}
      {mayReview&&<><BusyButton size="small" busy={busy===`review-${settlement.id}`} variant="contained" color="success" onClick={()=>onReview(settlement,"confirmed")}>ยืนยันรับเงิน</BusyButton><Button size="small" color="error" onClick={()=>onReview(settlement,"rejected")}>สลิปไม่ถูกต้อง</Button></>}
      {currentUserId===transfer.from&&(!settlement||settlement.status==="rejected")&&<BusyButton component="label" size="small" busy={busy===`transfer-${transfer.from}-${transfer.to}`} variant="contained" startIcon={<CloudUploadRounded/>}>{settlement?.status==="rejected"?"แนบสลิปใหม่":"แจ้งโอนแล้ว"}<input hidden type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event)=>onSend(transfer,event.target.files?.[0])}/></BusyButton>}
    </Stack>
  </Stack></CardContent></Card>;
}

function Money({ members, expenses, setExpenses, collections, setCollections, settlements=[], setSettlements, onAddExpense, onEditExpense, onDeleteExpense, onAddCollection, onEditCollection, onDeleteCollection, toast, onPersistCollection, onSubmitCollectionSlip, onSubmitTransfer, onReviewTransfer, currentUserId = "u1", onShowQr, canApprove = false, onReviewExpense, canAddCollection = true }) {
  const [section, setSection] = useState("collect"); const [expenseView,setExpenseView]=useState("all"); const [busy, setBusy] = useState("");
  const approvedExpenses = useMemo(() => expenses.filter((expense) => !expense.approvalStatus || expense.approvalStatus === "approved"), [expenses]);
  const hasApprovedExpenses = approvedExpenses.length > 0;
  const balances = useMemo(() => {const result=calculateBalances(approvedExpenses,members.map((m)=>m.id));settlements.filter((item)=>item.status==="confirmed").forEach((item)=>{result[item.from]=(result[item.from]||0)+Number(item.amount);result[item.to]=(result[item.to]||0)-Number(item.amount);});return result;}, [approvedExpenses, members,settlements]);
  const transfers = useMemo(() => simplifyDebts(balances), [balances]);
  const expenseGroups=useMemo(()=>{
    const total=(items)=>items.filter((item)=>!item.approvalStatus||item.approvalStatus==="approved").reduce((sum,item)=>sum+Number(item.amount),0);
    if(expenseView==="all")return [{key:"all",label:"รายจ่ายทั้งหมด",items:expenses,total:total(expenses)}];
    const grouped=new Map();
    expenses.forEach((expense)=>{const key=expenseView==="day"?(expense.expenseDate||"unknown"):(expense.mealPeriod||"other");if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(expense);});
    const order=expenseView==="day"?[...grouped.keys()].sort():["breakfast","lunch","dinner","snack","other"].filter((key)=>grouped.has(key));
    return order.map((key)=>{const items=grouped.get(key);return {key,label:expenseView==="day"?(key==="unknown"?"ไม่ระบุวัน":shortThaiDate(key)):mealLabels[key],items,total:total(items)};});
  },[expenses,expenseView]);
  const name = (id) => members.find((m) => m.id === id)?.name || "—";
  const markPaid = async (collectionId, memberId) => { setBusy(`${collectionId}-${memberId}`); const source=collections.find((c)=>c.id===collectionId); const updated = { ...source, paid:[...new Set([...source.paid,memberId])],payments:{...source.payments,[memberId]:{...source.payments?.[memberId],status:"paid"}} }; try { if(onPersistCollection) await onPersistCollection(updated,memberId); else await wait(); setCollections((old)=>old.map((c)=>c.id===collectionId?updated:c)); toast("ยืนยันการรับเงินแล้ว"); } catch(err){ toast(err.message,"error"); } finally { setBusy(""); } };
  const sendCollectionSlip=async(collection,file)=>{if(!file)return;setBusy(`slip-${collection.id}`);try{const payment=onSubmitCollectionSlip?await onSubmitCollectionSlip(collection,file):{status:"pending",slipUrl:""};setCollections((old)=>old.map((item)=>item.id===collection.id?{...item,payments:{...item.payments,[currentUserId]:payment}}:item));toast("ส่งสลิปให้ผู้รับตรวจแล้ว");}catch(err){toast(err.message,"error");}finally{setBusy("");}};
  const sendTransfer=async(transfer,file)=>{if(!file)return;setBusy(`transfer-${transfer.from}-${transfer.to}`);try{const settlement=onSubmitTransfer?await onSubmitTransfer(transfer,file):{id:crypto.randomUUID(),...transfer,status:"pending"};setSettlements?.((old)=>[...old.filter((item)=>!(item.from===transfer.from&&item.to===transfer.to)),settlement]);toast("ส่งสลิปปิดยอดแล้ว");}catch(err){toast(err.message,"error");}finally{setBusy("");}};
  const reviewTransfer=async(settlement,status)=>{setBusy(`review-${settlement.id}`);try{if(onReviewTransfer)await onReviewTransfer(settlement,status);setSettlements?.((old)=>old.map((item)=>item.id===settlement.id?{...item,status}:item));toast(status==="confirmed"?"ยืนยันรับเงินแล้ว":"ส่งกลับให้แก้ไขสลิป",status==="confirmed"?"success":"info");}catch(err){toast(err.message,"error");}finally{setBusy("");}};
  const decide = async (expense, status) => { setBusy(`${expense.id}-${status}`); try { if(onReviewExpense) await onReviewExpense(expense.id,status); else await wait(); setExpenses((old)=>old.map((item)=>item.id===expense.id?{...item,approvalStatus:status}:item)); toast(status==="approved"?"อนุมัติรายจ่ายแล้ว":"ปฏิเสธรายจ่ายแล้ว",status==="approved"?"success":"info"); } catch(err){toast(err.message,"error");} finally{setBusy("");} };
  return <Stack spacing={2}>
    <Box><Typography variant="h4">เงินของทริป</Typography></Box>
    <Stack direction="row" spacing={1}><Button fullWidth variant={section === "collect" ? "contained" : "outlined"} onClick={() => setSection("collect")}>เรียกเก็บ</Button><Button fullWidth variant={section === "expense" ? "contained" : "outlined"} onClick={() => setSection("expense")}>รายจ่าย</Button><Button fullWidth variant={section === "summary" ? "contained" : "outlined"} onClick={() => setSection("summary")}>สรุปยอด</Button></Stack>
    {section === "collect" && <>{collections.map((c) => <Card key={c.id}><CardContent><Stack direction="row" justifyContent="space-between"><Box><Chip size="small" color="warning" label={`ครบกำหนด ${c.due}`}/><Typography variant="h6" mt={1}>{c.title}</Typography><Typography color="text.secondary">ยอดรวม {currency(c.amount)} · คนละ {currency(c.perPerson)}</Typography></Box>{canApprove?<Stack direction="row"><IconButton aria-label="แก้รายการเรียกเก็บ" onClick={()=>onEditCollection(c)}><EditRounded/></IconButton><IconButton color="error" aria-label="ลบรายการเรียกเก็บ" onClick={()=>onDeleteCollection(c)}><DeleteOutlineRounded/></IconButton></Stack>:<ReceiptLongRounded color="primary"/>}</Stack><LinearProgress variant="determinate" value={c.paid.length / c.participants.length * 100} sx={{ my: 2, height: 8, borderRadius: 8 }}/><Typography variant="caption">จ่ายแล้ว {c.paid.length}/{c.participants.length} คน</Typography><Stack mt={1} spacing={1}>{c.participants.map((id) => {const payment=c.payments?.[id]||{status:c.paid.includes(id)?"paid":"unpaid"};return <Stack key={id} direction="row" alignItems="center" gap={1}><Avatar sx={{ width: 34, height: 34, bgcolor: members.find((m) => m.id === id)?.color }}>{members.find((m) => m.id === id)?.emoji}</Avatar><Typography flex={1}>{name(id)}</Typography>{payment.status==="paid"?<Chip size="small" color="success" label="จ่ายแล้ว"/>:currentUserId===c.receiver&&payment.status==="pending"?<Stack direction="row" spacing={.5}>{payment.slipUrl&&<Button size="small" href={payment.slipUrl} target="_blank">ดูสลิป</Button>}<BusyButton size="small" busy={busy===`${c.id}-${id}`} variant="contained" onClick={()=>markPaid(c.id,id)}>ยืนยัน</BusyButton></Stack>:id===currentUserId&&payment.status!=="pending"?<BusyButton component="label" size="small" busy={busy===`slip-${c.id}`} variant="outlined" startIcon={<CloudUploadRounded/>}>แจ้งโอน<input hidden type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event)=>sendCollectionSlip(c,event.target.files?.[0])}/></BusyButton>:<Chip size="small" color={payment.status==="pending"?"warning":"default"} label={payment.status==="pending"?"รอตรวจ":"ยังไม่จ่าย"}/>}</Stack>})}</Stack></CardContent></Card>)}{canAddCollection&&<Button variant="outlined" startIcon={<AddRounded/>} onClick={onAddCollection}>สร้างรายการเรียกเก็บ</Button>}</>}
    {section === "expense" && <>{expenses.length?<><Stack direction="row" spacing={1} className="expense-view-switch"><Button fullWidth variant={expenseView==="all"?"contained":"outlined"} onClick={()=>setExpenseView("all")}>ทั้งหมด</Button><Button fullWidth variant={expenseView==="day"?"contained":"outlined"} onClick={()=>setExpenseView("day")}>ต่อวัน</Button><Button fullWidth variant={expenseView==="meal"?"contained":"outlined"} onClick={()=>setExpenseView("meal")}>ต่อมื้อ</Button></Stack>{expenseGroups.map((group)=><ExpenseReportTable key={group.key} group={group} members={members} canApprove={canApprove} busy={busy} onDecide={decide} onEdit={onEditExpense} onDelete={onDeleteExpense}/>) }<Button variant="outlined" startIcon={<AddRounded/>} onClick={onAddExpense}>เพิ่มรายจ่าย</Button></>:<Card className="expense-empty"><CardContent><Box className="expense-empty-icon"><ReceiptLongRounded/></Box><Typography variant="h5">ยังไม่มีรายจ่าย</Typography><Typography color="text.secondary">เริ่มบันทึกค่าอาหาร ค่าเดินทาง หรือค่าใช้จ่ายอื่น ๆ แล้วระบบจะช่วยหารและสรุปยอดให้</Typography><Button variant="contained" startIcon={<AddRounded/>} onClick={onAddExpense}>เพิ่มรายจ่ายแรก</Button></CardContent></Card>}</>}
    {section === "summary" && <>{expenses.some((e)=>e.approvalStatus==="pending")&&<Alert severity="info">มีรายจ่ายรอตรวจ ซึ่งยังไม่นำมาคำนวณจนกว่าแอดมินจะอนุมัติ</Alert>}<Card className={`balance-card ${!hasApprovedExpenses?"balance-empty":""}`}><CardContent><Typography variant="overline">{hasApprovedExpenses?"ยอดสุทธิของคุณ":"สถานะสรุปยอด"}</Typography><Typography variant="h4" color={hasApprovedExpenses&&((balances[currentUserId] || 0) < 0)?"error.main":"inherit"}>{hasApprovedExpenses?`${(balances[currentUserId] || 0) >= 0 ? "ได้รับ " : "ต้องจ่าย "}${currency(Math.abs(balances[currentUserId] || 0))}`:"ยังไม่มีข้อมูล"}</Typography><Typography color="text.secondary">{hasApprovedExpenses?"คำนวณเฉพาะรายจ่ายที่อนุมัติแล้ว และหักรายการที่ยืนยันรับเงินแล้ว":expenses.length?"รอแอดมินอนุมัติรายจ่ายก่อน จึงจะเริ่มคำนวณยอด":"เพิ่มรายจ่ายรายการแรก แล้วระบบจะคำนวณยอดให้อัตโนมัติ"}</Typography></CardContent></Card>{hasApprovedExpenses&&<Typography variant="h6">รายการที่ต้องโอน</Typography>}{!hasApprovedExpenses?<Alert severity="info">{expenses.length?"ยังไม่มีรายจ่ายที่อนุมัติ จึงยังไม่สามารถสรุปยอดได้":"ยังไม่มีรายจ่ายในทริปนี้"}</Alert>:transfers.length ? transfers.map((transfer)=><SettlementCard key={`${transfer.from}-${transfer.to}`} transfer={transfer} settlement={settlements.find((item)=>item.from===transfer.from&&item.to===transfer.to)} members={members} currentUserId={currentUserId} busy={busy} onShowQr={onShowQr} onSend={sendTransfer} onReview={reviewTransfer} canApprove={canApprove}/>) : <Alert severity="success">ทุกคนเคลียร์ยอดเรียบร้อยแล้ว 🎉</Alert>}</>}
  </Stack>;
}

function Profile({ members, setMembers, onAddMember, toast, account, activeTrip, onLogout, canInvite = true, onSettings, onRoleChange, onRemoveMember, canInstall, onInstall }) {
  const meIndex = account ? members.findIndex((m) => m.id === account.user.id) : 0; const me = members[Math.max(0,meIndex)] || membersSeed[0]; const [busy, setBusy] = useState(false);
  const upload = async (event) => {
    const input = event.target; const file = input.files?.[0];
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) { input.value=""; return toast("รองรับเฉพาะ JPG, PNG หรือ WebP", "error"); }
    if (file.size > 2 * 1024 * 1024) { input.value=""; return toast("รูปต้องมีขนาดไม่เกิน 2 MB", "error"); }
    if (!account) {
      const reader = new FileReader();
      reader.onload = () => setMembers((old) => old.map((m, i) => i === meIndex ? { ...m, avatar: reader.result } : m));
      reader.readAsDataURL(file); input.value=""; return;
    }
    setBusy(true);
    try {
      const extension = file.type.split("/")[1].replace("jpeg","jpg");
      const path = `${account.user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path,file,{cacheControl:"3600",upsert:false});
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
      if (!publicData?.publicUrl) throw new Error("สร้าง URL รูปโปรไฟล์ไม่สำเร็จ");
      const { data: updatedProfile, error: updateError } = await supabase.from("profiles").update({avatar_url:publicData.publicUrl}).eq("id",account.user.id).select("avatar_url").single();
      if (updateError) throw updateError;
      setMembers((old)=>old.map((m)=>m.id===account.user.id?{...m,avatar:updatedProfile.avatar_url}:m));
      toast("เปลี่ยนรูปโปรไฟล์แล้ว");
    } catch (error) { toast(error.message||"เปลี่ยนรูปโปรไฟล์ไม่สำเร็จ","error"); }
    finally { setBusy(false); input.value=""; }
  };
  const uploadPaymentQr = async (event) => { const file=event.target.files?.[0];const tripId=activeTrip?.id||account?.trips?.[0]?.id; if(!file||!account||!tripId)return; if(file.size>3*1024*1024)return toast("รูป QR ต้องมีขนาดไม่เกิน 3 MB","error"); setBusy(true); try{const uploaded=await uploadTripFile(tripId,account.user.id,"payment-qr",file);const {error:updateError}=await supabase.from("profiles").update({payment_qr_path:uploaded.path}).eq("id",account.user.id);if(updateError)throw updateError;setMembers((old)=>old.map((m)=>m.id===account.user.id?{...m,paymentQr:uploaded.signedUrl,paymentQrPath:uploaded.path}:m));toast("บันทึก QR รับเงินแล้ว");}catch(err){toast(err.message,"error");}finally{setBusy(false);event.target.value="";} };
  const save = async () => { setBusy(true); if (account) { const { error } = await supabase.from("profiles").update({display_name:me.name,promptpay_id:me.promptpay,bank_name:me.bankName||null,account_name:me.accountName||null}).eq("id",account.user.id); if (error) { setBusy(false); return toast(error.message,"error"); } } else await wait(); setBusy(false); toast("บันทึกโปรไฟล์แล้ว"); };
  return <Stack spacing={2}>
    <Box textAlign="center"><Box className="profile-avatar">{me.avatar ? <Avatar src={me.avatar}/> : <Avatar sx={{ bgcolor: me.color }}>{me.emoji}</Avatar>}</Box><Button className="profile-photo-button" component="label" size="small" variant="outlined" startIcon={busy?<CircularProgress size={16}/>:<CameraAltRounded/>} disabled={busy}>เปลี่ยนรูปโปรไฟล์<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/></Button><Typography variant="h5" mt={1.2}>{me.name}</Typography><Typography color="text.secondary">{me.role}</Typography></Box>
    <Card><CardContent><Stack spacing={2}><TextField label="ชื่อที่แสดง" value={me.name} onChange={(e) => setMembers((old) => old.map((m, i) => i === meIndex ? { ...m, name: e.target.value } : m))}/><TextField label="PromptPay" value={me.promptpay} inputProps={{ inputMode: "numeric" }} onChange={(e) => setMembers((old) => old.map((m, i) => i === meIndex ? { ...m, promptpay: e.target.value.replace(/\D/g, "") } : m))}/><TextField label="ธนาคาร" placeholder="เช่น กสิกรไทย" value={me.bankName||""} onChange={(e)=>setMembers((old)=>old.map((m,i)=>i===meIndex?{...m,bankName:e.target.value}:m))}/><TextField label="ชื่อบัญชี" value={me.accountName||""} onChange={(e)=>setMembers((old)=>old.map((m,i)=>i===meIndex?{...m,accountName:e.target.value}:m))}/><Button component="label" variant="outlined" startIcon={<QrCode2Rounded/>}>{me.paymentQr ? "เปลี่ยน QR รับเงิน" : "อัปโหลด QR รับเงิน"}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadPaymentQr}/></Button>{me.paymentQr&&<Box className="qr-preview"><img src={me.paymentQr} alt="QR รับเงินของฉัน"/></Box>}<BusyButton busy={busy} variant="contained" onClick={save}>บันทึกโปรไฟล์</BusyButton></Stack></CardContent></Card>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">สมาชิกทั้งหมด</Typography>{canInvite && <Button startIcon={<PersonAddRounded/>} onClick={onAddMember}>เชิญเพื่อน</Button>}</Stack>
    <Card><CardContent>{members.map((m, index) => <React.Fragment key={m.id}><Stack direction="row" alignItems="center" py={1}><Avatar src={m.avatar} sx={{ bgcolor: m.color, mr: 1.5 }}>{m.emoji}</Avatar><Box flex={1}><Typography fontWeight={750}>{m.name}</Typography><Typography variant="caption" color="text.secondary">{m.role}</Typography></Box>{canInvite&&m.tripRole!=="owner"&&m.id!==account?.user.id?<Stack direction="row" alignItems="center"><TextField select size="small" sx={{width:125}} value={m.tripRole||"member"} onChange={(event)=>onRoleChange?.(m,event.target.value)}><MenuItem value="member">สมาชิก</MenuItem><MenuItem value="planner">ดูแลแพลน</MenuItem><MenuItem value="treasurer">เหรัญญิก</MenuItem></TextField><IconButton color="error" aria-label={`นำ ${m.name} ออกจากทริป`} onClick={()=>window.confirm(`นำ ${m.name} ออกจากทริปนี้?`)&&onRemoveMember?.(m)}><DeleteOutlineRounded/></IconButton></Stack>:<Chip size="small" color={m.online ? "success" : "default"} label={m.online ? "ออนไลน์" : "ออฟไลน์"}/>}</Stack>{index < members.length - 1 && <Divider/>}</React.Fragment>)}</CardContent></Card>
    {account && <Alert severity="success">เข้าสู่ระบบด้วย {account.user.email}</Alert>}{account&&"Notification" in window&&Notification.permission!=="granted"&&<Button variant="outlined" startIcon={<NotificationsRounded/>} onClick={async()=>{const permission=await Notification.requestPermission();toast(permission==="granted"?"เปิดการแจ้งเตือนแล้ว":"ยังไม่ได้อนุญาตการแจ้งเตือน",permission==="granted"?"success":"info");}}>เปิดการแจ้งเตือนบนเครื่องนี้</Button>}
    {canInstall&&<Button variant="outlined" startIcon={<InstallMobileRounded/>} onClick={onInstall}>ติดตั้ง TripMate บนมือถือ</Button>}{canInvite&&<Button color="inherit" startIcon={<SettingsRounded/>} onClick={onSettings}>ตั้งค่าทริปและสิทธิ์สมาชิก</Button>}<Button color="error" startIcon={<LogoutRounded/>} onClick={onLogout}>ออกจากระบบ</Button>
  </Stack>;
}

function Empty({ icon, title, action, onClick }) { return <Box className="empty"><span>{icon}</span><Typography variant="h6">{title}</Typography><Button variant="contained" onClick={onClick}>{action}</Button></Box>; }

function NotificationDialog({ open, onClose, items, onOpenMoney }) {
  return <Dialog open={open} onClose={onClose} fullWidth><DialogTitle>การแจ้งเตือน</DialogTitle><DialogContent><Stack spacing={1.2} pt={1}>{items.length?items.map((item,index)=><Alert key={`${item.type}-${index}`} severity={item.severity||"info"} icon={item.type==="done"?<DoneAllRounded/>:undefined}>{item.text}</Alert>):<Box textAlign="center" py={4}><DoneAllRounded color="success" sx={{fontSize:48}}/><Typography variant="h6">ยังไม่มีเรื่องต้องจัดการ</Typography></Box>}</Stack></DialogContent><DialogActions><Button onClick={onClose}>ปิด</Button>{items.length>0&&<Button variant="contained" onClick={onOpenMoney}>ไปหน้าค่าใช้จ่าย</Button>}</DialogActions></Dialog>;
}

function AddStopDialog({ open, onClose, onSave, onDelete, item = null, selectedDay = 1, dayCount = 4 }) {
  const emptyForm={day:selectedDay,time:"09:00",title:"",place:"",note:"",googleMapsUrl:"",latitude:"",longitude:""};
  const [form, setForm] = useState(emptyForm); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [confirmDelete,setConfirmDelete]=useState(false);
  useEffect(()=>{if(!open)return;setForm(item?{day:item.day,time:item.time||"09:00",title:item.title||"",place:item.place||"",note:item.note||"",googleMapsUrl:item.googleMapsUrl||"",latitude:item.latitude||"",longitude:item.longitude||""}:emptyForm);setError("");setConfirmDelete(false);},[open,item?.id,selectedDay]);
  const useCurrentLocation=()=>{if(!navigator.geolocation)return setError("เบราว์เซอร์นี้ไม่รองรับตำแหน่ง");navigator.geolocation.getCurrentPosition(({coords})=>setForm((old)=>({...old,latitude:coords.latitude,longitude:coords.longitude,googleMapsUrl:`https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`})),()=>setError("กรุณาอนุญาตการเข้าถึงตำแหน่ง"),{enableHighAccuracy:true,timeout:15000});};
  const submit = async () => { if (!form.title.trim() || !form.place.trim()) return setError("กรุณากรอกกิจกรรมและสถานที่"); setBusy(true);try{await onSave({ ...item,...form,latitude:form.latitude?Number(form.latitude):null,longitude:form.longitude?Number(form.longitude):null,id:item?.id||crypto.randomUUID(),done:item?.done||false,day:Number(form.day) });}catch(err){setError(err.message||"บันทึกไม่สำเร็จ");}finally{setBusy(false);} };
  const remove=async()=>{setBusy(true);try{await onDelete(item);onClose();}catch(err){setError(err.message||"ลบไม่สำเร็จ");}finally{setBusy(false);}};
  return <Dialog open={open} onClose={() => !busy && onClose()} fullWidth><DialogTitle>{item?"แก้ไขสถานที่":"เพิ่มแพลนเที่ยว"}</DialogTitle><DialogContent><Stack spacing={2} pt={1}>{error&&<Alert severity="error">{error}</Alert>}{confirmDelete&&<Alert severity="warning">ลบ “{item?.title}” ออกจากแพลนถาวร?</Alert>}<TextField select label="วันที่" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>{Array.from({length:dayCount},(_,i)=>i+1).map((d) => <MenuItem key={d} value={d}>วันที่ {d}</MenuItem>)}</TextField><TextField label="เวลา" type="time" InputLabelProps={{ shrink: true }} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}/><TextField label="ทำอะไร" placeholder="เช่น กินข้าวเที่ยง" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/><TextField label="สถานที่" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })}/><TextField label="ลิงก์ Google Maps" placeholder="https://maps.google.com/..." value={form.googleMapsUrl} onChange={(e)=>setForm({...form,googleMapsUrl:e.target.value})}/><Button variant="outlined" startIcon={<MyLocationRounded/>} onClick={useCurrentLocation}>ใช้ตำแหน่งปัจจุบันเป็นหมุด</Button>{form.latitude&&<Alert severity="success">ปักหมุดแล้ว {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}</Alert>}<TextField label="หมายเหตุ" multiline rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}/></Stack></DialogContent><DialogActions>{item&&!confirmDelete&&<Button color="error" onClick={()=>setConfirmDelete(true)}>ลบสถานที่</Button>}{confirmDelete&&<BusyButton busy={busy} color="error" variant="contained" onClick={remove}>ยืนยันลบ</BusyButton>}<Box flex={1}/><Button onClick={onClose}>ยกเลิก</Button><BusyButton busy={busy} variant="contained" onClick={submit}>{item?"บันทึกการแก้ไข":"เพิ่มในแพลน"}</BusyButton></DialogActions></Dialog>;
}

function ExpenseDialog({ open, onClose, onSave, members, currentUserId, item=null, receiptRequiredOver = 0, requiresApproval = true }) {
  const [form, setForm] = useState({ title: "", amount: "", paidBy: currentUserId || members[0]?.id || "", category: "อาหาร", expenseDate: localDateString(), mealPeriod: "lunch", participants: members.map((m) => m.id), splitMethod: "equal", shares: {}, receiptFile: null }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!open)return;if(item)setForm({title:item.title,amount:item.amount,paidBy:item.paidBy,category:item.category,expenseDate:item.expenseDate,mealPeriod:item.mealPeriod||"other",participants:item.participants,splitMethod:item.splitMethod||"equal",shares:item.shares||{},receiptFile:null,receiptPath:item.receiptPath||"",receiptUrl:item.receiptUrl||""});else setForm({title:"",amount:"",paidBy:currentUserId||members[0]?.id||"",category:"อาหาร",expenseDate:localDateString(),mealPeriod:"lunch",participants:members.map((m)=>m.id),splitMethod:"equal",shares:{},receiptFile:null}); }, [open,item?.id,currentUserId,members.length]);
  const toggle = (id) => setForm({ ...form, participants: form.participants.includes(id) ? form.participants.filter((x) => x !== id) : [...form.participants, id] });
  const submit = async () => { const amount=Number(form.amount); if (!form.title.trim() || amount <= 0 || !form.expenseDate || !form.participants.length) return setError("กรุณากรอกชื่อ วันที่ จำนวนเงิน และเลือกผู้ร่วมอย่างน้อย 1 คน"); if(receiptRequiredOver>0&&amount>=receiptRequiredOver&&!form.receiptFile&&!form.receiptPath)return setError(`ยอดตั้งแต่ ${currency(receiptRequiredOver)} ต้องแนบใบเสร็จ`); let shares={}; if(form.splitMethod==="custom"){shares=Object.fromEntries(form.participants.map((id)=>[id,Number(form.shares[id]||0)])); const total=Object.values(shares).reduce((sum,value)=>sum+value,0); if(Math.abs(total-amount)>.01)return setError(`ยอดที่หารรวมต้องเท่ากับ ${currency(amount)} (ตอนนี้ ${currency(total)})`);} else {const share=amount/form.participants.length;shares=Object.fromEntries(form.participants.map((id)=>[id,share]));} setBusy(true); setError(""); try{await onSave({ ...item,...form, amount, shares, mealPeriod:form.category==="อาหาร"?form.mealPeriod:"other", id:item?.id||crypto.randomUUID() });} finally{setBusy(false);} };
  return <Dialog open={open} onClose={() => !busy && onClose()} fullWidth><DialogTitle>{item?"แก้ไขรายจ่าย":"เพิ่มรายจ่าย"}</DialogTitle><DialogContent><Stack spacing={2} pt={1}>{error && <Alert severity="error">{error}</Alert>}{requiresApproval&&!item&&<Alert severity="info">เมื่อบันทึกแล้ว รายการจะรอแอดมินอนุมัติก่อนนำไปสรุปยอด</Alert>}<TextField label="รายการ" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/><TextField label="จำนวนเงิน" type="number" inputProps={{ min: 1 }} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}/><TextField label="วันที่ใช้จ่าย" type="date" InputLabelProps={{shrink:true}} value={form.expenseDate} onChange={(e)=>setForm({...form,expenseDate:e.target.value})}/><TextField select label="คนจ่าย" value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })}>{members.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}</TextField><TextField select label="หมวด" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, mealPeriod:e.target.value==="อาหาร"?(form.mealPeriod==="other"?"lunch":form.mealPeriod):"other" })}>{["อาหาร","เดินทาง","ที่พัก","กิจกรรม","อื่น ๆ"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>{form.category==="อาหาร"&&<TextField select label="มื้อ" value={form.mealPeriod} onChange={(e)=>setForm({...form,mealPeriod:e.target.value})}>{Object.entries(mealLabels).filter(([key])=>key!=="other").map(([key,label])=><MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>}<Typography fontWeight={750}>หารกับใครบ้าง</Typography><Box>{members.map((m) => <FormControlLabel key={m.id} control={<Checkbox checked={form.participants.includes(m.id)} onChange={() => toggle(m.id)}/>} label={m.name}/>)}</Box><TextField select label="วิธีหาร" value={form.splitMethod} onChange={(e)=>setForm({...form,splitMethod:e.target.value,shares:{}})}><MenuItem value="equal">หารเท่ากัน</MenuItem><MenuItem value="custom">กำหนดยอดแต่ละคน</MenuItem></TextField>{form.splitMethod==="equal"&&Number(form.amount)>0&&form.participants.length>0&&<Alert severity="success">คนละ {currency(Number(form.amount)/form.participants.length)}</Alert>}{form.splitMethod==="custom"&&<Stack spacing={1}>{form.participants.map((id)=><TextField key={id} size="small" type="number" label={`ยอดของ ${members.find((m)=>m.id===id)?.name||"สมาชิก"}`} value={form.shares[id]||""} onChange={(e)=>setForm({...form,shares:{...form.shares,[id]:e.target.value}})}/>)}</Stack>}<Button component="label" variant="outlined" startIcon={<CloudUploadRounded/>}>{form.receiptFile?form.receiptFile.name:form.receiptPath?"เปลี่ยนใบเสร็จ":"แนบรูปใบเสร็จ"}<input hidden type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e)=>setForm({...form,receiptFile:e.target.files?.[0]||null})}/></Button></Stack></DialogContent><DialogActions><Button onClick={onClose}>ยกเลิก</Button><BusyButton busy={busy} variant="contained" onClick={submit}>{item?"บันทึกการแก้ไข":"บันทึกรายจ่าย"}</BusyButton></DialogActions></Dialog>;
}

function CollectionDialog({ open, onClose, onSave, members, currentUserId, item=null }) {
  const [form, setForm] = useState({ title: "", amount: "", due: "", receiver: currentUserId || members[0]?.id || "",participants:[] }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => {if(!open)return;setForm(item?{title:item.title,amount:item.amount,due:item.due,receiver:item.receiver,participants:item.participants}:{title:"",amount:"",due:"",receiver:currentUserId||members[0]?.id||"",participants:members.map((m)=>m.id)});setError("");}, [open,item?.id,currentUserId,members.length]);
  const submit = async () => { if (!form.title.trim() || Number(form.amount) <= 0 || !form.due || !form.receiver||!form.participants.length) return setError("กรุณากรอกข้อมูลให้ครบและเลือกผู้ที่ต้องจ่าย"); setBusy(true);try{await onSave({ ...item,...form, id:item?.id||crypto.randomUUID(), amount:Number(form.amount),perPerson:Number(form.amount)/form.participants.length,paid:item?.paid||[form.receiver]});}finally{setBusy(false);} };
  return <Dialog open={open} onClose={() => !busy && onClose()} fullWidth><DialogTitle>{item?"แก้ไขรายการเรียกเก็บ":"สร้างรายการเรียกเก็บ"}</DialogTitle><DialogContent><Stack spacing={2} pt={1}>{error && <Alert severity="error">{error}</Alert>}<TextField label="รายการ" placeholder="เช่น ค่าที่พัก" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/><TextField label="ยอดรวม" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}/><TextField label="ครบกำหนด" type="date" InputLabelProps={{ shrink: true }} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })}/><TextField select label="ผู้รับเงิน" value={form.receiver} onChange={(e) => setForm({ ...form, receiver: e.target.value })}>{members.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}</TextField><Typography fontWeight={750}>ใครบ้างที่ต้องจ่าย</Typography><Box>{members.map((m)=><FormControlLabel key={m.id} control={<Checkbox checked={form.participants.includes(m.id)} onChange={()=>setForm({...form,participants:form.participants.includes(m.id)?form.participants.filter((id)=>id!==m.id):[...form.participants,m.id]})}/>} label={m.name}/>)}</Box>{Number(form.amount) > 0&&form.participants.length>0&&<Alert severity="info">หาร {form.participants.length} คน · คนละ {currency(Number(form.amount) / form.participants.length)}</Alert>}</Stack></DialogContent><DialogActions><Button onClick={onClose}>ยกเลิก</Button><BusyButton busy={busy} variant="contained" onClick={submit}>{item?"บันทึกการแก้ไข":"สร้างรายการ"}</BusyButton></DialogActions></Dialog>;
}

function MemberDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState({ name: "", promptpay: "" }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async () => { if (!form.name.trim()) return setError("กรุณากรอกชื่อสมาชิก"); setBusy(true); await wait(); onSave({ ...form, id: crypto.randomUUID(), role: "สมาชิก", color: ["#73b6a4","#789ed6","#a58ad2","#e6a85a"][Math.floor(Math.random()*4)], emoji: "🙂", online: false }); setBusy(false); setForm({ name: "", promptpay: "" }); setError(""); };
  return <Dialog open={open} onClose={() => !busy && onClose()} fullWidth><DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle><DialogContent><Stack spacing={2} pt={1}>{error && <Alert severity="error">{error}</Alert>}<TextField label="ชื่อที่แสดง" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/><TextField label="PromptPay (ไม่บังคับ)" inputProps={{ inputMode: "numeric" }} value={form.promptpay} onChange={(e) => setForm({ ...form, promptpay: e.target.value.replace(/\D/g, "") })}/><Alert severity="info">เมื่อต่อ Supabase ระบบจะสร้างบัญชีและส่งรหัสผ่านชั่วคราวให้สมาชิก</Alert></Stack></DialogContent><DialogActions><Button onClick={onClose}>ยกเลิก</Button><BusyButton busy={busy} variant="contained" onClick={submit}>เพิ่มสมาชิก</BusyButton></DialogActions></Dialog>;
}

function InviteDialog({ open, onClose, trip }) {
  const [label, setLabel] = useState(""); const [url, setUrl] = useState(""); const [invites,setInvites]=useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const reload=async()=>setInvites(await loadTripInvites(trip.id));
  useEffect(()=>{if(open)reload().catch((err)=>setError(err.message));},[open,trip.id]);
  const generate = async () => {
    setBusy(true); setError("");
    try {
      const token = await createInvite(trip.id, label.trim());
      setUrl(`${window.location.origin}${window.location.pathname}?invite=${token}`);
      await reload();
    } catch (err) { setError(err.message || "สร้างลิงก์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const copy = async () => { await navigator.clipboard.writeText(url); };
  return <Dialog open={open} onClose={() => !busy && onClose()} fullWidth><DialogTitle>เชิญเพื่อนเข้าทริป</DialogTitle><DialogContent><Stack spacing={2} pt={1}>
    <Alert severity="info">สร้างลิงก์แยกให้เพื่อนแต่ละคน ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 7 วัน</Alert>
    {error && <Alert severity="error">{error}</Alert>}
    <TextField label="ชื่อเพื่อนหรือหมายเหตุ" placeholder="เช่น เอ" value={label} onChange={(e) => setLabel(e.target.value)}/>
    {url && <TextField label="ลิงก์เชิญ" value={url} InputProps={{ readOnly: true }} helperText="ส่งลิงก์นี้ให้เพื่อนสมัครหรือล็อกอิน"/>}<Divider/><Typography fontWeight={800}>ลิงก์ที่สร้างไว้</Typography>{invites.length?invites.map((item)=>{const active=!item.claimed_at&&!item.revoked_at&&new Date(item.expires_at)>new Date();return <Stack key={item.id} direction="row" alignItems="center" spacing={1}><Box flex={1}><Typography>{item.label||"ไม่มีชื่อกำกับ"}</Typography><Typography variant="caption" color="text.secondary">{item.claimed_at?"ถูกใช้แล้ว":item.revoked_at?"ยกเลิกแล้ว":active?`ใช้ได้ถึง ${new Date(item.expires_at).toLocaleDateString("th-TH")}`:"หมดอายุแล้ว"}</Typography></Box>{active&&<IconButton color="error" aria-label="ยกเลิกลิงก์" onClick={async()=>{try{await revokeTripInvite(item.id);await reload();}catch(err){setError(err.message);}}}><DeleteOutlineRounded/></IconButton>}</Stack>}):<Typography variant="body2" color="text.secondary">ยังไม่มีลิงก์เชิญ</Typography>}
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>ปิด</Button>{url ? <Button variant="contained" startIcon={<ContentCopyRounded/>} onClick={copy}>คัดลอกลิงก์</Button> : <BusyButton busy={busy} variant="contained" onClick={generate}>สร้างลิงก์</BusyButton>}</DialogActions></Dialog>;
}

function PaymentQrDialog({ member, onClose }) {
  return <Dialog open={Boolean(member)} onClose={onClose} fullWidth maxWidth="xs"><DialogTitle>โอนให้ {member?.name}</DialogTitle><DialogContent><Stack spacing={2} alignItems="center" pt={1}>
    {member?.paymentQr ? <Box className="payment-qr"><img src={member.paymentQr} alt={`QR รับเงินของ ${member.name}`}/></Box> : <Alert severity="info">สมาชิกยังไม่ได้แนบรูป QR</Alert>}
    <Box textAlign="center"><Typography fontWeight={750}>{member?.accountName || member?.name}</Typography>{member?.bankName && <Typography color="text.secondary">{member.bankName}</Typography>}{member?.promptpay && <Chip sx={{mt:1}} icon={<QrCode2Rounded/>} label={`PromptPay ${member.promptpay}`}/>}</Box>
    <Alert severity="warning">ตรวจสอบชื่อผู้รับและยอดเงินในแอปธนาคารทุกครั้งก่อนยืนยันโอน</Alert>
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>ปิด</Button></DialogActions></Dialog>;
}

function TripSettingsDialog({ open, onClose, trip, onSave }) {
  const [form,setForm]=useState({}); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{if(open&&trip)setForm({name:trip.name||"",start_date:trip.start_date||"",end_date:trip.end_date||"",description:trip.description||"",google_photos_url:trip.google_photos_url||"",cover_url:trip.cover_url||"",coverFile:null,budget:trip.budget??"",require_expense_approval:trip.require_expense_approval!==false,members_can_add_stops:trip.members_can_add_stops!==false,members_can_add_collections:Boolean(trip.members_can_add_collections),receipt_required_over:trip.receipt_required_over??0});},[open,trip?.id]);
  const submit=async()=>{if(!form.name?.trim()||!form.start_date||!form.end_date)return setError("กรุณากรอกชื่อและวันที่ทริปให้ครบ");if(form.end_date<form.start_date)return setError("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");setBusy(true);setError("");try{let coverUrl=form.cover_url||null;if(form.coverFile)coverUrl=await uploadTripCover(trip.id,form.coverFile);const {coverFile,...values}=form;await onSave({...values,cover_url:coverUrl,name:form.name.trim(),description:form.description||null,google_photos_url:form.google_photos_url||null,budget:form.budget===""?null:Number(form.budget),receipt_required_over:Number(form.receipt_required_over||0)});onClose();}catch(err){setError(err.message||"บันทึกการตั้งค่าไม่สำเร็จ");}finally{setBusy(false);}};
  const toggle=(key)=>(event)=>setForm({...form,[key]:event.target.checked});
  return <Dialog open={open} onClose={()=>!busy&&onClose()} fullWidth><DialogTitle>ตั้งค่าทริป</DialogTitle><DialogContent><Stack spacing={2} pt={1}>{error&&<Alert severity="error">{error}</Alert>}<TextField label="ชื่อทริป" value={form.name||""} onChange={(e)=>setForm({...form,name:e.target.value})}/><Stack direction="row" spacing={1}><TextField label="วันเริ่ม" type="date" InputLabelProps={{shrink:true}} value={form.start_date||""} onChange={(e)=>setForm({...form,start_date:e.target.value})}/><TextField label="วันสิ้นสุด" type="date" InputLabelProps={{shrink:true}} value={form.end_date||""} onChange={(e)=>setForm({...form,end_date:e.target.value})}/></Stack><TextField label="รายละเอียด" multiline rows={2} value={form.description||""} onChange={(e)=>setForm({...form,description:e.target.value})}/><Button component="label" variant="outlined" startIcon={<CameraAltRounded/>}>{form.coverFile?form.coverFile.name:"เปลี่ยนภาพปกทริป"}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>setForm({...form,coverFile:e.target.files?.[0]||null})}/></Button><TextField label="ลิงก์อัลบั้ม Google Photos" value={form.google_photos_url||""} onChange={(e)=>setForm({...form,google_photos_url:e.target.value})}/><TextField label="งบทริป" type="number" inputProps={{min:0}} value={form.budget??""} onChange={(e)=>setForm({...form,budget:e.target.value})}/><Divider/><Typography fontWeight={800}>สิทธิ์และการเงิน</Typography><FormControlLabel control={<Switch checked={Boolean(form.require_expense_approval)} onChange={toggle("require_expense_approval")}/>} label="รายจ่ายของสมาชิกต้องให้แอดมินอนุมัติ"/><FormControlLabel control={<Switch checked={Boolean(form.members_can_add_stops)} onChange={toggle("members_can_add_stops")}/>} label="สมาชิกเพิ่มสถานที่ในแพลนได้"/><FormControlLabel control={<Switch checked={Boolean(form.members_can_add_collections)} onChange={toggle("members_can_add_collections")}/>} label="สมาชิกสร้างรายการเรียกเก็บได้"/><TextField label="บังคับแนบใบเสร็จ เมื่อยอดตั้งแต่" type="number" inputProps={{min:0}} helperText="ใส่ 0 หากไม่บังคับ" value={form.receipt_required_over??0} onChange={(e)=>setForm({...form,receipt_required_over:e.target.value})}/></Stack></DialogContent><DialogActions><Button onClick={onClose}>ยกเลิก</Button><BusyButton busy={busy} variant="contained" onClick={submit}>บันทึกการตั้งค่า</BusyButton></DialogActions></Dialog>;
}

function AuthScreen({ inviteToken }) {
  const [mode, setMode] = useState("login"); const [form, setForm] = useState({ name: "", email: "", password: "" }); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "reset") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(form.email, { redirectTo: window.location.origin });
        if (authError) throw authError; setMessage("ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจอีเมล");
      } else if (mode === "signup") {
        if (!form.name.trim()) throw new Error("กรุณากรอกชื่อที่แสดง");
        const { data, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { display_name: form.name.trim() } } });
        if (authError) throw authError;
        setMessage(data.session ? "สมัครสำเร็จ กำลังเข้าทริป..." : "สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (authError) throw authError;
      }
    } catch (err) { setError(err.message || "ทำรายการไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  return <ThemeProvider theme={theme}><Box className="auth-shell"><Card className="auth-card"><CardContent><Stack spacing={2.2}>
    <Box textAlign="center"><Avatar className="auth-logo"><TravelExploreRounded/></Avatar><Typography variant="h4">TripMate</Typography><Typography color="text.secondary">วางแผน แชร์ และเคลียร์ค่าใช้จ่ายกับเพื่อน</Typography></Box>
    {inviteToken && <Alert severity="info">คุณได้รับคำเชิญเข้าทริป เข้าสู่ระบบหรือสมัครสมาชิกเพื่อเข้าร่วม</Alert>}
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
    {mode === "signup" && <TextField label="ชื่อที่แสดง" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/>}<TextField label="อีเมล" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/>{mode !== "reset" && <TextField label="รหัสผ่าน" type="password" helperText={mode === "signup" ? "อย่างน้อย 6 ตัวอักษร" : ""} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/>}<BusyButton busy={busy} variant="contained" onClick={submit}>{mode === "login" ? "เข้าสู่ระบบ" : mode === "signup" ? "สมัครสมาชิก" : "ส่งลิงก์ตั้งรหัสผ่าน"}</BusyButton>
    <Stack direction="row" justifyContent="center" spacing={1}><Button size="small" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "มีบัญชีแล้ว" : "สมัครสมาชิก"}</Button><Button size="small" onClick={() => setMode(mode === "reset" ? "login" : "reset")}>{mode === "reset" ? "กลับไปล็อกอิน" : "ลืมรหัสผ่าน"}</Button></Stack>
  </Stack></CardContent></Card></Box></ThemeProvider>;
}

function CreateTripScreen({ user, onCreated }) {
  const [form, setForm] = useState({ name: "", start: "", end: "", description: "" }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async () => {
    if (!form.name || !form.start || !form.end) return setError("กรุณากรอกชื่อและวันที่ทริป");
    setBusy(true); setError("");
    try {
      const { data, error: tripError } = await supabase.from("trips").insert({ owner_id: user.id, name: form.name, start_date: form.start, end_date: form.end, description: form.description }).select().single();
      if (tripError) throw tripError;
      const { error: memberError } = await supabase.from("trip_members").insert({ trip_id: data.id, user_id: user.id, trip_role: "owner" });
      if (memberError) throw memberError; await onCreated();
    } catch (err) { setError(err.message || "สร้างทริปไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  return <ThemeProvider theme={theme}><Box className="auth-shell"><Card className="auth-card"><CardContent><Stack spacing={2}><Typography variant="h4">สร้างทริปแรก ✨</Typography><Typography color="text.secondary">คุณจะเป็นแอดมินและตั้งค่าทุกอย่างได้</Typography>{error && <Alert severity="error">{error}</Alert>}<TextField label="ชื่อทริป" placeholder="เชียงใหม่กับแก๊งเรา" value={form.name} onChange={(e) => setForm({...form,name:e.target.value})}/><Stack direction="row" spacing={1}><TextField label="วันเริ่ม" type="date" InputLabelProps={{shrink:true}} value={form.start} onChange={(e)=>setForm({...form,start:e.target.value})}/><TextField label="วันสิ้นสุด" type="date" InputLabelProps={{shrink:true}} value={form.end} onChange={(e)=>setForm({...form,end:e.target.value})}/></Stack><TextField label="รายละเอียด" multiline rows={3} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/><BusyButton busy={busy} variant="contained" onClick={submit}>สร้างทริป</BusyButton></Stack></CardContent></Card></Box></ThemeProvider>;
}

function CreateTripDialog({open,onClose,user,onCreated}) {
  const [form,setForm]=useState({name:"",start:"",end:"",description:""});const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const submit=async()=>{if(!form.name.trim()||!form.start||!form.end)return setError("กรุณากรอกชื่อและวันที่ทริป");if(form.end<form.start)return setError("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");setBusy(true);try{const {data,error:tripError}=await supabase.from("trips").insert({owner_id:user.id,name:form.name.trim(),start_date:form.start,end_date:form.end,description:form.description||null}).select().single();if(tripError)throw tripError;const {error:memberError}=await supabase.from("trip_members").insert({trip_id:data.id,user_id:user.id,trip_role:"owner"});if(memberError)throw memberError;await onCreated(data.id);setForm({name:"",start:"",end:"",description:""});onClose();}catch(err){setError(err.message||"สร้างทริปไม่สำเร็จ");}finally{setBusy(false);}};
  return <Dialog open={open} onClose={()=>!busy&&onClose()} fullWidth><DialogTitle>สร้างทริปใหม่</DialogTitle><DialogContent><Stack spacing={2} pt={1}>{error&&<Alert severity="error">{error}</Alert>}<TextField label="ชื่อทริป" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/><Stack direction="row" spacing={1}><TextField label="วันเริ่ม" type="date" InputLabelProps={{shrink:true}} value={form.start} onChange={(e)=>setForm({...form,start:e.target.value})}/><TextField label="วันสิ้นสุด" type="date" InputLabelProps={{shrink:true}} value={form.end} onChange={(e)=>setForm({...form,end:e.target.value})}/></Stack><TextField label="รายละเอียด" multiline rows={2} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></Stack></DialogContent><DialogActions><Button onClick={onClose}>ยกเลิก</Button><BusyButton busy={busy} variant="contained" onClick={submit}>สร้างทริป</BusyButton></DialogActions></Dialog>;
}

function LoadingScreen() { return <Box className="loading-screen"><Avatar className="loading-car"><TravelExploreRounded/></Avatar><Typography variant="h5">กำลังจัดกระเป๋า...</Typography><LinearProgress/><Stack spacing={1} width="100%"><Skeleton variant="rounded" height={140}/><Skeleton variant="rounded" height={90}/></Stack></Box>; }

function App({ account = null, trip = null, trips=[], onTripChange, onNewTrip, onRefresh }) {
  const [activeTrip,setActiveTrip]=useState(trip);
  useEffect(()=>setActiveTrip(trip),[trip]);
  const canInvite = !account || activeTrip?.trip_role === "owner";
  const canPlan = !account || ["owner","planner"].includes(activeTrip?.trip_role);
  const canManageMoney = !account || ["owner","treasurer"].includes(activeTrip?.trip_role);
  const canAddStops = canPlan || activeTrip?.members_can_add_stops !== false;
  const canAddCollections = canManageMoney || Boolean(activeTrip?.members_can_add_collections);
  const [loading, setLoading] = useState(true); const [tab, setTab] = useState(0); const [dialog, setDialog] = useState(""); const [editingStop,setEditingStop]=useState(null); const [editingExpense,setEditingExpense]=useState(null); const [editingCollection,setEditingCollection]=useState(null); const [selectedQr, setSelectedQr] = useState(null); const [toast, setToast] = useState({ open: false, text: "", severity: "success" });
  const [members, setMembers] = useStoredState("tripmate-members", membersSeed);
  const [stops, setStops] = useStoredState("tripmate-stops", stopsSeed);
  const [expenses, setExpenses] = useStoredState("tripmate-expenses", expensesSeed);
  const [collections, setCollections] = useStoredState("tripmate-collections", collectionsSeed);
  const [settlements,setSettlements]=useStoredState("tripmate-settlements",[]);
  const [checkins,setCheckins]=useStoredState("tripmate-checkins",[]);
  const [locations,setLocations]=useState([]);
  const [installPrompt,setInstallPrompt]=useState(null);
  useEffect(() => { const timer = setTimeout(() => setLoading(false), 850); return () => clearTimeout(timer); }, []);
  useEffect(() => {
    if (!account?.profile) return;
    setMembers((old) => old.map((member) => member.id === account.user.id ? { ...member, name: account.profile.display_name, avatar: account.profile.avatar_url } : member));
  }, [account?.profile?.display_name, account?.profile?.avatar_url]);
  useEffect(() => {
    if (!activeTrip) return;
    loadTripData(activeTrip.id).then((data) => { setMembers(data.members); setStops(data.stops); setExpenses(data.expenses); setCollections(data.collections); setSettlements(data.settlements||[]); setCheckins(data.checkins||[]); setLocations(data.locations); }).catch((err) => showToast(err.message,"error"));
  }, [activeTrip?.id]);
  useEffect(()=>{ if(!activeTrip)return; return subscribeToLocations(activeTrip.id,(payload)=>{ const row=payload.new; if(payload.eventType==="DELETE")setLocations((old)=>old.filter((x)=>x.user_id!==payload.old.user_id)); else setLocations((old)=>[...old.filter((x)=>x.user_id!==row.user_id),row]); }); },[activeTrip?.id]);
  useEffect(()=>{const handler=(event)=>{event.preventDefault();setInstallPrompt(event);};window.addEventListener("beforeinstallprompt",handler);return()=>window.removeEventListener("beforeinstallprompt",handler);},[]);
  const showToast = (text, severity = "success") => setToast({ open: true, text, severity });
  const currentUserId=account?.user.id||"u1";
  const notifications=useMemo(()=>{const items=[];if(canManageMoney){const count=expenses.filter((item)=>item.approvalStatus==="pending").length;if(count)items.push({type:"expense",severity:"warning",text:`มีรายจ่าย ${count} รายการรออนุมัติ`});}collections.forEach((collection)=>{const payment=collection.payments?.[currentUserId];if(collection.receiver===currentUserId){const pending=Object.values(collection.payments||{}).filter((item)=>item.status==="pending").length;if(pending)items.push({type:"collection",severity:"warning",text:`${collection.title}: มี ${pending} สลิปรอตรวจ`});}else if(collection.participants.includes(currentUserId)&&!collection.paid.includes(currentUserId)&&payment?.status!=="pending")items.push({type:"collection",text:`ยังไม่ได้ชำระ ${collection.title} ${currency(collection.perPerson)}`});});const waiting=settlements.filter((item)=>item.status==="pending"&&(item.to===currentUserId||canManageMoney)).length;if(waiting)items.push({type:"settlement",severity:"warning",text:`มีสลิปปิดยอด ${waiting} รายการรอยืนยัน`});return items;},[canManageMoney,collections,currentUserId,expenses,settlements]);
  const previousNotificationCount=useRef(0);
  useEffect(()=>{if(notifications.length>previousNotificationCount.current&&previousNotificationCount.current>0&&"Notification" in window&&Notification.permission==="granted")navigator.serviceWorker?.ready.then((registration)=>registration.active?.postMessage({type:"SHOW_NOTIFICATION",title:activeTrip?.name||"TripMate",body:notifications[0]?.text})).catch(()=>{});previousNotificationCount.current=notifications.length;},[notifications.length,activeTrip?.name]);
  if (loading) return <ThemeProvider theme={theme}><LoadingScreen/></ThemeProvider>;
  const pages = [
    <Home members={members} stops={stops} collections={collections} expenses={expenses.filter((e)=>!e.approvalStatus||e.approvalStatus==="approved")} setTab={setTab} trip={activeTrip}/>,
    <Plan stops={stops} setStops={setStops} onAdd={() => {setEditingStop(null);setDialog("stop");}} onEdit={(item)=>{setEditingStop(item);setDialog("stop");}} toast={showToast} onPersist={account ? (item) => toggleTripStopDone(item.id,item.done) : null} onReorder={account?(items)=>reorderTripStops(activeTrip.id,items):null} dayCount={activeTrip ? tripDayCount(activeTrip) : 4} canAdd={canAddStops} canManage={canInvite}/>,
    <TripMode trip={activeTrip} members={members} stops={stops} locations={locations} setLocations={setLocations} account={account} checkins={checkins} setCheckins={setCheckins} toast={showToast} onAddExpense={()=>setDialog("expense")} onCheckin={async(stop,checked)=>{if(account)await setStopCheckin(stop.id,account.user.id,checked);else await wait(250);}}/>,
    <Money members={members} expenses={expenses} setExpenses={setExpenses} collections={collections} setCollections={setCollections} settlements={settlements} setSettlements={setSettlements} onAddExpense={() => {setEditingExpense(null);setDialog("expense");}} onEditExpense={(item)=>{setEditingExpense(item);setDialog("expense");}} onDeleteExpense={async(item)=>{if(!window.confirm(`ลบรายจ่าย “${item.title}”?`))return;try{if(account)await deleteExpense(item.id);if(account&&item.receiptPath)await deleteTripFile(item.receiptPath).catch(()=>{});setExpenses((old)=>old.filter((entry)=>entry.id!==item.id));showToast("ลบรายจ่ายแล้ว","info");}catch(err){showToast(err.message,"error");}}} onAddCollection={() => {setEditingCollection(null);setDialog("collection");}} onEditCollection={(item)=>{setEditingCollection(item);setDialog("collection");}} onDeleteCollection={async(item)=>{if(!window.confirm(`ลบรายการเรียกเก็บ “${item.title}”?`))return;try{if(account)await deleteCollection(item.id);setCollections((old)=>old.filter((entry)=>entry.id!==item.id));showToast("ลบรายการเรียกเก็บแล้ว","info");}catch(err){showToast(err.message,"error");}}} toast={showToast} onPersistCollection={account ? (item,memberId)=>memberId ? confirmCollectionPayment(item.id,memberId) : saveCollection(activeTrip.id,account.user.id,item) : null} onSubmitCollectionSlip={async(collection,file)=>{if(!account)return {status:"pending",slipUrl:""};const uploaded=await uploadTripFile(activeTrip.id,account.user.id,"collection-slip",file);await submitCollectionPayment(collection.id,account.user.id,uploaded.path);return {status:"pending",slipPath:uploaded.path,slipUrl:uploaded.signedUrl};}} onSubmitTransfer={async(transfer,file)=>{if(!account)return {id:crypto.randomUUID(),...transfer,status:"pending"};const uploaded=await uploadTripFile(activeTrip.id,account.user.id,"settlement-slip",file);const id=await submitSettlement(activeTrip.id,transfer.to,transfer.amount,uploaded.path);return {id,...transfer,status:"pending",slipPath:uploaded.path,slipUrl:uploaded.signedUrl};}} onReviewTransfer={account?(settlement,status)=>reviewSettlement(settlement.id,status):null} currentUserId={currentUserId} onShowQr={setSelectedQr} canApprove={canManageMoney} onReviewExpense={account?reviewExpense:null} canAddCollection={canAddCollections}/>,
    <Profile members={members} setMembers={setMembers} onAddMember={() => setDialog(account ? "invite" : "member")} toast={showToast} account={account} activeTrip={activeTrip} onLogout={() => supabase?.auth.signOut()} canInvite={canInvite} onSettings={()=>setDialog("settings")} onRoleChange={async(member,role)=>{try{if(account)await updateTripMemberRole(activeTrip.id,member.id,role);const labels={member:"สมาชิก",planner:"ผู้ดูแลแพลน",treasurer:"เหรัญญิก"};setMembers((old)=>old.map((item)=>item.id===member.id?{...item,tripRole:role,role:labels[role]}:item));showToast("อัปเดตสิทธิ์สมาชิกแล้ว");}catch(err){showToast(err.message,"error");}}} onRemoveMember={async(member)=>{try{if(account)await removeTripMember(activeTrip.id,member.id);setMembers((old)=>old.filter((item)=>item.id!==member.id));showToast("นำสมาชิกออกจากทริปแล้ว","info");}catch(err){showToast(err.message,"error");}}} canInstall={Boolean(installPrompt)} onInstall={async()=>{await installPrompt?.prompt();setInstallPrompt(null);}}/>,
  ];
  return <ThemeProvider theme={theme}><Box className="app"><TopBar members={members} onAddMember={() => setDialog(account ? "invite" : "member")} canInvite={canInvite} tripName={activeTrip?.name} trips={trips} tripId={activeTrip?.id} onTripChange={onTripChange} onNewTrip={onNewTrip} notificationCount={notifications.length} onNotifications={()=>setDialog("notifications")}/>{!account && <Alert className="demo-banner" severity="warning">โหมดเดโม · เพิ่มค่า Supabase ใน .env.local เพื่อเปิดระบบล็อกอิน</Alert>}<main>{pages[tab]}</main>
    <BottomNavigation value={tab} onChange={(_, value) => setTab(value)} showLabels>
      <BottomNavigationAction label="หน้าหลัก" icon={<HomeRounded/>}/><BottomNavigationAction label="แพลน" icon={<CalendarMonthRounded/>}/><BottomNavigationAction label="Trip Mode" icon={<ExploreRounded/>}/><BottomNavigationAction label="ค่าใช้จ่าย" icon={<PaidRounded/>}/><BottomNavigationAction label="โปรไฟล์" icon={<MoreHorizRounded/>}/>
    </BottomNavigation>
    <AddStopDialog open={dialog === "stop"} item={editingStop} onClose={() => {setDialog("");setEditingStop(null);}} dayCount={activeTrip ? tripDayCount(activeTrip) : 4} onSave={async (item) => { const exists=stops.some((stop)=>stop.id===item.id);const movedDay=exists&&editingStop?.day!==item.day;const saved={...item,sortOrder:!exists||movedDay?stops.filter((stop)=>stop.day===item.day&&stop.id!==item.id).length:(item.sortOrder??0)};if(account)await saveStop(activeTrip.id,account.user.id,saved);setStops((old)=>exists?old.map((stop)=>stop.id===saved.id?saved:stop).sort((a,b)=>a.day-b.day||(a.sortOrder??0)-(b.sortOrder??0)):[...old,saved].sort((a,b)=>a.day-b.day||(a.sortOrder??0)-(b.sortOrder??0)));setDialog("");setEditingStop(null);showToast(exists?"บันทึกการแก้ไขแล้ว":"เพิ่มในแพลนแล้ว");}} onDelete={async(item)=>{if(account)await deleteStop(activeTrip.id,item.id);setStops((old)=>old.filter((stop)=>stop.id!==item.id));showToast("ลบสถานที่แล้ว","info");}}/>
    <ExpenseDialog open={dialog === "expense"} item={editingExpense} onClose={() => {setDialog("");setEditingExpense(null);}} members={members} currentUserId={account?.user.id} receiptRequiredOver={Number(activeTrip?.receipt_required_over||0)} requiresApproval={Boolean(account&&activeTrip?.require_expense_approval!==false&&!canInvite)} onSave={async (item) => { try { const exists=expenses.some((entry)=>entry.id===item.id);let saved={...item,approvalStatus:exists?item.approvalStatus:(!account||canInvite||activeTrip?.require_expense_approval===false?"approved":"pending")}; if(account&&item.receiptFile){const oldPath=saved.receiptPath;const uploaded=await uploadTripFile(activeTrip.id,account.user.id,"receipt",item.receiptFile);saved={...saved,receiptPath:uploaded.path,receiptUrl:uploaded.signedUrl};if(oldPath)await deleteTripFile(oldPath).catch(()=>{});} if(account) await saveExpense(activeTrip.id,account.user.id,saved); delete saved.receiptFile;setExpenses((old)=>exists?old.map((entry)=>entry.id===saved.id?saved:entry):[saved,...old]);setDialog("");setEditingExpense(null);showToast(exists?"แก้ไขรายจ่ายแล้ว":saved.approvalStatus==="pending"?"ส่งรายจ่ายให้แอดมินตรวจแล้ว":"บันทึกรายจ่ายแล้ว"); } catch(err){showToast(err.message,"error"); throw err;} }}/>
    <CollectionDialog open={dialog === "collection"} item={editingCollection} onClose={() => {setDialog("");setEditingCollection(null);}} members={members} currentUserId={account?.user.id} onSave={async (item) => { try {const exists=collections.some((entry)=>entry.id===item.id);if(account) await saveCollection(activeTrip.id,account.user.id,item);setCollections((old)=>exists?old.map((entry)=>entry.id===item.id?item:entry):[item,...old]);setDialog("");setEditingCollection(null);showToast(exists?"แก้ไขรายการเรียกเก็บแล้ว":"สร้างรายการเรียกเก็บแล้ว"); } catch(err){showToast(err.message,"error");} }}/>
    <MemberDialog open={dialog === "member"} onClose={() => setDialog("")} onSave={(member) => { setMembers((old) => [...old, member]); setDialog(""); showToast("เพิ่มสมาชิกแล้ว"); }}/>
    {activeTrip && <InviteDialog open={dialog === "invite"} onClose={() => setDialog("")} trip={activeTrip}/>} 
    {activeTrip&&<TripSettingsDialog open={dialog==="settings"} onClose={()=>setDialog("")} trip={activeTrip} onSave={async(settings)=>{const updated=account?await saveTripSettings(activeTrip.id,settings):{...activeTrip,...settings};setActiveTrip({...activeTrip,...updated,trip_role:activeTrip.trip_role});if(onRefresh)await onRefresh();showToast("บันทึกการตั้งค่าทริปแล้ว");}}/>}
    <NotificationDialog open={dialog==="notifications"} onClose={()=>setDialog("")} items={notifications} onOpenMoney={()=>{setDialog("");setTab(3);}}/>
    <PaymentQrDialog member={selectedQr} onClose={()=>setSelectedQr(null)}/>
    <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })} anchorOrigin={{ vertical: "top", horizontal: "center" }}><Alert severity={toast.severity} variant="filled" onClose={() => setToast({ ...toast, open: false })}>{toast.text}</Alert></Snackbar>
  </Box></ThemeProvider>;
}

function ConnectedApp() {
  const [session, setSession] = useState(null); const [account, setAccount] = useState(null); const [selectedTripId,setSelectedTripId]=useState(()=>localStorage.getItem("tripmate-active-trip")||""); const [createOpen,setCreateOpen]=useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  const refresh = async () => {
    try { const context = await getMyTripContext(); setAccount(context); setError(""); }
    catch (err) { setError(err.message || "โหลดข้อมูลไม่สำเร็จ"); }
  };
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (!next) setAccount(null); });
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) refresh(); }, [session?.user?.id]);
  useEffect(()=>{if(account?.trips?.length&&!account.trips.some((item)=>item.id===selectedTripId))setSelectedTripId(account.trips[0].id);},[account?.trips,selectedTripId]);
  useEffect(() => {
    if (!session || !inviteToken || !account) return;
    claimInvite(inviteToken).then(() => {
      window.history.replaceState({}, "", window.location.pathname); return refresh();
    }).catch((err) => setError(err.message || "ลิงก์เชิญไม่ถูกต้องหรือหมดอายุ"));
  }, [session?.user?.id, inviteToken, Boolean(account)]);
  if (loading || (session && !account)) return <ThemeProvider theme={theme}><LoadingScreen/></ThemeProvider>;
  if (!session) return <AuthScreen inviteToken={inviteToken}/>;
  if (error) return <ThemeProvider theme={theme}><Box className="auth-shell"><Alert severity="error">{error}</Alert></Box></ThemeProvider>;
  if (!account.trips.length) return <CreateTripScreen user={session.user} onCreated={refresh}/>;
  const active=chooseTrip(account.trips,selectedTripId);
  const selectTrip=(id)=>{setSelectedTripId(id);localStorage.setItem("tripmate-active-trip",id);};
  return <><App account={account} trip={active} trips={account.trips} onTripChange={selectTrip} onNewTrip={()=>setCreateOpen(true)} onRefresh={refresh}/><CreateTripDialog open={createOpen} onClose={()=>setCreateOpen(false)} user={session.user} onCreated={async(id)=>{await refresh();selectTrip(id);}}/></>;
}

const appRoot = window.__tripMateRoot || (window.__tripMateRoot = createRoot(document.getElementById("root")));
const previewDemo = import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo");
appRoot.render(<React.StrictMode>{isSupabaseConfigured && !previewDemo ? <ConnectedApp/> : <App/>}</React.StrictMode>);
if("serviceWorker" in navigator&&import.meta.env.PROD)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
