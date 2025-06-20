const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Config = require('../models/Config');

// Use global inventory models instead of direct imports
// These are set up in server.js with the separate inventory database connection
const ProductInventory = global.InventoryProduct;
const OrderRequest = global.InventoryOrder;
const { ErrorResponse } = require('../middleware/errorHandler');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Set up multer for CSV file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/csv');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `inventory-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only CSV files
    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      return cb(new ErrorResponse('Please upload a CSV file', 400), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 1024 * 1024 * 5 } // 5MB max file size
});

/**
 * @swagger
 * /api/admin/inventory/add:
 *   post:
 *     summary: Add a single inventory item
 *     tags: [Admin Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - botId
 *               - productName
 *               - sku
 *               - availableStock
 *               - unit
 *             properties:
 *               botId:
 *                 type: string
 *               productName:
 *                 type: string
 *               sku:
 *                 type: string
 *               availableStock:
 *                 type: number
 *               unit:
 *                 type: string
 *     responses:
 *       201:
 *         description: Inventory item created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Bot configuration not found
 */
router.post('/add', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { botId, productName, sku, availableStock, unit } = req.body;
    
    // Validate required fields
    if (!botId || !productName || !sku || availableStock === undefined) {
      return next(new ErrorResponse('Please provide all required fields', 400));
    }
    
    // Check if bot exists and has inventory enabled
    const botConfig = await Config.findOne({ _id: botId });
    if (!botConfig) {
      return next(new ErrorResponse(`Bot with ID ${botId} not found`, 404));
    }
    
    // Enable inventory for this bot if not already enabled
    if (!botConfig.inventoryEnabled) {
      await Config.findByIdAndUpdate(botId, { inventoryEnabled: true });
    }
    
    // Check if product with same SKU already exists for this bot
    const existingProduct = await ProductInventory.findOne({ botId, sku });
    if (existingProduct) {
      return next(new ErrorResponse(`Product with SKU ${sku} already exists for this bot`, 400));
    }
    
    // Create new inventory item
    const inventoryItem = await ProductInventory.create({
      botId,
      productName,
      sku,
      availableStock,
      unit: unit || 'pcs'
    });
    
    res.status(201).json({
      success: true,
      data: inventoryItem
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/admin/inventory/upload:
 *   post:
 *     summary: Upload inventory items via CSV
 *     tags: [Admin Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - botId
 *               - file
 *             properties:
 *               botId:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Inventory items uploaded successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Bot configuration not found
 */
router.post('/upload', protect, authorize('admin'), upload.single('file'), async (req, res, next) => {
  try {
    const { botId } = req.body;
    
    // Validate botId
    if (!botId) {
      return next(new ErrorResponse('Please provide a bot ID', 400));
    }
    
    // Check if bot exists
    const botConfig = await Config.findOne({ _id: botId });
    if (!botConfig) {
      return next(new ErrorResponse(`Bot with ID ${botId} not found`, 404));
    }
    
    // Enable inventory for this bot if not already enabled
    if (!botConfig.inventoryEnabled) {
      await Config.findByIdAndUpdate(botId, { inventoryEnabled: true });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return next(new ErrorResponse('Please upload a CSV file', 400));
    }
    
    const results = [];
    const errors = [];
    
    // Process CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', async (data) => {
        // Validate required fields
        if (!data.productName || !data.sku || !data.availableStock) {
          errors.push(`Row with SKU ${data.sku || 'unknown'} is missing required fields`);
          return;
        }
        
        try {
          // Check if product already exists
          const existingProduct = await ProductInventory.findOne({ botId, sku: data.sku });
          
          if (existingProduct) {
            // Update existing product
            existingProduct.productName = data.productName;
            existingProduct.availableStock = parseInt(data.availableStock, 10);
            existingProduct.unit = data.unit || 'pcs';
            existingProduct.updatedAt = Date.now();
            
            await existingProduct.save();
            results.push({ sku: data.sku, status: 'updated' });
          } else {
            // Create new product
            await ProductInventory.create({
              botId,
              productName: data.productName,
              sku: data.sku,
              availableStock: parseInt(data.availableStock, 10),
              unit: data.unit || 'pcs'
            });
            
            results.push({ sku: data.sku, status: 'created' });
          }
        } catch (err) {
          errors.push(`Error processing row with SKU ${data.sku}: ${err.message}`);
        }
      })
      .on('end', () => {
        // Clean up the uploaded file
        fs.unlinkSync(req.file.path);
        
        res.status(200).json({
          success: true,
          data: {
            processed: results.length,
            created: results.filter(r => r.status === 'created').length,
            updated: results.filter(r => r.status === 'updated').length,
            errors: errors.length > 0 ? errors : null
          }
        });
      });
  } catch (err) {
    // Clean up the uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    next(err);
  }
});

/**
 * @swagger
 * /api/admin/inventory/update-stock:
 *   patch:
 *     summary: Update stock for a specific product
 *     tags: [Admin Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - botId
 *               - sku
 *               - availableStock
 *             properties:
 *               botId:
 *                 type: string
 *               sku:
 *                 type: string
 *               availableStock:
 *                 type: number
 *     responses:
 *       200:
 *         description: Stock updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Product not found
 */
router.patch('/update-stock', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { botId, sku, availableStock } = req.body;
    
    // Validate required fields
    if (!botId || !sku || availableStock === undefined) {
      return next(new ErrorResponse('Please provide all required fields', 400));
    }
    
    // Find the product
    const product = await ProductInventory.findOne({ botId, sku });
    if (!product) {
      return next(new ErrorResponse(`Product with SKU ${sku} not found for bot ${botId}`, 404));
    }
    
    // Update stock
    product.availableStock = availableStock;
    product.updatedAt = Date.now();
    await product.save();
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/admin/inventory/list/{botId}:
 *   get:
 *     summary: Get all inventory items for a specific bot
 *     tags: [Admin Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the bot
 *     responses:
 *       200:
 *         description: List of inventory items
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Bot not found
 */
router.get('/list/:botId', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { botId } = req.params;
    
    // Check if bot exists
    const botConfig = await Config.findOne({ _id: botId });
    if (!botConfig) {
      return next(new ErrorResponse(`Bot with ID ${botId} not found`, 404));
    }
    
    // Get all inventory items for this bot
    const inventoryItems = await ProductInventory.find({ botId }).sort('productName');
    
    res.status(200).json({
      success: true,
      count: inventoryItems.length,
      data: inventoryItems
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/admin/inventory/orders/{botId}:
 *   get:
 *     summary: Get all order requests for a specific bot
 *     tags: [Admin Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the bot
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, rejected]
 *         description: Filter orders by status
 *     responses:
 *       200:
 *         description: List of order requests
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Bot not found
 */
router.get('/orders/:botId', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { botId } = req.params;
    const { status } = req.query;
    
    // Check if bot exists
    const botConfig = await Config.findOne({ _id: botId });
    if (!botConfig) {
      return next(new ErrorResponse(`Bot with ID ${botId} not found`, 404));
    }
    
    // Build query
    const query = { botId };
    if (status) {
      query.status = status;
    }
    
    // Get all order requests for this bot
    const orderRequests = await OrderRequest.find(query)
      .sort({ timestamp: -1 })
      .populate('sessionId', 'startedAt');
    
    res.status(200).json({
      success: true,
      count: orderRequests.length,
      data: orderRequests
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/admin/inventory/order/{id}:
 *   patch:
 *     summary: Update order request status
 *     tags: [Admin Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the order request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, rejected]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Order request not found
 */
router.patch('/order/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    // Validate status
    if (!status || !['pending', 'confirmed', 'rejected'].includes(status)) {
      return next(new ErrorResponse('Please provide a valid status', 400));
    }
    
    // Find the order request
    const orderRequest = await OrderRequest.findById(id);
    if (!orderRequest) {
      return next(new ErrorResponse(`Order request with ID ${id} not found`, 404));
    }
    
    // Update order request
    orderRequest.status = status;
    if (notes) {
      orderRequest.notes = notes;
    }
    
    await orderRequest.save();
    
    // If order is confirmed, update inventory (optional)
    if (status === 'confirmed') {
      const product = await ProductInventory.findOne({
        botId: orderRequest.botId,
        productName: orderRequest.productName
      });
      
      if (product && product.availableStock >= orderRequest.requestedQty) {
        product.availableStock -= orderRequest.requestedQty;
        await product.save();
      }
    }
    
    res.status(200).json({
      success: true,
      data: orderRequest
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;