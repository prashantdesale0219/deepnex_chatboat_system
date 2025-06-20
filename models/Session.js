const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  configId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Config',
    required: [true, 'Please provide a configuration ID'],
  },
  userId: {
    type: String,
    required: [true, 'Please provide a user ID'],
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
});

// Update lastActivity timestamp before saving
SessionSchema.pre('save', function (next) {
  this.lastActivity = Date.now();
  next();
});

// Create indexes for faster queries
SessionSchema.index({ configId: 1 });
SessionSchema.index({ userId: 1 });

module.exports = mongoose.model('Session', SessionSchema);