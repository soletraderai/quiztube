// Session service for creating and managing learning sessions
import type { Session, ProcessingState, VideoMetadata, KnowledgeBase } from '../types';
import { extractVideoId, fetchVideoMetadata, fetchTranscript, combineTranscript } from './youtube';
import { generateTopicsFromVideo } from './gemini';
import { buildKnowledgeBase, generateSampleSources } from './knowledgeBase';

// Generate unique session ID
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Session creation progress callback type
export type ProgressCallback = (state: ProcessingState) => void;

// Create a new learning session from a YouTube URL
export async function createSession(
  youtubeUrl: string,
  apiKey: string,
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
    progress: 30,
    message: 'Extracting transcript...',
  });

  let transcript = '';
  try {
    const segments = await fetchTranscript(videoId);
    transcript = combineTranscript(segments);
  } catch (error) {
    console.log('Transcript extraction note:', error);
    // Continue without transcript - Gemini will work with metadata only
  }

  // Step 4: Build knowledge base from transcript and video info
  onProgress?.({
    step: 'building_knowledge',
    progress: 50,
    message: 'Building knowledge base...',
  });

  // Build knowledge base from extracted URLs or generate sample sources
  let knowledgeBase: KnowledgeBase = buildKnowledgeBase(transcript || undefined);

  // If no URLs were extracted, generate sample sources based on video topic
  if (knowledgeBase.sources.length === 0) {
    knowledgeBase = generateSampleSources(metadata.title);
  }

  // Step 5: Generate topics and questions using Gemini
  onProgress?.({
    step: 'generating_topics',
    progress: 70,
    message: 'Generating topics and questions...',
  });

  let topics;
  let estimatedDuration;

  try {
    const result = await generateTopicsFromVideo(apiKey, metadata, transcript || undefined);
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
      bookmarkedTopics: 0,
      digDeeperCount: 0,
    },
    currentTopicIndex: 0,
    currentQuestionIndex: 0,
    difficulty: 'standard',
    status: 'overview',
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
