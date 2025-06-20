import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import axios from 'axios';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import PublicChat from './pages/PublicChat';
import Sessions from './pages/Sessions';
import NotFound from './pages/NotFound';
import OnboardingForm from './pages/OnboardingForm';

// Components
import Layout from './components/Layout';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Admin Redirect Component
const AdminRedirect = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  
  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        // If user is admin, create a chatbot session automatically
        if (currentUser && currentUser.role === 'admin') {
          // Get the first available config or create one
          const configResponse = await axios.get('/api/configs');
          let configId;
          
          if (configResponse.data.data && configResponse.data.data.length > 0) {
            configId = configResponse.data.data[0]._id;
          } else {
            // Create a default config if none exists
            const newConfigResponse = await axios.post('/api/configs', {
              name: 'Default Chatbot',
              purpose: 'General assistance',
              ai: {
                provider: 'mistral',
                model: 'mistral-small'
              }
            });
            configId = newConfigResponse.data.data._id;
          }
          
          // Create a new session with this config
          const sessionResponse = await axios.post('/api/sessions', { configId });
          setSessionId(sessionResponse.data.data._id);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error in admin redirect:', error);
        setLoading(false);
      }
    };
    
    checkUserAndRedirect();
  }, [currentUser]);
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // Redirect based on user role
  if (currentUser && currentUser.role === 'admin' && sessionId) {
    return <Navigate to={`/chat/${sessionId}`} replace />;
  }
  
  // Default redirect for non-admin users
  return <Navigate to="/onboarding" replace />;
};

function App() {
  const { theme } = useTheme();
  
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: '100vh',
      bgcolor: theme.palette.background.default,
      color: theme.palette.text.primary
    }}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminRedirect />} />
          <Route path="chat" element={<OnboardingForm />} />
          <Route path="chat/:sessionId" element={<Chat />} />
          <Route path="onboarding" element={<OnboardingForm />} />
        </Route>
        <Route path="/public/:sessionId" element={<PublicChat />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Box>
  );
}

export default App;