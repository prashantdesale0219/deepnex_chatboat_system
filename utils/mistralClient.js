const axios = require('axios');

class MistralClient {
  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY;
    this.apiUrl = process.env.MISTRAL_API_URL || 'https://api.mistral.ai/v1';
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  /**
   * Generate a response from Mistral AI
   * @param {string} sessionId - The session ID
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Additional options for the API call
   * @returns {Promise<Object>} - The AI response
   */
  async generateResponse(sessionId, messages, options = {}) {
    try {
      const startTime = Date.now();
      
      // Configure request with retry logic
      const maxRetries = 3;
      let retries = 0;
      let response;
      
      // Use custom system prompt from config if available, otherwise use default
      let systemPrompt = "You are a helpful AI assistant.";
      
      // If config has a system_prompt, use it
      if (options.system_prompt) {
        systemPrompt = options.system_prompt;
      }
      // If user language is provided, add language instruction to system prompt
      else if (options.userLanguage) {
        systemPrompt = `You are a friendly and helpful AI assistant. Always greet the user appropriately when they say hello, hi, namaste, or any other greeting. Respond to basic greetings and questions like "how are you" in a conversational manner. Please respond in the same language as the user. If the user speaks in Hindi, respond in Hindi. If they speak in English, respond in English. If they speak in any other language, try to respond in that same language.`;
      }
      
      // Add product inventory access information to system prompt
      if (options.inventoryAccess) {
        systemPrompt += `\n\nIMPORTANT INSTRUCTION: You have access to the product inventory information from the 'productinventories' collection. You MUST ONLY provide information about products that are available in the inventory data. If a user asks about a product or any information that is not in the inventory data, you MUST respond that you don't have that information or the product is not available in your inventory. DO NOT provide any information from your general knowledge about products, specifications, or any other details that are not explicitly mentioned in the inventory data provided to you. Always check if the product exists in the inventory before responding.\n\nWhen a user asks about product availability, you should respond in the same language as the user. If the user speaks in Hindi, respond in Hindi. If they speak in English, respond in English.\n\nFor product inventory queries, you can help users with:\n1. Checking if a product is available in stock\n2. Providing information about available quantity\n3. Helping place orders for available products\n4. Suggesting alternatives if a product is out of stock\n\nThe product inventory database contains information such as product name, SKU, available stock, and unit of measurement.`;
      }
      
      while (retries < maxRetries) {
        try {
          response = await this.client.post('/chat/completions', {
            model: options.model || 'mistral-small',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(msg => ({
                role: msg.role === 'bot' ? 'assistant' : 'user',
                content: msg.content
              }))
            ],
            temperature: options.temperature || 0.7,
            max_tokens: options.max_tokens || 1000,
            stream: options.stream || false
          });
          
          break; // Success, exit retry loop
        } catch (error) {
          // Check if we should retry based on the error type
          const shouldRetry = this._shouldRetryRequest(error);
          
          if (!shouldRetry) {
            throw error; // Don't retry for certain errors
          }
          
          retries++;
          if (retries >= maxRetries) {
            throw error; // Max retries reached, throw the error
          }
          
          // Log retry attempt
          console.log(`Retrying Mistral API call (${retries}/${maxRetries}) for session ${sessionId} after error: ${error.message}`);
          
          // Exponential backoff with jitter for better distribution
          const baseDelay = Math.pow(2, retries) * 1000;
          const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
          const delay = baseDelay + jitter;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Log metrics
      console.log(`Mistral API call completed in ${latency}ms for session ${sessionId}`);
      
      return {
        reply: response.data.choices[0].message.content,
        model: response.data.model,
        usage: response.data.usage,
        latency
      };
    } catch (error) {
      // Log detailed error information
      console.error('Error calling Mistral API:', error.response?.data || error.message);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        config: error.config
      });
      
      // Handle specific error cases
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.status === 401) {
          throw new Error('Authentication failed: Invalid API key');
        } else if (error.response.status === 429) {
          throw new Error('Rate limit exceeded: Too many requests');
        } else if (error.response.status >= 500) {
          throw new Error('Mistral API server error: Please try again later');
        }
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response from Mistral API: Network issue or service unavailable');
      }
      
      // Generic error with more context
      throw new Error(`Failed to generate AI response: ${error.message}`);
    }
  }

  /**
   * Generate a streaming response from Mistral AI
   * @param {string} sessionId - The session ID
   * @param {Array} messages - Array of message objects with role and content
   * @param {function} onChunk - Callback function for each chunk of the stream
   * @param {Object} options - Additional options for the API call
   * @returns {Promise<void>}
   */
  async generateStreamingResponse(sessionId, messages, onChunk, options = {}) {
    try {
      // Configure request with retry logic
      const maxRetries = 3;
      let retries = 0;
      let response;
      
      while (retries < maxRetries) {
        try {
          response = await this.client.post('/chat/completions', {
            model: options.model || 'mistral-small',
            messages: messages.map(msg => ({
              role: msg.role === 'bot' ? 'assistant' : 'user',
              content: msg.content
            })),
            temperature: options.temperature || 0.7,
            max_tokens: options.max_tokens || 1000,
            stream: true
          }, {
            responseType: 'stream'
          });
          
          break; // Success, exit retry loop
        } catch (error) {
          // Check if we should retry based on the error type
          const shouldRetry = this._shouldRetryRequest(error);
          
          if (!shouldRetry) {
            throw error; // Don't retry for certain errors
          }
          
          retries++;
          if (retries >= maxRetries) {
            throw error; // Max retries reached, throw the error
          }
          
          // Log retry attempt
          console.log(`Retrying Mistral API streaming call (${retries}/${maxRetries}) for session ${sessionId} after error: ${error.message}`);
          
          // Exponential backoff with jitter for better distribution
          const baseDelay = Math.pow(2, retries) * 1000;
          const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
          const delay = baseDelay + jitter;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      response.data.on('data', (chunk) => {
        // Parse the chunk and call the callback
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.includes('data:')) {
            const data = line.replace('data:', '').trim();
            if (data === '[DONE]') {
              onChunk(null, true); // Signal completion
            } else {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                if (content) {
                  onChunk(content, false);
                }
              } catch (e) {
                console.error('Error parsing streaming response:', e);
              }
            }
          }
        }
      });

      response.data.on('end', () => {
        console.log(`Streaming completed for session ${sessionId}`);
      });

    } catch (error) {
      // Log detailed error information
      console.error('Error in streaming response:', error.response?.data || error.message);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        config: error.config
      });
      
      // Handle specific error cases
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.status === 401) {
          throw new Error('Authentication failed: Invalid API key');
        } else if (error.response.status === 429) {
          throw new Error('Rate limit exceeded: Too many requests');
        } else if (error.response.status >= 500) {
          throw new Error('Mistral API server error: Please try again later');
        }
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response from Mistral API: Network issue or service unavailable');
      }
      
      // Generic error with more context
      throw new Error(`Failed to generate streaming AI response: ${error.message}`);
    }
  }

  /**
   * Determine if a request should be retried based on the error
   * @private
   * @param {Error} error - The error that occurred
   * @returns {boolean} - Whether the request should be retried
   */
  _shouldRetryRequest(error) {
    // Don't retry for authentication errors (invalid API key)
    if (error.response && error.response.status === 401) {
      return false;
    }
    
    // Don't retry for bad requests (invalid parameters)
    if (error.response && error.response.status === 400) {
      return false;
    }
    
    // Don't retry if the model doesn't exist
    if (error.response && 
        error.response.status === 404 || 
        (error.response.data && error.response.data.error && 
         error.response.data.error.includes('model not found'))) {
      return false;
    }
    
    // Retry for rate limiting (with appropriate backoff)
    if (error.response && error.response.status === 429) {
      return true;
    }
    
    // Retry for server errors
    if (error.response && error.response.status >= 500) {
      return true;
    }
    
    // Retry for network errors (ECONNRESET, ETIMEDOUT, etc.)
    if (error.code && [
      'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN'
    ].includes(error.code)) {
      return true;
    }
    
    // By default, retry
    return true;
  }
}

module.exports = new MistralClient();