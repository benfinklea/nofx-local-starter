/**
 * Breadcrumbs component for navigation context
 * Phase 1.5 - Track C implementation
 */

import * as React from 'react';
import {
  Box,
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  NavigateNext as NavigateNextIcon,
  Home as HomeIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useNavigationContext } from '../hooks/useNavigation';

export default function Breadcrumbs() {
  const navigate = useNavigate();
  const { breadcrumbs, actions } = useNavigationContext();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleActionsClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleActionsClose = () => {
    setAnchorEl(null);
  };

  const handleActionClick = (action: typeof actions[0]) => {
    handleActionsClose();
    action.action();
  };

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        py: 1.5,
        backgroundColor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <MuiBreadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
        sx={{ flex: 1 }}
      >
        {/* Home icon for root */}
        {breadcrumbs[0]?.path === '/' ? (
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'text.primary',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            <HomeIcon fontSize="small" sx={{ mr: 0.5 }} />
            Home
          </Link>
        ) : null}

        {/* Breadcrumb items */}
        {breadcrumbs.slice(breadcrumbs[0]?.path === '/' ? 1 : 0).map((crumb, index) => {
          const isLast = index === breadcrumbs.length - (breadcrumbs[0]?.path === '/' ? 2 : 1);

          if (isLast) {
            return (
              <Typography key={crumb.path} color="text.primary" variant="body2">
                {crumb.label}
              </Typography>
            );
          }

          return (
            <Link
              key={crumb.path}
              component="button"
              variant="body2"
              onClick={() => navigate(crumb.path)}
              sx={{
                color: 'text.primary',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              {crumb.label}
            </Link>
          );
        })}
      </MuiBreadcrumbs>

      {/* Contextual Actions */}
      {actions.length > 0 && (
        <>
          <IconButton
            size="small"
            onClick={handleActionsClick}
            aria-label="page actions"
            sx={{ ml: 2 }}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleActionsClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            {actions.map((action, index) => (
              <MenuItem
                key={index}
                onClick={() => handleActionClick(action)}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  minWidth: 200,
                }}
              >
                <span>{action.label}</span>
                {action.keyboard && (
                  <Chip
                    label={action.keyboard}
                    size="small"
                    sx={{
                      ml: 2,
                      height: 20,
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                    }}
                  />
                )}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
}