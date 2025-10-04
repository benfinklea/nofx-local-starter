import * as React from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';

interface HelpTextProps {
  title?: string;
  children: React.ReactNode;
  severity?: 'info' | 'success' | 'warning' | 'error';
  defaultOpen?: boolean;
}

export default function HelpText({
  title = 'Help',
  children,
  severity = 'info',
  defaultOpen = false
}: HelpTextProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapse in={open}>
      <Alert
        severity={severity}
        icon={<HelpOutlineIcon />}
        sx={{ mb: 2 }}
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={() => setOpen(false)}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
      >
        {title && <AlertTitle>{title}</AlertTitle>}
        {children}
      </Alert>
    </Collapse>
  );
}
