const mongoose = require('mongoose');

const ProductInventorySchema = new mongoose.Schema({
  botId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Config',
    required: [true, 'Bot ID is required']
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    trim: true
  },
  availableStock: {
    type: Number,
    required: [true, 'Available stock is required'],
    min: [0, 'Stock cannot be negative']
  },
  unit: {
    type: String,
    default: 'pcs',
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for botId and sku for faster lookups
ProductInventorySchema.index({ botId: 1, sku: 1 }, { unique: true });

// Create index for botId and productName for fuzzy searches
ProductInventorySchema.index({ botId: 1, productName: 1 });

// Update the updatedAt timestamp before saving
ProductInventorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ProductInventory', ProductInventorySchema);