const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Config = require('../models/Config');
const Session = require('../models/Session');

// Use global inventory models instead of direct imports
// These are set up in server.js with the separate inventory database connection
const ProductInventory = global.InventoryProduct;
const OrderRequest = global.InventoryOrder;
const { ErrorResponse } = require('../middleware/errorHandler');
const aiClientManager = require('../utils/aiClientManager');

// Fuzzy search utility
const FuzzySearch = require('fuzzy-search');

/**
 * @swagger
 * /api/chat/inventory/check:
 *   get:
 *     summary: Check product availability in inventory
 *     tags: [Chat Inventory]
 *     parameters:
 *       - in: query
 *         name: botId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the bot
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         required: true
 *         description: Product name or query to search for
 *     responses:
 *       200:
 *         description: Product availability information
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Bot or product not found
 */
router.get('/check', async (req, res, next) => {
  try {
    const { botId, query } = req.query;
    
    // Validate required fields
    if (!botId || !query) {
      return next(new ErrorResponse('Please provide bot ID and product query', 400));
    }
    
    // Check if bot exists and has inventory enabled
    const botConfig = await Config.findOne({ _id: botId });
    if (!botConfig) {
      return next(new ErrorResponse(`Bot with ID ${botId} not found`, 404));
    }
    
    if (!botConfig.inventoryEnabled) {
      return next(new ErrorResponse(`Inventory is not enabled for this bot`, 400));
    }
    
    // Get all products for this bot
    const products = await ProductInventory.find({ botId });
    
    if (products.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          found: false,
          message: 'No products available in inventory'
        }
      });
    }
    
    // Use fuzzy search to find closest matching product
    const searcher = new FuzzySearch(products, ['productName'], {
      caseSensitive: false,
      sort: true
    });
    
    const searchResults = searcher.search(query);
    
    if (searchResults.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          found: false,
          message: 'No matching products found'
        }
      });
    }
    
    // Return the best match
    const bestMatch = searchResults[0];
    
    res.status(200).json({
      success: true,
      data: {
        found: true,
        product: {
          productName: bestMatch.productName,
          sku: bestMatch.sku,
          availableStock: bestMatch.availableStock,
          unit: bestMatch.unit
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/chat/inventory/order:
 *   post:
 *     summary: Record a user order request
 *     tags: [Chat Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - botId
 *               - productName
 *               - requestedQty
 *               - userQuery
 *             properties:
 *               botId:
 *                 type: string
 *               productName:
 *                 type: string
 *               requestedQty:
 *                 type: number
 *               userQuery:
 *                 type: string
 *               userId:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order request recorded successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Bot not found
 */
router.post('/order', async (req, res, next) => {
  try {
    const { botId, productName, requestedQty, userQuery, userId, sessionId } = req.body;
    
    // Validate required fields
    if (!botId || !productName || !requestedQty || !userQuery) {
      return next(new ErrorResponse('Please provide all required fields', 400));
    }
    
    // Check if bot exists and has inventory enabled
    const botConfig = await Config.findOne({ _id: botId });
    if (!botConfig) {
      return next(new ErrorResponse(`Bot with ID ${botId} not found`, 404));
    }
    
    if (!botConfig.inventoryEnabled) {
      return next(new ErrorResponse(`Inventory is not enabled for this bot`, 400));
    }
    
    // Check if product exists
    const products = await ProductInventory.find({ botId });
    const searcher = new FuzzySearch(products, ['productName'], {
      caseSensitive: false,
      sort: true
    });
    
    const searchResults = searcher.search(productName);
    
    let matchedProduct = null;
    if (searchResults.length > 0) {
      matchedProduct = searchResults[0];
    }
    
    // Create order request
    const orderRequest = await OrderRequest.create({
      botId,
      productName: matchedProduct ? matchedProduct.productName : productName,
      requestedQty,
      userQuery,
      userId,
      sessionId,
      status: 'pending'
    });
    
    // If product exists and has enough stock, update the status
    if (matchedProduct && matchedProduct.availableStock >= requestedQty) {
      orderRequest.status = 'confirmed';
      await orderRequest.save();
      
      // Optionally, update the stock (uncomment if you want to reduce stock immediately)
      // matchedProduct.availableStock -= requestedQty;
      // await matchedProduct.save();
    }
    
    res.status(201).json({
      success: true,
      data: orderRequest
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/chat/inventory/intent:
 *   post:
 *     summary: Process inventory-related intents from user messages
 *     tags: [Chat Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - botId
 *               - message
 *               - userId
 *             properties:
 *               botId:
 *                 type: string
 *               message:
 *                 type: string
 *               userId:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Processed intent and response
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Bot not found
 */
router.post('/intent', async (req, res, next) => {
  try {
    const { botId, message, userId, sessionId } = req.body;
    
    // Validate required fields
    if (!botId || !message || !userId) {
      return next(new ErrorResponse('Please provide all required fields', 400));
    }
    
    // Check if bot exists and has inventory enabled
    const botConfig = await Config.findOne({ _id: botId });
    if (!botConfig) {
      return next(new ErrorResponse(`Bot with ID ${botId} not found`, 404));
    }
    
    if (!botConfig.inventoryEnabled) {
      return next(new ErrorResponse(`Inventory is not enabled for this bot`, 400));
    }
    
    // Get or create session
    let session;
    if (sessionId) {
      session = await Session.findById(sessionId);
      if (!session) {
        return next(new ErrorResponse(`Session with ID ${sessionId} not found`, 404));
      }
    } else {
      session = await Session.create({
        configId: botId,
        userId
      });
    }
    
    // Prepare system prompt for intent detection
    const intentDetectionPrompt = `
    You are an inventory management assistant. Analyze the user message and extract the following information:
    1. Intent: Is the user asking about product availability (inventory_check) or trying to place an order (order_intent)?
    2. Product Name: What product is the user asking about?
    3. Quantity: If the user is trying to place an order, what quantity are they requesting?
    
    The user may ask in Hindi or English. You must be able to understand both languages and extract the relevant information regardless of the language used.
    
    Examples in Hindi:
    - "क्या आपके पास लैपटॉप है?" (Intent: inventory_check, Product: laptop)
    - "मुझे 2 मोबाइल फोन चाहिए" (Intent: order_intent, Product: mobile phone, Quantity: 2)
    
    Examples in English:
    - "Do you have laptops in stock?" (Intent: inventory_check, Product: laptop)
    - "I want to order 3 printers" (Intent: order_intent, Product: printer, Quantity: 3)
    
    Respond in JSON format only with the following structure:
    {
      "intent": "inventory_check" or "order_intent" or "other",
      "productName": "extracted product name",
      "quantity": number or null if not specified
    }
    `;
    
    // Use AI to detect intent and extract entities
    const intentAnalysisMessages = [
      { role: 'system', content: intentDetectionPrompt },
      { role: 'user', content: message }
    ];
    
    const intentAnalysis = await aiClientManager.generateResponse(
      session._id.toString(),
      intentAnalysisMessages,
      { system_prompt: intentDetectionPrompt }
    );
    
    let intentData;
    try {
      intentData = JSON.parse(intentAnalysis.content);
    } catch (err) {
      intentData = {
        intent: 'other',
        productName: null,
        quantity: null
      };
    }
    
    let response = '';
    
    // Detect language (simple check for Hindi characters)
    const containsHindi = /[\u0900-\u097F]/.test(message);
    const isHindi = containsHindi;
    
    // Process based on intent
    if (intentData.intent === 'inventory_check' && intentData.productName) {
      // Check product availability
      const products = await ProductInventory.find({ botId });
      
      if (products.length === 0) {
        response = isHindi
          ? 'मुझे खेद है, इस समय इन्वेंटरी में कोई प्रोडक्ट उपलब्ध नहीं है।'
          : 'I\'m sorry, there are no products available in the inventory at this time.';
      } else {
        // Use fuzzy search to find closest matching product
        const searcher = new FuzzySearch(products, ['productName'], {
          caseSensitive: false,
          sort: true
        });
        
        const searchResults = searcher.search(intentData.productName);
        
        if (searchResults.length === 0) {
          response = isHindi
            ? `मुझे खेद है, "${intentData.productName}" नाम का कोई प्रोडक्ट नहीं मिला। कृपया दूसरे प्रोडक्ट के बारे में पूछें।`
            : `I'm sorry, no product named "${intentData.productName}" was found. Please ask about another product.`;
        } else {
          const product = searchResults[0];
          if (product.availableStock > 0) {
            response = isHindi
              ? `हां, ${product.productName} उपलब्ध है। वर्तमान में ${product.availableStock} ${product.unit} स्टॉक में हैं। कितने चाहिए?`
              : `Yes, ${product.productName} is available. There are currently ${product.availableStock} ${product.unit} in stock. How many would you like?`;
          } else {
            response = isHindi
              ? `मुझे खेद है, ${product.productName} वर्तमान में स्टॉक में नहीं है।`
              : `I'm sorry, ${product.productName} is currently out of stock.`;
          }
        }
      }
    } else if (intentData.intent === 'order_intent' && intentData.productName && intentData.quantity) {
      // Process order intent
      const products = await ProductInventory.find({ botId });
      
      if (products.length === 0) {
        response = isHindi
          ? 'मुझे खेद है, इस समय इन्वेंटरी में कोई प्रोडक्ट उपलब्ध नहीं है।'
          : 'I\'m sorry, there are no products available in the inventory at this time.';
      } else {
        // Use fuzzy search to find closest matching product
        const searcher = new FuzzySearch(products, ['productName'], {
          caseSensitive: false,
          sort: true
        });
        
        const searchResults = searcher.search(intentData.productName);
        
        if (searchResults.length === 0) {
          response = isHindi
            ? `मुझे खेद है, "${intentData.productName}" नाम का कोई प्रोडक्ट नहीं मिला। कृपया दूसरे प्रोडक्ट के बारे में पूछें।`
            : `I'm sorry, no product named "${intentData.productName}" was found. Please ask about another product.`;
        } else {
          const product = searchResults[0];
          
          if (product.availableStock >= intentData.quantity) {
            // Create order request
            await OrderRequest.create({
              botId,
              productName: product.productName,
              requestedQty: intentData.quantity,
              userQuery: message,
              userId,
              sessionId: session._id,
              status: 'confirmed'
            });
            
            response = isHindi
              ? `आपका ऑर्डर रिकॉर्ड कर लिया गया है। ${intentData.quantity} ${product.unit} ${product.productName} के लिए आपका ऑर्डर कन्फर्म हो गया है। हमारी टीम जल्द ही आपसे संपर्क करेगी।`
              : `Your order has been recorded. Your order for ${intentData.quantity} ${product.unit} of ${product.productName} has been confirmed. Our team will contact you soon.`;
          } else if (product.availableStock > 0) {
            response = isHindi
              ? `मुझे खेद है, ${product.productName} के केवल ${product.availableStock} ${product.unit} ही उपलब्ध हैं। क्या आप कम मात्रा में ऑर्डर करना चाहेंगे?`
              : `I'm sorry, only ${product.availableStock} ${product.unit} of ${product.productName} are available. Would you like to order a smaller quantity?`;
          } else {
            response = isHindi
              ? `मुझे खेद है, ${product.productName} वर्तमान में स्टॉक में नहीं है।`
              : `I'm sorry, ${product.productName} is currently out of stock.`;
          }
        }
      }
    } else {
      // Unknown intent or missing information
      response = isHindi
        ? 'मैं आपकी सहायता करने के लिए हूं। आप किसी प्रोडक्ट की उपलब्धता के बारे में पूछ सकते हैं या ऑर्डर प्लेस कर सकते हैं।'
        : 'I am here to help you. You can ask about product availability or place an order.';
    }
    
    res.status(200).json({
      success: true,
      data: {
        intent: intentData,
        response
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;