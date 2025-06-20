import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Container
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';

const Sessions = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    // Redirect to onboarding page
    navigate('/onboarding');
  }, [navigate]);
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ 
      flexGrow: 1, 
      p: 3, 
      overflow: 'auto',
      height: '100%',
      backgroundColor: theme.palette.background.default
    }}>
      <Container maxWidth="lg">
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              textAlign: 'center',
              backgroundColor: theme.palette.background.paper,
              borderRadius: 2,
              maxWidth: 500
            }}
          >
            <Typography variant="h5" gutterBottom>
              Create Your Custom Chatbot
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Start by creating a new chatbot tailored to your specific needs.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              size="large"
              onClick={() => navigate('/onboarding')}
            >
              Create Chatbot
            </Button>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default Sessions;