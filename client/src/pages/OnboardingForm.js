import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Container,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  FormHelperText,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const domains = [
  'general',
  'support',
  'product',
  'faq',
  'programming',
  'documentation',
  'api',
  'marketing',
  'sales',
  'travel',
  'finance',
  'healthcare',
  'education'
];

const toneStyles = [
  'formal',
  'casual',
  'friendly',
  'professional',
  'technical'
];

const languages = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }
];

const aiProviders = [
  { value: 'mistral', name: 'Mistral AI' },
  { value: 'openai', name: 'OpenAI' }
];

const mistralModels = [
  { value: 'mistral-small', name: 'Mistral Small' },
  { value: 'mistral-medium', name: 'Mistral Medium' },
  { value: 'mistral-large', name: 'Mistral Large' }
];

const openaiModels = [
  { value: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  { value: 'gpt-4', name: 'GPT-4' }
];

const OnboardingForm = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    purpose: '',
    projectId: '',
    domain: [],
    tone: {
      style: 'professional',
      language: 'en'
    },
    channels: ['web'],
    integrations: [],
    system_prompt: '',
    ai: {
      provider: 'mistral',
      model: 'mistral-small',
      temperature: 0.7,
      max_tokens: 1000
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [chatbotLink, setChatbotLink] = useState('');
  
  // PDF upload states
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfUploadSuccess, setPdfUploadSuccess] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState('');
  const [pdfPreview, setPdfPreview] = useState('');
  
  // Prompt enhancement states
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanceSuccess, setPromptEnhanceSuccess] = useState(false);
  const [promptEnhanceError, setPromptEnhanceError] = useState('');
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };
  
  const handleDomainChange = (event) => {
    const {
      target: { value },
    } = event;
    setFormData({
      ...formData,
      domain: typeof value === 'string' ? value.split(',') : value,
    });
  };
  
  const handlePdfChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        setPdfUploadError('Only PDF files are allowed');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB
        setPdfUploadError('File size should not exceed 10MB');
        return;
      }
      
      setPdfFile(file);
      setPdfUploadError('');
      setPdfPreview(file.name);
    }
  };
  
  const handlePdfUpload = async (configId) => {
    if (!pdfFile) return null;
    
    try {
      setPdfUploading(true);
      setPdfUploadError('');
      
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      
      const response = await axios.post(`/api/configs/upload-pdf/${configId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setPdfUploadSuccess(true);
      return response.data.data;
    } catch (err) {
      console.error('Error uploading PDF:', err);
      setPdfUploadError(err.response?.data?.error || 'Failed to upload PDF. Please try again.');
      return null;
    } finally {
      setPdfUploading(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      // Generate a unique projectId if not provided
      if (!formData.projectId) {
        const projectId = formData.name
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
          .substring(0, 30);
        
        formData.projectId = `${projectId}_${Date.now().toString(36)}`;
      }
      
      // Prepare config data with original prompt if system_prompt exists
      const configDataToSubmit = {
        ...formData,
        original_prompt: formData.system_prompt ? formData.system_prompt : '',
        enhanced_prompt: promptEnhanceSuccess ? formData.system_prompt : ''
      };
      
      // Create the configuration
      const res = await axios.post('/api/configs', configDataToSubmit);
      const config = res.data.data;
      
      // Upload PDF if selected
      if (pdfFile) {
        await handlePdfUpload(config._id);
      }
      
      // Create a session with this configuration
      const sessionRes = await axios.post('/api/sessions', { configId: config._id });
      const session = sessionRes.data.data;
      
      // Generate chatbot link
      const chatbotLink = `${window.location.origin}/chat/${session._id}`;
      setChatbotLink(chatbotLink);
      
      setSuccess(true);
      setFormData({
        name: '',
        purpose: '',
        projectId: '',
        domain: [],
        tone: {
          style: 'professional',
          language: 'en'
        },
        channels: ['web'],
        integrations: [],
        system_prompt: '',
        ai: {
          provider: 'mistral',
          model: 'mistral-small',
          temperature: 0.7,
          max_tokens: 1000
        }
      });
      setPdfFile(null);
      setPdfPreview('');
      setPdfUploadSuccess(false);
      setPromptEnhanceSuccess(false);
      setPromptEnhanceError('');
    } catch (err) {
      console.error('Error creating chatbot:', err);
      setError(err.response?.data?.error || 'Failed to create chatbot. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  
  const handleEnhancePrompt = async () => {
    if (!formData.system_prompt) return;
    
    setEnhancingPrompt(true);
    setPromptEnhanceSuccess(false);
    setPromptEnhanceError('');
    
    try {
      const response = await axios.post('/api/configs/enhance-prompt', {
        prompt: formData.system_prompt
      });
      
      // Store the enhanced prompt
      setEnhancedPrompt(response.data.data.enhancedPrompt);
      
      // Show the confirmation dialog
      setShowPromptDialog(true);
      setPromptEnhanceSuccess(true);
      
    } catch (err) {
      console.error('Error enhancing prompt:', err);
      setPromptEnhanceError(err.response?.data?.error || 'Failed to enhance prompt. Please try again.');
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setPromptEnhanceError('');
      }, 5000);
    } finally {
      setEnhancingPrompt(false);
    }
  };
  
  const handleAcceptEnhancedPrompt = () => {
    // Update the form data with the enhanced prompt
    setFormData({
      ...formData,
      system_prompt: enhancedPrompt
    });
    
    // Close the dialog
    setShowPromptDialog(false);
    
    // Show success message
    setPromptEnhanceSuccess(true);
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setPromptEnhanceSuccess(false);
    }, 3000);
  };
  
  const handleClosePromptDialog = () => {
    setShowPromptDialog(false);
  };
  
  const handleGoToChat = () => {
    if (chatbotLink) {
      window.location.href = chatbotLink;
    }
  };
  
  return (
    <Box sx={{ 
      flexGrow: 1, 
      p: 3, 
      overflow: 'auto',
      height: '100%',
      backgroundColor: theme.palette.background.default
    }}>
      {/* Prompt Enhancement Dialog */}
      <Dialog
        open={showPromptDialog}
        onClose={handleClosePromptDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>एन्हांस्ड प्रॉम्प्ट</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" gutterBottom>
            आपका प्रॉम्प्ट AI द्वारा एन्हांस किया गया है। क्या आप इसे स्वीकार करना चाहते हैं?
          </Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, maxHeight: '300px', overflow: 'auto' }}>
            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {enhancedPrompt}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePromptDialog} color="primary">
            रद्द करें
          </Button>
          <Button onClick={handleAcceptEnhancedPrompt} color="primary" variant="contained">
            स्वीकार करें
          </Button>
        </DialogActions>
      </Dialog>
      
      <Container maxWidth="md">
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper
          }}
        >
          <Typography variant="h4" gutterBottom align="center">
            Create Your Custom Chatbot
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph align="center">
            Fill out this form to create a chatbot tailored to your specific needs.
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Chatbot created successfully!
            </Alert>
          )}
          
          {success && chatbotLink && (
            <Card sx={{ mb: 4, backgroundColor: theme.palette.primary.light }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Your Chatbot is Ready!
                </Typography>
                <Typography variant="body1" paragraph>
                  Share this link with your users:
                </Typography>
                <TextField
                  fullWidth
                  variant="outlined"
                  value={chatbotLink}
                  InputProps={{
                    readOnly: true,
                  }}
                  sx={{ mb: 2 }}
                />
                <Button 
                  variant="contained" 
                  color="primary" 
                  fullWidth
                  onClick={handleGoToChat}
                >
                  Go to Your Chatbot
                </Button>
              </CardContent>
            </Card>
          )}
          
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  required
                  fullWidth
                  label="Chatbot Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  helperText="Give your chatbot a descriptive name"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Project ID (Optional)"
                  name="projectId"
                  value={formData.projectId}
                  onChange={handleChange}
                  helperText="Leave blank to auto-generate"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  label="Purpose"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  multiline
                  rows={2}
                  helperText="Describe what your chatbot will help users with"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="domain-label">Domain</InputLabel>
                  <Select
                    labelId="domain-label"
                    multiple
                    value={formData.domain}
                    onChange={handleDomainChange}
                    input={<OutlinedInput id="select-multiple-chip" label="Domain" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} />
                        ))}
                      </Box>
                    )}
                    MenuProps={MenuProps}
                  >
                    {domains.map((domain) => (
                      <MenuItem
                        key={domain}
                        value={domain}
                      >
                        {domain}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Select the domains your chatbot will specialize in</FormHelperText>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Tone & Style
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="tone-style-label">Tone Style</InputLabel>
                  <Select
                    labelId="tone-style-label"
                    name="tone.style"
                    value={formData.tone.style}
                    onChange={handleChange}
                    label="Tone Style"
                  >
                    {toneStyles.map((style) => (
                      <MenuItem key={style} value={style}>
                        {style.charAt(0).toUpperCase() + style.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>How should your chatbot communicate?</FormHelperText>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="tone-language-label">Language</InputLabel>
                  <Select
                    labelId="tone-language-label"
                    name="tone.language"
                    value={formData.tone.language}
                    onChange={handleChange}
                    label="Language"
                  >
                    {languages.map((lang) => (
                      <MenuItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Primary language for responses</FormHelperText>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="System Prompt"
                  name="system_prompt"
                  value={formData.system_prompt}
                  onChange={handleChange}
                  multiline
                  rows={4}
                  helperText="Custom instructions for the AI (optional). Leave blank to use default prompt based on purpose."
                />
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    {enhancingPrompt && (
                      <Typography variant="caption" color="text.secondary">
                        <CircularProgress size={12} sx={{ mr: 1 }} />
                        Enhancing prompt with AI...
                      </Typography>
                    )}
                    {promptEnhanceSuccess && (
                      <Typography variant="caption" color="success.main">
                        <CheckCircleOutlineIcon fontSize="small" sx={{ mr: 0.5, fontSize: 14, verticalAlign: 'middle' }} />
                        Prompt enhanced successfully!
                      </Typography>
                    )}
                    {promptEnhanceError && (
                      <Typography variant="caption" color="error">
                        <ErrorOutlineIcon fontSize="small" sx={{ mr: 0.5, fontSize: 14, verticalAlign: 'middle' }} />
                        {promptEnhanceError}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleEnhancePrompt}
                    disabled={!formData.system_prompt || loading || enhancingPrompt}
                    startIcon={enhancingPrompt ? <CircularProgress size={16} /> : null}
                  >
                    Enhance Prompt with AI
                  </Button>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  PDF Knowledge Base (Optional)
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Upload a PDF document to train your chatbot on specific knowledge. The AI will deeply analyze both the document content AND your configuration details (purpose, domain, tone) to provide comprehensive responses tailored to your needs.
                </Typography>
                
                <Box sx={{ 
                  border: '1px dashed',
                  borderColor: 'grey.400',
                  borderRadius: 1,
                  p: 3,
                  textAlign: 'center',
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                }}>
                  <input
                    accept="application/pdf"
                    style={{ display: 'none' }}
                    id="pdf-upload"
                    type="file"
                    onChange={handlePdfChange}
                  />
                  <label htmlFor="pdf-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      sx={{ mb: 2 }}
                    >
                      Select PDF File
                    </Button>
                  </label>
                  
                  {pdfPreview && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        Selected file: {pdfPreview}
                      </Typography>
                    </Box>
                  )}
                  
                  {pdfUploadError && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {pdfUploadError}
                    </Alert>
                  )}
                  
                  {pdfUploadSuccess && (
                    <Alert severity="success" sx={{ mt: 2 }}>
                      PDF uploaded successfully! The chatbot will intelligently combine your document knowledge with your configuration details (purpose, domain, tone) to provide the most relevant and helpful responses.
                    </Alert>
                  )}
                  
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Max file size: 10MB. Only PDF files are supported.
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  AI Configuration
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="ai-provider-label">AI Provider</InputLabel>
                  <Select
                    labelId="ai-provider-label"
                    name="ai.provider"
                    value={formData.ai.provider}
                    onChange={handleChange}
                    label="AI Provider"
                  >
                    {aiProviders.map((provider) => (
                      <MenuItem key={provider.value} value={provider.value}>
                        {provider.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="ai-model-label">AI Model</InputLabel>
                  <Select
                    labelId="ai-model-label"
                    name="ai.model"
                    value={formData.ai.model}
                    onChange={handleChange}
                    label="AI Model"
                  >
                    {formData.ai.provider === 'mistral' ? (
                      mistralModels.map((model) => (
                        <MenuItem key={model.value} value={model.value}>
                          {model.name}
                        </MenuItem>
                      ))
                    ) : (
                      openaiModels.map((model) => (
                        <MenuItem key={model.value} value={model.value}>
                          {model.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Temperature"
                  name="ai.temperature"
                  type="number"
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                  value={formData.ai.temperature}
                  onChange={handleChange}
                  helperText="Controls randomness (0-1, lower is more deterministic)"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Max Tokens"
                  name="ai.max_tokens"
                  type="number"
                  inputProps={{ min: 100, max: 4000, step: 100 }}
                  value={formData.ai.max_tokens}
                  onChange={handleChange}
                  helperText="Maximum length of generated responses"
                />
              </Grid>
              
              <Grid item xs={12} sx={{ mt: 3 }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  fullWidth
                  disabled={loading}
                  sx={{ py: 1.5 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Create Chatbot'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Container>
    </Box>
  );
};

export default OnboardingForm;