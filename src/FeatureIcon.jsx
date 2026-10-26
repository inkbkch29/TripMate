import React from 'react';
import {Box} from '@mui/material';
import {featureTones} from './theme';
export default function FeatureIcon({tone='plan',children}){const colors=featureTones[tone]||featureTones.plan;return <Box component="span" className="feature-icon" aria-hidden="true" sx={{bgcolor:colors.background,color:colors.color}}>{children}</Box>;}
