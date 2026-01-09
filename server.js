// Simple Express server for YouTube transcript proxy
// This bypasses CORS restrictions for client-side transcript fetching

import express from 'express';
import cors from 'cors';
import { YouTubeTranscriptApi } from 'youtube-captions-api';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins (frontend)
app.use(cors());
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

    console.log(`[Video API] Successfully fetched metadata for ${videoId}: ${durationSeconds}s`);

    res.json({
      videoId,
      title: videoDetails.title,
      channel: videoDetails.author,
      duration: durationSeconds,
      thumbnail: videoDetails.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
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

    res.json({
      videoId,
      segments,
      fullText: segments.map(s => s.text).join(' '),
      language: result.language_code,
      isGenerated: result.is_generated
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

// Start server
app.listen(PORT, () => {
  console.log(`[Transcript Proxy] Server running on http://localhost:${PORT}`);
  console.log(`[Transcript Proxy] API endpoint: http://localhost:${PORT}/api/transcript/:videoId`);
});
