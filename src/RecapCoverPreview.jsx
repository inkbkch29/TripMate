import React from 'react';
import {Box,CircularProgress,Typography} from '@mui/material';
import {visuallyHidden} from '@mui/utils';
import TravelStats from './TravelStats';
export default function RecapCoverPreview({preview,name,places,total,showExpenses}){return <Box className="recap-story-stage" sx={{aspectRatio:'9/16',bgcolor:'#18333d'}} aria-busy={preview.busy}>
 {preview.url?<img src={preview.url} alt={`ตัวอย่าง Recap ${name||''}`}/>:<Box className="recap-story-placeholder">{preview.busy&&<CircularProgress size={26}/>}<Typography>กำลังเตรียมรูป…</Typography></Box>}
 {preview.busy&&preview.url&&<span className="recap-render-status" role="status">กำลังอัปเดต…</span>}
 <Box sx={visuallyHidden} aria-live="polite"><TravelStats places={places} total={total} showExpenses={showExpenses}/></Box>
 </Box>;}
