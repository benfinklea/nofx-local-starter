import * as React from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import FolderIcon from '@mui/icons-material/Folder';
import Stack from '@mui/material/Stack';
import { useProjects } from '../hooks/useProjects';
import { Link as RouterLink } from 'react-router-dom';

export default function ProjectSwitcher(){
  const { projects, projectId, selected, select } = useProjects();
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchor);
  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);
  const choose = (id: string) => () => { select(id); setAnchor(null); };

  return (
    <>
      <Button color="inherit" onClick={handleOpen} startIcon={<FolderIcon/>} endIcon={<ArrowDropDownIcon/>}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ textTransform:'none' }}>{selected?.name || projectId}</Typography>
        </Stack>
      </Button>
      <Menu anchorEl={anchor} open={open} onClose={handleClose} keepMounted>
        {projects.map(p => (
          <MenuItem key={p.id} selected={p.id===projectId} onClick={choose(p.id)}>{p.name} <Typography sx={{ ml:1 }} color="text.secondary" component="span">({p.id})</Typography></MenuItem>
        ))}
        <MenuItem component={RouterLink} to="/projects" onClick={handleClose}>Manage Projects…</MenuItem>
      </Menu>
    </>
  );
}

