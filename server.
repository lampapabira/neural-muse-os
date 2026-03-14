const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARES ---
app.use(helmet({
  contentSecurityPolicy: false, // Nécessaire pour charger Tailwind et les scripts externes facilement
}));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// --- SERVIR LE FRONTEND ---
// Cette ligne est CRITIQUE : elle rend le dossier "public" accessible
app.use(express.static("public")); 

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Trop de requêtes, réessaie dans une minute." },
});
app.use("/api", limiter);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- ROUTES API ---

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Neural Muse API" });
});

app.post("/api/optimize-prompt", async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await model.generateContent(`Tu es un expert en prompt engineering. Transforme cette idée en prompt ultra-détaillé et pro pour une génération d'image : ${prompt}`);
    res.json({ ok: true, text: result.response.text() });
  } catch (error) {
    res.status(500).json({ error: "Erreur IA" });
  }
});

app.post("/api/chat-suggest", async (req, res) => {
  try {
    const { messageHistory } = req.body;
    const result = await model.generateContent(`Analyse cette conversation OnlyFans et propose 3 réponses de vente séduisantes : ${messageHistory}`);
    res.json({ ok: true, suggestion: result.response.text() });
  } catch (error) {
    res.status(500).json({ error: "Erreur IA" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur Neural Muse actif sur le port ${PORT}`);
});
