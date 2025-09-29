/**
 * Manifest-Driven Navigation Shell Component
 * Phase 1.5 - Track A: Navigation Framework & Layout Shell
 *
 * This component replaces the legacy Shell.tsx with a manifest-driven approach.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Collapse,
  Badge,
  Tooltip,
  Chip,
  useTheme,
  useMediaQuery,
  Divider,
  Typography,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft,
  ChevronRight,
  ExpandLess,
  ExpandMore,
  Search as SearchIcon,
  Dashboard,
  PlayArrow,
  Storage,
  Settings,
  WarningAmber,
  Chat,
  SmartToy,
  Description,
  LibraryBooks,
  Analytics,
  Article,
  Timeline,
  DeveloperMode,
  Science,
  Shield,
  MenuBook,
  Help,
  Apps,
  Insights,
  Code,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { alpha } from '@mui/material/styles';

import { NavigationComposer, validateManifest } from '@shared/nav-composer';
import {
  NavigationManifest,
  NavigationItem,
  NavigationGroup,
  ResolvedNavigationItem,
  NavigationItemType,
  NavigationItemStatus,
  NavigationEventType,
} from '@shared/navigation';

import TopBar from './TopBar';
import { useAuth } from '../hooks/useAuth';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useNavigationManifest } from '../hooks/useNavigationManifest';

// ============================================================================
// Icon Mapping
// ============================================================================

const ICON_MAP: Record<string, React.ElementType> = {
  Dashboard,
  PlayArrow,
  Storage,
  Settings,
  WarningAmber,
  Chat,
  SmartToy,
  Description,
  LibraryBooks,
  Analytics,
  Article,
  Timeline,
  DeveloperMode,
  Science,
  Shield,
  MenuBook,
  Help,
  Apps,
  Insights,
  Code,
};

const getIcon = (iconName?: string): React.ReactNode => {
  if (!iconName) return null;
  const IconComponent = ICON_MAP[iconName];
  return IconComponent ? <IconComponent /> : null;
};

// ============================================================================
// Breadcrumbs Component
// ============================================================================

interface BreadcrumbsBarProps {
  composer: NavigationComposer;
  currentPath: string;
}

const BreadcrumbsBar: React.FC<BreadcrumbsBarProps> = ({ composer, currentPath }) => {
  const navigate = useNavigate();
  const breadcrumbs = useMemo(
    () => composer.getBreadcrumbs(currentPath),
    [composer, currentPath]
  );

  if (breadcrumbs.length === 0) return null;

  return (
    <Box sx={{ px: 3, py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Breadcrumbs aria-label="breadcrumb">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return isLast ? (
            <Typography key={crumb.id} color="text.primary" variant="body2">
              {crumb.label}
            </Typography>
          ) : (
            <Link
              key={crumb.id}
              component="button"
              variant="body2"
              onClick={() => crumb.path && navigate(crumb.path)}
              sx={{ cursor: 'pointer' }}
            >
              {crumb.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
};

// ============================================================================
// Navigation Item Component
// ============================================================================

interface NavItemProps {
  item: ResolvedNavigationItem;
  composer: NavigationComposer;
  level?: number;
  onItemClick: (item: ResolvedNavigationItem) => void;
}

const NavItem: React.FC<NavItemProps> = ({ item, composer, level = 0, onItemClick }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isActive = location.pathname === item.path;

  const handleClick = () => {
    if (item.children && item.children.length > 0) {
      setOpen(!open);
    } else if (item.accessible) {
      onItemClick(item);
      composer.handleItemClick(item.id);
    }
  };

  const renderBadge = () => {
    if (!item.badge) return null;

    switch (item.badge.type) {
      case 'count':
        return (
          <Badge badgeContent={item.badge.value as number} color="primary">
            <span />
          </Badge>
        );
      case 'dot':
        return (
          <Badge variant="dot" color={item.badge.color as any || 'primary'}>
            <span />
          </Badge>
        );
      case 'text':
        return (
          <Chip
            label={item.badge.value as string}
            size="small"
            color={item.badge.color as any || 'default'}
          />
        );
      default:
        return null;
    }
  };

  const renderStatus = () => {
    switch (item.status) {
      case NavigationItemStatus.BETA:
        return <Chip label="BETA" size="small" color="secondary" sx={{ ml: 1 }} />;
      case NavigationItemStatus.ALPHA:
        return <Chip label="ALPHA" size="small" color="warning" sx={{ ml: 1 }} />;
      case NavigationItemStatus.COMING_SOON:
        return <Chip label="SOON" size="small" color="info" sx={{ ml: 1 }} />;
      case NavigationItemStatus.DEPRECATED:
        return <Chip label="DEPRECATED" size="small" color="error" sx={{ ml: 1 }} />;
      default:
        return null;
    }
  };

  if (item.type === NavigationItemType.DIVIDER) {
    return <Divider sx={{ my: 1 }} />;
  }

  return (
    <>
      <ListItem disablePadding sx={{ pl: level * 2 }}>
        <Tooltip title={item.shortcut ? `Shortcut: ${item.shortcut}` : ''}>
          <ListItemButton
            selected={isActive}
            disabled={!item.accessible}
            onClick={handleClick}
            sx={{
              opacity: item.accessible ? 1 : 0.5,
              '&.Mui-selected': {
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                borderLeft: 3,
                borderColor: 'primary.main',
              },
            }}
          >
            {item.icon && <ListItemIcon>{getIcon(item.icon)}</ListItemIcon>}
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {item.label}
                  {renderStatus()}
                </Box>
              }
            />
            {renderBadge()}
            {item.children && item.children.length > 0 && (open ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
        </Tooltip>
      </ListItem>
      {item.children && item.children.length > 0 && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {item.children.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                composer={composer}
                level={level + 1}
                onItemClick={onItemClick}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

// ============================================================================
// Navigation Group Component
// ============================================================================

interface NavGroupProps {
  group: NavigationGroup;
  items: ResolvedNavigationItem[];
  composer: NavigationComposer;
  onItemClick: (item: ResolvedNavigationItem) => void;
}

const NavGroup: React.FC<NavGroupProps> = ({ group, items, composer, onItemClick }) => {
  const [collapsed, setCollapsed] = useState(!group.defaultExpanded);

  const groupItems = items.filter((item) => item.groupId === group.id);

  if (groupItems.length === 0) return null;

  return (
    <>
      {group.collapsible ? (
        <>
          <ListItem>
            <ListItemButton onClick={() => setCollapsed(!collapsed)}>
              {group.icon && <ListItemIcon>{getIcon(group.icon)}</ListItemIcon>}
              <ListItemText
                primary={
                  <Typography variant="overline" sx={{ fontWeight: 600 }}>
                    {group.label}
                  </Typography>
                }
              />
              {collapsed ? <ExpandMore /> : <ExpandLess />}
            </ListItemButton>
          </ListItem>
          <Collapse in={!collapsed} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {groupItems.map((item) => (
                <NavItem key={item.id} item={item} composer={composer} onItemClick={onItemClick} />
              ))}
            </List>
          </Collapse>
        </>
      ) : (
        <>
          {group.label && (
            <ListItem>
              <Typography variant="overline" sx={{ px: 2, py: 1, fontWeight: 600 }}>
                {group.label}
              </Typography>
            </ListItem>
          )}
          {groupItems.map((item) => (
            <NavItem key={item.id} item={item} composer={composer} onItemClick={onItemClick} />
          ))}
        </>
      )}
    </>
  );
};

// ============================================================================
// Main Shell Component
// ============================================================================

export interface ManifestShellProps {
  children: React.ReactNode;
}

export default function ManifestShell({ children }: ManifestShellProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, roles, permissions } = useAuth();
  const featureFlags = useFeatureFlags();
  const { manifest, loading, error } = useNavigationManifest();

  const [drawerOpen, setDrawerOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ResolvedNavigationItem[]>([]);

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Create navigation composer
  const composer = useMemo(() => {
    if (!manifest) return null;

    return new NavigationComposer(manifest, {
      userRoles: roles || [],
      userPermissions: permissions || [],
      featureFlags: featureFlags || {},
      environment: process.env.NODE_ENV || 'development',
    });
  }, [manifest, roles, permissions, featureFlags]);

  // Get resolved navigation items and groups
  const { items, groups } = useMemo(() => {
    if (!composer) return { items: [], groups: [] };

    return {
      items: composer.getResolvedItems(),
      groups: composer.getResolvedGroups(),
    };
  }, [composer]);

  // Handle drawer toggle
  useEffect(() => {
    setDrawerOpen(!isMobile);
  }, [isMobile]);

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (composer && query.trim()) {
        const results = composer.searchItems(query);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    },
    [composer]
  );

  // Handle navigation item click
  const handleItemClick = useCallback(
    (item: ResolvedNavigationItem) => {
      if (item.type === NavigationItemType.EXTERNAL && item.path) {
        window.open(item.path, '_blank');
      } else if (item.type === NavigationItemType.ROUTE && item.path) {
        navigate(item.path);
        if (isMobile) {
          setDrawerOpen(false);
        }
      }
    },
    [navigate, isMobile]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!composer || !manifest?.settings?.enableShortcuts) return;

    const shortcuts = composer.getShortcuts();

    const handleKeyPress = (e: KeyboardEvent) => {
      const key = `${e.metaKey || e.ctrlKey ? 'cmd+' : ''}${e.key}`;
      const item = shortcuts.get(key);

      if (item && item.path) {
        e.preventDefault();
        handleItemClick(item as ResolvedNavigationItem);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [composer, manifest, handleItemClick]);

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load navigation: {error}</Alert>
      </Box>
    );
  }

  const drawerWidth = 280;

  return (
    <>
      <TopBar onMenuToggle={() => setDrawerOpen(!drawerOpen)} />

      <Box sx={{ display: 'flex', pt: 8 }}>
        {/* Navigation Drawer */}
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sx={{
            width: drawerOpen ? drawerWidth : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              top: 64,
              height: 'calc(100% - 64px)',
            },
          }}
        >
          {/* Search */}
          {manifest?.settings?.showSearch && (
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search navigation..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          {/* Search Results or Navigation Items */}
          <List>
            {searchQuery && searchResults.length > 0 ? (
              searchResults.map((item) => (
                <NavItem key={item.id} item={item} composer={composer!} onItemClick={handleItemClick} />
              ))
            ) : searchQuery ? (
              <ListItem>
                <ListItemText primary="No results found" secondary={`for "${searchQuery}"`} />
              </ListItem>
            ) : (
              groups.map((group) => (
                <NavGroup
                  key={group.id}
                  group={group}
                  items={items}
                  composer={composer!}
                  onItemClick={handleItemClick}
                />
              ))
            )}
          </List>
        </Drawer>

        {/* Main Content Area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            transition: theme.transitions.create(['margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            marginLeft: isMobile ? 0 : drawerOpen ? `${drawerWidth}px` : 0,
          }}
        >
          {/* Breadcrumbs */}
          {manifest?.settings?.showBreadcrumbs && composer && (
            <BreadcrumbsBar composer={composer} currentPath={location.pathname} />
          )}

          {/* Page Content */}
          <Box sx={{ p: 3 }}>{children}</Box>
        </Box>
      </Box>

      {/* Export navigation state for extensions */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.NOFX_NAV = ${JSON.stringify({ items, groups, manifest })}`,
        }}
      />
    </>
  );
}