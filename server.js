const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
// IMPORTANT : Render utilise process.env.PORT
const PORT = process.env.PORT || 5000;

// Sécurité et Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(express.static("public"));

// Limiteur de requêtes (Anti-spam / Anti-bot)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limite chaque IP à 30 requêtes par minute
  message: { error: "Trop de requêtes, réessaie dans une minute." },
});
app.use("/api", limiter);

// Vérification de la clé API
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY manquante dans les variables d'environnement");
  process.exit(1);
}

// Initialisation de Google AI (Gemini 1.5 Flash est idéal pour l'OFM : rapide et pas cher)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- SCHÉMAS DE VALIDATION (ZOD) ---
const optimizePromptSchema = z.object({
  prompt: z.string().min(3).max(5000),
  mode: z.enum(["photo", "video", "avatar", "ads"]).optional(),
});

const chatSuggestSchema = z.object({
  messageHistory: z.union([
    z.string().min(3).max(20000),
    z.array(
      z.object({
        role: z.enum(["user", "assistant", "system"]).optional(),
        text: z.string().min(1).max(5000),
      })
    ),
  ]),
  tone: z.enum(["natural", "seductive", "premium"]).optional(),
});

// Helper pour normaliser l'historique
function normalizeHistory(history) {
  if (typeof history === "string") return history;
  return history
    .map((m) => `[${m.role || "user"}] ${m.text}`)
    .join("\n");
}

// --- ROUTES API ---

// 1. Santé du serveur
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Neural Muse API",
    status: "Operational",
    model: "gemini-1.5-flash"
  });
});

// 2. Optimisation de Prompt (Génération d'images/vidéos pour modèles)
app.post("/api/optimize-prompt", async (req, res) => {
  try {
    const parsed = optimizePromptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalide", details: parsed.error.flatten() });
    }

    const { prompt, mode = "photo" } = parsed.data;

    const fullPrompt = `Tu es un ingénieur de prompt expert. 
    Transforme cette idée en prompt ${mode} premium, ultra-détaillé, réaliste et haut de gamme.
    Réponds uniquement avec le prompt final, sans explications.
    Idée de base : ${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    
    res.json({
      ok: true,
      mode,
      text: response.text() || "",
    });
  } catch (error) {
    console.error("optimize-prompt error:", error);
    res.status(500).json({ ok: false, error: "Erreur lors de l'optimisation" });
  }
});

// 3. Chat Suggest (Aide aux chatters pour la vente/sourcing)
app.post("/api/chat-suggest", async (req, res) => {
  try {
    const parsed = chatSuggestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalide", details: parsed.error.flatten() });
    }

    const { messageHistory, tone = "natural" } = parsed.data;
    const historyText = normalizeHistory(messageHistory);

    const userPrompt = `Analyse cet historique de chat OFM :
    ${historyText}
    
    Objectif : Comprendre le contexte et proposer 3 réponses adaptées au ton "${tone}".
    Format : Analyse rapide suivie des 3 suggestions de réponses.`;

    const result = await model.generateContent(userPrompt);
    const response = await result.response;

    res.json({
      ok: true,
      tone,
      suggestion: response.text() || "",
    });
  } catch (error) {
    console.error("chat-suggest error:", error);
    res.status(500).json({ ok: false, error: "Erreur lors de la suggestion" });
  }
});

// Gestion 404
app.use((req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Neural Muse actif sur le port ${PORT}`);
});
