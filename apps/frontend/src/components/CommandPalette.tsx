/**
 * Command Palette component for quick navigation and search
 * Phase 1.5 - Track C implementation
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  InputAdornment,
  Box,
  Typography,
  Chip,
  Paper,
  Divider,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  History as HistoryIcon,
  TrendingUp as TrendingIcon,
  Dashboard as DashboardIcon,
  PlayArrow as PlayArrowIcon,
  Storage as StorageIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  Chat as ChatIcon,
  Build as BuildIcon,
  Analytics as AnalyticsIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useNavigationSearch, useNavigation } from '../hooks/useNavigation';
import { NavigationItem } from '@nofx/shared/navigation/types';
import { useNavigate } from 'react-router-dom';

// Icon mapping
const iconMap: Record<string, React.ComponentType> = {
  Dashboard: DashboardIcon,
  PlayArrow: PlayArrowIcon,
  Storage: StorageIcon,
  Settings: SettingsIcon,
  Warning: WarningIcon,
  Chat: ChatIcon,
  Build: BuildIcon,
  Analytics: AnalyticsIcon,
  Code: CodeIcon,
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { searchTerm, setSearchTerm, searchResults } = useNavigationSearch();
  const { visibleItems, navigateTo } = useNavigation();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [recentItems, setRecentItems] = React.useState<NavigationItem[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load recent items from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem('recentNavigationItems');
    if (stored) {
      try {
        const items = JSON.parse(stored);
        setRecentItems(items.slice(0, 5));
      } catch (e) {
        console.error('Failed to parse recent items:', e);
      }
    }
  }, []);

  // Save recent item to localStorage
  const saveRecentItem = (item: NavigationItem) => {
    const updated = [item, ...recentItems.filter(i => i.id !== item.id)].slice(0, 5);
    setRecentItems(updated);
    localStorage.setItem('recentNavigationItems', JSON.stringify(updated));
  };

  // Get trending items (most visited)
  const trendingItems = React.useMemo(() => {
    // In a real app, this would come from analytics
    return visibleItems.slice(0, 3);
  }, [visibleItems]);

  // Handle item selection
  const handleItemClick = (item: NavigationItem) => {
    saveRecentItem(item);
    navigateTo(item.path, item);
    onClose();
    setSearchTerm('');
  };

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = searchTerm ? searchResults : [...recentItems, ...trendingItems];

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            handleItemClick(items[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, searchTerm, searchResults, recentItems, trendingItems, selectedIndex]);

  // Reset selected index when search changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  // Focus input when dialog opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const renderItem = (item: NavigationItem, index: number, section?: string) => {
    const Icon = iconMap[item.icon || 'Storage'];
    const isSelected = index === selectedIndex;

    return (
      <ListItem
        key={`${section}-${item.id}`}
        disablePadding
        sx={{
          backgroundColor: isSelected ? 'action.hover' : 'transparent',
        }}
      >
        <ListItemButton
          onClick={() => handleItemClick(item)}
          sx={{
            py: 1.5,
            px: 2,
          }}
        >
          <ListItemIcon>
            <Icon />
          </ListItemIcon>
          <ListItemText
            primary={item.label}
            secondary={item.path}
            primaryTypographyProps={{
              fontWeight: isSelected ? 600 : 400,
            }}
          />
          <ListItemSecondaryAction>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {item.badge && (
                <Chip
                  label={item.badge.text}
                  size="small"
                  color={
                    item.badge.type === 'beta' ? 'info' :
                    item.badge.type === 'alpha' ? 'warning' :
                    item.badge.type === 'deprecated' ? 'error' :
                    'default'
                  }
                />
              )}
              {item.keyboard && (
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    opacity: 0.6,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 0.5,
                    px: 0.5,
                    py: 0.25,
                  }}
                >
                  {item.keyboard}
                </Typography>
              )}
            </Box>
          </ListItemSecondaryAction>
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          position: 'fixed',
          top: '10%',
          maxHeight: '70vh',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            placeholder="Search for pages, commands, or actions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={onClose}>
                    <CloseIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  border: 'none',
                },
              },
            }}
          />
        </Box>

        <Divider />

        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {searchTerm ? (
            // Search Results
            <List>
              {searchResults.length > 0 ? (
                searchResults.map((item, index) => renderItem(item, index, 'search'))
              ) : (
                <ListItem>
                  <ListItemText
                    primary="No results found"
                    secondary={`Try searching for different terms`}
                    sx={{ textAlign: 'center', py: 4 }}
                  />
                </ListItem>
              )}
            </List>
          ) : (
            // Recent and Trending
            <>
              {recentItems.length > 0 && (
                <>
                  <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                    <Typography variant="overline" sx={{ display: 'flex', alignItems: 'center' }}>
                      <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
                      Recent
                    </Typography>
                  </Box>
                  <List dense>
                    {recentItems.map((item, index) => renderItem(item, index, 'recent'))}
                  </List>
                </>
              )}

              {trendingItems.length > 0 && (
                <>
                  <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                    <Typography variant="overline" sx={{ display: 'flex', alignItems: 'center' }}>
                      <TrendingIcon fontSize="small" sx={{ mr: 1 }} />
                      Trending
                    </Typography>
                  </Box>
                  <List dense>
                    {trendingItems.map((item, index) =>
                      renderItem(item, recentItems.length + index, 'trending')
                    )}
                  </List>
                </>
              )}
            </>
          )}
        </Box>

        <Divider />

        <Box sx={{ px: 2, py: 1, backgroundColor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            Press <strong>↑↓</strong> to navigate, <strong>Enter</strong> to select, <strong>Esc</strong> to close
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}