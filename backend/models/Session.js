const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  visitorId: String,
  userId: String,
  lastProduct: String,
  lastIntent: String,
  lastMatchedProducts: [String],  // ✅ Add this line
  updatedAt: { type: Date, default: Date.now },
});

// Correct export
module.exports = mongoose.model('Session', SessionSchema);
