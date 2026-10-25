import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import TravelStats from './TravelStats';
it('conditionally removes wallet markup, number, label and divider when expenses are off',()=>{const hidden=renderToStaticMarkup(<TravelStats places={2} total={4250} showExpenses={false}/>);expect(hidden).toContain('PlaceOutlinedIcon');expect(hidden).not.toMatch(/AccountBalanceWallet|4,250|Total Spent|MuiDivider|—/);const shown=renderToStaticMarkup(<TravelStats places={2} total={4250} showExpenses/>);expect(shown).toContain('AccountBalanceWalletOutlinedIcon');expect(shown).toContain('฿4,250');expect(shown).toContain('MuiDivider');});
