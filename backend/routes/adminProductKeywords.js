const express = require('express');
const router = express.Router();
const ProductKeyword = require('../models/ProductKeyword');

// 🔍 Get all product keywords
router.get('/keywords', async (req, res) => {
  try {
    const keywords = await ProductKeyword.find().sort({ product: 1, phrase: 1 });
    res.json({ success: true, keywords });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch keywords', error: err.message });
  }
});

// ➕ Add new product keyword
router.post('/keywords', async (req, res) => {
  const { phrase, product, weight, userId } = req.body;
  if (!phrase || !product || !userId) {
    return res.status(400).json({ success: false, message: 'Missing required fields: phrase, product, userId' });
  }

  try {
    const newKeyword = await ProductKeyword.create({ phrase, product, weight: weight || 1, userId });
    res.json({ success: true, keyword: newKeyword });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create keyword', error: err.message });
  }
});

// ✏️ Edit product keyword
router.put('/keywords/:id', async (req, res) => {
  const { id } = req.params;
  const { phrase, product, weight } = req.body;

  try {
    const updated = await ProductKeyword.findByIdAndUpdate(
      id,
      { ...(phrase && { phrase }), ...(product && { product }), ...(weight !== undefined && { weight }) },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Keyword not found' });
    res.json({ success: true, keyword: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update keyword', error: err.message });
  }
});

// ❌ Delete keyword
router.delete('/keywords/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await ProductKeyword.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Keyword not found' });
    res.json({ success: true, message: 'Keyword deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete keyword', error: err.message });
  }
});

module.exports = router;
