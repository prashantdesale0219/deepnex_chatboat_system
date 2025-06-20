import React from 'react';
import { 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Typography 
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import { useNavigate } from 'react-router-dom';

/**
 * SessionItem component for displaying a single chat session in the sidebar
 */
const SessionItem = ({ session, selected, onClick }) => {
  const navigate = useNavigate();
  
  // Format date to readable format
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Handle click on session item
  const handleClick = () => {
    navigate(`/chat/${session._id}`);
    if (onClick) onClick();
  };

  return (
    <ListItem disablePadding>
      <ListItemButton 
        selected={selected} 
        onClick={handleClick}
        sx={{
          borderRadius: 1,
          my: 0.5,
          '&.Mui-selected': {
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            '& .MuiListItemIcon-root': {
              color: 'white',
            },
            '& .MuiTypography-root': {
              color: 'white',
            }
          }
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          <ChatIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText 
          primary={
            <Typography 
              variant="body2" 
              noWrap 
              sx={{ 
                fontWeight: selected ? 'bold' : 'normal',
                maxWidth: '180px'
              }}
            >
              {session.configId?.name || 'Chat Session'}
            </Typography>
          }
          secondary={
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ color: selected ? 'rgba(255,255,255,0.7)' : undefined }}
            >
              {formatDate(session.updatedAt || session.createdAt)}
            </Typography>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

export default SessionItem;