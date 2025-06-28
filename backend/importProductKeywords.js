const mongoose = require('mongoose');
const ProductKeyword = require('./models/ProductKeyword');
const productKeywords = require('./productKeywords'); // This should export an object like { "keyword": "product name" }

// Replace this with actual user ID
const userId = '685147f3da70113a186841ae';

async function importKeywords() {
  try {
    await mongoose.connect('mongodb+srv://healthcurelavedaa:90yGBNaUWxUBfnSN@cluster0.qc93qml.mongodb.net/chatbot?retryWrites=true&w=majority', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const keywordDocs = Object.entries(productKeywords).map(([phrase, product]) => ({
      userId,
      phrase: phrase.trim().toLowerCase(),
      product,
      weight: 1, // default weight
    }));

    // Optional: Clear old entries for this user
    await ProductKeyword.deleteMany({ userId });

    const result = await ProductKeyword.insertMany(keywordDocs);
    console.log(`✅ Imported ${result.length} keywords to MongoDB.`);
  } catch (err) {
    console.error('❌ Import failed:', err);
  } finally {
    mongoose.connection.close();
  }
}

importKeywords();
