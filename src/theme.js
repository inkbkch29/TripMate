import {createTheme} from '@mui/material/styles';
export const featureTones = {
 plan: {background:'#EAF6FC',color:'#258CAD'},
 travel: {background:'#E8F8F3',color:'#248D7D'},
 expenses: {background:'#FFF1E7',color:'#B97846'},
 voting: {background:'#FFF1C9',color:'#A47B27'},
 memories: {background:'#F1ECFF',color:'#8B70CB'},
 members: {background:'#EAF6FC',color:'#258CAD'},
};
const transition='transform 160ms ease, background-color 160ms ease, color 160ms ease, border-color 160ms ease';
const theme=createTheme({
 palette:{primary:{main:'#247E9E',dark:'#1B657F',light:'#EAF6FC',contrastText:'#fff'},secondary:{main:'#267D6F',dark:'#1D6258',light:'#E8F8F3',contrastText:'#fff'},success:{main:'#287D60'},warning:{main:'#926820'},error:{main:'#C54F59'},background:{default:'#F6FAFC',paper:'#fff'},text:{primary:'#203A50',secondary:'#5D7485'},divider:'#E5EEF3'},
 shape:{borderRadius:18},
 typography:{fontFamily:'"Nunito", "Anuphan", "Noto Sans Thai", system-ui, sans-serif',h4:{fontSize:'clamp(1.75rem, 6vw, 2rem)',fontWeight:700,lineHeight:1.25,letterSpacing:'-.025em'},h5:{fontSize:'1.35rem',fontWeight:700,lineHeight:1.3},h6:{fontSize:'1.08rem',fontWeight:600,lineHeight:1.4},overline:{fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em'},body1:{fontSize:'.95rem',lineHeight:1.58},body2:{fontSize:'.875rem',lineHeight:1.55},caption:{fontSize:'.78rem',lineHeight:1.45},button:{textTransform:'none',fontWeight:700}},
 components:{
 MuiButton:{defaultProps:{disableElevation:true},styleOverrides:{root:{minHeight:44,borderRadius:15,transition,'&:active':{transform:'scale(.98)'},'&:focus-visible':{outline:'3px solid #65BCE5',outlineOffset:3}},contained:{minHeight:48},outlined:{borderColor:'#D7E6EE',background:'#fff'}}},
 MuiIconButton:{styleOverrides:{root:{minWidth:44,minHeight:44,transition,'&:active':{transform:'scale(.98)'},'&:focus-visible':{outline:'3px solid #65BCE5',outlineOffset:2}}}},
 MuiButtonBase:{styleOverrides:{root:{transition,'&.Mui-focusVisible':{outline:'3px solid #65BCE5',outlineOffset:2}}}},
 MuiCard:{styleOverrides:{root:{borderRadius:20,border:'1px solid #E5EEF3',boxShadow:'0 2px 8px rgba(32,58,80,.025)'}}},
 MuiCardContent:{styleOverrides:{root:{padding:16,'&:last-child':{paddingBottom:16}}}},
 MuiTextField:{defaultProps:{fullWidth:true},styleOverrides:{root:{'& .MuiOutlinedInput-root':{borderRadius:14,background:'#fff','& fieldset':{borderColor:'#D7E6EE'},'&:hover fieldset':{borderColor:'#8ABFD1'}}}}},
 MuiChip:{styleOverrides:{root:{borderRadius:12,fontWeight:600,transition}}},
 MuiAccordion:{defaultProps:{disableGutters:true},styleOverrides:{root:{boxShadow:'none',background:'#fff','&:before':{display:'none'}}}},
 MuiCollapse:{defaultProps:{timeout:170}},
 MuiDialog:{styleOverrides:{paper:{background:'#fff'}}},
 MuiTooltip:{defaultProps:{enterDelay:400}},
 }
});
export default theme;
