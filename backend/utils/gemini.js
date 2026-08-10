import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

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

/**
 * Generates text using Gemini 2.5 Flash
 * @param {string} prompt 
 * @param {string} [systemInstruction] 
 * @returns {Promise<string>}
 */
export const generateText = async (prompt, systemInstruction = '') => {
  try {
    const client = getGeminiClient();
    const config = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config,
    });

    return response.text;
  } catch (error) {
    console.error('Error generating text with Gemini:', error);
    throw error;
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
 * Generates structured JSON output
 * @param {string} prompt 
 * @param {object} [schema] Optional JSON schema to enforce structure
 * @returns {Promise<any>}
 */
export const generateJSON = async (prompt, schema = null) => {
  try {
    const client = getGeminiClient();
    const config = {
      responseMimeType: 'application/json',
    };
    if (schema) {
      config.responseSchema = schema;
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config,
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error('Error generating JSON with Gemini:', error);
    throw error;
  }
};
