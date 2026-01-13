// YouTube service for extracting video metadata and transcripts
import type { VideoMetadata, TranscriptSegment } from '../types';

// Proxy server URL for transcript and video metadata extraction (bypasses CORS)
const TRANSCRIPT_PROXY_URL = 'http://localhost:3001';

// Check if the transcript proxy server is available
async function isProxyAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${TRANSCRIPT_PROXY_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Extract video ID from various YouTube URL formats
export function extractVideoId(url: string): string | null {
  const patterns = [
    // Standard watch URL, embedded URL, youtu.be short URL
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // Watch URL with additional parameters
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    // YouTube Shorts URLs
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    // Mobile URL (m.youtube.com)
    /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Fetch video metadata using YouTube oEmbed API (no API key required)
export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Use oEmbed API for basic metadata (no API key required)
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const response = await fetch(oembedUrl);

  if (!response.ok) {
    // 401/403 typically means the video is private
    // 404 means the video doesn't exist or has been deleted
    // 400 can also indicate an invalid/unavailable video
    if (response.status === 401 || response.status === 403) {
      throw new Error('This video is private. Please try a public video.');
    } else if (response.status === 404 || response.status === 400) {
      throw new Error('This video is unavailable. It may have been deleted or does not exist.');
    }
    throw new Error(`Failed to fetch video information (${response.status}). Please try a different video.`);
  }

  const data = await response.json();

  // Try to fetch actual duration from proxy server
  let duration = 0;
  try {
    const proxyAvailable = await isProxyAvailable();
    if (proxyAvailable) {
      const durationResponse = await fetch(`${TRANSCRIPT_PROXY_URL}/api/video/${videoId}`);
      if (durationResponse.ok) {
        const videoData = await durationResponse.json();
        duration = videoData.duration || 0;
        console.log(`Fetched actual video duration: ${duration} seconds`);
      }
    }
  } catch (error) {
    console.warn('Could not fetch video duration from proxy:', error);
  }

  return {
    url: url,
    title: data.title || 'Untitled Video',
    thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration: duration, // Actual duration from proxy, or 0 if unavailable
    channel: data.author_name || 'Unknown Channel',
    publishDate: undefined, // Not available from oEmbed
  };
}

// Fetch transcript using the proxy server (bypasses CORS)
// Falls back to empty array if proxy is not available
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  // First check if proxy server is available
  const proxyAvailable = await isProxyAvailable();

  if (!proxyAvailable) {
    console.log('Transcript proxy server not available - using Gemini for content analysis based on video metadata');
    return [];
  }

  try {
    console.log(`Fetching transcript from proxy server for video: ${videoId}`);

    const response = await fetch(`${TRANSCRIPT_PROXY_URL}/api/transcript/${videoId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`Transcript fetch failed: ${errorData.error || response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.segments || data.segments.length === 0) {
      console.log('No transcript segments returned from proxy');
      return [];
    }

    console.log(`Successfully fetched ${data.segments.length} transcript segments`);
    return data.segments as TranscriptSegment[];

  } catch (error) {
    console.warn('Error fetching transcript from proxy:', error);
    return [];
  }
}

// Alternative: Generate topics directly from video metadata using Gemini
// This is used when transcript is not available
export function generatePromptForVideoAnalysis(metadata: VideoMetadata): string {
  return `Analyze this YouTube video and create an educational learning session:

Video Title: "${metadata.title}"
Channel: ${metadata.channel}
URL: ${metadata.url}

Based on the video title and context, please:
1. Identify 3-5 main topics that this video likely covers
2. For each topic, provide a brief summary of what it might cover
3. Generate 2-3 questions per topic that would help test understanding

Format your response as JSON with this structure:
{
  "topics": [
    {
      "title": "Topic Title",
      "summary": "Brief summary of what this topic covers (2-3 sentences)",
      "questions": [
        "Question 1 text",
        "Question 2 text"
      ]
    }
  ],
  "estimatedDuration": number (in minutes)
}

Make the questions thought-provoking and focus on understanding, not just recall.`;
}

// Parse transcript into segments with timestamps
export function parseTranscriptSegments(rawTranscript: string): TranscriptSegment[] {
  // Split by common transcript delimiters
  const segments: TranscriptSegment[] = [];
  const lines = rawTranscript.split('\n').filter(line => line.trim());

  let currentOffset = 0;
  const avgSegmentDuration = 5000; // 5 seconds per segment

  for (const line of lines) {
    segments.push({
      text: line.trim(),
      duration: avgSegmentDuration,
      offset: currentOffset,
    });
    currentOffset += avgSegmentDuration;
  }

  return segments;
}

// Combine transcript segments into a full text
export function combineTranscript(segments: TranscriptSegment[]): string {
  return segments.map(s => s.text).join(' ');
}

// Format duration in seconds to MM:SS or HH:MM:SS format
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Calculate estimated video duration from transcript
export function estimateDuration(segments: TranscriptSegment[]): number {
  if (segments.length === 0) return 0;
  const lastSegment = segments[segments.length - 1];
  return Math.ceil((lastSegment.offset + lastSegment.duration) / 1000); // in seconds
}
