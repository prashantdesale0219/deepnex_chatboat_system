const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { protect } = require('../middleware/auth');
const Session = require('../models/Session');
const Message = require('../models/Message');
const Config = require('../models/Config');
const { ErrorResponse } = require('../middleware/errorHandler');
const aiClientManager = require('../utils/aiClientManager');

/**
 * @swagger
 * /api/webhook:
 *   post:
 *     summary: Generic webhook endpoint for external channel integration
 *     tags: [Webhook]
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
 *               - userId
 *               - message
 *             properties:
 *               configId:
 *                 type: string
 *                 description: ID of the chatbot configuration to use
 *               userId:
 *                 type: string
 *                 description: External user identifier
 *               message:
 *                 type: string
 *                 description: User message content
 *               sessionId:
 *                 type: string
 *                 description: Optional existing session ID
 *               channel:
 *                 type: string
 *                 description: Source channel (e.g., slack, whatsapp)
 *     responses:
 *       200:
 *         description: AI response
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Configuration or session not found
 */
router.post('/', protect, async (req, res, next) => {
  try {
    const { configId, userId, message, sessionId, channel = 'api' } = req.body;
    
    // Validate required fields
    if (!configId || !userId || !message) {
      return next(new ErrorResponse('Please provide configId, userId, and message', 400));
    }
    
    // Check if configuration exists
    const config = await Config.findById(configId);
    if (!config) {
      return next(new ErrorResponse(`Configuration not found with id of ${configId}`, 404));
    }
    
    let session;
    
    // If sessionId is provided, use existing session
    if (sessionId) {
      session = await Session.findById(sessionId);
      if (!session) {
        return next(new ErrorResponse(`Session not found with id of ${sessionId}`, 404));
      }
      
      // Update session last activity
      session.lastActivity = Date.now();
      await session.save();
    } else {
      // Create new session
      session = await Session.create({
        configId,
        userId
      });
    }
    
    // Save user message
    const userMessage = await Message.create({
      sessionId: session._id,
      role: 'user',
      content: message
    });
    
    // Get conversation history
    const history = await Message.find({ sessionId: session._id })
      .sort({ timestamp: 1 })
      .limit(10); // Limit to last 10 messages for context
    
    // Configuration is already retrieved above, no need to fetch again
    
    // Log the configuration being used
    console.log(`Using configuration for webhook session ${session._id}:`, config);
    
    // Check if this is an inventory-related query and if inventory is enabled
    let aiResponse;
    
    if (config.inventoryEnabled) {
      try {
        // Try to detect inventory intent
        const inventoryIntentResponse = await fetch(`${req.protocol}://${req.get('host')}/api/chat/inventory/intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            botId: configId,
            message,
            sessionId: session._id,
            userId
          })
        });
        
        const inventoryResult = await inventoryIntentResponse.json();
        
        // If inventory intent was detected and processed successfully
        if (inventoryResult.success && inventoryResult.intent !== 'other') {
          // Use the inventory response
          aiResponse = {
            reply: inventoryResult.message
          };
        } else {
          // No inventory intent detected, proceed with normal AI response
          aiResponse = await aiClientManager.generateResponse(
            session._id,
            history,
            config
          );
        }
      } catch (inventoryError) {
        console.error('Error processing inventory intent:', inventoryError);
        
        // Fallback to normal AI response
        aiResponse = await aiClientManager.generateResponse(
          session._id,
          history,
          config
        );
      }
    } else {
      // Inventory not enabled, proceed with normal AI response
      aiResponse = await aiClientManager.generateResponse(
        session._id,
        history,
        config
      );
    }
    
    // Save bot message
    const botMessage = await Message.create({
      sessionId: session._id,
      role: 'bot',
      content: aiResponse.reply
    });
    
    res.status(200).json({
      success: true,
      data: {
        sessionId: session._id,
        reply: aiResponse.reply,
        messageId: botMessage._id,
        channel
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;