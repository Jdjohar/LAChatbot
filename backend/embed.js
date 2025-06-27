const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs').promises;
const path = require('path');
const pRetry = require('p-retry');
const winston = require('winston');
require('dotenv').config();


const logger = winston.createLogger({
  transports: [new winston.transports.File({ filename: 'embed.log' })],
});



// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Reference to your Pinecone index
const indexName = process.env.PINECONE_INDEX;
const index = pinecone.Index(indexName);

async function createEmbeddings(userId, jsonFilePath) {
  if (!userId) {
    logger.error('userId is required');
    throw new Error('userId is required');
  }
  try {
    const jsonData = JSON.parse(await fs.readFile(jsonFilePath, 'utf-8'));
    for (const { product, field, text } of jsonData) {
      const embedding = await pRetry(
        () => openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: text,
        }).then(res => res.data[0].embedding),
        { retries: 3, onFailedAttempt: err => logger.warn(`Embedding retry: ${err.message}`) }
      );

      const id = `${userId}_${product.replace(/\s+/g, '_')}_${field}_${Date.now()}`;
      await index.upsert([{
        id,
        values: embedding,
        metadata: { userId, product, field, text, filename: path.basename(jsonFilePath) },
      }]);

      logger.info(`Stored embedding for ${product} - ${field} (ID: ${id})`);
    }
    logger.info('All embeddings stored successfully');
  } catch (error) {
    logger.error(`Error creating embeddings: ${error.message}`);
    throw error;
  }
}


module.exports = { createEmbeddings };

if (require.main === module) {
  const userId = process.argv[2] || process.env.DEFAULT_USER_ID;
  const jsonFilePath = process.argv[3] || './data/products.json';
  createEmbeddings(userId, jsonFilePath).catch(err => {
    logger.error(`Script error: ${err.message}`);
    process.exit(1);
  });
}