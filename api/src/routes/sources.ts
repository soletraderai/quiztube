import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { aiRateLimit } from '../middleware/rateLimit.js';

const router = Router();

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// POST /api/sources/fetch - Fetch external source content
router.post('/fetch', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      throw new AppError(400, 'URL is required', 'INVALID_INPUT');
    }

    console.log(`[Sources API] Fetching content from: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch URL: ${response.statusText}`,
        statusCode: response.status,
      });
    }

    const html = await response.text();
    // Strip HTML tags, keep meaningful text
    const content = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);

    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    res.json({ content, title, statusCode: response.status });
  } catch (error) {
    console.error(`[Sources API] Error fetching:`, (error as Error).message);
    res.json({ error: (error as Error).message, content: '', title: req.body.url, statusCode: 0 });
  }
});

// POST /api/sources/summarize - AI summarization for external sources
router.post('/summarize', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { content, videoTitle, url } = req.body;

    if (!content || !videoTitle) {
      throw new AppError(400, 'Content and videoTitle are required', 'INVALID_INPUT');
    }

    const rateLimit = await aiRateLimit(req.user!.id, req.user!.tier);
    if (!rateLimit.allowed) {
      throw new AppError(429, 'AI rate limit exceeded', 'RATE_LIMITED');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError(500, 'AI service not configured', 'AI_NOT_CONFIGURED');
    }

    const prompt = `Analyze this web page content and provide a summary relevant to the video "${videoTitle}".

URL: ${url}
Content (first 5000 chars):
${content.slice(0, 5000)}

Respond in valid JSON with exactly these fields:
{
  "title": "A clear, descriptive title for this source",
  "summary": "A 2-3 sentence summary of the content",
  "relevance": "How this source relates to the video topic"
}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      throw new AppError(response.status, 'AI API error', 'AI_API_ERROR');
    }

    const data = await response.json() as Record<string, any>;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AppError(500, 'No AI response', 'AI_NO_RESPONSE');
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(jsonStr);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
