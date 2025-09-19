import * as React from 'react';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StorageIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import WarningIcon from '@mui/icons-material/WarningAmber';
import TopBar from './TopBar';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 240;

export default function Shell({ children }: { children: React.ReactNode }){
  const [open, setOpen] = React.useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const go = (to: string) => () => { setOpen(false); nav(to); };

  const items = [
    { text: 'Dashboard', icon: <DashboardIcon/>, to: '/' },
    { text: 'Runs', icon: <PlayArrowIcon/>, to: '/runs' },
    { text: 'Projects', icon: <StorageIcon/>, to: '/projects' },
    { text: 'Models', icon: <StorageIcon/>, to: '/models' },
    { text: 'Settings', icon: <SettingsIcon/>, to: '/settings' },
    { text: 'DLQ', icon: <WarningIcon/>, to: '/dlq' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <TopBar />
      <IconButton onClick={() => setOpen(true)} sx={{ position: 'fixed', top: 12, left: 12, zIndex: 1201, display: { sm: 'none' } }} aria-label="menu">
        <MenuIcon />
      </IconButton>
      <Drawer
        variant="permanent"
        sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}
        open
      >
        <Toolbar />
        <Divider />
        <List>
          {items.map(i => (
            <ListItem key={i.text} disablePadding>
              <ListItemButton selected={loc.hash.includes(i.to)} onClick={go(i.to)}>
                <ListItemIcon>{i.icon}</ListItemIcon>
                <ListItemText primary={i.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Drawer
        variant="temporary"
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}
      >
        <Toolbar />
        <Divider />
        <List>
          {items.map(i => (
            <ListItem key={i.text} disablePadding>
              <ListItemButton selected={loc.hash.includes(i.to)} onClick={go(i.to)}>
                <ListItemIcon>{i.icon}</ListItemIcon>
                <ListItemText primary={i.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 2, width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` } }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
