const mongoose = require('mongoose');

const productKeywordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  phrase: { type: String, required: true },
  product: { type: String, required: true },
  weight: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProductKeyword', productKeywordSchema);
