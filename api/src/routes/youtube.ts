import { Router, Response, NextFunction } from 'express';
import { ApifyClient } from 'apify-client';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { aiRateLimit } from '../middleware/rateLimit.js';
import { redis } from '../index.js';

const router = Router();

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

const TRANSCRIPT_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

// Extract chapter markers from YouTube video description
function extractChaptersFromDescription(description: string): { title: string; startTime: number }[] {
  if (!description) return [];

  const chapters: { title: string; startTime: number }[] = [];
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

// Validate YouTube video ID format
function isValidVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

// GET /api/youtube/video/:videoId - Fetch video metadata
router.get('/video/:videoId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const videoId = req.params.videoId as string;

    if (!isValidVideoId(videoId)) {
      throw new AppError(400, 'Invalid video ID format', 'INVALID_VIDEO_ID');
    }

    console.log(`[YouTube API] Fetching metadata for video: ${videoId}`);

    const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en',
      },
    });

    if (!pageResponse.ok) {
      throw new AppError(pageResponse.status, 'Failed to fetch YouTube page', 'YOUTUBE_FETCH_ERROR');
    }

    const html = await pageResponse.text();

    const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/s);
    if (!playerMatch) {
      throw new AppError(404, 'Could not extract video data', 'VIDEO_DATA_NOT_FOUND');
    }

    const playerData = JSON.parse(playerMatch[1]);

    if (!playerData.videoDetails) {
      throw new AppError(404, 'Video details not found', 'VIDEO_NOT_FOUND');
    }

    const videoDetails = playerData.videoDetails;
    const durationSeconds = parseInt(videoDetails.lengthSeconds) || 0;
    const description = videoDetails.shortDescription || '';

    console.log(`[YouTube API] Successfully fetched metadata for ${videoId}: ${durationSeconds}s`);

    res.json({
      videoId,
      title: videoDetails.title,
      channel: videoDetails.author,
      duration: durationSeconds,
      thumbnail: videoDetails.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      description,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/youtube/transcript/:videoId - Fetch transcript via Apify with Redis caching
router.get('/transcript/:videoId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const videoId = req.params.videoId as string;
    const userId = req.user!.id;

    if (!isValidVideoId(videoId)) {
      throw new AppError(400, 'Invalid video ID format', 'INVALID_VIDEO_ID');
    }

    // Check rate limit
    const rateLimit = await aiRateLimit(userId, req.user!.tier);
    if (!rateLimit.allowed) {
      throw new AppError(429, 'Rate limit exceeded', 'RATE_LIMITED');
    }

    // Check Redis cache
    const cacheKey = `transcript:${userId}:${videoId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[YouTube API] Cache hit for transcript ${videoId}`);
      const parsed = JSON.parse(cached);
      return res.json({ ...parsed, cached: true });
    }

    console.log(`[YouTube API] Fetching transcript via Apify for video: ${videoId}`);

    if (!process.env.APIFY_API_TOKEN) {
      throw new AppError(500, 'Apify API token not configured', 'APIFY_NOT_CONFIGURED');
    }

    // Call Apify actor
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const run = await apifyClient.actor('supreme_coder/youtube-transcript-scraper').call({
      urls: [{ url }],
      outputFormat: 'json',
    });

    // Fetch results from the dataset
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new AppError(404, 'No transcript available for this video', 'TRANSCRIPT_NOT_FOUND');
    }

    const item = items[0] as Record<string, unknown>;

    // Extract transcript data - Apify returns segments with text, start, duration (in seconds)
    const rawSegments = (item.captions || item.transcript || []) as Array<{ text: string; start: number; duration: number }>;

    if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
      throw new AppError(404, 'No transcript segments found', 'TRANSCRIPT_EMPTY');
    }

    // Transform: seconds -> milliseconds for offset/duration
    const segments = rawSegments.map((seg) => ({
      text: seg.text,
      offset: Math.round(seg.start * 1000),
      duration: Math.round(seg.duration * 1000),
    }));

    // Extract chapters from video description
    let chapters: { title: string; startTime: number }[] = [];
    const videoDetails = item.videoDetails as Record<string, unknown> | undefined;
    if (videoDetails?.shortDescription) {
      chapters = extractChaptersFromDescription(videoDetails.shortDescription as string);
    }

    // If no chapters from Apify metadata, try fetching from YouTube page
    if (chapters.length === 0) {
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
        console.log(`[YouTube API] Could not extract chapters: ${(chapterError as Error).message}`);
      }
    }

    const language = (item.language as string) || 'en';
    const isGenerated = (item.isGenerated as boolean) ?? false;

    const result = {
      videoId,
      segments,
      fullText: segments.map((s) => s.text).join(' '),
      language,
      isGenerated,
      chapters,
    };

    // Cache in Redis
    await redis.set(cacheKey, JSON.stringify(result), 'EX', TRANSCRIPT_CACHE_TTL);

    console.log(`[YouTube API] Successfully fetched ${segments.length} segments for ${videoId}`);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
