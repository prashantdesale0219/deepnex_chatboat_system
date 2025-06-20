const axios = require('axios');

class OpenAIClient {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  /**
   * Generate a response from OpenAI
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
      
      while (retries < maxRetries) {
        try {
          // Use custom system prompt from config if available
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
          
          response = await this.client.post('/chat/completions', {
            model: options.model || 'gpt-3.5-turbo',
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
            throw error; // Don't retry, propagate the error
          }
          
          retries++;
          if (retries >= maxRetries) {
            throw error; // Max retries reached, propagate the error
          }
          
          // Log retry attempt
          console.log(`Retrying OpenAI request (${retries}/${maxRetries}) after error: ${error.message}`);
          
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Log API call latency
      const latency = Date.now() - startTime;
      console.log(`OpenAI API call completed in ${latency}ms`);
      
      return {
        reply: response.data.choices[0].message.content,
        model: response.data.model,
        usage: response.data.usage
      };
    } catch (error) {
      console.error('Error generating OpenAI response:', error);
      
      // Provide more specific error messages based on the error type
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('OpenAI API Error Status:', error.response.status);
        console.error('OpenAI API Error Data:', error.response.data);
        
        if (error.response.status === 401) {
          throw new Error('OpenAI API key is invalid or expired');
        } else if (error.response.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else if (error.response.status >= 500) {
          throw new Error('OpenAI API server error. Please try again later.');
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('OpenAI API No Response:', error.request);
        throw new Error('No response received from OpenAI API. Please check your network connection.');
      }
      
      // Generic error for other cases
      throw new Error('Failed to generate OpenAI response: ' + error.message);
    }
  }

  /**
   * Generate a streaming response from OpenAI
   * @param {string} sessionId - The session ID
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Additional options for the API call
   * @param {Function} onChunk - Callback function for each chunk of the streaming response
   * @returns {Promise<void>}
   */
  async generateStreamingResponse(sessionId, messages, options = {}, onChunk) {
    try {
      const startTime = Date.now();
      
      // Configure request with retry logic
      const maxRetries = 3;
      let retries = 0;
      
      while (retries < maxRetries) {
        try {
          const response = await this.client.post('/chat/completions', {
            model: options.model || 'gpt-3.5-turbo',
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
          
          // Process the streaming response
          response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              if (line.includes('[DONE]')) {
                onChunk({ done: true });
                return;
              }
              
              try {
                const jsonData = JSON.parse(line.replace(/^data: /, '').trim());
                const content = jsonData.choices[0]?.delta?.content;
                
                if (content) {
                  onChunk({ content });
                }
              } catch (err) {
                console.error('Error parsing streaming data:', err);
              }
            }
          });
          
          response.data.on('end', () => {
            const latency = Date.now() - startTime;
            console.log(`OpenAI streaming API call completed in ${latency}ms`);
            onChunk({ done: true });
          });
          
          return; // Success, exit function
        } catch (error) {
          // Check if we should retry based on the error type
          const shouldRetry = this._shouldRetryRequest(error);
          
          if (!shouldRetry) {
            throw error; // Don't retry, propagate the error
          }
          
          retries++;
          if (retries >= maxRetries) {
            throw error; // Max retries reached, propagate the error
          }
          
          // Log retry attempt
          console.log(`Retrying OpenAI streaming request (${retries}/${maxRetries}) after error: ${error.message}`);
          
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      console.error('Error generating OpenAI streaming response:', error);
      
      // Provide more specific error messages based on the error type
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('OpenAI API Error Status:', error.response.status);
        console.error('OpenAI API Error Data:', error.response.data);
        
        if (error.response.status === 401) {
          onChunk({ error: 'OpenAI API key is invalid or expired' });
        } else if (error.response.status === 429) {
          onChunk({ error: 'OpenAI API rate limit exceeded. Please try again later.' });
        } else if (error.response.status >= 500) {
          onChunk({ error: 'OpenAI API server error. Please try again later.' });
        } else {
          onChunk({ error: `OpenAI API error: ${error.response.status}` });
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('OpenAI API No Response:', error.request);
        onChunk({ error: 'No response received from OpenAI API. Please check your network connection.' });
      } else {
        // Generic error for other cases
        onChunk({ error: 'Failed to generate OpenAI streaming response: ' + error.message });
      }
    }
  }

  /**
   * Determine if a request should be retried based on the error
   * @private
   * @param {Error} error - The error that occurred
   * @returns {boolean} - Whether the request should be retried
   */
  _shouldRetryRequest(error) {
    // Don't retry client errors (except rate limiting)
    if (error.response) {
      const status = error.response.status;
      
      // Don't retry 400 (Bad Request), 401 (Unauthorized), or 404 (Not Found)
      if (status === 400 || status === 401 || status === 404) {
        // Check for model not found errors specifically
        if (status === 404 && error.response.data && 
            error.response.data.error && 
            error.response.data.error.message && 
            error.response.data.error.message.includes('model')) {
          console.error('Model not found error, not retrying:', error.response.data.error.message);
          return false;
        }
        return false;
      }
      
      // Retry on rate limiting (429) or server errors (5xx)
      return status === 429 || status >= 500;
    }
    
    // Retry on network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNABORTED' || 
        error.message.includes('timeout')) {
      return true;
    }
    
    // Don't retry other errors
    return false;
  }
}

// Export a singleton instance
module.exports = new OpenAIClient();