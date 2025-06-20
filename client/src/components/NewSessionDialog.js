import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';
import { configsAPI } from '../services/api';

/**
 * Dialog component for creating a new chat session
 * Allows selecting from available configurations
 */
const NewSessionDialog = ({ open, onClose, onCreateSession }) => {
  const [configs, setConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch available configurations when dialog opens
  useEffect(() => {
    if (open) {
      fetchConfigs();
    }
  }, [open]);

  // Fetch configurations from API
  const fetchConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await configsAPI.getAllConfigs();
      setConfigs(response.data);
      // Auto-select first config if available
      if (response.data.length > 0) {
        setSelectedConfig(response.data[0]._id);
      }
    } catch (err) {
      setError('Failed to load configurations. Please try again.');
      console.error('Error fetching configs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle creating a new session
  const handleCreate = () => {
    if (selectedConfig) {
      onCreateSession(selectedConfig);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Chat Session</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" sx={{ my: 2 }}>
            {error}
          </Typography>
        ) : configs.length === 0 ? (
          <Typography sx={{ my: 2 }}>
            No configurations available. Please create a configuration first.
          </Typography>
        ) : (
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="config-select-label">Configuration</InputLabel>
              <Select
                labelId="config-select-label"
                value={selectedConfig}
                label="Configuration"
                onChange={(e) => setSelectedConfig(e.target.value)}
              >
                {configs.map((config) => (
                  <MenuItem key={config._id} value={config._id}>
                    <Box>
                      <Typography variant="subtitle1">{config.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {config.purpose}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {selectedConfig && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Selected Configuration Details:
                </Typography>
                {configs.find(c => c._id === selectedConfig) && (
                  <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'primary.main' }}>
                    <Typography variant="body2" gutterBottom>
                      <strong>Model:</strong> {configs.find(c => c._id === selectedConfig).model}
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      <strong>Temperature:</strong> {configs.find(c => c._id === selectedConfig).temperature}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Max Tokens:</strong> {configs.find(c => c._id === selectedConfig).maxTokens}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button 
          onClick={handleCreate} 
          color="primary" 
          variant="contained"
          disabled={!selectedConfig || loading}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewSessionDialog;