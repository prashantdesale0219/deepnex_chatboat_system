const MistralClient = require('./mistralClient');
const OpenAIClient = require('./openaiClient');

class AIClientManager {
  constructor() {
    this.clients = {
      mistral: MistralClient,
      openai: OpenAIClient
    };
    
    // Default provider
    this.defaultProvider = 'mistral';
  }

  /**
   * Get the appropriate AI client based on configuration
   * @param {Object} config - Configuration object with AI settings
   * @returns {Object} - The selected AI client
   */
  getClient(config = {}) {
    // If no config or no AI config, use default
    if (!config || !config.ai || !config.ai.provider) {
      console.log(`Using default AI provider: ${this.defaultProvider}`);
      return this.clients[this.defaultProvider];
    }

    const provider = config.ai.provider.toLowerCase();
    
    // Check if the requested provider exists
    if (!this.clients[provider]) {
      console.warn(`Provider ${provider} not available, falling back to ${this.defaultProvider}`);
      return this.clients[this.defaultProvider];
    }

    console.log(`Using AI provider: ${provider}`);
    return this.clients[provider];
  }

  /**
   * Generate a response using the appropriate AI client
   * @param {string} sessionId - The session ID
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} config - Configuration object with AI settings
   * @returns {Promise<Object>} - The AI response
   */
  async generateResponse(sessionId, messages, config = {}) {
    const client = this.getClient(config);
    
    // Always enable inventory access for all bots
    // This ensures all bots can access the productinventories collection
    const inventoryAccess = true;
    
    // Extract AI-specific options from config
    const options = {
      inventoryAccess,
      model: config.ai?.model,
      temperature: config.ai?.temperature,
      max_tokens: config.ai?.max_tokens,
      system_prompt: config.system_prompt
    };
    
    return client.generateResponse(sessionId, messages, options);
  }

  /**
   * Generate a streaming response using the appropriate AI client
   * @param {string} sessionId - The session ID
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} config - Configuration object with AI settings
   * @param {Function} onChunk - Callback function for each chunk of the streaming response
   * @returns {Promise<void>}
   */
  async generateStreamingResponse(sessionId, messages, config = {}, onChunk) {
    const client = this.getClient(config);
    
    // Extract AI-specific options from config
    const options = {
      model: config.ai?.model,
      temperature: config.ai?.temperature,
      max_tokens: config.ai?.max_tokens,
      system_prompt: config.system_prompt,
      stream: true
    };
    
    return client.generateStreamingResponse(sessionId, messages, options, onChunk);
  }
}

// Export a singleton instance
module.exports = new AIClientManager();