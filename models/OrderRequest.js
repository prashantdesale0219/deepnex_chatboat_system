const mongoose = require('mongoose');

const OrderRequestSchema = new mongoose.Schema({
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
  requestedQty: {
    type: Number,
    required: [true, 'Requested quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  userQuery: {
    type: String,
    required: [true, 'Original user query is required']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  userId: {
    type: String,
    trim: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  }
});

// Create indexes for faster lookups
OrderRequestSchema.index({ botId: 1, status: 1 });
OrderRequestSchema.index({ timestamp: -1 });
OrderRequestSchema.index({ sessionId: 1 });

module.exports = mongoose.model('OrderRequest', OrderRequestSchema);