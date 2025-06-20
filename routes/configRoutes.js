const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Config = require('../models/Config');
const { ErrorResponse } = require('../middleware/errorHandler');
const projectConfigManager = require('../utils/projectConfigManager');
const { upload, extractTextFromPDF } = require('../middleware/fileUpload');
const promptEnhancer = require('../utils/promptEnhancer');
const path = require('path');

/**
 * @swagger
 * /api/configs:
 *   post:
 *     summary: Create a new chatbot configuration
 *     tags: [Configurations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - purpose
 *             properties:
 *               name:
 *                 type: string
 *               purpose:
 *                 type: string
 *               system_prompt:
 *                 type: string
 *                 description: Custom system prompt for the AI model
 *               domain:
 *                 type: array
 *                 items:
 *                   type: string
 *               tone:
 *                 type: object
 *                 properties:
 *                   style:
 *                     type: string
 *                     enum: [formal, casual, friendly, professional, technical]
 *                   language:
 *                     type: string
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *               integrations:
 *                 type: array
 *                 items:
 *                   type: string
 *               ai:
 *                 type: object
 *                 properties:
 *                   provider:
 *                     type: string
 *                     enum: [mistral, openai]
 *                     description: AI provider to use (mistral or openai)
 *                   model:
 *                     type: string
 *                     description: Model name to use (e.g., mistral-small, gpt-3.5-turbo)
 *                   temperature:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                     description: Controls randomness (0-1, lower is more deterministic)
 *                   max_tokens:
 *                     type: integer
 *                     description: Maximum tokens to generate in the response
 *     responses:
 *       201:
 *         description: Configuration created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 */
router.post('/', protect, async (req, res, next) => {
  try {
    const config = await Config.create(req.body);
    res.status(201).json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/configs/upload-pdf/{configId}:
 *   post:
 *     summary: Upload a PDF file for a configuration
 *     tags: [Configurations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the configuration
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to upload
 *     responses:
 *       200:
 *         description: PDF uploaded and processed successfully
 *       400:
 *         description: Invalid input or file format
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Configuration not found
 */
router.post('/upload-pdf/:configId', protect, upload.single('pdf'), async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ErrorResponse('Please upload a PDF file', 400));
    }

    const configId = req.params.configId;
    const config = await Config.findById(configId);

    if (!config) {
      return next(new ErrorResponse(`Configuration not found with id of ${configId}`, 404));
    }

    // Extract text from PDF
    const pdfText = await extractTextFromPDF(req.file.path);

    // Get configuration details
    const configName = config.name;
    const configPurpose = config.purpose;
    const configDomain = config.domain;
    const configTone = config.tone;
    
    // Generate a system prompt based on both the PDF content and configuration details
    const systemPrompt = `You are a specialized assistant named "${configName}" with the primary purpose of ${configPurpose}. You specialize in the ${configDomain.join(', ')} domain(s) and communicate in a ${configTone?.style || 'professional'} tone using ${configTone?.language || 'English'} language.

You have been trained EXCLUSIVELY on the following document. You MUST deeply understand and internalize this content to provide accurate and helpful responses:

${pdfText.substring(0, 2000)}...

When answering questions:
1. ALWAYS analyze both the document content AND the context of your configuration (purpose: ${configPurpose}, domain: ${configDomain.join(', ')}) to provide comprehensive responses
2. Use the document's specific terminology, facts, and information as your primary knowledge source
3. Apply your understanding of the ${configDomain.join(', ')} domain to interpret the document content in the most relevant way
4. Maintain the document's factual accuracy while explaining concepts in a ${configTone?.style || 'professional'} manner
5. For questions directly related to the document, provide detailed answers citing specific information
6. For questions partially related to the document, combine document knowledge with your understanding of the configuration context
7. For completely unrelated topics, politely explain that you're specialized in ${configPurpose} with knowledge from the specific document provided

Your goal is to be an expert on this document while using your configuration context (purpose, domain, tone) to present this knowledge in the most helpful and relevant way possible. You should appear as if you've thoroughly studied both the document AND the configuration details to provide the most valuable assistance.`;

    // Update configuration with PDF file path and content
    config.pdfFilePath = req.file.path;
    config.pdfContent = pdfText.substring(0, 10000); // Store first 10000 chars of PDF content
    config.system_prompt = systemPrompt;

    await config.save();

    res.status(200).json({
      success: true,
      data: {
        configId: config._id,
        fileName: req.file.filename,
        fileSize: req.file.size,
        contentPreview: pdfText.substring(0, 200) + '...'
      }
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/configs/enhance-prompt:
 *   post:
 *     summary: Enhance a prompt using AI
 *     tags: [Configurations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: The original prompt to enhance
 *               configId:
 *                 type: string
 *                 description: Optional configuration ID to use for enhancement context
 *     responses:
 *       200:
 *         description: Prompt enhanced successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 */
router.post('/enhance-prompt', protect, async (req, res, next) => {
  try {
    const { prompt, configId } = req.body;
    
    if (!prompt) {
      return next(new ErrorResponse('Please provide a prompt to enhance', 400));
    }
    
    let config = {};
    
    // If configId is provided, get the configuration
    if (configId) {
      config = await Config.findById(configId);
      
      if (!config) {
        return next(new ErrorResponse(`Configuration not found with id of ${configId}`, 404));
      }
    }
    
    // Enhance the prompt
    const enhancedPrompt = await promptEnhancer.enhancePrompt(prompt, config);
    
    res.status(200).json({
      success: true,
      data: {
        originalPrompt: prompt,
        enhancedPrompt
      }
    });
  } catch (error) {
    console.error('Error enhancing prompt:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/configs/{id}/enhance-system-prompt:
 *   post:
 *     summary: Enhance and save the system prompt for a configuration
 *     tags: [Configurations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: The original prompt to enhance (optional, will use existing system_prompt if not provided)
 *     responses:
 *       200:
 *         description: System prompt enhanced and saved successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Configuration not found
 */
router.post('/:id/enhance-system-prompt', protect, async (req, res, next) => {
  try {
    const configId = req.params.id;
    let { prompt } = req.body;
    
    // Get the configuration
    const config = await Config.findById(configId);
    
    if (!config) {
      return next(new ErrorResponse(`Configuration not found with id of ${configId}`, 404));
    }
    
    // If no prompt is provided, use the existing system_prompt
    if (!prompt && config.system_prompt) {
      prompt = config.system_prompt;
    } else if (!prompt) {
      return next(new ErrorResponse('Please provide a prompt to enhance', 400));
    }
    
    // Store the original prompt
    config.original_prompt = prompt;
    
    // Enhance the system prompt
    const enhancedPrompt = await promptEnhancer.enhanceSystemPrompt(prompt, config);
    
    // Update the configuration with the enhanced prompt
    config.enhanced_prompt = enhancedPrompt;
    config.system_prompt = enhancedPrompt;
    
    await config.save();
    
    res.status(200).json({
      success: true,
      data: {
        configId: config._id,
        originalPrompt: config.original_prompt,
        enhancedPrompt: config.enhanced_prompt
      }
    });
  } catch (error) {
    console.error('Error enhancing system prompt:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/configs:
 *   get:
 *     summary: Get all configurations
 *     tags: [Configurations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all configurations
 *       401:
 *         description: Not authorized
 */
router.get('/', protect, async (req, res, next) => {
  try {
    const configs = await Config.find();
    res.status(200).json({
      success: true,
      count: configs.length,
      data: configs
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/configs/{id}:
 *   get:
 *     summary: Get a single configuration
 *     tags: [Configurations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuration details
 *       404:
 *         description: Configuration not found
 *       401:
 *         description: Not authorized
 */
router.get('/:id', protect, async (req, res, next) => {
  try {
    const config = await Config.findById(req.params.id);
    
    if (!config) {
      return next(new ErrorResponse(`Configuration not found with id of ${req.params.id}`, 404));
    }
    
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/configs/{id}/toggle-inventory-access:
 *   patch:
 *     summary: Toggle product inventory access feature for a chatbot
 *     tags: [Configurations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Enable or disable product inventory access
 *     responses:
 *       200:
 *         description: Product inventory access updated successfully
 *       404:
 *         description: Configuration not found
 *       401:
 *         description: Not authorized
 */
router.patch('/:id/toggle-inventory-access', protect, async (req, res, next) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return next(new ErrorResponse('Please provide a valid enabled status (boolean)', 400));
    }
    
    const config = await Config.findById(req.params.id);
    
    if (!config) {
      return next(new ErrorResponse(`Configuration not found with id of ${req.params.id}`, 404));
    }
    
    // Update product inventory access feature
    if (!config.features) {
      config.features = {};
    }
    
    config.features.inventoryAccess = enabled;
    config.inventoryEnabled = enabled; // For backward compatibility
    
    await config.save();
    
    res.status(200).json({
      success: true,
      data: {
        configId: config._id,
        inventoryAccess: config.features.inventoryAccess
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/configs/{id}:
 *   put:
 *     summary: Update a configuration
 *     tags: [Configurations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               purpose:
 *                 type: string
 *               domain:
 *                 type: array
 *                 items:
 *                   type: string
 *               tone:
 *                 type: object
 *                 properties:
 *                   style:
 *                     type: string
 *                     enum: [formal, casual, friendly, professional, technical]
 *                   language:
 *                     type: string
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *               integrations:
 *                 type: array
 *                 items:
 *                   type: string
 *               features:
 *                 type: object
 *                 properties:
 *                   inventoryAccess:
 *                     type: boolean
 *                     description: Enable product inventory access for this chatbot
 *               ai:
 *                 type: object
 *                 properties:
 *                   provider:
 *                     type: string
 *                     enum: [mistral, openai]
 *                     description: AI provider to use (mistral or openai)
 *                   model:
 *                     type: string
 *                     description: Model name to use (e.g., mistral-small, gpt-3.5-turbo)
 *                   temperature:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                     description: Controls randomness (0-1, lower is more deterministic)
 *                   max_tokens:
 *                     type: integer
 *                     description: Maximum tokens to generate in the response
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *       404:
 *         description: Configuration not found
 *       401:
 *         description: Not authorized
 */
router.put('/:id', protect, async (req, res, next) => {
  try {
    let config = await Config.findById(req.params.id);
    
    if (!config) {
      return next(new ErrorResponse(`Configuration not found with id of ${req.params.id}`, 404));
    }
    
    config = await Config.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/configs/{id}:
 *   delete:
 *     summary: Delete a configuration
 *     tags: [Configurations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuration deleted successfully
 *       404:
 *         description: Configuration not found
 *       401:
 *         description: Not authorized
 */
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const config = await Config.findById(req.params.id);
    
    if (!config) {
      return next(new ErrorResponse(`Configuration not found with id of ${req.params.id}`, 404));
    }
    
    await config.deleteOne();
    
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
 * /api/configs/projects:
 *   get:
 *     summary: Get all project configurations
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all project configurations
 *       401:
 *         description: Not authorized
 */
router.get('/projects', protect, async (req, res, next) => {
  try {
    const projectConfigs = projectConfigManager.getAllProjectConfigs();
    
    res.status(200).json({
      success: true,
      count: Object.keys(projectConfigs).length,
      data: projectConfigs
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/configs/projects/{projectId}:
 *   get:
 *     summary: Get configuration for a specific project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project configuration
 *       404:
 *         description: Project configuration not found
 *       401:
 *         description: Not authorized
 */
router.get('/projects/:projectId', protect, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const projectConfig = projectConfigManager.getProjectConfig(projectId);
    
    if (!projectConfig || Object.keys(projectConfig).length === 0) {
      return next(new ErrorResponse(`Project configuration not found for ${projectId}`, 404));
    }
    
    res.status(200).json({
      success: true,
      data: projectConfig
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/configs/projects/{projectId}:
 *   post:
 *     summary: Create or update a project configuration
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *               - name
 *               - purpose
 *             properties:
 *               name:
 *                 type: string
 *               purpose:
 *                 type: string
 *               domain:
 *                 type: array
 *                 items:
 *                   type: string
 *               tone:
 *                 type: object
 *                 properties:
 *                   style:
 *                     type: string
 *                     enum: [formal, casual, friendly, professional, technical]
 *                   language:
 *                     type: string
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *               integrations:
 *                type: array
 *                items:
 *                  type: string
 *               ai:
 *                type: object
 *                properties:
 *                  provider:
 *                    type: string
 *                    enum: [mistral, openai]
 *                  model:
 *                    type: string
 *                  temperature:
 *                    type: number
 *                  max_tokens:
 *                    type: integer
 *     responses:
 *       200:
 *         description: Project configuration updated
 *       201:
 *         description: Project configuration created
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authorized
 */
router.post('/projects/:projectId', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // Validate required fields
    if (!req.body.name || !req.body.purpose) {
      return next(new ErrorResponse('Name and purpose are required fields', 400));
    }
    
    // Set the project configuration
    projectConfigManager.setProjectConfig(projectId, req.body);
    
    // Sync with database
    await projectConfigManager.syncWithDatabase();
    
    // Get the updated config
    const updatedConfig = projectConfigManager.getProjectConfig(projectId);
    
    res.status(200).json({
      success: true,
      data: updatedConfig
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/configs/projects/{projectId}:
 *   delete:
 *     summary: Delete a project configuration
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project configuration deleted
 *       400:
 *         description: Cannot delete default configuration
 *       404:
 *         description: Project configuration not found
 *       401:
 *         description: Not authorized
 */
router.delete('/projects/:projectId', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // Cannot delete default configuration
    if (projectId === 'default') {
      return next(new ErrorResponse('Cannot delete default configuration', 400));
    }
    
    // Remove the project configuration
    const removed = projectConfigManager.removeProjectConfig(projectId);
    
    if (!removed) {
      return next(new ErrorResponse(`Project configuration not found for ${projectId}`, 404));
    }
    
    // Also remove from database if exists
    await Config.deleteOne({ projectId });
    
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
 * /api/configs/projects/sync:
 *   post:
 *     summary: Sync project configurations with database
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurations synced successfully
 *       401:
 *         description: Not authorized
 */
router.post('/projects/sync', protect, authorize('admin'), async (req, res, next) => {
  try {
    await projectConfigManager.syncWithDatabase();
    
    res.status(200).json({
      success: true,
      message: 'Project configurations synced with database'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;