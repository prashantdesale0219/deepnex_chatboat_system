const aiClientManager = require('./aiClientManager');

class PromptEnhancer {
  constructor() {
    // Default enhancement instructions
    this.defaultEnhancementInstructions = `
You are an expert prompt engineer. Your task is to enhance the given prompt to make it more detailed, specific, and effective.

Follow these guidelines to enhance the prompt:
1. Expand on the core concepts and ideas in the original prompt
2. Add specific instructions for tone, style, and format
3. Include clear constraints and boundaries
4. Provide examples or templates where appropriate
5. Ensure the enhanced prompt maintains the original intent
6. Make the prompt more detailed and comprehensive
7. Add context and background information
8. Specify the desired output format
9. Include any relevant domain-specific terminology

Your enhanced prompt should be significantly more detailed and effective than the original while preserving its core purpose.
`;
  }

  /**
   * Enhance a prompt using AI
   * @param {string} originalPrompt - The original prompt to enhance
   * @param {Object} config - Configuration object with AI settings
   * @returns {Promise<string>} - The enhanced prompt
   */
  async enhancePrompt(originalPrompt, config = {}) {
    try {
      if (!originalPrompt || originalPrompt.trim() === '') {
        throw new Error('Original prompt is required');
      }

      // Create a unique session ID for this enhancement request
      const sessionId = `enhance_${Date.now()}`;
      
      // Prepare the message for the AI
      const messages = [
        {
          role: 'user',
          content: `${this.defaultEnhancementInstructions}\n\nOriginal Prompt: ${originalPrompt}\n\nEnhanced Prompt:`
        }
      ];
      
      // Use a higher temperature for more creative enhancements
      const enhancementConfig = {
        ...config,
        ai: {
          ...config.ai,
          temperature: 0.8,  // Slightly higher temperature for creativity
          max_tokens: 2000   // Allow for longer responses
        },
        system_prompt: 'You are an expert prompt engineer specializing in enhancing prompts to make them more detailed and effective.'
      };
      
      // Generate the enhanced prompt
      const response = await aiClientManager.generateResponse(sessionId, messages, enhancementConfig);
      
      return response.reply.trim();
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      throw error;
    }
  }

  /**
   * Enhance a system prompt with configuration context
   * @param {string} originalPrompt - The original prompt to enhance
   * @param {Object} config - Configuration object with chatbot settings
   * @returns {Promise<string>} - The enhanced prompt with configuration context
   */
  async enhanceSystemPrompt(originalPrompt, config) {
    try {
      if (!originalPrompt || originalPrompt.trim() === '') {
        throw new Error('Original prompt is required');
      }

      if (!config) {
        throw new Error('Configuration is required');
      }

      // Extract configuration details
      const configName = config.name || 'Assistant';
      const configPurpose = config.purpose || 'helping users';
      const configDomain = config.domain || [];
      const configTone = config.tone || { style: 'professional', language: 'en' };
      const inventoryEnabled = config.inventoryEnabled || false;
      const businessName = config.businessName || 'our business';
      
      // Create a unique session ID for this enhancement request
      const sessionId = `enhance_system_${Date.now()}`;
      
      // Prepare the message for the AI with configuration context
      let promptContent = `You are an expert prompt engineer. Your task is to enhance the given system prompt for a chatbot named "${configName}" with the primary purpose of ${configPurpose}. The chatbot specializes in the ${configDomain.join(', ')} domain(s) and communicates in a ${configTone?.style || 'professional'} tone using ${configTone?.language || 'English'} language.`;
      
      // Add inventory management context if enabled
      if (inventoryEnabled) {
        promptContent += `\n\nThis chatbot has inventory management capabilities for ${businessName}. It can:\n1. Check product availability in inventory\n2. Process order requests from users\n3. Understand user intent related to inventory queries\n4. Provide information about product stock levels\n5. Help users place orders for available products\n\nWhen users ask about products or want to place orders, the chatbot should be helpful and provide accurate information about product availability. The chatbot has access to the 'productinventories' collection in MongoDB which contains product information such as name, SKU, available stock, and unit of measurement.\n\nThe chatbot should respond in the same language as the user. If the user speaks in Hindi, respond in Hindi. If they speak in English, respond in English.`;
      }
      
      promptContent += `\n\nOriginal System Prompt: ${originalPrompt}\n\nPlease enhance this system prompt to make it more detailed, specific, and effective. Incorporate the chatbot's name, purpose, domain, and tone into the enhanced prompt. Make sure the enhanced prompt provides clear instructions for the AI to follow.`;
      
      // Add inventory-specific instructions if enabled
      if (inventoryEnabled) {
        promptContent += `\n\nInclude specific instructions for handling inventory-related queries, such as:\n1. How to respond when users ask about product availability\n2. How to handle order requests\n3. How to respond when products are out of stock\n4. How to guide users through the ordering process\n5. How to provide information about product details (name, SKU, available stock, unit)\n6. How to suggest alternatives if a requested product is unavailable\n7. How to respond in the user's preferred language (Hindi or English)\n8. How to handle quantity-related questions\n\nThe chatbot should be able to access the 'productinventories' collection in MongoDB to provide accurate and up-to-date information about product availability.`;
      }
      
      promptContent += `\n\nEnhanced System Prompt:`;
      
      const messages = [
        {
          role: 'user',
          content: promptContent
        }
      ];
      
      // Use a balanced temperature for system prompt enhancement
      const enhancementConfig = {
        ...config,
        ai: {
          ...config.ai,
          temperature: 0.5,  // More balanced temperature for system prompts
          max_tokens: 2000   // Allow for longer responses
        },
        system_prompt: 'You are an expert prompt engineer specializing in enhancing system prompts for AI assistants.'
      };
      
      // Generate the enhanced system prompt
      const response = await aiClientManager.generateResponse(sessionId, messages, enhancementConfig);
      
      return response.reply.trim();
    } catch (error) {
      console.error('Error enhancing system prompt:', error);
      throw error;
    }
  }
}

// Export a singleton instance
module.exports = new PromptEnhancer();