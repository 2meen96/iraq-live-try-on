import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Route: AI proxy
  app.post('/api/ai/generateContent', async (req, res) => {
    try {
      const apiKey = process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Missing Gemini API Key on server.' });
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const { model, contents, config } = req.body;

      let response;
      let lastError;
      const PARALLEL_RETRIES = 5;

      for (let attempt = 0; attempt < PARALLEL_RETRIES; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents,
            config
          });
          break; // success
        } catch (error: any) {
          lastError = error;
          console.error(`AI Proxy attempt ${attempt + 1} failed:`, error.message);
          
          if (attempt < PARALLEL_RETRIES - 1) {
              const is503 = error.message && error.message.includes('503');
              // Backoff strategy: 4s, 8s, 12s, 16s... + more if 503
              const waitTime = (is503 ? 6000 : 4000) * (attempt + 1);
              console.log(`Waiting for ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (!response) {
        throw lastError;
      }

      res.json({
        text: response.text,
        candidates: response.candidates
      });
    } catch (error: any) {
      console.error('AI Proxy Error:', error);
      res.status(500).json({ error: error.message || 'Internal AI Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
