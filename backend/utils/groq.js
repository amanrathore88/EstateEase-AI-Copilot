import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

export const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GROQ_API_KEY is not defined in the environment variables.");
  }
  return new Groq({ apiKey: apiKey || 'dummy-key' });
};

/**
 * Generates text using Groq (Llama-3.3-70b-versatile)
 * @param {string} prompt 
 * @param {string} [systemInstruction] 
 * @returns {Promise<string>}
 */
export const generateTextWithGroq = async (prompt, systemInstruction = '') => {
  try {
    const client = getGroqClient();
    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const chatCompletion = await client.chat.completions.create({
      messages,
      model: 'openai/gpt-oss-20b',
      temperature: 0.3,
      max_completion_tokens: 1024,
    });

    return chatCompletion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating text with Groq:', error);
    throw error;
  }
};

/**
 * Generates structured JSON output using Groq
 * @param {string} prompt 
 * @returns {Promise<any>}
 */
export const generateJSONWithGroq = async (prompt) => {
  try {
    const client = getGroqClient();
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant designed to output JSON. You must return a valid JSON object matching the requested structure.'
      },
      { role: 'user', content: prompt }
    ];

    const chatCompletion = await client.chat.completions.create({
      messages,
      model: 'openai/gpt-oss-20b',
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    return JSON.parse(chatCompletion.choices[0].message.content);
  } catch (error) {
    console.error('Error generating JSON with Groq:', error);
    throw error;
  }
};
