import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import NodeCache from "node-cache";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.NEWS_API_KEY;

// Cache results for 15 minutes so we don't hammer the news API
// (free plans have daily request limits).
const cache = new NodeCache({ stdTTL: 900 });

app.use(cors());

// Map our site's Hindi category names to NewsAPI's category param.
const CATEGORY_MAP = {
  "भारत": { country: "in" },
  "विश्व": { country: "us" }, // NewsAPI has no single "world" endpoint; pick a broad source
  "व्यापार": { country: "in", category: "business" },
  "तकनीक": { country: "in", category: "technology" },
  "खेल": { country: "in", category: "sports" },
};

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

    // IMPORTANT (copyright): only forward short fields — headline, a short
    // description, the source name, and a link back to the original article.
    // Never forward or store the full article body/content field.
    const articles = (data.articles || []).map((a) => ({
      title: a.title,
      // Trim description defensively so we never pass through a long excerpt.
      description: (a.description || "").slice(0, 180),
      source: a.source?.name || "Unknown",
      url: a.url,
      publishedAt: a.publishedAt,
    }));

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
