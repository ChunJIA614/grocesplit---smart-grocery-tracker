import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const PORT = 3000;
const MODEL_NAME = 'gemma-3-4b-it';

// Lazy-initialize Gemini SDK to prevent crashes if key is missing on start
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required. Please set it in Settings/Variables.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.post('/api/parse-grocery', async (req, res) => {
    try {
      const { text, users } = req.body;
      if (!text || !users) {
        return res.status(400).json({ error: 'text and users are required' });
      }

      let ai;
      try {
        ai = getAiClient();
      } catch (e: any) {
        console.warn('Gemini initialization failed:', e.message);
        return res.status(503).json({ error: e.message });
      }

      const userNames = users.map((u: any) => u.name).join(', ');
      const prompt = `You are a grocery parsing assistant. Extract grocery items from this text and return valid JSON.

Text: "${text}"

Available users for cost splitting: ${userNames}

Instructions:
- If text mentions who items are for (e.g. "for everyone", "for me and Alice"), map to matching user names
- If not specified, include all users
- Return ONLY a JSON array, no other text

JSON format:
[{"name": "item name", "quantity": 1, "unit": "pcs", "totalPrice": 0.00, "sharedBy": ["User1", "User2"]}]

Parse the text now:`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });

      const responseText = response.text || '[]';
      
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // Try to find JSON array directly
        const arrayMatch = responseText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          jsonStr = arrayMatch[0];
        }
      }
      
      const parsed = JSON.parse(jsonStr);
      res.json(Array.isArray(parsed) ? parsed : []);
    } catch (error: any) {
      console.error('API parse-grocery error:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  app.post('/api/suggest-recipe', async (req, res) => {
    try {
      const { ingredients } = req.body;
      if (!ingredients || !Array.isArray(ingredients)) {
        return res.status(400).json({ error: 'ingredients array is required' });
      }

      let ai;
      try {
        ai = getAiClient();
      } catch (e: any) {
        console.warn('Gemini initialization failed:', e.message);
        return res.status(503).json({ error: e.message });
      }

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `I have these ingredients: ${ingredients.join(', ')}. 
Suggest ONE simple recipe in this exact format:
**Recipe Name** - Brief one-sentence description.`,
      });

      res.json({ recipe: response.text || 'Could not generate recipe.' });
    } catch (error: any) {
      console.error('API suggest-recipe error:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // Serve Frontend with Vite / Static Files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
