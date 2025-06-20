import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Drawer, 
  List, 
  Divider,
  useMediaQuery,
  Button,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon, 
  ListItemText,
  Tooltip,
  CircularProgress
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Add, 
  Brightness4, 
  Brightness7,
  Person,
  Logout,
  Refresh
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import SessionItem from './SessionItem';

const drawerWidth = 280;

const Layout = () => {
  const { theme, mode, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Check if user is admin
  const isAdmin = currentUser && currentUser.role === 'admin';
  
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };
  
  const handleCreateChatbot = () => {
    navigate('/onboarding');
    if (isMobile) setMobileOpen(false);
  };
  
  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };
  
  // Fetch sessions from API
  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get('/api/sessions');
      setSessions(response.data.data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Failed to load chatbot sessions');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch sessions on component mount
  useEffect(() => {
    fetchSessions();
  }, []);
  
  const drawer = (
    <>
      <Toolbar sx={{ justifyContent: 'center' }}>
        <Typography variant="h6" noWrap component="div">
          Mistral Chat
        </Typography>
      </Toolbar>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Button 
          variant="contained" 
          startIcon={<Add />} 
          fullWidth 
          onClick={handleCreateChatbot}
        >
          Create Chatbot
        </Button>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Your Chatbots
        </Typography>
        <Tooltip title="Refresh chatbots">
          <IconButton size="small" onClick={fetchSessions} disabled={loading}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />
      <List sx={{ px: 1, overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : error ? (
          <Typography variant="body2" color="error" sx={{ px: 2, py: 1 }}>
            {error}
          </Typography>
        ) : sessions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            No chatbots found
          </Typography>
        ) : (
          sessions.map((session) => (
            <SessionItem 
              key={session._id} 
              session={session} 
              onClick={() => isMobile && setMobileOpen(false)}
            />
          ))
        )}
      </List>
    </>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {!isAdmin && (
        <AppBar 
          position="fixed" 
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            boxShadow: 1
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            
            <Box sx={{ flexGrow: 1 }} />
            
            <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
              <IconButton onClick={toggleTheme} color="inherit">
                {mode === 'light' ? <Brightness4 /> : <Brightness7 />}
              </IconButton>
            </Tooltip>
            
            <IconButton
              onClick={handleProfileMenuOpen}
              size="small"
              sx={{ ml: 2 }}
              aria-controls={open ? 'account-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={open ? 'true' : undefined}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main }}>
                {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>
      )}
      
      {!isAdmin && (
        <Box
          component="nav"
          sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        >
          {/* Mobile drawer */}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerWidth,
                backgroundColor: theme.palette.background.paper,
              },
            }}
          >
            {drawer}
          </Drawer>
          
          {/* Desktop drawer */}
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerWidth,
                backgroundColor: theme.palette.background.paper,
                borderRight: `1px solid ${theme.palette.divider}`
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>
      )}
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isAdmin ? 0 : 3,
          width: isAdmin ? '100%' : { md: `calc(100% - ${drawerWidth}px)` },
          ml: isAdmin ? 0 : { md: `${drawerWidth}px` },
          mt: isAdmin ? 0 : '64px',
          display: 'flex',
          flexDirection: 'column',
          height: isAdmin ? '100vh' : 'calc(100vh - 64px)',
          overflow: 'auto'
        }}
      >
        {!isAdmin && <Toolbar />} {/* Spacer for AppBar */}
        <Outlet />
      </Box>
      
      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          {currentUser?.name || 'User'}
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout;