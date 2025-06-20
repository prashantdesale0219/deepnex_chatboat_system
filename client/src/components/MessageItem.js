import React from 'react';
import { Box, Typography, Paper, Avatar } from '@mui/material';
import { useTheme } from '../contexts/ThemeContext';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';

/**
 * MessageItem component for displaying a single chat message
 * Supports markdown and code syntax highlighting
 */
const MessageItem = ({ message, isLast }) => {
  const { mode } = useTheme();
  const isAI = message.role === 'assistant';
  
  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        mb: 2,
        scrollMarginTop: '100px',
        backgroundColor: isAI 
          ? mode === 'dark' ? 'rgba(32, 33, 35, 0.5)' : 'rgba(247, 247, 248, 0.8)' 
          : 'transparent',
        py: 2,
        px: { xs: 2, md: 4 },
        borderBottom: isLast ? 'none' : `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
      }}
      id={`message-${message._id}`}
    >
      <Avatar
        sx={{
          bgcolor: isAI ? 'primary.main' : 'secondary.main',
          color: '#fff',
          mr: 2,
          mt: 0.5,
          width: 36,
          height: 36
        }}
      >
        {isAI ? <SmartToyIcon /> : <PersonIcon />}
      </Avatar>
      
      <Box sx={{ flex: 1, maxWidth: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {isAI ? 'AI Assistant' : 'You'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {formatTime(message.createdAt)}
          </Typography>
        </Box>
        
        <Box sx={{ 
          '& pre': { 
            borderRadius: 2,
            p: 0,
            my: 2,
            maxWidth: '100%',
            overflow: 'auto'
          },
          '& code': {
            fontFamily: '"Roboto Mono", monospace',
          },
          '& p': {
            my: 1
          },
          '& ul, & ol': {
            pl: 4
          }
        }}>
          <ReactMarkdown
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={mode === 'dark' ? tomorrow : prism}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {message.content}
          </ReactMarkdown>
        </Box>
      </Box>
    </Box>
  );
};

export default MessageItem;