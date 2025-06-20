const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: [true, 'Please provide a session ID'],
  },
  role: {
    type: String,
    enum: ['user', 'bot'],
    required: [true, 'Please specify the message role (user or bot)'],
  },
  content: {
    type: String,
    required: [true, 'Message content cannot be empty'],
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for faster queries
MessageSchema.index({ sessionId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', MessageSchema);