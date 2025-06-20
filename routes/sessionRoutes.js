const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Session = require('../models/Session');
const Message = require('../models/Message');
const Config = require('../models/Config');
const User = require('../models/User');
const { ErrorResponse } = require('../middleware/errorHandler');
const aiClientManager = require('../utils/aiClientManager');
const projectConfigManager = require('../utils/projectConfigManager');

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Start a new conversation session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - configId
 *             properties:
 *               configId:
 *                 type: string
 *                 description: ID of the chatbot configuration to use
 *     responses:
 *       201:
 *         description: Session created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Configuration not found
 */
router.post('/', protect, async (req, res, next) => {
  try {
    const { configId } = req.body;
    
    // Validate MongoDB ObjectId format
    if (!configId || !configId.match(/^[0-9a-fA-F]{24}$/)) {
      return next(new ErrorResponse(`Invalid configuration ID format. Must be a valid MongoDB ObjectId.`, 400));
    }
    
    // Check if configuration exists
    const config = await Config.findById(configId);
    
    if (!config) {
      return next(new ErrorResponse(`Configuration not found with id of ${configId}`, 404));
    }
    
    // Create session
    const session = await Session.create({
      configId,
      userId: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    // Log the error for debugging
    console.error('Error in message processing:', error);
    
    // Handle specific AI-related errors with appropriate status codes
    if (error.message.includes('Authentication failed')) {
      return next(new ErrorResponse('AI service authentication failed. Please check API key configuration.', 500));
    } else if (error.message.includes('Rate limit exceeded')) {
      return next(new ErrorResponse('AI service rate limit exceeded. Please try again later.', 429));
    } else if (error.message.includes('API server error')) {
      return next(new ErrorResponse('AI service is currently unavailable. Please try again later.', 503));
    } else if (error.message.includes('Network issue')) {
      return next(new ErrorResponse('Unable to connect to AI service. Please check your network connection.', 503));
    } else if (error.message.includes('Failed to generate AI response')) {
      return next(new ErrorResponse(`Problem generating AI response: ${error.message}`, 500));
    }
    
    // For other errors, pass to the default error handler
    next(error);
  }
});

/**
 * @swagger
 * /api/sessions/project/{projectId}:
 *   post:
 *     summary: Start a new conversation session using project configuration
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project identifier to use for configuration
 *     responses:
 *       201:
 *         description: Session created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Project configuration not found
 */
router.post('/project/:projectId', protect, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // Get configuration from database for this project
    const config = await projectConfigManager.getConfigFromDatabase(projectId);
    
    if (!config) {
      return next(new ErrorResponse(`Configuration not found for project ${projectId}`, 404));
    }
    
    // Create session with the project configuration
    const session = await Session.create({
      configId: config._id,
      userId: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    // Log the error for debugging
    console.error('Error creating session with project config:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}/messages:
 *   post:
 *     summary: Send a message and get AI response
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User message content
 *     responses:
 *       200:
 *         description: AI response
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Session not found
 */
router.post('/:sessionId/messages', protect, async (req, res, next) => {
  // Function to include product inventory data in the context
  const includeInventoryData = async (session, config) => {
    try {
      // Always include inventory data regardless of config settings
      // Get product inventory data for this bot from the productinventories collection
      const inventoryProducts = await global.InventoryProduct.find({})
        .select('productName sku availableStock unit')
        .limit(200) // Increased limit to provide more comprehensive inventory access
        .lean();
      
      if (inventoryProducts && inventoryProducts.length > 0) {
        // Format inventory data for AI context with clear instructions
        const inventoryContext = `\nCurrent Product Inventory Information:\n${inventoryProducts.map(p => 
          `- ${p.productName} (SKU: ${p.sku}): ${p.availableStock} ${p.unit} available`
        ).join('\n')}\n\nInstructions for handling inventory queries:\n1. Respond in the same language as the user (Hindi or English)\n2. For inventory checks, provide accurate stock information\n3. For order requests, confirm if the requested quantity is available\n4. If a product is out of stock or not in the inventory, politely inform the user\n5. Suggest alternatives if available when a requested product is out of stock`;
        
        return inventoryContext;
      }
      return '';
    } catch (error) {
      console.error('Error fetching product inventory data:', error);
      return '';
    }
  };
  
  try {
    const { sessionId } = req.params;
    const { message, language } = req.body;
    
    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return next(new ErrorResponse(`Session not found with id of ${sessionId}`, 404));
    }
    
    // Check if user owns this session
    if (String(session.userId) !== String(req.user.id)) {
      return next(new ErrorResponse('Not authorized to access this session', 401));
    }
    
    // Update session lastActive timestamp
    session.lastActive = Date.now();
    await session.save();
    
    // Save user message
    await Message.create({
      sessionId,
      role: 'user',
      content: message
    });
    
    // Get conversation history
    const history = await Message.find({ sessionId })
      .sort({ timestamp: 1 })
      .limit(10); // Limit to last 10 messages for context
    
    // Get configuration for this session
    const config = await Config.findById(session.configId);
    
    // Add user language to config if provided
    if (language) {
      if (!config.ai) {
        config.ai = {};
      }
      config.ai.userLanguage = language;
    }
    
    // Ensure system_prompt is passed to AI client
    if (!config.system_prompt) {
      // If no system prompt is defined, create a default one based on purpose
      if (config.purpose) {
        config.system_prompt = `You are an AI assistant focused on: ${config.purpose}. Provide helpful, accurate, and relevant responses.`;
      } else {
        config.system_prompt = "You are a friendly and helpful AI assistant. Always greet the user appropriately when they say hello, hi, namaste, or any other greeting. Respond to basic greetings and questions like \"how are you\" in a conversational manner.";
      }
    }
    
    // Log the configuration being used
    console.log(`Using configuration for session ${sessionId}:`, config);
    
    // Check if we should include inventory data
    const inventoryContext = await includeInventoryData(session, config);
    
    // Prepare messages for AI, potentially including inventory context
    const aiMessages = history.map(msg => {
      // For the last user message, append inventory context if available
      if (msg.role === 'user' && msg === history[history.length - 1] && inventoryContext) {
        return {
          role: msg.role,
          content: `${msg.content}\n\n[System Note: The following inventory information is available for reference]${inventoryContext}`
        };
      }
      return {
        role: msg.role,
        content: msg.content
      };
    });
    
    // Generate AI response using the AI client manager
    // This will automatically select the appropriate AI provider based on config
    const aiResponse = await aiClientManager.generateResponse(
      sessionId,
      aiMessages,
      config
    );
    
    // Save bot message
    const botMessage = await Message.create({
      sessionId,
      role: 'bot',
      content: aiResponse.reply
    });
    
    res.status(200).json({
      success: true,
      data: {
        reply: aiResponse.reply,
        messageId: botMessage._id
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}/messages:
 *   delete:
 *     summary: Clear all messages in a conversation session
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All messages cleared successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Session not found
 */
router.delete('/:sessionId/messages', protect, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return next(new ErrorResponse(`Session not found with id of ${sessionId}`, 404));
    }
    
    // Check if user owns this session
    if (String(session.userId) !== String(req.user.id)) {
      return next(new ErrorResponse('Not authorized to access this session', 401));
    }
    
    // Delete all messages for this session
    await Message.deleteMany({ sessionId });
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'All messages cleared successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}/messages:
 *   get:
 *     summary: Get conversation history for a session
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation history
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Session not found
 */
router.get('/:sessionId/messages', protect, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return next(new ErrorResponse(`Session not found with id of ${sessionId}`, 404));
    }
    
    // Check if user owns this session
    // Convert both to strings for comparison to avoid type mismatch
    if (String(session.userId) !== String(req.user.id)) {
      return next(new ErrorResponse('Not authorized to access this session', 401));
    }
    
    // Get messages for this session
    const messages = await Message.find({ sessionId }).sort({ timestamp: 1 });
    
    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Get all sessions for the current user
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user sessions
 *       401:
 *         description: Not authorized
 */
router.get('/', protect, async (req, res, next) => {
  try {
    // Get sessions for this user
    const sessions = await Session.find({ userId: req.user.id })
      .sort({ lastActivity: -1 })
      .populate({
        path: 'configId',
        select: 'name purpose',
        // Handle invalid ObjectId references gracefully
        match: { _id: { $exists: true } }
      });
    
    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     summary: Get a single session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session details
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Session not found
 */
router.get('/:sessionId', protect, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // Get session
    const session = await Session.findById(sessionId).populate('configId', 'name purpose');
    
    if (!session) {
      return next(new ErrorResponse(`Session not found with id of ${sessionId}`, 404));
    }
    
    // Check if user owns this session
    if (session.userId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to access this session', 401));
    }
    
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   delete:
 *     summary: Delete a session and its messages
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deleted successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Session not found
 */
router.delete('/:sessionId', protect, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // Get session
    const session = await Session.findById(sessionId);
    
    if (!session) {
      return next(new ErrorResponse(`Session not found with id of ${sessionId}`, 404));
    }
    
    // Check if user owns this session
    // Convert both to strings for comparison to avoid type mismatch
    if (String(session.userId) !== String(req.user.id)) {
      return next(new ErrorResponse('Not authorized to delete this session', 401));
    }
    
    // Delete all messages in this session
    await Message.deleteMany({ sessionId });
    
    // Delete session
    await session.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/sessions/public/{sessionId}:
 *   get:
 *     summary: Get a public session by ID (no authentication required)
 *     tags: [Public Sessions]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session details
 *       404:
 *         description: Session not found
 */
router.get('/public/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // Get session
    const session = await Session.findById(sessionId).populate('configId', 'name purpose');
    
    if (!session) {
      return next(new ErrorResponse(`Session not found with id of ${sessionId}`, 404));
    }
    
    // Check if session belongs to an admin user
    const user = await User.findById(session.userId).select('role');
    if (!user || user.role !== 'admin') {
      return next(new ErrorResponse(`This session is not publicly accessible`, 403));
    }
    
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/sessions/public/{sessionId}/messages:
 *   get:
 *     summary: Get conversation history for a public session (no authentication required)
 *     tags: [Public Sessions]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation history
 *       403:
 *         description: Session not publicly accessible
 *       404:
 *         description: Session not found
 */
router.get('/public/:sessionId/messages', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return next(new ErrorResponse(`Session not found with id of ${sessionId}`, 404));
    }
    
    // Check if session belongs to an admin user
    const user = await User.findById(session.userId).select('role');
    if (!user || user.role !== 'admin') {
      return next(new ErrorResponse(`This session is not publicly accessible`, 403));
    }
    
    // Get messages for this session
    const messages = await Message.find({ sessionId }).sort({ timestamp: 1 });
    
    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/sessions/public/{sessionId}/messages:
 *   post:
 *     summary: Send a message to a public session (no authentication required)
 *     tags: [Public Sessions]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User message content
 *     responses:
 *       200:
 *         description: AI response
 *       403:
 *         description: Session not publicly accessible
 *       404:
 *         description: Session not found
 */
router.post('/public/:sessionId/messages', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { message, language } = req.body;
    
    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return next(new ErrorResponse(`Session not found with id of ${sessionId}`, 404));
    }
    
    // Check if session belongs to an admin user
    const user = await User.findById(session.userId).select('role');
    if (!user || user.role !== 'admin') {
      return next(new ErrorResponse(`This session is not publicly accessible`, 403));
    }
    
    // Update session lastActive timestamp
    session.lastActive = Date.now();
    await session.save();
    
    // Save user message
    await Message.create({
      sessionId,
      role: 'user',
      content: message
    });
    
    // Get conversation history
    const history = await Message.find({ sessionId })
      .sort({ timestamp: 1 })
      .limit(10); // Limit to last 10 messages for context
    
    // Get configuration for this session
    const config = await Config.findById(session.configId);
    
    // Add user language to config if provided
    if (language) {
      if (!config.ai) {
        config.ai = {};
      }
      config.ai.userLanguage = language;
    }
    
    // Ensure system_prompt is passed to AI client
    if (!config.system_prompt) {
      // If no system prompt is defined, create a default one based on purpose
      if (config.purpose) {
        config.system_prompt = `You are an AI assistant focused on: ${config.purpose}. Provide helpful, accurate, and relevant responses.`;
      } else {
        config.system_prompt = "You are a friendly and helpful AI assistant. Always greet the user appropriately when they say hello, hi, namaste, or any other greeting. Respond to basic greetings and questions like \"how are you\" in a conversational manner.";
      }
    }
    
    // Get inventory data for context
    const getInventoryData = async () => {
      try {
        // Get product inventory data from the productinventories collection
        const inventoryProducts = await global.InventoryProduct.find({})
          .select('productName sku availableStock unit')
          .limit(200)
          .lean();
        
        if (inventoryProducts && inventoryProducts.length > 0) {
          // Format inventory data for AI context
          const inventoryContext = `\nCurrent Product Inventory Information:\n${inventoryProducts.map(p => 
            `- ${p.productName} (SKU: ${p.sku}): ${p.availableStock} ${p.unit} available`
          ).join('\n')}\n\nInstructions for handling inventory queries:\n1. Respond in the same language as the user (Hindi or English)\n2. For inventory checks, provide accurate stock information\n3. For order requests, confirm if the requested quantity is available\n4. If a product is out of stock or not in the inventory, politely inform the user\n5. Suggest alternatives if available when a requested product is out of stock`;
          
          return inventoryContext;
        }
        return '';
      } catch (error) {
        console.error('Error fetching product inventory data:', error);
        return '';
      }
    };
    
    // Get inventory context
    const inventoryContext = await getInventoryData();
    
    // Prepare messages for AI, including inventory context
    const aiMessages = history.map((msg, index) => {
      // For the last user message, append inventory context if available
      if (msg.role === 'user' && index === history.length - 1 && inventoryContext) {
        return {
          role: msg.role,
          content: `${msg.content}\n\n[System Note: The following inventory information is available for reference]${inventoryContext}`
        };
      }
      return {
        role: msg.role,
        content: msg.content
      };
    });
    
    // Generate AI response using the AI client manager
    const aiResponse = await aiClientManager.generateResponse(
      sessionId,
      aiMessages,
      {
        ...config,
        inventoryAccess: true // Ensure inventory access is enabled
      }
    );
    
    // Save bot message
    const botMessage = await Message.create({
      sessionId,
      role: 'bot',
      content: aiResponse.reply
    });
    
    res.status(200).json({
      success: true,
      data: {
        reply: aiResponse.reply,
        messageId: botMessage._id
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;