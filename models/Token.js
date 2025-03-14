const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['refresh'],
    default: 'refresh'
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  revokedReason: {
    type: String,
    enum: ['expired', 'manual_logout', 'reuse_detected', 'user_deleted', null],
    default: null
  },
  family: {
    type: String,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  userAgent: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  }
});

// Index for fast lookup
TokenSchema.index({ token: 1 });
TokenSchema.index({ user: 1 });
TokenSchema.index({ family: 1 });

module.exports = mongoose.model('Token', TokenSchema); 