const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');

// 🔹 Get unique sessions
router.get('/chats', async (req, res) => {
  try {
    const sessions = await Chat.aggregate([
      {
        $group: {
          _id: '$visitorId',
          latestMessage: { $last: '$message' },
          latestReply: { $last: '$reply' },
          lastUpdated: { $last: '$createdAt' }
        }
      },
      { $sort: { lastUpdated: -1 } }
    ]);

    res.json({ success: true, sessions });
  } catch (err) {
    console.error('Error fetching chat sessions:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// 🔹 Get full chat history for a visitorId
router.get('/chats/:visitorId', async (req, res) => {
  try {
    const { visitorId } = req.params;
    const history = await Chat.find({ visitorId }).sort({ createdAt: 1 });
    res.json({ success: true, history });
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
