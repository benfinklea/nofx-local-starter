import * as React from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StorageIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import WarningIcon from '@mui/icons-material/WarningAmber';
import ChatIcon from '@mui/icons-material/Chat';
import TopBar from './TopBar';
import { useNavigate, useLocation } from 'react-router-dom';
import { uiFlags } from '../config';

export default function Shell({ children }: { children: React.ReactNode }){
  const nav = useNavigate();
  const loc = useLocation();

  const items = [
    { text: 'Dashboard', icon: <DashboardIcon/>, to: '/' },
    { text: 'Runs', icon: <PlayArrowIcon/>, to: '/runs' },
    uiFlags.responses ? { text: 'Responses', icon: <ChatIcon/>, to: '/responses' } : null,
    { text: 'Projects', icon: <StorageIcon/>, to: '/projects' },
    { text: 'Models', icon: <StorageIcon/>, to: '/models' },
    { text: 'Settings', icon: <SettingsIcon/>, to: '/settings' },
    { text: 'DLQ', icon: <WarningIcon/>, to: '/dlq' },
  ].filter(Boolean) as Array<{ text: string; icon: React.ReactNode; to: string }>;

  return (
    <>
      <TopBar />
      <Box sx={{ display: 'flex', pt: 8 }}>
        {/* Sidebar */}
        <Box sx={{
          width: 240,
          backgroundColor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          minHeight: 'calc(100vh - 64px)'
        }}>
          <List>
            {items.map(item => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={loc.hash.includes(item.to)}
                  onClick={() => nav(item.to)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>

        {/* Main content */}
        <Box sx={{ flex: 1, p: 3 }}>
          {children}
        </Box>
      </Box>
    </>
  );
}