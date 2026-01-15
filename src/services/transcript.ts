/**
 * Transcript Service
 * Phase 7: Utilities for parsing and working with video transcripts
 */

import { ParsedTranscriptSegment, TranscriptSegment } from '../types';

/**
 * Parse raw YouTube transcript segments into a standardized format
 * Converts offset/duration to startTime/endTime
 */
export function parseTranscriptSegments(
  rawSegments: TranscriptSegment[]
): ParsedTranscriptSegment[] {
  return rawSegments.map((segment) => ({
    text: segment.text.trim(),
    startTime: segment.offset,
    endTime: segment.offset + segment.duration,
  }));
}

/**
 * Parse transcript text that includes timestamps in various formats
 * Handles:
 * - YouTube format: "[00:00]" or "(00:00)" prefixes
 * - Plain text (splits into chunks with estimated timestamps)
 */
export function parseTranscriptWithTimestamps(
  rawTranscript: string,
  videoDuration?: number
): ParsedTranscriptSegment[] {
  if (!rawTranscript || rawTranscript.trim().length === 0) {
    return [];
  }

  // Check if transcript has timestamps in [MM:SS] or [HH:MM:SS] format
  const timestampRegex = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;
  const hasTimestamps = timestampRegex.test(rawTranscript);

  if (hasTimestamps) {
    return parseTimestampedTranscript(rawTranscript);
  }

  // Fall back to chunking plain text
  return parseUntimedTranscript(rawTranscript, videoDuration);
}

/**
 * Parse transcript that contains timestamp markers
 */
function parseTimestampedTranscript(transcript: string): ParsedTranscriptSegment[] {
  const segments: ParsedTranscriptSegment[] = [];
  const timestampRegex = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

  let lastIndex = 0;
  let lastTime = 0;
  let match;

  // Reset regex
  timestampRegex.lastIndex = 0;

  while ((match = timestampRegex.exec(transcript)) !== null) {
    const hours = match[3] ? parseInt(match[1], 10) : 0;
    const minutes = match[3] ? parseInt(match[2], 10) : parseInt(match[1], 10);
    const seconds = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
    const currentTime = hours * 3600 + minutes * 60 + seconds;

    // Get text between last timestamp and this one
    if (lastIndex > 0) {
      const text = transcript.slice(lastIndex, match.index).trim();
      if (text.length > 0) {
        segments.push({
          text,
          startTime: lastTime,
          endTime: currentTime,
        });
      }
    }

    lastIndex = match.index + match[0].length;
    lastTime = currentTime;
  }

  // Get remaining text after last timestamp
  const remainingText = transcript.slice(lastIndex).trim();
  if (remainingText.length > 0) {
    segments.push({
      text: remainingText,
      startTime: lastTime,
      endTime: lastTime + 60, // Assume 60 seconds for last segment
    });
  }

  return segments;
}

/**
 * Parse plain text transcript into chunks with estimated timestamps
 */
function parseUntimedTranscript(
  transcript: string,
  videoDuration?: number
): ParsedTranscriptSegment[] {
  const segments: ParsedTranscriptSegment[] = [];

  // Split by sentences or natural breaks
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  if (sentences.length === 0) {
    return [];
  }

  // Estimate duration per segment
  const totalDuration = videoDuration || sentences.length * 10; // Default 10s per sentence
  const durationPerSegment = totalDuration / sentences.length;

  // Group sentences into chunks of ~3-5 sentences
  const chunkSize = 4;
  for (let i = 0; i < sentences.length; i += chunkSize) {
    const chunk = sentences.slice(i, i + chunkSize).join(' ');
    const startTime = i * durationPerSegment;
    const endTime = Math.min((i + chunkSize) * durationPerSegment, totalDuration);

    segments.push({
      text: chunk,
      startTime,
      endTime,
    });
  }

  return segments;
}

/**
 * Find transcript segments that fall within a given timestamp range
 */
export function findRelevantSegments(
  segments: ParsedTranscriptSegment[],
  startTime: number,
  endTime: number,
  limit: number = 3
): ParsedTranscriptSegment[] {
  // Find segments that overlap with the given range
  const relevant = segments.filter((segment) => {
    // Segment overlaps if it starts before endTime and ends after startTime
    return segment.startTime < endTime && segment.endTime > startTime;
  });

  // Sort by how much they overlap with the target range (most relevant first)
  relevant.sort((a, b) => {
    const overlapA = Math.min(a.endTime, endTime) - Math.max(a.startTime, startTime);
    const overlapB = Math.min(b.endTime, endTime) - Math.max(b.startTime, startTime);
    return overlapB - overlapA;
  });

  return relevant.slice(0, limit);
}

/**
 * Format seconds as MM:SS or HH:MM:SS string
 */
export function formatTimestamp(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse a timestamp string (MM:SS or HH:MM:SS) to seconds
 */
export function parseTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);

  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }

  return 0;
}

/**
 * Generate a YouTube URL with timestamp parameter
 */
export function generateYouTubeTimestampUrl(videoUrl: string, seconds: number): string {
  try {
    const url = new URL(videoUrl);
    const videoId = url.searchParams.get('v') || url.pathname.split('/').pop();

    // Handle different YouTube URL formats
    if (url.hostname.includes('youtu.be')) {
      return `https://youtu.be/${videoId}?t=${Math.floor(seconds)}`;
    }

    // Standard youtube.com format
    url.searchParams.set('t', `${Math.floor(seconds)}s`);
    return url.toString();
  } catch {
    // If URL parsing fails, append timestamp parameter
    const separator = videoUrl.includes('?') ? '&' : '?';
    return `${videoUrl}${separator}t=${Math.floor(seconds)}s`;
  }
}

/**
 * Get a text excerpt around a specific timestamp
 */
export function getExcerptAtTimestamp(
  segments: ParsedTranscriptSegment[],
  timestamp: number,
  contextSeconds: number = 30
): string {
  const startTime = Math.max(0, timestamp - contextSeconds);
  const endTime = timestamp + contextSeconds;

  const relevant = findRelevantSegments(segments, startTime, endTime, 5);
  return relevant.map((s) => s.text).join(' ');
}
