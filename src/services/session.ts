// Session service for creating and managing learning sessions
import type { Session, ProcessingState, VideoMetadata, KnowledgeBase, TranscriptSegment, EnhancedTranscriptSegment, ContentAnalysis } from '../types';
import { extractVideoId, fetchVideoMetadata, fetchTranscript, combineTranscript } from './youtube';
import { generateTopicsFromVideo, analyzeTranscriptContent, TopicGenerationOptions, RateLimitError } from './gemini';
import { buildKnowledgeBase, generateSampleSources } from './knowledgeBase';
import { parseTranscriptSegments, processTranscriptForSession, linkSegmentsToTopics } from './transcript';

// Generate unique session ID
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Session creation progress callback type
export type ProgressCallback = (state: ProcessingState) => void;

// Create a new learning session from a YouTube URL
export async function createSession(
  youtubeUrl: string,
  onProgress?: ProgressCallback
): Promise<Session> {
  // Step 1: Extract video ID
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL. Please enter a valid YouTube video URL.');
  }

  // Step 2: Fetch video metadata
  onProgress?.({
    step: 'fetching_video',
    progress: 10,
    message: 'Fetching video information...',
  });

  let metadata: VideoMetadata;
  try {
    metadata = await fetchVideoMetadata(videoId);
  } catch (error) {
    throw new Error(`Failed to fetch video information: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Step 3: Try to extract transcript
  onProgress?.({
    step: 'extracting_transcript',
    progress: 25,
    message: 'Extracting transcript...',
  });

  let transcript = '';
  // Phase 7 F2: Also store raw segments for parsing into help panel context
  let rawSegments: Array<{ text: string; duration: number; offset: number }> = [];
  try {
    rawSegments = await fetchTranscript(videoId);
    transcript = combineTranscript(rawSegments);
  } catch (error) {
    console.log('Transcript extraction note:', error);
    // Continue without transcript - Gemini will work with metadata only
  }

  // Step 4: Build knowledge base from transcript and video info
  onProgress?.({
    step: 'building_knowledge',
    progress: 45,
    message: 'Building knowledge base...',
  });

  // Build knowledge base from extracted URLs or generate sample sources
  let knowledgeBase: KnowledgeBase = buildKnowledgeBase(transcript || undefined);

  // If no URLs were extracted, generate sample sources based on video topic
  if (knowledgeBase.sources.length === 0) {
    knowledgeBase = generateSampleSources(metadata.title);
  }

  // Phase 8: Process enhanced segments BEFORE topic generation so we can pass them to the AI
  // This enables contextual question generation with source quotes and timestamps
  let preProcessedSegments: EnhancedTranscriptSegment[] | undefined;
  if (rawSegments.length > 0) {
    preProcessedSegments = processTranscriptForSession(rawSegments as TranscriptSegment[]);
  }

  // Step 4.5: Phase 10 — Content analysis (two-stage pipeline Stage 1)
  let contentAnalysis: ContentAnalysis | undefined;
  if (transcript) {
    onProgress?.({
      step: 'analyzing_content',
      progress: 60,
      message: 'Analyzing content structure...',
    });

    try {
      contentAnalysis = await analyzeTranscriptContent(metadata, transcript, preProcessedSegments);
    } catch (error) {
      // Silent fallback: if content analysis fails, proceed with single-stage generation
      if (error instanceof RateLimitError) {
        console.log('Content analysis skipped: rate limit hit');
      } else {
        console.warn('Content analysis failed, falling back to single-stage generation:', error);
      }
      contentAnalysis = undefined;
    }
  }

  // Step 5: Generate topics and questions using Gemini
  onProgress?.({
    step: 'generating_topics',
    progress: 80,
    message: 'Generating topics and questions...',
  });

  let topics;
  let estimatedDuration;

  try {
    // Phase 8: Pass enhanced segments and knowledge base sources to topic generation
    const options: TopicGenerationOptions = {
      transcript: transcript || undefined,
      enhancedSegments: preProcessedSegments,
      // Phase 10: Pass content analysis to enable analysis-aware question generation
      contentAnalysis,
    };
    const result = await generateTopicsFromVideo(metadata, options);
    topics = result.topics;
    estimatedDuration = result.estimatedDuration;
  } catch (error) {
    throw new Error(`Failed to generate learning content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Only set duration from estimate if actual duration wasn't fetched
  if (!metadata.duration || metadata.duration === 0) {
    metadata.duration = estimatedDuration * 60; // Convert to seconds
  }

  // Step 6: Create session object
  onProgress?.({
    step: 'ready',
    progress: 100,
    message: 'Session ready!',
  });

  // Phase 7 F2: Parse raw segments for help panel context
  const transcriptSegments = rawSegments.length > 0
    ? parseTranscriptSegments(rawSegments)
    : undefined;

  // Phase 8: Link pre-processed enhanced segments to topics now that we have both
  // (preProcessedSegments were created before topic generation for AI context)
  let enhancedSegments = preProcessedSegments;
  if (enhancedSegments && topics.length > 0) {
    enhancedSegments = linkSegmentsToTopics(enhancedSegments, topics);
  }

  const session: Session = {
    id: generateSessionId(),
    createdAt: Date.now(),
    completedAt: null,
    video: metadata,
    knowledgeBase,
    topics,
    score: {
      topicsCompleted: 0,
      topicsSkipped: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
      bookmarkedTopics: 0,
      digDeeperCount: 0,
      // Phase 7: Three-tier evaluation counts
      questionsPassed: 0,
      questionsFailed: 0,
      questionsNeutral: 0,
    },
    currentTopicIndex: 0,
    currentQuestionIndex: 0,
    difficulty: 'standard',
    status: 'overview',
    transcript: transcript || undefined,  // Store transcript for note generation
    // Phase 7 F2: Store parsed transcript segments for help panel
    transcriptSegments,
    // Phase 8: Store enhanced transcript segments with IDs and topic linking
    enhancedSegments,
    // Phase 10: Store content analysis for future use (dig-deeper, evaluation, etc.)
    contentAnalysis,
  };

  return session;
}

// Resume an existing session
export function resumeSession(session: Session): Session {
  // If session was completed, don't change status
  if (session.status === 'completed') {
    return session;
  }

  // Otherwise, set to active
  return {
    ...session,
    status: 'active',
  };
}

// Complete a session
export function completeSession(session: Session): Session {
  return {
    ...session,
    status: 'completed',
    completedAt: Date.now(),
  };
}

// Calculate session statistics
export function calculateSessionStats(session: Session) {
  const totalTopics = session.topics.length;
  const completedTopics = session.topics.filter(t => t.completed).length;
  const skippedTopics = session.topics.filter(t => t.skipped).length;
  const bookmarkedTopics = session.topics.filter(t => t.bookmarked).length;

  const totalQuestions = session.topics.reduce((sum, t) => sum + t.questions.length, 0);
  const answeredQuestions = session.topics.reduce(
    (sum, t) => sum + t.questions.filter(q => q.userAnswer !== null).length,
    0
  );

  const progressPercent = totalTopics > 0
    ? Math.round(((completedTopics + skippedTopics) / totalTopics) * 100)
    : 0;

  return {
    totalTopics,
    completedTopics,
    skippedTopics,
    bookmarkedTopics,
    totalQuestions,
    answeredQuestions,
    progressPercent,
  };
}
