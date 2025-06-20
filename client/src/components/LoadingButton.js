import React from 'react';
import { Button, CircularProgress } from '@mui/material';

/**
 * Button component with loading state
 * Shows a spinner when loading is true
 */
const LoadingButton = ({ 
  loading, 
  children, 
  disabled, 
  startIcon, 
  ...props 
}) => {
  return (
    <Button
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : startIcon}
      {...props}
    >
      {children}
    </Button>
  );
};

export default LoadingButton;