const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
// Utilisation de la bibliothèque officielle
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
require("dotenv").config();

const app = express();
// Render injecte son propre PORT, il faut absolument utiliser process.env.PORT
const PORT = process.env.PORT || 5000; 

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// --- CONFIGURATION AI ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// On utilise 1.5-flash (stable et très rapide pour l'OFM)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- SCHEMAS DE VALIDATION ---
const optimizePromptSchema = z.object({
  prompt: z.string().min(3).max(5000),
  mode: z.enum(["photo", "video", "avatar", "ads"]).optional(),
});

// ... (Garde ton normalizeHistory, il est très bien)

// --- ROUTES ---

// Route Santé (Health Check)
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Neural Muse API", status: "Operational" });
});

// Version corrigée de la route d'optimisation (Non-streaming)
app.post("/api/optimize-prompt", async (req, res) => {
  try {
    const parsed = optimizePromptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Payload invalide" });

    const { prompt, mode = "photo" } = parsed.data;

    const systemInstruction = "Tu es un ingénieur de prompt expert. Réponds uniquement avec le prompt final en style premium.";
    
    // Correction de l'appel SDK
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Type: ${mode}. Idée: ${prompt}` }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1200 },
    });

    res.json({ ok: true, text: result.response.text() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur IA" });
  }
});

// --- DÉMARRAGE ---
app.listen(PORT, () => {
  console.log(`🚀 Neural Muse API active sur le port ${PORT}`);
});
