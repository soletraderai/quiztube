// YouTube service for extracting video metadata and transcripts
import type { VideoMetadata, TranscriptSegment } from '../types';

// Extract video ID from various YouTube URL formats
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
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

  try {
    // Use oEmbed API for basic metadata (no API key required)
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch video metadata: ${response.status}`);
    }

    const data = await response.json();

    return {
      url: url,
      title: data.title || 'Untitled Video',
      thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: 0, // oEmbed doesn't provide duration, will be estimated from transcript
      channel: data.author_name || 'Unknown Channel',
      publishDate: undefined, // Not available from oEmbed
    };
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    // Fallback to basic info
    return {
      url: url,
      title: 'Video',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: 0,
      channel: 'YouTube',
    };
  }
}

// Fetch transcript using a public transcript service
// Note: In production, you would use youtube-transcript or similar library
// For this implementation, we'll use a proxy approach
export async function fetchTranscript(_videoId: string): Promise<TranscriptSegment[]> {
  // Note: Direct transcript access is not available from the browser due to CORS
  // In a production app, this would be done server-side
  // For now, Gemini will work with video metadata only
  console.log('Transcript extraction skipped - using Gemini for content analysis based on video metadata');
  return [];
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

// Calculate estimated video duration from transcript
export function estimateDuration(segments: TranscriptSegment[]): number {
  if (segments.length === 0) return 0;
  const lastSegment = segments[segments.length - 1];
  return Math.ceil((lastSegment.offset + lastSegment.duration) / 1000); // in seconds
}
