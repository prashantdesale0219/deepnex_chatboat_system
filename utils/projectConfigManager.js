const fs = require('fs');
const path = require('path');
const Config = require('../models/Config');

class ProjectConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, '../config/projects.json');
    this.projectConfigs = {};
    this.loadProjectConfigs();
  }

  /**
   * Load project configurations from the JSON file
   */
  loadProjectConfigs() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        this.projectConfigs = JSON.parse(configData);
        console.log('Project configurations loaded successfully');
      } else {
        console.warn('Project configuration file not found. Creating default configuration.');
        this.projectConfigs = {
          default: {
            name: 'Default Chatbot',
            purpose: 'General purpose AI assistant',
            system_prompt: 'You are a helpful AI assistant. Answer questions accurately, be polite, and provide useful information based on your knowledge.',
            domain: ['general'],
            tone: {
              style: 'professional',
              language: 'en'
            },
            channels: ['web'],
            integrations: [],
            ai: {
              provider: 'mistral',
              model: 'mistral-small',
              temperature: 0.7,
              max_tokens: 1000
            }
          }
        };
        this.saveProjectConfigs();
      }
    } catch (error) {
      console.error('Error loading project configurations:', error);
      this.projectConfigs = {};
    }
  }

  /**
   * Save project configurations to the JSON file
   */
  saveProjectConfigs() {
    try {
      // Ensure the directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(
        this.configPath, 
        JSON.stringify(this.projectConfigs, null, 2),
        'utf8'
      );
      console.log('Project configurations saved successfully');
    } catch (error) {
      console.error('Error saving project configurations:', error);
    }
  }

  /**
   * Get configuration for a specific project
   * @param {string} projectId - The project identifier
   * @returns {Object} - The project configuration
   */
  getProjectConfig(projectId) {
    // If projectId is not provided or doesn't exist, return default config
    if (!projectId || !this.projectConfigs[projectId]) {
      console.log(`Project ID ${projectId} not found, using default configuration`);
      return this.projectConfigs.default || {};
    }
    
    return this.projectConfigs[projectId];
  }

  /**
   * Add or update a project configuration
   * @param {string} projectId - The project identifier
   * @param {Object} config - The project configuration
   */
  setProjectConfig(projectId, config) {
    if (!projectId) {
      throw new Error('Project ID is required');
    }
    
    this.projectConfigs[projectId] = config;
    this.saveProjectConfigs();
  }

  /**
   * Remove a project configuration
   * @param {string} projectId - The project identifier to remove
   * @returns {boolean} - True if removed, false if not found
   */
  removeProjectConfig(projectId) {
    if (!projectId || projectId === 'default') {
      return false; // Cannot remove default config
    }
    
    if (this.projectConfigs[projectId]) {
      delete this.projectConfigs[projectId];
      this.saveProjectConfigs();
      return true;
    }
    
    return false;
  }

  /**
   * Get all project configurations
   * @returns {Object} - All project configurations
   */
  getAllProjectConfigs() {
    return this.projectConfigs;
  }

  /**
   * Sync project configurations with database
   * Creates or updates configurations in the database based on the JSON file
   */
  async syncWithDatabase() {
    try {
      for (const [projectId, config] of Object.entries(this.projectConfigs)) {
        // Check if config exists in database
        let dbConfig = await Config.findOne({ projectId });
        
        if (dbConfig) {
          // Update existing config
          dbConfig.name = config.name;
          dbConfig.purpose = config.purpose;
          dbConfig.system_prompt = config.system_prompt;
          dbConfig.domain = config.domain;
          dbConfig.tone = config.tone;
          dbConfig.channels = config.channels;
          dbConfig.integrations = config.integrations;
          dbConfig.ai = config.ai;
          
          await dbConfig.save();
          console.log(`Updated configuration for project: ${projectId}`);
        } else {
          // Create new config
          await Config.create({
            projectId,
            name: config.name,
            purpose: config.purpose,
            system_prompt: config.system_prompt,
            domain: config.domain,
            tone: config.tone,
            channels: config.channels,
            integrations: config.integrations,
            ai: config.ai
          });
          console.log(`Created configuration for project: ${projectId}`);
        }
      }
      
      console.log('Database sync completed successfully');
    } catch (error) {
      console.error('Error syncing with database:', error);
    }
  }

  /**
   * Get configuration from database for a specific project
   * @param {string} projectId - The project identifier
   * @returns {Promise<Object>} - The project configuration from database
   */
  async getConfigFromDatabase(projectId) {
    try {
      // If projectId is not provided, use default
      const searchId = projectId || 'default';
      
      // Find config in database
      let dbConfig = await Config.findOne({ projectId: searchId });
      
      // If not found, try to create it from JSON file
      if (!dbConfig) {
        const fileConfig = this.getProjectConfig(searchId);
        
        if (Object.keys(fileConfig).length > 0) {
          dbConfig = await Config.create({
            projectId: searchId,
            name: fileConfig.name,
            purpose: fileConfig.purpose,
            system_prompt: fileConfig.system_prompt,
            domain: fileConfig.domain,
            tone: fileConfig.tone,
            channels: fileConfig.channels,
            integrations: fileConfig.integrations,
            ai: fileConfig.ai
          });
          console.log(`Created configuration for project: ${searchId}`);
        } else {
          // If not found in file either, use default
          const defaultConfig = this.getProjectConfig('default');
          dbConfig = await Config.create({
            projectId: 'default',
            name: defaultConfig.name,
            purpose: defaultConfig.purpose,
            system_prompt: defaultConfig.system_prompt,
            domain: defaultConfig.domain,
            tone: defaultConfig.tone,
            channels: defaultConfig.channels,
            integrations: defaultConfig.integrations,
            ai: defaultConfig.ai
          });
          console.log('Created default configuration');
        }
      }
      
      return dbConfig;
    } catch (error) {
      console.error('Error getting configuration from database:', error);
      return null;
    }
  }
}

// Export a singleton instance
module.exports = new ProjectConfigManager();