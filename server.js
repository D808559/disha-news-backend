import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import NodeCache from "node-cache";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Cache results for 15 minutes so we don't hammer the news API
const cache = new NodeCache({ stdTTL: 900 });

app.use(cors());

const CATEGORY_MAP = {
  "भारत": { country: "us" },
  "विश्व": { country: "us" },
  "व्यापार": { country: "in", category: "business" },
  "तकनीक": { country: "in", category: "technology" },
  "खेल": { country: "in", category: "sports" },
};

// Rewrites a headline + description in original words using Gemini,
// so we never publish the source's exact wording.
async function rewriteWithGemini(title, description) {
  if (!GEMINI_API_KEY) return { title, description }; // fallback if no key set

  try {
    const prompt = `Rewrite this news headline and description in Hindi, in your own original words, keeping only the facts. Do not copy the exact wording. Reply ONLY in this exact format with no extra text:
TITLE: <rewritten headline>
DESC: <rewritten description, max 40 words>

Original headline: ${title}
Original description: ${description}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const titleMatch = text.match(/TITLE:\s*(.+)/);
    const descMatch = text.match(/DESC:\s*(.+)/);

    return {
      title: titleMatch ? titleMatch[1].trim() : title,
      description: descMatch ? descMatch[1].trim() : description,
    };
  } catch (err) {
    console.error("Gemini rewrite failed:", err);
    return { title, description }; // fallback to original on error
  }
}

app.get("/api/news", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "Server has no NEWS_API_KEY configured. Add it to your .env file.",
      });
    }

    const cat = req.query.cat || "भारत";
    const cacheKey = `news-${cat}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ source: "cache", articles: cached });
    }

    const mapping = CATEGORY_MAP[cat] || CATEGORY_MAP["भारत"];
    const params = new URLSearchParams({
      apiKey: API_KEY,
      country: mapping.country,
      pageSize: "8",
    });
    if (mapping.category) params.set("category", mapping.category);

    const url = `https://newsapi.org/v2/top-headlines?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "ok") {
      return res.status(502).json({ error: data.message || "News provider error" });
    }

    const rawArticles = (data.articles || []).map((a) => ({
      title: a.title,
      description: (a.description || "").slice(0, 180),
      source: a.source?.name || "Unknown",
      url: a.url,
      publishedAt: a.publishedAt,
    }));

    // Rewrite each article with Gemini (runs in parallel for speed)
    const articles = await Promise.all(
      rawArticles.map(async (a) => {
        const rewritten = await rewriteWithGemini(a.title, a.description);
        return { ...a, title: rewritten.title, description: rewritten.description };
      })
    );

    cache.set(cacheKey, articles);
    res.json({ source: "live", articles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong fetching news." });
  }
});

app.get("/", (req, res) => {
  res.send("Disha news backend is running. Try /api/news?cat=भारत");
});

app.listen(PORT, () => {
  console.log(`Disha news backend listening on port ${PORT}`);
});
