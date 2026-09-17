import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { generateTextWithGroq, generateJSONWithGroq } from './groq.js';

dotenv.config();

let aiInstance = null;

export const getGeminiClient = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });
  }
  return aiInstance;
};

const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-2.5-flash'
];

/**
 * Generates text using Gemini with multi-model and Groq fallback
 * @param {string} prompt 
 * @param {string} [systemInstruction] 
 * @returns {Promise<string>}
 */
export const generateText = async (prompt, systemInstruction = '') => {
  const client = getGeminiClient();
  const config = {};
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config,
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini] Model ${model} failed, trying next fallback:`, err.message);
    }
  }

  // Fallback to Groq if all Gemini models fail or hit rate limits
  try {
    console.log('[Gemini Fallback] Attempting generation with Groq...');
    return await generateTextWithGroq(prompt, systemInstruction);
  } catch (groqErr) {
    console.error('All AI providers failed:', groqErr);
    throw lastError || groqErr;
  }
};

/**
 * Generates text embeddings using gemini-embedding-2 (3072 dimensions)
 * @param {string} text 
 * @returns {Promise<number[]>}
 */
export const getEmbedding = async (text) => {
  try {
    if (!text || typeof text !== 'string') {
      return [];
    }
    const client = getGeminiClient();
    const response = await client.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
    });

    if (response.embeddings && response.embeddings[0] && response.embeddings[0].values) {
      return response.embeddings[0].values;
    }
    if (response.embedding && response.embedding.values) {
      return response.embedding.values;
    }
    throw new Error('Failed to retrieve embedding values');
  } catch (error) {
    console.error('Error generating embedding with Gemini:', error);
    // Return a dummy 3072-dim array if API fails, to prevent application crash
    return new Array(3072).fill(0);
  }
};

/**
 * Generates structured JSON output using Gemini with Groq fallback
 * @param {string} prompt 
 * @param {object} [schema] Optional JSON schema to enforce structure
 * @returns {Promise<any>}
 */
export const generateJSON = async (prompt, schema = null) => {
  const client = getGeminiClient();
  const config = {
    responseMimeType: 'application/json',
  };
  if (schema) {
    config.responseSchema = schema;
  }

  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config,
      });
      if (response && response.text) {
        return JSON.parse(response.text);
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini] JSON with model ${model} failed, trying next fallback:`, err.message);
    }
  }

  // Fallback to Groq if Gemini fails
  try {
    console.log('[Gemini Fallback] Attempting JSON generation with Groq...');
    return await generateJSONWithGroq(prompt);
  } catch (groqErr) {
    console.error('All JSON AI providers failed:', groqErr);
    throw lastError || groqErr;
  }
};
