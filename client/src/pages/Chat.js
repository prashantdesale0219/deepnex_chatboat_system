import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
  Avatar,
  Divider,
  Alert,
  Tooltip,
  Button
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  CleaningServices as ClearIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';

const Chat = () => {
  const { sessionId } = useParams();
  const { theme, mode } = useTheme();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Fetch session and messages
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch session details
        const sessionRes = await axios.get(`/api/sessions/${sessionId}`);
        setSession(sessionRes.data.data);
        
        // Fetch messages
        const messagesRes = await axios.get(`/api/sessions/${sessionId}/messages`);
        setMessages(messagesRes.data.data);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load chat. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (sessionId) {
      fetchData();
    }
  }, [sessionId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Auto focus input field when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const userMessage = {
      _id: `temp-${Date.now()}`,
      sessionId,
      role: 'user',
      content: newMessage,
      timestamp: new Date().toISOString()
    };
    
    // Optimistically add user message to UI
    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setSending(true);
    setError('');

    // Add typing indicator
    const typingIndicatorId = `typing-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        _id: typingIndicatorId,
        sessionId,
        role: 'bot',
        content: '●●●',
        isTyping: true,
        timestamp: new Date().toISOString()
      }
    ]);

    try {
      // Detect language of user message to respond in same language
      const userLanguage = newMessage.trim();
      
      // Send message to API
      const res = await axios.post(`/api/sessions/${sessionId}/messages`, {
        message: newMessage,
        // Pass detected language to backend
        language: userLanguage
      });
      
      // Add bot response
      const botMessage = {
        _id: res.data.data.messageId,
        sessionId,
        role: 'bot',
        content: res.data.data.reply,
        timestamp: new Date().toISOString()
      };
      
      // Replace temp message and typing indicator with actual response
      setMessages(prev => [
        ...prev.filter(msg => msg._id !== userMessage._id && msg._id !== typingIndicatorId),
        {
          ...userMessage,
          _id: `user-${Date.now()}` // Replace temp ID with a more permanent one
        },
        botMessage
      ]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
      
      // Remove optimistically added message and typing indicator on error
      setMessages(prev => prev.filter(msg => !msg._id.startsWith('temp-') && !msg._id.startsWith('typing-')));
    } finally {
      setSending(false);
      // Scroll to bottom after message is sent
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
      // Auto-focus the input field after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };
  
  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content);
    setCopied(content);
    setTimeout(() => setCopied(null), 2000);
  };
  
  const handleDeleteSession = async () => {
    if (window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      try {
        await axios.delete(`/api/sessions/${sessionId}`);
        navigate('/chat');
      } catch (err) {
        console.error('Error deleting session:', err);
        setError('Failed to delete conversation');
      }
    }
  };
  
  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear all messages in this conversation? This action cannot be undone.')) {
      try {
        setLoading(true);
        await axios.delete(`/api/sessions/${sessionId}/messages`);
        setMessages([]);
        setError('');
      } catch (err) {
        console.error('Error clearing messages:', err);
        setError('Failed to clear messages');
      } finally {
        setLoading(false);
      }
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      backgroundColor: theme.palette.background.chat,
      position: 'relative' // Added position relative for absolute positioning of floating button
    }}>
      {/* Chat header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {currentUser && currentUser.role !== 'admin' && (
            <IconButton 
              edge="start" 
              onClick={() => navigate('/chat')}
              sx={{ mr: 1 }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap>
            {session?.configId?.name || 'Chat'}
          </Typography>
        </Box>
        
        {currentUser && currentUser.role !== 'admin' && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Clear chat messages">
              <IconButton color="primary" onClick={handleClearChat}>
                <ClearIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete conversation">
              <IconButton color="error" onClick={handleDeleteSession}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
      
      {/* Error alert */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Messages area */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        {messages.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            opacity: 0.7
          }}>
            <BotIcon sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
            <Typography variant="h6">
              Start a conversation
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 400, mt: 1 }}>
              Send a message to start chatting with the AI assistant.
            </Typography>
          </Box>
        ) : (
          messages.map((message) => (
            <Box 
              key={message._id} 
              sx={{
                display: 'flex',
                flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                maxWidth: '85%',
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Avatar 
                sx={{ 
                  bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                  width: 36, 
                  height: 36,
                  ml: message.role === 'user' ? 1 : 0,
                  mr: message.role === 'user' ? 0 : 1,
                }}
              >
                {message.role === 'user' ? 
                  (currentUser?.name?.charAt(0) || <PersonIcon />) : 
                  <BotIcon />}
              </Avatar>
              
              <Paper 
                elevation={1} 
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: message.role === 'user' ? 
                    theme.palette.background.message.user : 
                    theme.palette.background.message.bot,
                  position: 'relative',
                  '&:hover .message-actions': {
                    opacity: 1,
                  }
                }}
              >
                {message.isTyping ? (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    '& .typing-dot': {
                      width: '8px',
                      height: '8px',
                      margin: '0 2px',
                      borderRadius: '50%',
                      backgroundColor: theme.palette.text.secondary,
                      display: 'inline-block',
                      animation: 'typingAnimation 1.4s infinite ease-in-out both',
                    },
                    '& .typing-dot:nth-of-type(1)': {
                      animationDelay: '0s',
                    },
                    '& .typing-dot:nth-of-type(2)': {
                      animationDelay: '0.2s',
                    },
                    '& .typing-dot:nth-of-type(3)': {
                      animationDelay: '0.4s',
                    },
                    '@keyframes typingAnimation': {
                      '0%, 80%, 100%': {
                        transform: 'scale(0.6)',
                        opacity: 0.6,
                      },
                      '40%': {
                        transform: 'scale(1)',
                        opacity: 1,
                      },
                    },
                  }}>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </Box>
                ) : message.role === 'bot' ? (
                  <Box sx={{ 
                    '& pre': { 
                      borderRadius: 1,
                      overflow: 'auto',
                      maxWidth: '100%',
                      backgroundColor: mode === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${mode === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'}`,
                    },
                    '& code': {
                      fontFamily: 'monospace',
                      p: 0.5,
                      borderRadius: 0.5,
                      backgroundColor: mode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.1)',
                    },
                    '& a': {
                      color: 'primary.main',
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    },
                    '& p': {
                      marginTop: '0.5em',
                      marginBottom: '0.5em',
                    },
                    '& h1, & h2, & h3, & h4, & h5, & h6': {
                      marginTop: '1em',
                      marginBottom: '0.5em',
                      fontWeight: 600,
                    },
                    '& ul, & ol': {
                      paddingLeft: '1.5em',
                    },
                    '& li': {
                      marginBottom: '0.25em',
                    },
                    '& blockquote': {
                      borderLeft: `3px solid ${theme.palette.primary.main}`,
                      paddingLeft: '1em',
                      margin: '1em 0',
                      color: 'text.secondary',
                    },
                    '& table': {
                      borderCollapse: 'collapse',
                      width: '100%',
                      marginBottom: '1em',
                    },
                    '& th, & td': {
                      border: `1px solid ${theme.palette.divider}`,
                      padding: '0.5em',
                    },
                    '& th': {
                      backgroundColor: mode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)',
                    },
                  }}>
                    <ReactMarkdown
                      components={{
                        code({node, inline, className, children, ...props}) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={mode === 'light' ? prism : atomDark}
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
                ) : (
                  <Typography variant="body1">{message.content}</Typography>
                )}
                
                {/* Message actions */}
                <Box 
                  className="message-actions"
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: message.role === 'user' ? 'auto' : 4,
                    left: message.role === 'user' ? 4 : 'auto',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    gap: 0.5,
                    backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.6)',
                    borderRadius: 1,
                    p: 0.5,
                  }}
                >
                  <Tooltip title={copied === message.content ? 'Copied!' : 'Copy to clipboard'}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleCopyMessage(message.content)}
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                
                {/* Timestamp */}
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ 
                    display: 'block', 
                    mt: 1, 
                    textAlign: message.role === 'user' ? 'right' : 'left',
                    fontSize: '0.7rem'
                  }}
                >
                  {new Date(message.timestamp).toLocaleTimeString()}
                </Typography>
              </Paper>
            </Box>
          ))
        )}
        <div ref={messagesEndRef} />
      </Box>
      

      {/* Message input */}
      <Box sx={{ 
        p: 2, 
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper
      }}>
        <form onSubmit={handleSendMessage}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              placeholder="Type a message..."
              variant="outlined"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
              inputRef={inputRef}
              multiline
              maxRows={4}
              autoFocus
              onKeyDown={(e) => {
                // Send message on Enter key, but allow Shift+Enter for new line
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newMessage.trim() && !sending) {
                    handleSendMessage(e);
                  }
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 4,
                  backgroundColor: theme.palette.background.default,
                }
              }}
              InputProps={{
                endAdornment: (
                  <IconButton 
                    color="primary" 
                    type="submit" 
                    disabled={!newMessage.trim() || sending}
                    sx={{ ml: 1 }}
                  >
                    {sending ? <CircularProgress size={24} /> : <SendIcon />}
                  </IconButton>
                )
              }}
            />
          </Box>
        </form>
      </Box>

      {/* Footer with chatbot change button - only shown for non-admin users */}
      {currentUser && currentUser.role !== 'admin' && (
        <Box sx={{ 
          p: 2, 
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          display: 'flex',
          justifyContent: 'center'
        }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/chat')}
            startIcon={<ArrowBackIcon />}
          >
            Back to Chatbot List
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default Chat;