import React, { useState, useEffect } from 'react';
import Button from '@mui/material/Button'; 
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

const Popup = ({ message }) => {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (message) {
      setOpen(true);
      const timeoutId = setTimeout(() => {
        setOpen(false);
      }, 30000); // Change the timeout duration as needed

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [message]);

  return (
    <Dialog open={open} onClose={handleClose} className="dialog">
      <DialogTitle className="dialog">Message</DialogTitle>
      <DialogContent className="dialog">
        <DialogContentText className="dialog">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions className="dialog">
        <Button onClick={handleClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Popup;
