import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

// Ultra-fast, highly reliable models defined in SKILL.md
const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const BACKUP_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

// Health / status endpoint
app.get('/api/health', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({
    status: 'ok',
    geminiConnected: hasKey,
    model: PRIMARY_MODEL,
  });
});

const BASE_SYSTEM_INSTRUCTION = `You are EcoGuide, a friendly, encouraging, and knowledgeable environmental awareness assistant.

Language & Multilingual Indian Support (Crucial Rule):
- India is wonderfully diverse and you must support ALL Indian languages and scripts, plus English and colloquial mixes.
- Supported languages include (but are not limited to):
  * Hindi (हिन्दी) & Hinglish (Hindi in Roman script)
  * Bengali (বাংলা) & Banglish
  * Telugu (తెలుగు) & Teluglish
  * Marathi (मराठी)
  * Tamil (தமிழ்) & Tanglish
  * Gujarati (ગુજરાતી)
  * Kannada (ಕನ್ನಡ)
  * Malayalam (മലയാളം)
  * Punjabi (ਪੰਜਾਬੀ)
  * Odia (ଓଡ଼ିଆ)
  * Assamese (অসমীয়া)
  * Urdu (اردو)
  * English
- Script & Style Matching:
  * If the user writes in a native Indian script (e.g. Devanagari हिन्दी, বাংলা, தமிழ், తెలుగు, ગુજરાતી, etc.), respond fluently and respectfully in that exact native script.
  * If the user writes in Roman transliteration (e.g. Hinglish "paani kaise bachaye", Tanglish, Kanglish, etc.), reply naturally in that same Romanized conversational style.
  * If the user writes in English, respond in clear, accessible English.
  * If an explicit preferred language is specified in the prompt instructions, prioritize responding in that requested language.

Content & Practical Relevance:
- Offer practical, realistic eco-friendly tips relevant to Indian homes, cities, and villages (e.g. cloth jhola/bags, steel dabbas, earthen matkas, terrace gardens, kitchen waste composting, saving water during daily chores, energy-efficient appliances, local indigenous trees like Neem, Peepal, Tulsi).
- Use clear bullet points, bold key actions, and an optimistic, encouraging tone.`;

// Secure Chat Endpoint
app.post('/api/chat', async (req, res) => {
  const { message, history = [], stream = true, language = 'auto' } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required and cannot be empty.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server. Please ensure the API key is attached in Settings > Secrets.',
    });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Construct dynamic system instruction respecting preferred language
  let systemInstruction = BASE_SYSTEM_INSTRUCTION;
  if (language && language !== 'auto') {
    systemInstruction += `\n\nUSER PREFERENCE: The user has explicitly selected "${language}" as their preferred language. Please formulate your entire response in ${language}.`;
  }

  // Format previous turns for context
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  if (Array.isArray(history)) {
    for (const item of history.slice(-6)) {
      if (item && item.content && (item.role === 'user' || item.role === 'model')) {
        contents.push({
          role: item.role,
          parts: [{ text: String(item.content) }],
        });
      }
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: message.trim() }],
  });

  const modelsToTry = [PRIMARY_MODEL, ...BACKUP_MODELS];

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    for (const model of modelsToTry) {
      try {
        const responseStream = await ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        for await (const chunk of responseStream) {
          const textChunk = chunk.text;
          if (textChunk) {
            res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
          }
        }

        res.write('data: [DONE]\n\n');
        return res.end();
      } catch (err: any) {
        console.warn(`Streaming attempt with model ${model} failed:`, err?.message);
        // Continue to backup model
      }
    }

    // Fallback if all streams encountered temporary issue
    res.write(`data: ${JSON.stringify({ error: 'API connection mein temporary issue hai. Kripya thodi der baad dobara koshish karein.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  } else {
    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        const replyText = response.text || 'No response generated.';
        return res.json({ reply: replyText });
      } catch (err: any) {
        console.warn(`Unary generation with model ${model} failed:`, err?.message);
      }
    }

    return res.status(500).json({
      error: 'API connection mein temporary issue hai. Kripya thodi der baad dobara koshish karein.',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`EcoGuide Server listening on port ${port} (http://localhost:${port})`);
  });
}

startServer();
