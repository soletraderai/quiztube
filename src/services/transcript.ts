/**
 * Transcript Service
 * Phase 7: Utilities for parsing and working with video transcripts
 */

import { ParsedTranscriptSegment, TranscriptSegment, EnhancedTranscriptSegment, Topic, Chapter } from '../types';

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

// ============================================================================
// Phase 8: Enhanced Transcript Segment Functions
// ============================================================================

/**
 * Generate a unique ID for a transcript segment
 * Format: seg_{startTime}_{hash} where hash is derived from text content
 */
export function generateSegmentId(segment: ParsedTranscriptSegment, index: number): string {
  // Simple hash from text content for uniqueness
  const textHash = segment.text
    .slice(0, 20)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 8);

  return `seg_${Math.floor(segment.startTime)}_${index}_${textHash}`;
}

/**
 * Convert ParsedTranscriptSegments to EnhancedTranscriptSegments
 * Adds unique IDs and computed duration
 */
export function enhanceSegments(
  segments: ParsedTranscriptSegment[]
): EnhancedTranscriptSegment[] {
  return segments.map((segment, index) => ({
    ...segment,
    id: generateSegmentId(segment, index),
    duration: segment.endTime - segment.startTime,
  }));
}

/**
 * Merge short segments (< minDuration seconds) with adjacent segments
 * This improves question generation by providing more context per segment
 */
export function mergeShortSegments(
  segments: EnhancedTranscriptSegment[],
  minDuration: number = 5
): EnhancedTranscriptSegment[] {
  if (segments.length === 0) return [];
  if (segments.length === 1) return segments;

  const merged: EnhancedTranscriptSegment[] = [];
  let currentSegment: EnhancedTranscriptSegment | null = null;

  for (const segment of segments) {
    if (currentSegment === null) {
      currentSegment = { ...segment };
      continue;
    }

    // If current accumulated segment is too short, merge with next
    if (currentSegment.duration < minDuration) {
      currentSegment = {
        ...currentSegment,
        text: `${currentSegment.text} ${segment.text}`,
        endTime: segment.endTime,
        duration: segment.endTime - currentSegment.startTime,
        // Keep the original segment's ID
      };
    } else {
      // Current segment is long enough, push it and start new
      merged.push(currentSegment);
      currentSegment = { ...segment };
    }
  }

  // Don't forget the last segment
  if (currentSegment) {
    // If last segment is still too short, merge with previous if possible
    if (currentSegment.duration < minDuration && merged.length > 0) {
      const lastMerged = merged[merged.length - 1];
      merged[merged.length - 1] = {
        ...lastMerged,
        text: `${lastMerged.text} ${currentSegment.text}`,
        endTime: currentSegment.endTime,
        duration: currentSegment.endTime - lastMerged.startTime,
      };
    } else {
      merged.push(currentSegment);
    }
  }

  return merged;
}

/**
 * Link transcript segments to topics based on timestamp overlap
 * Updates each segment's topicId field when it falls within a topic's time range
 */
export function linkSegmentsToTopics(
  segments: EnhancedTranscriptSegment[],
  topics: Topic[]
): EnhancedTranscriptSegment[] {
  return segments.map((segment) => {
    // Find topic that best overlaps with this segment
    let bestTopic: Topic | null = null;
    let bestOverlap = 0;

    for (const topic of topics) {
      // Skip topics without timestamp information
      if (topic.timestampStart === undefined || topic.timestampEnd === undefined) {
        continue;
      }

      // Calculate overlap between segment and topic
      const overlapStart = Math.max(segment.startTime, topic.timestampStart);
      const overlapEnd = Math.min(segment.endTime, topic.timestampEnd);
      const overlap = Math.max(0, overlapEnd - overlapStart);

      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestTopic = topic;
      }
    }

    // Only link if there's meaningful overlap (at least 50% of segment duration)
    const minOverlapRatio = 0.5;
    if (bestTopic && bestOverlap >= segment.duration * minOverlapRatio) {
      return {
        ...segment,
        topicId: bestTopic.id,
      };
    }

    return segment;
  });
}

/**
 * Process raw transcript segments into enhanced segments ready for session storage
 * This is the main entry point for Phase 8 transcript processing
 */
export function processTranscriptForSession(
  rawSegments: TranscriptSegment[],
  topics?: Topic[]
): EnhancedTranscriptSegment[] {
  // Step 1: Parse raw segments to get startTime/endTime
  const parsed = parseTranscriptSegments(rawSegments);

  // Step 2: Enhance with IDs and duration
  const enhanced = enhanceSegments(parsed);

  // Step 3: Merge short segments for better context
  const merged = mergeShortSegments(enhanced);

  // Step 4: Link to topics if provided
  if (topics && topics.length > 0) {
    return linkSegmentsToTopics(merged, topics);
  }

  return merged;
}

/**
 * Get segments linked to a specific topic
 */
export function getSegmentsForTopic(
  segments: EnhancedTranscriptSegment[],
  topicId: string
): EnhancedTranscriptSegment[] {
  return segments.filter((segment) => segment.topicId === topicId);
}

/**
 * Format segments for AI prompt inclusion
 * Returns segments formatted as: [MM:SS-MM:SS] "text"
 */
export function formatSegmentsForPrompt(
  segments: EnhancedTranscriptSegment[],
  maxSegments: number = 50
): string {
  return segments
    .slice(0, maxSegments)
    .map((segment) => {
      const start = formatTimestamp(segment.startTime);
      const end = formatTimestamp(segment.endTime);
      return `[${start}-${end}] "${segment.text}"`;
    })
    .join('\n');
}

// ============================================================================
// Phase 12: Chapter Extraction Functions
// ============================================================================

/**
 * Generate a deterministic chapter ID
 */
export function generateChapterId(videoId: string, index: number): string {
  return `ch-${videoId}-${index}`;
}

/**
 * Extract chapters from transcript segments and optional YouTube chapter markers.
 * Falls back to time-based chunking (~5 minute intervals) when no chapters provided.
 */
export function extractChapters(
  segments: ParsedTranscriptSegment[],
  youtubeChapters?: { title: string; startTime: number }[],
  videoDuration?: number,
  videoId?: string
): Chapter[] {
  if (segments.length === 0) return [];

  const vid = videoId || 'unknown';
  const lastSegment = segments[segments.length - 1];
  const totalDuration = videoDuration || lastSegment.endTime;

  // When YouTube chapters are available, use them
  if (youtubeChapters && youtubeChapters.length > 1) {
    return youtubeChapters.map((ch, index) => {
      const nextStartTime = index < youtubeChapters.length - 1
        ? youtubeChapters[index + 1].startTime
        : totalDuration;
      const endTime = nextStartTime;
      const duration = endTime - ch.startTime;

      // Collect transcript content within this chapter's time range
      const content = segments
        .filter(seg => seg.startTime >= ch.startTime && seg.startTime < endTime)
        .map(seg => seg.text)
        .join(' ');

      return {
        id: generateChapterId(vid, index),
        title: ch.title,
        startTime: ch.startTime,
        endTime,
        content: content || '',
        duration,
      };
    }).filter(ch => ch.content.length > 0 && ch.duration > 0);
  }

  // Fallback: time-based chunking (~5 minute intervals)
  const CHUNK_SECONDS = 300; // 5 minutes
  const MIN_CHUNK = 60; // 1 minute minimum
  const MAX_CHUNK = 600; // 10 minute maximum
  const chapters: Chapter[] = [];

  // For very short videos (<5 min), treat as single chapter
  if (totalDuration < CHUNK_SECONDS) {
    const content = segments.map(seg => seg.text).join(' ');
    const title = content.split(/[.!?]/)[0]?.trim().slice(0, 60) || 'Full Video';
    return [{
      id: generateChapterId(vid, 0),
      title,
      startTime: 0,
      endTime: totalDuration,
      content,
      duration: totalDuration,
    }];
  }

  // Calculate number of chunks
  let numChunks = Math.max(1, Math.round(totalDuration / CHUNK_SECONDS));
  let chunkDuration = totalDuration / numChunks;

  // Enforce min/max chunk duration
  if (chunkDuration < MIN_CHUNK) {
    numChunks = Math.max(1, Math.floor(totalDuration / MIN_CHUNK));
    chunkDuration = totalDuration / numChunks;
  }
  if (chunkDuration > MAX_CHUNK) {
    numChunks = Math.ceil(totalDuration / MAX_CHUNK);
    chunkDuration = totalDuration / numChunks;
  }

  for (let i = 0; i < numChunks; i++) {
    const startTime = i * chunkDuration;
    const endTime = Math.min((i + 1) * chunkDuration, totalDuration);

    const chapterSegments = segments.filter(
      seg => seg.startTime >= startTime && seg.startTime < endTime
    );
    const content = chapterSegments.map(seg => seg.text).join(' ');

    // Generate title from first sentence of content
    const firstSentence = content.split(/[.!?]/)[0]?.trim() || '';
    const title = firstSentence.length > 60
      ? firstSentence.slice(0, 57) + '...'
      : firstSentence || `Part ${i + 1}`;

    if (content.length > 0) {
      chapters.push({
        id: generateChapterId(vid, i),
        title,
        startTime,
        endTime,
        content,
        duration: endTime - startTime,
      });
    }
  }

  return chapters;
}

/**
 * Link chapters to topics based on timestamp overlap
 */
export function linkChaptersToTopics(
  chapters: Chapter[],
  topics: Topic[]
): void {
  for (const topic of topics) {
    if (topic.questions) {
      for (const question of topic.questions) {
        if (question.sourceTimestamp !== undefined) {
          const matchingChapter = chapters.find(
            ch => question.sourceTimestamp! >= ch.startTime && question.sourceTimestamp! < ch.endTime
          );
          if (matchingChapter) {
            question.sourceChapterId = matchingChapter.id;
          }
        }
      }
    }
  }
}
