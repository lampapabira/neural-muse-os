const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Trop de requêtes, réessaie dans une minute." },
});
app.use("/api", limiter);

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY manquante dans .env");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

function normalizeHistory(history) {
  if (typeof history === "string") return history;
  return history
    .map((m) => `[${m.role || "user"}] ${m.text}`)
    .join("\n");
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Neural Muse API",
    model: "gemini-2.5-flash",
  });
});

app.post("/api/optimize-prompt", async (req, res) => {
  try {
    const parsed = optimizePromptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Payload invalide",
        details: parsed.error.flatten(),
      });
    }

    const { prompt, mode = "photo" } = parsed.data;

    const systemInstruction = `
Tu es un ingénieur de prompt expert.
Ta mission est de transformer une idée brute en prompt premium, précis, visuel et directement exploitable.

Règles :
- Réponds uniquement avec le prompt final
- Pas d'explications
- Niveau professionnel
- Style détaillé, cohérent, haut de gamme
`;

    const userPrompt = `
Type de rendu : ${mode}

Transforme cette idée en prompt ultra détaillé :

${prompt}

Contraintes à intégrer intelligemment :
- rendu cinématographique
- lumière professionnelle
- composition claire
- détails visuels riches
- réalisme élevé
- qualité premium
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.8,
        maxOutputTokens: 1200,
      },
    });

    res.json({
      ok: true,
      mode,
      text: response.text || "",
    });
  } catch (error) {
    console.error("optimize-prompt error:", error);
    res.status(500).json({
      ok: false,
      error: "Erreur lors de l’optimisation du prompt",
    });
  }
});

app.post("/api/chat-suggest", async (req, res) => {
  try {
    const parsed = chatSuggestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Payload invalide",
        details: parsed.error.flatten(),
      });
    }

    const { messageHistory, tone = "natural" } = parsed.data;
    const historyText = normalizeHistory(messageHistory);

    const systemInstruction = `
Tu es un expert en communication émotionnelle, psychologie conversationnelle et rédaction de réponses naturelles.
Tu analyses un historique et tu proposes des réponses crédibles, fluides, modernes et adaptées au contexte social.
`;

    const userPrompt = `
Analyse cet historique :

${historyText}

Objectif :
- comprendre le ton,
- détecter le niveau d'intérêt,
- proposer 3 réponses adaptées.

Ton principal demandé : ${tone}

Format attendu :
Analyse rapide :
...
Réponse 1 :
...
Réponse 2 :
...
Réponse 3 :
...
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.9,
        maxOutputTokens: 1000,
      },
    });

    res.json({
      ok: true,
      tone,
      suggestion: response.text || "",
    });
  } catch (error) {
    console.error("chat-suggest error:", error);
    res.status(500).json({
      ok: false,
      error: "Erreur lors de la génération de la suggestion",
    });
  }
});

app.post("/api/optimize-prompt-stream", async (req, res) => {
  try {
    const parsed = optimizePromptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalide" });
    }

    const { prompt, mode = "photo" } = parsed.data;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: `
Transforme cette idée en prompt ${mode} premium, détaillé et directement exploitable :

${prompt}
      `,
      config: {
        systemInstruction:
          "Tu es un ingénieur de prompt expert. Retourne uniquement le prompt final.",
        temperature: 0.8,
        maxOutputTokens: 1200,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text || "";
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur streaming" });
    } else {
      res.end();
    }
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

app.listen(PORT, () => {
  console.log(`Serveur Neural Muse actif sur le port ${PORT}`);
});
