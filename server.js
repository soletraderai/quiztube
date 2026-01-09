// Simple Express server for YouTube transcript proxy
// This bypasses CORS restrictions for client-side transcript fetching

import express from 'express';
import cors from 'cors';
import { YoutubeTranscript } from 'youtube-transcript';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins (frontend)
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Transcript proxy server is running' });
});

// Transcript extraction endpoint
app.get('/api/transcript/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  console.log(`[Transcript API] Fetching transcript for video: ${videoId}`);

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcript || transcript.length === 0) {
      return res.status(404).json({
        error: 'No transcript available for this video',
        videoId
      });
    }

    console.log(`[Transcript API] Successfully fetched ${transcript.length} segments for ${videoId}`);

    // Transform to our expected format
    const segments = transcript.map((item, index) => ({
      text: item.text,
      offset: Math.round(item.offset * 1000), // Convert to milliseconds
      duration: Math.round(item.duration * 1000), // Convert to milliseconds
    }));

    res.json({
      videoId,
      segments,
      fullText: segments.map(s => s.text).join(' ')
    });

  } catch (error) {
    console.error(`[Transcript API] Error fetching transcript for ${videoId}:`, error.message);
    console.error(`[Transcript API] Full error:`, error);

    // Handle specific error types
    if (error.message?.includes('Could not retrieve')) {
      return res.status(404).json({
        error: 'Transcript not available. The video may not have captions.',
        videoId
      });
    }

    if (error.message?.includes('unavailable') || error.message?.includes('private')) {
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
