const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  uploadCount: { type: Number, default: 0 },
  questionCount: { type: Number, default: 0 },
   plan: { type: String, enum: ['free', 'paid'], default: 'free' },
  subscriptionStatus: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
  
  isAdmin: { type: Boolean, default: false },
  
  chatHistory: [
    {
      message: String,
      response: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
   allowedDomains: [{ type: String, default: [] }],
  widgetSettings: {
    theme: { type: String, default: '#1e3a8a' },
    position: { type: String, default: 'bottom-right' },
    avatar: { type: String, default: '' },
    // welcomeMessage: { type: String, default: 'Welcome to La Vedaa – I am here to help you' }
    welcomeMessage: { type: String, default: 'Hey welcome to La Vedaa store! <strong>How can i help you?</strong>' }
  },
  widgetApiKey: { type: String, default: () => uuidv4() }, // Unique API key for widget
});

userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ widgetApiKey: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);