import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

// HIPAA: API keys MUST come from environment variables — never hardcoded in source
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('[HIPAA] GEMINI_API_KEY environment variable is not set. Server cannot start safely.');
  process.exit(1);
}
const MODEL = 'gemini-2.5-flash-lite';
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function geminiComplete(systemPrompt: string, userMessage: string, history?: { role: string; content: string }[]): Promise<string> {
  // Build a single prompt string that includes history for reliability
  let fullPrompt = systemPrompt + "\n\n";
  if (history && history.length > 0) {
    for (const msg of history) {
      fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    }
  }
  fullPrompt += `User: ${userMessage}\nAssistant:`;

  const result = await genAI.models.generateContent({
    model: MODEL,
    contents: fullPrompt,
    config: { maxOutputTokens: 400, temperature: 0.3 }
  });
  return result.text ?? "No response generated.";
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Chatbot Route — Gemini 2.5 Flash Lite (fast)
  app.post("/api/chat", async (req: any, res: any) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }
      const systemMsg = messages.find((m: any) => m.role === 'system');
      const history = messages.filter((m: any) => m.role !== 'system' && m.role !== 'user' || false).slice(0, -1);
      const chatHistory = messages.filter((m: any) => m.role !== 'system');
      const lastMsg = chatHistory[chatHistory.length - 1];
      const prevHistory = chatHistory.slice(0, -1);

      const text = await geminiComplete(
        systemMsg?.content || 'You are HealixAI, a concise medical assistant.',
        lastMsg?.content || '',
        prevHistory
      );
      res.json({ choices: [{ message: { role: 'assistant', content: text } }] });
    } catch {
      // HIPAA: Do not expose internal error details — they may reference PHI
      res.status(500).json({ error: 'Internal server error. Please try again.' });
    }
  });

  // Medical Analysis Route — Gemini 2.5 Flash Lite
  app.post("/api/medical-analysis", async (req: any, res: any) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      const text = await geminiComplete(
        'You are HealixAI, a professional AI Medical Assistant. Be concise, structured, and always include a disclaimer.',
        prompt
      );
      res.json({ choices: [{ message: { role: 'assistant', content: text } }] });
    } catch {
      // HIPAA: Do not expose internal error details
      res.status(500).json({ error: 'Internal server error. Please try again.' });
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
    app.get('*', (req: any, res: any) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server (Gemini Flash) running on http://localhost:${PORT}`);
  });
}

startServer();
