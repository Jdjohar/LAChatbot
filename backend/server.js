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
const ProductKeyword = require('./models/ProductKeyword');
const Session = require('./models/Session');
const Analytics = require('./models/Analytics');
const widgetRoute = require('./routes/widget');
const cors = require('cors');
const { job } = require('./cron');
const winston = require('winston');
const adminProductKeywordsRoutes = require('./routes/adminProductKeywords');

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

// Initialize logging
const logger = winston.createLogger({
  transports: [new winston.transports.File({ filename: 'chatbot.log' })],
});


const productKeywords = require('./productKeywords');
const STATIC_DOMAINS = ['https://la-chatbot.vercel.app', 'http://127.0.0.1:5500'];
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.PINECONE_INDEX);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const corsOptions = {
  origin: async function (origin, callback, req) {
    try {
      // console.log('CORS check:', {
      //   origin,
      //   url: req ? req.url : 'undefined',
      //   method: req ? req.method : 'undefined',
      //   headers: req ? req.headers : 'undefined',
      //   ip: req ? req.ip : 'undefined'
      // });
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  preflightContinue: false
};

app.use(cors(corsOptions));
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
console.log('MongoDB connected');


// Session management functions
async function getSession(visitorId, userId) {
  let session = await Session.findOne({ visitorId, userId }).lean(); // this returns plain object
  if (!session) {
    session = await Session.create({ visitorId, userId });
    return session.toObject(); // make sure it's plain object if lean() not used above
  }
  return session;
}

async function updateSession(visitorId, userId, data) {
  console.log("🔄 updateSession called with:", { visitorId, userId, data });

  await Session.findOneAndUpdate(
    { visitorId, userId },
    { $set: { ...data, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
}

// Intent detection
const intentKeywords = {
  benefits: ['benefits', 'advantages', 'helps with', 'what does it do', 'head pain', 'headache'],
  ingredients: ['ingredients', 'made of', 'contains', 'what’s in it'],
  pricing: ['price', 'cost', 'how much', 'pricing'],
  usage: ['how to use', 'dosage', 'instructions', 'how to take', 'how it work', 'how does it work', 'how it works', 'its how work'],
  ideal_for: ['who is it for', 'suitable for', 'recommended for'],
  link: ['buy', 'purchase', 'where to get', 'link'],
};

function detectIntent(message) {
  const lowerMessage = message.toLowerCase();
  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return intent;
    }
  }
  return null;
}

function findProductFromMessage(message, lastProduct) {
  const lowerMessage = message.toLowerCase();
  if (lastProduct && lowerMessage.includes(lastProduct.toLowerCase())) {
    return lastProduct;
  }
  for (const [keyword, product] of Object.entries(productKeywords)) {
    if (lowerMessage.includes(keyword)) {
      return product;
    }
  }
  return lastProduct || null;
}



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
app.use('/admin', adminProductKeywordsRoutes);

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
// 🔍 Fast local intent detection
// app.post('/chat', authenticateApiKey, async (req, res) => {
//   const { message, visitorId } = req.body;
//   if (!message || typeof message !== 'string' || !visitorId) {
//     return res.status(400).json({ error: 'Message and visitorId required' });
//   }

//   try {
//     const user = await User.findById(req.user.id);
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     const lowerMsg = message.toLowerCase().trim();
//     const session = await getSession(visitorId, user._id);

//     // 👋 Greetings
//     const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
//     if (greetings.some(greet => lowerMsg === greet || lowerMsg.startsWith(greet + ' '))) {
//       const reply = "👋 Hello! I'm here to assist you with any La Vedaa Healthcure product. Please tell me what concern or product you're looking for help with.";
//       await Chat.create({ userId: user._id, visitorId, message, reply });
//       return res.json({ reply });
//     }

//     // 🔄 Manual product switch
//     const switchIntent = /(other|different|else|switch|change).*(product|capsule|item)/i;
//     if (switchIntent.test(lowerMsg)) {
//       sessionMemory.set(visitorId, null);
//     }

//     // 🧠 1. Try detect intent locally
//     let intent = detectIntent(message);

//     // 🤖 2. GPT fallback if no intent matched
//     if (!intent) {
//       const intentPrompt = `Classify the user's intent into one of these: "pricing", "benefits", "ingredients", "usage", "link", or "other".\n\nMessage: "${message}"\n\nJust return the label.`;
//       const intentResp = await openai.chat.completions.create({
//         model: 'gpt-3.5-turbo',
//         messages: [{ role: 'user', content: intentPrompt }]
//       });
//       intent = intentResp.choices[0].message.content.trim().toLowerCase();
//     }

//     // 🔍 Product matching
//     let resolvedProduct = null;
//     const matchedProducts = [];

//     for (const key in productKeywords) {
//       const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
//       if (regex.test(lowerMsg)) {
//         const product = productKeywords[key].trim();
//         if (!matchedProducts.includes(product)) matchedProducts.push(product);
//       }
//     }

//     if (matchedProducts.length === 1) {
//       resolvedProduct = matchedProducts[0];
//       sessionMemory.set(visitorId, resolvedProduct);
//     } else if (matchedProducts.length > 1) {
//       const reply = matchedProducts.slice(0, 2).map((p, i) => `${i + 1}. ${p}`).join('\n');
//       return res.json({
//         reply: `I found more than one product that may match your concern:\n\n${reply}\n\nPlease ask about one of them or continue and I’ll assist with both.`
//       });
//     } else if (sessionMemory.has(visitorId)) {
//       resolvedProduct = sessionMemory.get(visitorId);
//     }

//     // ❌ Still no product match
//     if (!resolvedProduct) {
//       return res.json({
//         reply: "I couldn't identify the product you're asking about. Please mention a concern or product name (e.g., 'heart', 'energy', 'sleep')."
//       });
//     }

//     // ✅ Free plan check
//     if (user.plan === 'free' && user.questionCount >= 20) {
//       return res.status(403).json({ reply: UPGRADE_MESSAGE });
//     }

//     // ⏳ Chat history
//     const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
//     const recentMessages = await Chat.find({
//       userId: user._id,
//       visitorId,
//       createdAt: { $gte: since }
//     }).sort({ createdAt: -1 }).limit(6);

//     const chatHistory = recentMessages.reverse().flatMap(chat => [
//       { role: 'user', content: chat.message },
//       { role: 'assistant', content: chat.reply }
//     ]);

//     // 🔎 Embedding
//     const embeddingResponse = await openai.embeddings.create({
//       model: 'text-embedding-ada-002',
//       input: message.trim()
//     });
//     const queryEmbedding = embeddingResponse.data[0].embedding;

//     // 🔍 Pinecone query
//     const pineconeFilter = {
//       userId: String(user._id),
//       product: resolvedProduct,
//       ...(intent !== 'other' ? { field: intent } : {})
//     };

//     let queryResponse = await index.query({
//       vector: queryEmbedding,
//       topK: 20,
//       includeMetadata: true,
//       filter: pineconeFilter
//     });

//     if (queryResponse.matches.length === 0) {
//       // Retry without intent
//       queryResponse = await index.query({
//         vector: queryEmbedding,
//         topK: 20,
//         includeMetadata: true,
//         filter: {
//           userId: String(user._id),
//           product: resolvedProduct
//         }
//       });
//     }

//     if (queryResponse.matches.length === 0) {
//       return res.json({
//         reply: "I'm sorry, I don't have information on that right now. Please contact info@lavedaa.com or call 9888153555 for assistance."
//       });
//     }

//     // 📄 Context
//     const MAX_TEXT_LENGTH = 100;
//     const context = queryResponse.matches.map(m => {
//       const product = m.metadata.product || 'Unknown';
//       const field = m.metadata.field || 'Unknown';
//       let text = m.metadata.text || '';
//       if (text.length > MAX_TEXT_LENGTH) {
//         text = text.slice(0, MAX_TEXT_LENGTH) + '...';
//       }
//       return `PRODUCT: ${product}\nFIELD: ${field}\nTEXT: ${text}`;
//     }).join('\n\n');

//     // 🧾 GPT Prompt
//     const systemPrompt = `You are a helpful assistant for La Vedaa Healthcure products.

// Use only verified product data. Assume the active product is "${resolvedProduct}".

// Never switch or guess another product unless user says so explicitly.`;

//     const messages = [
//       { role: 'system', content: systemPrompt },
//       ...chatHistory,
//       {
//         role: 'user',
//         content: `User asked: "${message}"\n\nUse ONLY the following context:\n\n${context}`
//       }
//     ];

//     const completionResponse = await openai.chat.completions.create({
//       model: 'gpt-3.5-turbo',
//       messages
//     });

//     const reply = completionResponse.choices[0].message.content;

//     // 💬 Save
//     await Chat.create({ userId: user._id, visitorId, message, reply });

//     // 🧠 Update session
//     await updateSession(visitorId, user._id, {
//       lastProduct: resolvedProduct,
//       lastIntent: intent
//     });

//     // 📊 Usage
//     if (user.plan === 'free') {
//       user.questionCount += 1;
//       await user.save();
//     }

//     res.json({ reply });

//   } catch (err) {
//     console.error('❗ Chat error:', err);
//     res.status(500).json({
//       reply: "Oops! Something went wrong. Please contact info@lavedaa.com or call 9888153555."
//     });
//   }
// });

app.post('/chat', authenticateApiKey, async (req, res) => {
  const { message, visitorId } = req.body;
  if (!message || typeof message !== 'string' || !visitorId) {
    return res.status(400).json({ error: 'Message and visitorId required' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const session = await getSession(visitorId, user._id);
    const lowerMsg = message.toLowerCase().trim();

    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
    if (greetings.some(greet => lowerMsg === greet || lowerMsg.startsWith(greet + ' '))) {
      const reply = "👋 Hello! I'm here to assist you with any La Vedaa Healthcure product. Please tell me what concern or product you're looking for help with.";
      await Chat.create({ userId: user._id, visitorId, message, reply });
      return res.json({ reply });
    }

    let intent = detectIntent(message);
    if (!intent) {
      const intentPrompt = `This is a user message: "${message}". Identify the most relevant intent.
Choose from: benefits, pricing, usage, ingredients, link, ideal_for.`;
      const intentResp = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: intentPrompt }]
      });
      const rawIntent = intentResp.choices[0].message.content.trim().toLowerCase();
      if (Object.keys(intentKeywords).includes(rawIntent)) intent = rawIntent;
    }

    const matchedEntries = await ProductKeyword.find({ userId: user._id });
   const productKeywords = {};
matchedEntries.forEach(e => {
  productKeywords[e.phrase.toLowerCase()] = {
    product: e.product,
    weight: e.weight || 1
  };
});

    const matchedProducts = Object.entries(productKeywords)
      .filter(([phrase]) => lowerMsg.includes(phrase))
      .map(([, product]) => product);

    const uniqueMatches = [...new Set(matchedProducts)];

    if (uniqueMatches.length === 0 && !session?.lastProduct) {
      // 🧠 Ask GPT to infer a possible keyword (like 'pain', 'sleep', etc.)
      const gptKeywordPrompt = `The user message is: "${message}". Extract the most relevant keyword related to a health concern or product category from this message. Respond with just one word like "pain", "sleep", "energy", "heart", etc.`;

      const keywordResp = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: gptKeywordPrompt }]
      });

      const inferredKeyword = keywordResp.choices[0].message.content.trim().toLowerCase();
      console.log("🧠 Fallback inferred keyword:", inferredKeyword);

      const fallbackMatchesWithScore = Object.entries(productKeywords)
        .map(([phrase, value]) => {
          const matchScore =
            phrase.includes(inferredKeyword) ? 1 : inferredKeyword.includes(phrase) ? 0.5 : 0;

          const productName = typeof value === 'string' ? value : value.product;
          const weight = typeof value === 'object' ? value.weight || 1 : 1;

          return { phrase, product: productName, weight, score: matchScore };
        })
        .filter(m => m.score > 0);
console.log("🧪 productKeywords preview:", Object.entries(productKeywords).slice(0, 5));
      // 👉 Group by product, and keep MAX(weight × score) per product
      const productScores = {};

      for (const match of fallbackMatchesWithScore) {
        const score = match.weight * match.score;
        if (!productScores[match.product]) {
          productScores[match.product] = 0;
        }
        productScores[match.product] += match.weight * match.score;
      }
console.log("🧮 Final weighted scores:", productScores);
      // Sort by highest combined weight x match score
      const sortedFallback = Object.entries(productScores)
        .sort((a, b) => b[1] - a[1])
        .map(([product]) => product);

      if (sortedFallback.length > 0) {

        await updateSession(visitorId, user._id, {
          lastProduct: sortedFallback[0],
          lastIntent: intent || 'benefits',
          lastMatchedProducts: [sortedFallback[0]]
        });


        return res.json({
          reply: `Based on your concern "${inferredKeyword}", I recommend: ${sortedFallback[0]}. Would you like to know its price, usage, or benefits?`
        });
      }

      return res.json({
        reply: `Sorry, I couldn't identify a matching product for your concern.\n\nPlease mention a specific health issue (e.g., 'heart', 'energy', 'sleep'), or contact support:\n📧 info@lavedaa.com\n📞 9888153555`
      });
    }


    const productsToUse = intent === 'pricing'
      ? (uniqueMatches.length ? uniqueMatches : session?.lastMatchedProducts || [session?.lastProduct])
      : [uniqueMatches[0] || session?.lastProduct];

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: message.trim()
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    const chatHistory = (await Chat.find({ userId: user._id, visitorId })
      .sort({ createdAt: -1 })
      .limit(6)).reverse().flatMap(chat => [
        { role: 'user', content: chat.message },
        { role: 'assistant', content: chat.reply }
      ]);

    const allReplies = [];
    for (const product of productsToUse) {
      const pineconeFilter = { userId: String(user._id), product, ...(intent ? { field: intent } : {}) };

      let query = await index.query({ vector: queryEmbedding, topK: 20, includeMetadata: true, filter: pineconeFilter });
      if (query.matches.length === 0) {
        query = await index.query({ vector: queryEmbedding, topK: 20, includeMetadata: true, filter: { userId: String(user._id), product } });
      }
      if (query.matches.length === 0) continue;

      const context = query.matches.map(m => {
  const field = m.metadata?.field || 'Unknown';
  let text = m.metadata?.text || 'No description available';
  if (text.length > 100) text = text.slice(0, 100) + '...';
  return `PRODUCT: ${product}\nFIELD: ${field}\nTEXT: ${text}`;
}).join('\n\n');

      const messages = [
        { role: 'system', content: `You are a helpful assistant. Use only verified product data. Active product is "${product}".` },
        ...chatHistory,
        {
          role: 'user', content: `User asked: "${message}"
Use ONLY this context:
${context}`
        }
      ];

      const response = await openai.chat.completions.create({ model: 'gpt-3.5-turbo', messages });
      allReplies.push(response.choices[0].message.content);
    }

    const finalReply = allReplies.length ? allReplies.join('\n\n') + `\n\n🔁 Want to ask about a different product? Type 'try another product'.` :
      `Sorry, I couldn't find relevant info. 📞 Contact support at info@lavedaa.com or call 9888153555.`;

    await Chat.create({ userId: user._id, visitorId, message, reply: finalReply });
    await updateSession(visitorId, user._id, {
      lastProduct: productsToUse[0],
      lastIntent: intent,
      lastMatchedProducts: productsToUse
    });

    if (user.plan === 'free') {
      user.questionCount += 1;
      await user.save();
    }

    res.json({ reply: finalReply });

  } catch (err) {
    console.error('❗ Chat error:', err);
    res.status(500).json({ reply: "Oops! Something went wrong. Please contact support." });
  }
});














// ==============================
// 📦 /upload Route (Field-Level)
// ==============================




app.post('/upload', authenticateToken, checkLimits, async (req, res) => {
  const { filename, data, visitorId = 'default' } = req.body;
  if (!filename || !data) {
    return res.status(400).json({ error: 'Filename and data are required' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const products = JSON.parse(data);

    console.log("products:======", products);

    const vectors = [];

    for (let i = 0; i < products.length; i++) {
      const { product, field, text } = products[i];

      // Skip incomplete entries
      if (!product || !field || !text?.trim()) continue;

      // Get embedding from OpenAI
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.trim()
      });

      // Create vector entry
      vectors.push({
        id: `${req.user.id}_${visitorId}_${filename}_${i}`,
        values: embeddingResponse.data[0].embedding,
        metadata: {
          userId: req.user.id.toString(),
          visitorId,
          filename,
          product,
          field,
          text,
          createdAt: new Date().toISOString()
        }
      });

      console.log("vectors:======", vectors);
    }

    if (vectors.length > 0) {
      await index.upsert(vectors, req.user.id.toString());
    }

    if (user.plan === 'free') {
      user.uploadCount += 1;
      await user.save();
    }

    res.status(200).json({ message: 'Field-level data uploaded successfully.' });
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
app.post('/whatsapp', authenticateApiKey, async (req, res) => {
  const { From: fromNumber, Body: message } = req.body;
  try {
    const user = await User.findById(req.user.id);
    const session = await getSession(fromNumber, user._id);
    const product = findProductFromMessage(message, session.lastProduct);
    const intent = detectIntent(message);

    let reply = '';
    if (product && intent === 'link') {
      const linkEntry = jsonData.find(e => e.product === product && e.field === 'link');
      await twilioClient.messages.create({
        contentSid: process.env.TWILIO_BUTTON_TEMPLATE_SID,
        contentVariables: JSON.stringify({
          product,
          link: linkEntry?.text || 'https://jdwebservices.com/lavedaa'
        }),
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: fromNumber,
      });
      reply = `Check out ${product} here: ${linkEntry?.text}`;
    } else {
      const filter = { userId: user._id };
      if (product) filter.product = product;
      if (intent) filter.field = intent;
      const queryResponse = await index.query({
        vector: await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: message,
        }).then(res => res.data[0].embedding),
        topK: 5,
        includeMetadata: true,
        filter,
        minScore: 0.75,
      });
      const context = queryResponse.matches.map(match => match.metadata.text).join('\n');
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `Provide a concise WhatsApp-friendly response about ${product || 'our products'}. Focus on ${intent || 'relevant details'}. Include links if relevant. Add: "Please consult a physician for persistent issues" for health queries.` },
          { role: 'user', content: `Context: ${context}\n\nQuestion: ${message}` },
        ],
      });
      reply = response.choices[0].message.content;
      await twilioClient.messages.create({
        body: reply,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: fromNumber,
      });
    }

    await Chat.create({ userId: user._id, visitorId: fromNumber, message, reply });
    await updateSession(fromNumber, user._id, { lastProduct: product, lastIntent: intent });
    res.status(200).send('Message processed');
  } catch (err) {
    logger.error(`WhatsApp error: ${err.message}`);
    res.status(500).send('Error processing message');
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
      topK: 20,
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
        topK: 20,
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