const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name for the configuration'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    purpose: {
      type: String,
      required: [true, 'Please provide a purpose for the chatbot'],
      trim: true,
      maxlength: [500, 'Purpose cannot be more than 500 characters'],
    },
    businessName: {
      type: String,
      trim: true,
      maxlength: [100, 'Business name cannot be more than 100 characters'],
    },
    inventoryEnabled: {
      type: Boolean,
      default: false,
    },
    features: {
      type: Object,
      default: {
        inventoryAccess: true
      }
    },
    system_prompt: {
      type: String,
      trim: true,
    },
    original_prompt: {
      type: String,
      trim: true,
    },
    enhanced_prompt: {
      type: String,
      trim: true,
    },
    pdfFilePath: {
      type: String,
      trim: true,
    },
    pdfContent: {
      type: String,
      trim: true,
    },
    projectId: {
      type: String,
      trim: true,
      index: true,
      default: 'default',
    },
    domain: {
      type: [String],
      default: [],
    },
    tone: {
      style: {
        type: String,
        enum: ['formal', 'casual', 'friendly', 'professional', 'technical'],
        default: 'professional',
      },
      language: {
        type: String,
        default: 'en',
      },
    },
    channels: {
      type: [String],
      default: ['web'],
    },
    integrations: {
      type: [String],
      default: [],
    },
    inventory: {
      checkPrompt: {
        type: String,
        trim: true,
        default: 'I need to check if we have {product} in stock.'
      },
      orderPrompt: {
        type: String,
        trim: true,
        default: 'I want to order {quantity} {unit} of {product}.'
      },
    },
    ai: {
      provider: {
        type: String,
        enum: ['mistral', 'openai'],
        default: 'mistral',
      },
      model: {
        type: String,
        default: 'mistral-small',
      },
      temperature: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.7,
      },
      max_tokens: {
        type: Number,
        min: 1,
        max: 4096,
        default: 1000,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Config', ConfigSchema);