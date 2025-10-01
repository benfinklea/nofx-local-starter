import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeveloperModeIcon from '@mui/icons-material/DeveloperMode';
import { ColorModeContext } from '../theme';
import { useTheme } from '@mui/material/styles';
import ProjectSwitcher from './ProjectSwitcher';
import NewRunDialog from './NewRunDialog';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { auth } from '../lib/auth';

interface TopBarProps {
  onMenuToggle?: () => void;
}

export default function TopBar({ onMenuToggle }: TopBarProps = {}){
  const color = React.useContext(ColorModeContext);
  const theme = useTheme();
  const navigate = useNavigate();
  const [openRun, setOpenRun] = React.useState(false);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = React.useState<null | HTMLElement>(null);

  const handleLogout = async () => {
    await auth.logout();
    window.location.href = '/';
  };

  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsMenuAnchor(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsMenuAnchor(null);
  };

  const handleThemeToggle = () => {
    color.toggle();
    handleSettingsClose();
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    handleSettingsClose();
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
          <Link component={RouterLink} to="/agents" underline="hover">Agents</Link>

          {/* Theme Toggle - Lightbulb */}
          <Tooltip title={`Switch to ${theme.palette.mode === 'dark' ? 'light' : 'dark'} mode`}>
            <IconButton onClick={color.toggle} color="inherit" size="small">
              {theme.palette.mode === 'dark' ? <LightbulbIcon fontSize="small" /> : <LightbulbOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Settings Menu - Gear Icon */}
          <Tooltip title="Settings">
            <IconButton color="inherit" onClick={handleSettingsClick} size="small">
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={settingsMenuAnchor}
            open={Boolean(settingsMenuAnchor)}
            onClose={handleSettingsClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={() => handleNavigate('/settings')}>
              <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Settings</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleNavigate('/projects')}>
              <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Projects</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleNavigate('/dev')}>
              <ListItemIcon><DeveloperModeIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Developer Tools</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Stack>
        <NewRunDialog open={openRun} onClose={()=>setOpenRun(false)} />
      </Toolbar>
    </AppBar>
  );
}
