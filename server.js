// Simple Express server for YouTube transcript proxy
// This bypasses CORS restrictions for client-side transcript fetching

import express from 'express';
import cors from 'cors';
import { YouTubeTranscriptApi } from 'youtube-captions-api';

const app = express();
const PORT = process.env.PROXY_PORT || process.env.PORT || 3002;

// Phase 12: Extract chapter markers from YouTube video description
function extractChaptersFromDescription(description) {
  if (!description) return [];

  const chapters = [];
  // Match lines starting with timestamps like 0:00, 1:23, 01:23, 1:23:45
  const lines = description.split('\n');
  const timestampRegex = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)/;

  for (const line of lines) {
    const match = line.trim().match(timestampRegex);
    if (match) {
      const hours = match[1] ? parseInt(match[1], 10) : 0;
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const startTime = hours * 3600 + minutes * 60 + seconds;
      const title = match[4].trim();
      if (title.length > 0) {
        chapters.push({ title, startTime });
      }
    }
  }

  return chapters;
}

// Enable CORS for frontend origin with credentials support
// Accept multiple localhost ports since Vite may use 5173, 5174, 5175, etc.
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow any localhost origin for development
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Transcript proxy server is running' });
});

// Video metadata endpoint - fetches duration from YouTube page
app.get('/api/video/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  console.log(`[Video API] Fetching metadata for video: ${videoId}`);

  try {
    const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en'
      },
    });

    if (!pageResponse.ok) {
      return res.status(pageResponse.status).json({
        error: 'Failed to fetch YouTube page',
        videoId
      });
    }

    const html = await pageResponse.text();

    // Extract ytInitialPlayerResponse which contains video details
    const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/s);
    if (!playerMatch) {
      return res.status(404).json({
        error: 'Could not extract video data',
        videoId
      });
    }

    const playerData = JSON.parse(playerMatch[1]);

    if (!playerData.videoDetails) {
      return res.status(404).json({
        error: 'Video details not found',
        videoId
      });
    }

    const videoDetails = playerData.videoDetails;
    const durationSeconds = parseInt(videoDetails.lengthSeconds) || 0;

    // Phase 12: Extract video description for chapter markers and source detection
    const description = videoDetails.shortDescription || '';

    console.log(`[Video API] Successfully fetched metadata for ${videoId}: ${durationSeconds}s`);

    res.json({
      videoId,
      title: videoDetails.title,
      channel: videoDetails.author,
      duration: durationSeconds,
      thumbnail: videoDetails.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      description,
    });

  } catch (error) {
    console.error(`[Video API] Error fetching metadata for ${videoId}:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch video metadata',
      message: error.message,
      videoId
    });
  }
});

// Create transcript API instance
const transcriptApi = new YouTubeTranscriptApi();

// Transcript extraction endpoint
app.get('/api/transcript/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  console.log(`[Transcript API] Fetching transcript for video: ${videoId}`);

  try {
    const result = await transcriptApi.fetch(videoId);

    if (!result || !result.snippets || result.snippets.length === 0) {
      return res.status(404).json({
        error: 'No transcript available for this video',
        videoId
      });
    }

    console.log(`[Transcript API] Successfully fetched ${result.snippets.length} segments for ${videoId}`);

    // Transform to our expected format
    const segments = result.snippets.map((item) => ({
      text: item.text,
      offset: Math.round(item.start * 1000), // Convert seconds to milliseconds
      duration: Math.round(item.duration * 1000), // Convert seconds to milliseconds
    }));

    // Phase 12: Attempt to extract chapter markers from video description
    let chapters = [];
    try {
      const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      });
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/s);
        if (playerMatch) {
          const playerData = JSON.parse(playerMatch[1]);
          const description = playerData.videoDetails?.shortDescription || '';
          chapters = extractChaptersFromDescription(description);
        }
      }
    } catch (chapterError) {
      console.log(`[Transcript API] Could not extract chapters: ${chapterError.message}`);
    }

    res.json({
      videoId,
      segments,
      fullText: segments.map(s => s.text).join(' '),
      language: result.language_code,
      isGenerated: result.is_generated,
      chapters,
    });

  } catch (error) {
    console.error(`[Transcript API] Error fetching transcript for ${videoId}:`, error.message);
    console.error(`[Transcript API] Full error:`, error);

    // Handle specific error types
    if (error.name === 'TranscriptsDisabled' || error.message?.includes('Transcripts are disabled')) {
      return res.status(404).json({
        error: 'Transcripts are disabled for this video',
        videoId
      });
    }

    if (error.message?.includes('Could not retrieve') || error.message?.includes('No transcript found')) {
      return res.status(404).json({
        error: 'Transcript not available. The video may not have captions.',
        videoId
      });
    }

    if (error.message?.includes('unavailable') || error.message?.includes('private') || error.message?.includes('unplayable')) {
      return res.status(403).json({
        error: 'Video is unavailable or private',
        videoId
      });
    }

    res.status(500).json({
      error: 'Failed to fetch transcript',
      message: error.message,
      videoId
    });
  }
});

// Server-side validation endpoint for settings
app.post('/api/validate/settings', (req, res) => {
  const { userName, language } = req.body;
  const errors = {};

  console.log(`[Validation API] Validating settings:`, { userName: userName ? '***' : 'empty', language });

  // Username validation
  if (!userName || typeof userName !== 'string') {
    errors.userName = 'Username is required';
  } else {
    const trimmedName = userName.trim();
    if (!trimmedName) {
      errors.userName = 'Username cannot be empty or whitespace only';
    } else if (trimmedName.length > 50) {
      errors.userName = 'Username must be 50 characters or less';
    }
  }

  // Language validation
  const validLanguages = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh'];
  if (!language || typeof language !== 'string') {
    errors.language = 'Language is required';
  } else if (!validLanguages.includes(language)) {
    errors.language = 'Invalid language selection';
  }

  if (Object.keys(errors).length > 0) {
    console.log(`[Validation API] Validation failed:`, errors);
    return res.status(400).json({
      error: 'Validation failed',
      errors
    });
  }

  console.log(`[Validation API] Validation passed`);
  res.json({
    success: true,
    message: 'Settings are valid'
  });
});

// Server-side validation endpoint for YouTube URL
app.post('/api/validate/youtube-url', (req, res) => {
  const { url } = req.body;

  console.log(`[Validation API] Validating YouTube URL:`, url);

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      error: 'Validation failed',
      errors: { url: 'URL is required' }
    });
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return res.status(400).json({
      error: 'Validation failed',
      errors: { url: 'URL cannot be empty or whitespace only' }
    });
  }

  // Match various YouTube URL formats
  const youtubePatterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
  ];

  const isValidYouTube = youtubePatterns.some((pattern) => pattern.test(trimmedUrl));

  if (!isValidYouTube) {
    console.log(`[Validation API] Invalid YouTube URL`);
    return res.status(400).json({
      error: 'Validation failed',
      errors: { url: 'Please enter a valid YouTube URL (youtube.com/watch?v=... or youtu.be/...)' }
    });
  }

  console.log(`[Validation API] YouTube URL is valid`);
  res.json({
    success: true,
    message: 'YouTube URL is valid'
  });
});

// Gemini AI proxy endpoint - uses server-side API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

app.post('/api/ai/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!GEMINI_API_KEY) {
    console.error('[AI API] GEMINI_API_KEY not configured');
    return res.status(500).json({ error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.' });
  }

  console.log(`[AI API] Processing request with prompt length: ${prompt.length}`);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Handle rate limiting specifically (HTTP 429)
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        return res.status(429).json({
          error: `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`,
          retryAfter
        });
      }

      // Handle quota exceeded
      const errorMessage = errorData.error?.message || response.statusText;
      if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate')) {
        return res.status(429).json({
          error: 'API quota exceeded. Please wait a few minutes before trying again.',
          retryAfter: 60
        });
      }

      console.error(`[AI API] Gemini API error: ${response.status} - ${errorMessage}`);
      return res.status(response.status).json({ error: `AI API error: ${errorMessage}` });
    }

    const data = await response.json();

    if (data.error) {
      // Check for rate limit errors in response body
      if (data.error.message.toLowerCase().includes('quota') ||
          data.error.message.toLowerCase().includes('rate')) {
        return res.status(429).json({
          error: 'API rate limit reached. Please wait a few minutes before trying again.',
          retryAfter: 60
        });
      }
      console.error(`[AI API] Gemini API error in response:`, data.error);
      return res.status(500).json({ error: `AI API error: ${data.error.message}` });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: 'No response from AI API' });
    }

    console.log(`[AI API] Successfully generated response with length: ${text.length}`);
    res.json({ text });
  } catch (error) {
    console.error(`[AI API] Error:`, error.message);
    res.status(500).json({ error: `AI service error: ${error.message}` });
  }
});

// Phase 12.3: Proxy endpoint for fetching external source content
app.post('/api/sources/fetch', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`[Sources API] Fetching content from: ${url}`);

  try {
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
      .slice(0, 10000); // Cap at 10k chars

    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    res.json({ content, title, statusCode: response.status });
  } catch (error) {
    console.error(`[Sources API] Error fetching ${url}:`, error.message);
    res.json({ error: error.message, content: '', title: url, statusCode: 0 });
  }
});

// Phase 12.3: AI summarization endpoint for external sources
app.post('/api/ai/summarize-source', async (req, res) => {
  const { content, videoTitle, url } = req.body;

  if (!content || !videoTitle) {
    return res.status(400).json({ error: 'Content and videoTitle are required' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  try {
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

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'AI API error' });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: 'No AI response' });
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(jsonStr);
    res.json(result);
  } catch (error) {
    console.error(`[AI API] Summarize source error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[Transcript Proxy] Server running on http://localhost:${PORT}`);
  console.log(`[Transcript Proxy] API endpoint: http://localhost:${PORT}/api/transcript/:videoId`);
  console.log(`[Transcript Proxy] AI endpoint: http://localhost:${PORT}/api/ai/generate`);
  console.log(`[Transcript Proxy] Validation endpoints: /api/validate/settings, /api/validate/youtube-url`);
  if (!GEMINI_API_KEY) {
    console.warn('[Transcript Proxy] Warning: GEMINI_API_KEY not set. AI features will not work.');
  }
});
