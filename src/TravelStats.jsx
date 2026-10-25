import React from 'react';
import {Box,Divider,Stack,Typography} from '@mui/material';
import {PlaceOutlined,AccountBalanceWalletOutlined} from '@mui/icons-material';
import {travelStatsItems} from './travel-stats';
export default function TravelStats(props){const items=travelStatsItems(props);return <Stack direction="row" justifyContent="center" spacing={3} divider={items.length>1?<Divider flexItem orientation="vertical" sx={{borderColor:'#ffffff45'}}/>:undefined} sx={{color:'#fff'}}>{items.map(item=>{const Icon=item.id==='places'?PlaceOutlined:AccountBalanceWalletOutlined;return <Box key={item.id} sx={{flex:items.length>1?1:'0 1 auto'}}><Stack direction="row" alignItems="center" justifyContent="center" gap={1}><Icon sx={{fontSize:20,color:'#fff'}}/><Typography fontWeight={700}>{item.value}</Typography></Stack><Typography variant="caption" sx={{opacity:.82,display:'block',textAlign:'center'}}>{item.label}</Typography></Box>;})}</Stack>;}
