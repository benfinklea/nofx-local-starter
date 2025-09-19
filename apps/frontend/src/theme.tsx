import * as React from 'react';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';

export const ColorModeContext = React.createContext({ toggle: () => {}, mode: 'dark' as 'light'|'dark' });

export function AppTheme({ children }: { children: React.ReactNode }){
  const [mode, setMode] = React.useState<'light'|'dark'>(() => (localStorage.getItem('mui-mode') as 'light'|'dark') || 'dark');
  const colorMode = React.useMemo(() => ({
    mode,
    toggle: () => setMode(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('mui-mode', next);
      return next;
    })
  }), [mode]);

  const theme = React.useMemo(() => createTheme({
    palette: { mode, primary: { main: '#6ea8fe' }, secondary: { main: '#8bffb0' } },
    spacing: 8,
    shape: { borderRadius: 10 },
    components: {
      MuiContainer: { defaultProps: { maxWidth: 'lg' } },
      MuiPaper: { defaultProps: { variant: 'outlined' } },
      MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
      MuiTableHead: { styleOverrides: { root: { '& th': { fontWeight: 600 } } } },
      MuiTableCell: { defaultProps: { component: 'td' } },
      MuiListItemText: {
        defaultProps: {
          primaryTypographyProps: { component: 'div' },
          secondaryTypographyProps: { component: 'div' }
        }
      }
    }
  }), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
