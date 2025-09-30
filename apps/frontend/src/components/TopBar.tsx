import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Link from '@mui/material/Link';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { ColorModeContext } from '../theme';
import { useTheme } from '@mui/material/styles';
import ProjectSwitcher from './ProjectSwitcher';
import NewRunDialog from './NewRunDialog';
import { Link as RouterLink } from 'react-router-dom';
import { auth } from '../lib/auth';

interface TopBarProps {
  onMenuToggle?: () => void;
}

export default function TopBar({ onMenuToggle }: TopBarProps = {}){
  const color = React.useContext(ColorModeContext);
  const theme = useTheme();
  const [openRun, setOpenRun] = React.useState(false);

  const handleLogout = async () => {
    await auth.logout();
    // Cookies are cleared by the auth service
    // Redirect to root - AuthCheck will show login form
    window.location.href = '/';
  };
  return (
    <AppBar position="sticky" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', backdropFilter: 'blur(8px)' }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>NOFX</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <ProjectSwitcher />
          <Tooltip title="Start new run">
            <IconButton color="inherit" onClick={()=>setOpenRun(true)}>
              <PlayArrowIcon />
            </IconButton>
          </Tooltip>
          <Link component={RouterLink} to="/runs" underline="hover">Runs</Link>
          <Link component={RouterLink} to="/models" underline="hover">Models</Link>
          <Link component={RouterLink} to="/settings" underline="hover">Settings</Link>
          <Link href="/ui/dev" underline="hover" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>Dev</Link>
          <Tooltip title="Admin login">
            <IconButton color="inherit" href="/ui/login" target="_self">
              <AccountCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={handleLogout} aria-label="Logout">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open Dev page">
            <IconButton color="inherit" href="/ui/dev" target="_self">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle light/dark">
            <IconButton onClick={color.toggle} color="inherit">
              {theme.palette.mode === 'dark' ? <Brightness7Icon/> : <Brightness4Icon/>}
            </IconButton>
          </Tooltip>
        </Stack>
        <NewRunDialog open={openRun} onClose={()=>setOpenRun(false)} />
      </Toolbar>
    </AppBar>
  );
}
