const express = require('express');
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Analytics = require('./models/Analytics');
const widgetRoute = require('./routes/widget');
const cors = require('cors');
const { job } = require('./cron');
const authenticateApiKey = require('./middleware/authenticateApiKey');
const sessionMemory = new Map();
dotenv.config();
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/static', express.static('static'));
// Normalize domain: remove trailing slash, enforce lowercase
const normalizeDomain = (domain) => {
  if (!domain) return domain;
  return domain.toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, 'https://') // unify www
    .replace(/\/$/, '');
};

const STATIC_DOMAINS = ['https://la-chatbot.vercel.app'];

const corsOptions = {
  origin: async function (origin, callback, req) {
    try {
      console.log('CORS check:', {
        origin,
        url: req ? req.url : 'undefined',
        method: req ? req.method : 'undefined',
        headers: req ? req.headers : 'undefined',
        ip: req ? req.ip : 'undefined'
      });
      if (!origin) {
        console.log('No origin, allowing request for URL:', req ? req.url : 'undefined');
        if ((req && req.url && req.url.startsWith('/static')) || (req && req.method === 'OPTIONS')) {
          return callback(null, true);
        }
        console.warn('Rejecting undefined origin for non-static/non-OPTIONS request:', req ? req.url : 'undefined');
        return callback(new Error('Origin required for this request'));
      }
      // const normalizedOrigin = normalizeDomain(origin);
      const normalizedOrigin = origin;
      console.log('Normalized origin:', normalizedOrigin);
      if (STATIC_DOMAINS.includes(normalizedOrigin) || normalizedOrigin.startsWith('http://localhost')) {
        console.log('Allowing static or localhost origin:', normalizedOrigin);
        return callback(null, true);
      }
      const user = await User.findOne({ allowedDomains: normalizedOrigin });
      if (user) {
        console.log('Origin allowed for user:', { userId: user._id, origin: normalizedOrigin });
        return callback(null, true);
      }
      console.warn('CORS rejected for origin:', normalizedOrigin);
      callback(new Error('Not allowed by CORS'));
    } catch (err) {
      console.error('CORS processing error:', err);
      callback(new Error('CORS processing error'));
    }
  },
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type', 'X-API-Key', 'x-internal-auth', 'x-user-id'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  preflightContinue: false
};

app.use(cors(corsOptions));
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
console.log('MongoDB connected');


const UPGRADE_MESSAGE = 'You have reached your plan limit. Upgrade to the paid plan for unlimited questions and uploads at https://careerengine.in/upgrade.';

const checkLimits = async (req, res, next) => {
  console.log(req.user, "sddsds");

  try {
    const user = await User.findById(req.user.id);
    console.log(req.user, "user");

    if (!user) return res.status(404).json({ error: 'User not found 3' });
    console.log('checkLimits:', { userId: req.user.id, plan: user.plan, uploadCount: user.uploadCount });
    if (user.plan === 'paid' && user.subscriptionStatus === 'active') {
      return next();
    }
    if (user.uploadCount >= 5) {
      return res.status(403).json({ reply: UPGRADE_MESSAGE });
    }
    next();
  } catch (err) {
    console.error('Limit check error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.PINECONE_INDEX);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    req.user = { id: decoded.userId };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    User.findById(decoded.userId).then(user => {
      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      req.user = { id: decoded.userId };
      next();
    }).catch(err => {
      console.error('Admin auth error:', err);
      res.status(500).json({ error: 'Server error' });
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.use('/widget', widgetRoute);

app.get('/chats', authenticateApiKey, async (req, res) => {
  const { visitorId } = req.query;
  if (!visitorId) return res.status(400).json({ error: 'Missing visitorId' });
  try {
    const chats = await Chat.find({ userId: req.user.id, visitorId }).sort({ createdAt: 1 });
    res.json(chats);
  } catch (err) {
    console.error('Chat history error:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  console.log(username, password);
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ error: 'User already exists' });
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashed });
  await user.save();
  res.json({ message: 'User created' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: 'Invalid login' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Invalid login' });
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
  res.json(
    {
      token,
      userid: user._id,
    });
});

app.get('/user/uploads', async (req, res) => {
  const { userId, visitorId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    // Use embedding for empty string as query vector to get broad results
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: '', // empty string to get a neutral embedding vector
    });
    const queryVector = embeddingResponse.data[0].embedding;

    const filter = { userId: userId.toString() };
    if (visitorId) filter.visitorId = visitorId;

    const queryResponse = await index.query({
      vector: queryVector,
      topK: 1000,
      includeMetadata: true,
      filter,
      // optionally set a low similarity threshold, e.g.:
      // minScore: 0.0,
    });

    console.log('Uploads query:', {
      userId,
      visitorId,
      matchCount: queryResponse.matches.length,
    });

    const uploads = queryResponse.matches.map((match) => ({
      filename: match.metadata.filename,
      visitorId: match.metadata.visitorId,
      text: match.metadata.text,
      vectorId: match.id,
      createdAt: match.metadata.createdAt || new Date().toISOString(),
    }));

    res.json({ uploads });
  } catch (err) {
    console.error('Fetch uploads error:', err);
    res.status(500).json({ error: 'Failed to fetch uploads' });
  }
});

app.get('/user/domains', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('allowedDomains');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ domains: user.allowedDomains });
  } catch (err) {
    console.error('Fetch domains error:', err);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});
app.post('/upload', authenticateToken, checkLimits, async (req, res) => {
  console.log("User Req", req.user);

  const { filename, data, visitorId = 'default' } = req.body;

  if (!filename) return res.status(400).json({ error: 'Filename is required' });
  if (!data) return res.status(400).json({ error: 'Data is required' });

  try {
    const user = await User.findById(req.user.id);
    console.log(user, "User");
    if (!user) return res.status(404).json({ error: 'User not found' });

    let vectors = [];

    // Try parse JSON - if fails, treat as plain text
    let products;
    try {
      products = JSON.parse(data);
    } catch {
      products = null;
    }

    if (products && Array.isArray(products)) {
      // Structured JSON upload - each product embedded separately
      for (let i = 0; i < products.length; i++) {
        const { title, text } = products[i];
        if (!text?.trim()) continue;

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: text.trim()
        });

        vectors.push({
          id: `${req.user.id}_${visitorId}_${filename}_${i}`,
          values: embeddingResponse.data[0].embedding,
          metadata: {
            userId: req.user.id.toString(),
            visitorId,
            filename,
            title,
            text,
            createdAt: new Date().toISOString()
          }
        });
      }
    } else {
      // Plain text upload - chunk & embed as usual
      const chunkSize = 5000;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize).trim();
        if (!chunk) continue;

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: chunk
        });

        vectors.push({
          id: `${req.user.id}_${visitorId}_${filename}_${Math.floor(i / chunkSize)}`,
          values: embeddingResponse.data[0].embedding,
          metadata: {
            userId: req.user.id.toString(),
            visitorId,
            filename,
            text: chunk,
            createdAt: new Date().toISOString()
          }
        });
      }
    }

    if (vectors.length > 0) {
      await index.upsert(vectors, req.user.id.toString());
    }

    if (user.plan === 'free') user.uploadCount += 1;
    await user.save();

    res.status(200).json({ message: 'Data embedded and uploaded successfully.' });

  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: 'Failed to upload data' });
  }
});




// app.post('/upload', authenticateToken, checkLimits, async (req, res) => {
//   const { data, filename, visitorId = 'default' } = req.body;
//   console.log('Upload request:', { userId: req.user.id, visitorId, filename, dataLength: data?.length });
//   if (!data || !filename) {
//     return res.status(400).json({ error: 'Data and filename are required' });
//   }
//   try {
//     const user = await User.findById(req.user.id);
//     if (!user) return res.status(404).json({ error: 'User not found' });
//     const chunkSize = 5000;
//     const chunks = [];
//     for (let i = 0; i < data.length; i += chunkSize) {
//       chunks.push(data.slice(i, i + chunkSize));
//     }
//     const vectors = [];
//     for (let i = 0; i < chunks.length; i++) {
//       const chunk = chunks[i].trim();
//       if (!chunk) continue;
//       console.log(openai,"Check openai API");

//       const embeddingResponse = await openai.embeddings.create({
//         model: 'text-embedding-ada-002',
//         input: chunk,
//       });
//       const embedding = embeddingResponse.data[0].embedding;
//       const vectorId = `${req.user.id}_${visitorId}_${filename}_${i}`;
//       vectors.push({
//         id: vectorId,
//         values: embedding,
//         metadata: {
//           userId: req.user.id.toString(),
//           visitorId,
//           text: chunk,
//           filename,
//           createdAt: new Date().toISOString() // Add timestamp
//         }
//       });
//       console.log('Upserting vector:', {
//         id: vectorId,
//         userId: req.user.id,
//         visitorId,
//         filename,
//         textLength: chunk.length
//       });
//     }
//     if (vectors.length > 0) {
//       await index.upsert(vectors, req.user.id.toString());
//       console.log('Vectors upserted:', { vectorCount: vectors.length, userId: req.user.id, visitorId });
//     } else {
//       console.warn('No vectors to upsert for upload:', { userId: req.user.id, visitorId, filename });
//     }
//     if (user.plan === 'free') {
//       user.uploadCount += 1;
//     }
//     await user.save();
//     res.status(200).json({ message: 'Data embedded and stored successfully' });
//   } catch (err) {
//     console.error('Upload error:', err);
//     res.status(500).json({ error: 'Error processing upload' });
//   }
// });
app.get('/vectors', authenticateToken, async (req, res) => {

  try {
    const { queryText = null } = req.query;

    let vector;
    if (queryText) {
      const embeddingRes = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: queryText
      });
      vector = embeddingRes.data[0].embedding;
    } else {
      // default query vector (all zeros = won't match anything well)
      vector = Array(1536).fill(0);
    }

    const results = await index.query({
      vector,
      topK: 10,
      includeMetadata: true,

    },
      'req.user.id.toString()'
    );

    res.json(results.matches);
  } catch (err) {
    console.error('Error fetching vectors:', err);
    res.status(500).json({ error: 'Failed to fetch vectors' });
  }
});

app.delete('/vectors/:id', authenticateToken, async (req, res) => {
  const vectorId = req.params.id;
  const namespace = req.user.id.toString();

  try {
    // Call Pinecone's delete method with vector ID and namespace
    await index.deleteOne(vectorId, namespace); // ✅ if you're using `.deleteOne`

    res.status(200).json({ message: 'Vector deleted successfully', id: vectorId });
  } catch (error) {
    console.error('Error deleting vector:', error);
    res.status(500).json({ error: 'Failed to delete vector' });
  }
});


app.put('/vectors/:id', authenticateToken, async (req, res) => {
  try {
    const vectorId = req.params.id;
    const { newText } = req.body;

    if (!newText) {
      return res.status(400).json({ error: 'newText is required' });
    }

    // Delete old vector
    await index.delete1({
      ids: [vectorId],
      namespace: req.user.id.toString()
    });

    // Create new embedding
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: newText
    });
    const newEmbedding = embeddingRes.data[0].embedding;

    // Upsert updated vector
    await index.upsert({
      vectors: [{
        id: vectorId,
        values: newEmbedding,
        metadata: {
          userId: req.user.id.toString(),
          text: newText,
          updatedAt: new Date().toISOString()
        }
      }],
      namespace: req.user.id.toString()
    });

    res.json({ message: `Vector ${vectorId} updated successfully` });
  } catch (err) {
    console.error('Error updating vector:', err);
    res.status(500).json({ error: 'Failed to update vector' });
  }
});
app.post('/chat', authenticateApiKey, async (req, res) => {
  const { message, visitorId } = req.body;

  if (!message || typeof message !== 'string' || !visitorId) {
    return res.status(400).json({ error: 'Invalid message or visitorId' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.plan === 'free' && user.questionCount >= 20) {
      return res.status(403).json({ reply: UPGRADE_MESSAGE });
    }

    // 🧠 1. Load previous chat history for context
    const recentMessages = await Chat.find({
      userId: user._id,
      visitorId
    }).sort({ createdAt: -1 }).limit(6);

    const chatHistory = recentMessages
      .reverse()
      .flatMap(chat => [
        { role: 'user', content: chat.message },
        { role: 'assistant', content: chat.reply }
      ]);

    // 🧠 2. Detect product from current message
   const productKeywords = {
  // Happy Heart Capsules
  "happy heart": "Happy Heart Capsules",
  "heart": "Happy Heart Capsules",
  "heart care": "Happy Heart Capsules",
  "cardio": "Happy Heart Capsules",
  "blood pressure": "Happy Heart Capsules",
  "cholesterol": "Happy Heart Capsules",
  "circulation": "Happy Heart Capsules",
  "bp": "Happy Heart Capsules",
  "stress heart": "Happy Heart Capsules",

  // Men Care Capsules
  "men": "Men Care Capsules",
  "men's care": "Men Care Capsules",
  "male": "Men Care Capsules",
  "testosterone": "Men Care Capsules",
  "stamina": "Men Care Capsules",
  "men health": "Men Care Capsules",
  "recovery": "Men Care Capsules",
  "performance": "Men Care Capsules",
  "mens capsule": "Men Care Capsules",

  // Deep Sleep Capsules
  "sleep": "Deep Sleep Capsules",
  "deep sleep": "Deep Sleep Capsules",
  "insomnia": "Deep Sleep Capsules",
  "relax": "Deep Sleep Capsules",
  "anxiety": "Deep Sleep Capsules",
  "calm": "Deep Sleep Capsules",
  "sleep aid": "Deep Sleep Capsules",
  "non habit sleep": "Deep Sleep Capsules",
  "stress sleep": "Deep Sleep Capsules",

  // Women Care Capsules
  "women": "Women Care Capsules",
  "ladies": "Women Care Capsules",
  "female": "Women Care Capsules",
  "women health": "Women Care Capsules",
  "hormonal balance": "Women Care Capsules",
  "pms": "Women Care Capsules",
  "skin hair": "Women Care Capsules",
  "metabolism": "Women Care Capsules",
  "period pain": "Women Care Capsules",

  // Energy Booster Capsules
  "energy": "Energy Booster Capsules",
  "booster": "Energy Booster Capsules",
  "fatigue": "Energy Booster Capsules",
  "tiredness": "Energy Booster Capsules",
  "energy pills": "Energy Booster Capsules",
  "boost stamina": "Energy Booster Capsules",
  "energy support": "Energy Booster Capsules",
  "body energy": "Energy Booster Capsules",

  // Men Care & Energy Booster Combo Pack
  "men combo": "Men Care & Energy Booster Combo Pack",
  "men energy combo": "Men Care & Energy Booster Combo Pack",
  "men care energy": "Men Care & Energy Booster Combo Pack",
  "men full pack": "Men Care & Energy Booster Combo Pack",
  "male combo": "Men Care & Energy Booster Combo Pack",
  "both men energy": "Men Care & Energy Booster Combo Pack",
  "combo for men": "Men Care & Energy Booster Combo Pack",
  "men together pack": "Men Care & Energy Booster Combo Pack",
  "men double pack": "Men Care & Energy Booster Combo Pack",
  "men energy full combo": "Men Care & Energy Booster Combo Pack",
  "complete men pack": "Men Care & Energy Booster Combo Pack",
  "men + energy combo": "Men Care & Energy Booster Combo Pack",
  "all in one men": "Men Care & Energy Booster Combo Pack",

  // Women Care & Energy Booster Combo Pack
  "women combo": "Women Care & Energy Booster Combo Pack",
  "women energy combo": "Women Care & Energy Booster Combo Pack",
  "women care energy": "Women Care & Energy Booster Combo Pack",
  "women full pack": "Women Care & Energy Booster Combo Pack",
  "ladies combo": "Women Care & Energy Booster Combo Pack",
  "both women energy": "Women Care & Energy Booster Combo Pack",
  "combo for women": "Women Care & Energy Booster Combo Pack",
  "women together pack": "Women Care & Energy Booster Combo Pack",
  "female combo pack": "Women Care & Energy Booster Combo Pack",
  "women energy full combo": "Women Care & Energy Booster Combo Pack",
  "complete women pack": "Women Care & Energy Booster Combo Pack",
  "women + energy combo": "Women Care & Energy Booster Combo Pack",
  "all in one women": "Women Care & Energy Booster Combo Pack"
};

    let lastProduct = sessionMemory.get(visitorId) || null;
    for (const key in productKeywords) {
      if (message.toLowerCase().includes(key)) {
        lastProduct = productKeywords[key];
        sessionMemory.set(visitorId, lastProduct);
        break;
      }
    }

    // 🔎 3. Embed the current question
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: message.trim(),
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 📡 4. Query Pinecone with userId and visitorId filter
    let queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
      filter: { userId: user._id.toString(), visitorId }
    });

    // fallback: query by userId only
    if (queryResponse.matches.length === 0) {
      queryResponse = await index.query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true,
        filter: { userId: user._id.toString() }
      });
    }

    // 🧹 5. Filter context by last mentioned product
    const filteredChunks = queryResponse.matches
      .filter(m =>
        lastProduct &&
        m.metadata.text.toLowerCase().includes(lastProduct.toLowerCase())
      )
      .map(m => m.metadata.text);

    const context = (filteredChunks.length > 0
      ? filteredChunks
      : queryResponse.matches.map(m => m.metadata.text)
    ).join('\n');

    // 📜 6. Strong system prompt
    const systemPrompt = `
You are a helpful assistant for La Vedaa Healthcure products.

The customer is currently interested in: **${lastProduct || 'a specific product'}**

ONLY answer about this product. If the user says "benefits", "description", "price", or "how to use", assume they mean **${lastProduct || 'that product'}**.

⚠️ NEVER list all products. NEVER include other products unless the user clearly mentions them.

Be concise, helpful, and on-topic.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: `Context: ${context}\n\nQuestion: ${message}` }
    ];

    // 🧠 7. Get GPT response
    const completionResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages
    });

    const reply = completionResponse.choices[0].message.content;

    // 💾 8. Save chat message
    await Chat.create({ userId: user._id, visitorId, message, reply });

    if (user.plan === 'free') {
      user.questionCount += 1;
      await user.save();
    }

    res.json({ reply });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/chat/reset-session', (req, res) => {
  const { visitorId } = req.body;

  if (!visitorId) {
    return res.status(400).json({ error: 'visitorId is required' });
  }

  // Clear memory for that visitor
  sessionMemory.delete(visitorId);

  res.json({ message: `Session memory reset for visitor ${visitorId}` });
});




app.get('/user/plan', authenticateApiKey, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('plan subscriptionStatus questionCount uploadCount');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      questionCount: user.questionCount,
      uploadCount: user.uploadCount
    });
  } catch (err) {
    console.error('Plan fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch plan details' });
  }
});

app.use(express.urlencoded({ extended: true }));
app.post('/whatsapp', async (req, res) => {
  const incomingMessage = req.body.Body;
  const fromNumber = req.body.From;
  try {
    if (!fromNumber) {
      console.error('Missing "From" in request body:', req.body);
      return res.status(400).send('Missing sender number.');
    }
    const user = await User.findOne();
    if (!incomingMessage || typeof incomingMessage !== 'string') {
      await twilioClient.messages.create({
        body: 'Please send a valid message.',
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: fromNumber,
      });
      return res.status(200).send('OK');
    }
    if (user.plan === 'free' && user.questionCount >= 20) {
      console.log('WhatsApp question limit reached for user:', user._id);
      await twilioClient.messages.create({
        body: UPGRADE_MESSAGE,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: fromNumber,
      });
      return res.status(200).send('OK');
    }
    const reply = await processMessage(incomingMessage, user, 'default');
    if (reply === UPGRADE_MESSAGE) {
      console.log('WhatsApp returning upgrade message for user:', user._id);
      await twilioClient.messages.create({
        body: reply,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: fromNumber,
      });
      return res.status(200).send('OK');
    }
    await twilioClient.messages.create({
      body: reply,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: fromNumber,
    });
    if (user.plan === 'free') {
      user.questionCount += 1;
      await user.save();
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing WhatsApp message:', error.message);
    res.status(200).send('OK');
  }
});

async function processMessage(message, user, visitorId = 'default') {
  console.log('processMessage:', { userId: user._id, plan: user.plan, questionCount: user.questionCount });
  if (user.plan === 'free' && user.questionCount >= 20) {
    console.log('Question limit reached in processMessage for user:', user._id);
    return UPGRADE_MESSAGE;
  }
  if (!visitorId || typeof visitorId !== 'string') {
    console.error('Invalid visitorId:', visitorId);
    return 'Error: Invalid visitor ID.';
  }
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: message.trim(),
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log("Querying Pinecone with embedding of length", queryEmbedding.length);
    
    let queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
      filter: {
        userId: user._id.toString(),
        visitorId
      }
    });
    console.log('Pinecone query with visitorId filter:', {
      userId: user._id.toString(),
      visitorId,
      matchCount: queryResponse.matches.length,
      matches: queryResponse.matches.map(m => ({
        id: m.id,
        score: m.score,
        userId: m.metadata.userId,
        visitorId: m.metadata.visitorId,
        filename: m.metadata.filename,
        textLength: m.metadata.text.length
      }))
    });
    if (queryResponse.matches.length === 0) {
      console.warn('No matches with visitorId filter, trying userId only:', { userId: user._id.toString() });
      queryResponse = await index.query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true,
        filter: {
          userId: user._id.toString()
        }
      });
      console.log('Pinecone query with userId only:', {
        userId: user._id.toString(),
        matchCount: queryResponse.matches.length,
        matches: queryResponse.matches.map(m => ({
          id: m.id,
          score: m.score,
          userId: m.metadata.userId,
          visitorId: m.metadata.visitorId,
          filename: m.metadata.filename,
          textLength: m.metadata.text.length
        }))
      });
    }
const context = (filteredChunks.length > 0 ? filteredChunks : queryResponse.matches.map(m => m.metadata.text)).join('\n');
    console.log('Context length:', context.length, 'Context sample:', context.slice(0, 200));
    if (!context) {
      console.warn('No context retrieved from Pinecone for query:', message);
      return 'I don’t have any relevant information to answer this question. Please upload data or ask something else.';
    }
    const completionResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Use the provided context to answer questions accurately. If asked about the number of items (e.g., stories), count distinct items based on metadata (e.g., filename). Summarize or list items if relevant.',
        },
        {
          role: 'user',
          content: `Context: ${context}\n\nQuestion: ${message}`
        },
      ],
    });
    if (user.plan === 'free') {
      user.questionCount += 1;
      await user.save();
    }
    const reply = completionResponse.choices[0].message.content;
    console.log('GPT reply:', reply);
    return reply;
  } catch (err) {
    console.error('Process message error:', err);
    return 'Error processing your request. Please try again.';
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});