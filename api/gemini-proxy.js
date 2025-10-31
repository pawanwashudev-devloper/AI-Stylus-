// Vercel Serverless Function to proxy Gemini API requests
import { GoogleGenAI, Modality } from "@google/genai";

// Initialize the AI client with the API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, model, contents, config } = req.body;

    // Validate required fields
    if (!action || !model || !contents) {
      return res.status(400).json({ error: 'Missing required fields: action, model, contents' });
    }

    // Call the Gemini API
    const response = await ai.models.generateContent({
      model,
      contents,
      config
    });

    // Return the response based on action type
    if (action === 'analyzeIdea') {
      return res.status(200).json({ text: response.text.trim() });
    } else if (action === 'generateImage') {
      // Extract image data from response
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
          return res.status(200).json({ imageData: part.inlineData.data });
        }
      }
      return res.status(500).json({ error: "No image data found in the AI's response." });
    } else {
      return res.status(400).json({ error: 'Invalid action type' });
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process request', 
      details: error.message 
    });
  }
}
