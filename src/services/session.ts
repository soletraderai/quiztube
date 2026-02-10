// Lesson service for creating and managing learning lessons (renamed from session)
import type { Lesson, ProcessingState, VideoMetadata, KnowledgeBase, TranscriptSegment, EnhancedTranscriptSegment, ContentAnalysis, Chapter, ExternalSource, ProcessingLog } from '../types';
import { extractVideoId, fetchVideoMetadata, fetchTranscript, combineTranscript } from './youtube';
import { generateTopicsFromVideo, analyzeTranscriptContent, TopicGenerationOptions, RateLimitError } from './gemini';
import { buildKnowledgeBase, generateSampleSources } from './knowledgeBase';
import { parseTranscriptSegments, processTranscriptForSession, linkSegmentsToTopics, extractChapters, linkChaptersToTopics } from './transcript';
import { detectSources, extractSourceSummaries } from './externalSources';
import { PipelineLogger } from './processingLog';

// Generate unique lesson ID
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Lesson creation progress callback type
export type ProgressCallback = (state: ProcessingState) => void;

// Create a new learning lesson from a YouTube URL
export async function createLesson(
  youtubeUrl: string,
  onProgress?: ProgressCallback
): Promise<Lesson> {
  const lessonId = generateSessionId();
  const logger = new PipelineLogger(lessonId);

  // Step 1: Extract video ID
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL. Please enter a valid YouTube video URL.');
  }

  // Step 2: Fetch video metadata (10%)
  onProgress?.({
    step: 'fetching_video',
    progress: 10,
    message: 'Fetching video information...',
  });

  let metadata: VideoMetadata;
  let videoDescription = '';
  try {
    const result = await fetchVideoMetadata(videoId);
    metadata = result;
    // The proxy server now returns description
    videoDescription = (result as any).description || '';
  } catch (error) {
    throw new Error(`Failed to fetch video information: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Step 3: Extract transcript + chapters (20%)
  onProgress?.({
    step: 'extracting_transcript',
    progress: 20,
    message: 'Extracting transcript & chapters...',
  });

  let transcript = '';
  let rawSegments: Array<{ text: string; duration: number; offset: number }> = [];
  let youtubeChapters: { title: string; startTime: number }[] = [];
  try {
    const transcriptResult = await fetchTranscript(videoId);
    rawSegments = transcriptResult;
    transcript = combineTranscript(rawSegments);
    // YouTube chapters are returned by the proxy alongside transcript
    youtubeChapters = (transcriptResult as any).chapters || [];
  } catch (error) {
    console.log('Transcript extraction note:', error);
  }

  // Extract chapters from transcript segments
  const transcriptSegments = rawSegments.length > 0
    ? parseTranscriptSegments(rawSegments)
    : undefined;

  let chapters: Chapter[] = [];
  if (transcriptSegments && transcriptSegments.length > 0) {
    chapters = extractChapters(
      transcriptSegments,
      youtubeChapters.length > 0 ? youtubeChapters : undefined,
      metadata.duration,
      videoId
    );
  }

  logger.logStep(
    'transcript_fetch',
    `Video ID: ${videoId}`,
    `Fetched ${rawSegments.length} segments, ${transcript.length} chars`,
    'Used youtube-captions-api via proxy server',
    `${chapters.length} chapters extracted`,
    true
  );

  // Step 4: Detect external sources (30%)
  let detectedUrls: { url: string; foundIn: 'transcript' | 'description' }[] = [];
  let externalSources: ExternalSource[] = [];

  try {
    onProgress?.({
      step: 'detecting_sources',
      progress: 30,
      message: 'Detecting external sources...',
    });

    detectedUrls = detectSources(transcript, videoDescription);

    logger.logStep(
      'url_detection',
      `Scanned transcript (${transcript.length} chars) and description`,
      `Found ${detectedUrls.length} URLs`,
      `Detected in: ${detectedUrls.filter(u => u.foundIn === 'transcript').length} transcript, ${detectedUrls.filter(u => u.foundIn === 'description').length} description`,
      `URLs: ${detectedUrls.map(u => u.url).join(', ')}`,
      true
    );
  } catch (error) {
    console.log('Source detection failed, continuing without sources:', error);
    logger.logStep('url_detection', 'Scan failed', 'No URLs detected', String(error), '', false);
  }

  // Step 5: Extract source summaries (40%)
  try {
    if (detectedUrls.length > 0) {
      onProgress?.({
        step: 'extracting_summaries',
        progress: 40,
        message: 'Summarizing referenced sources...',
      });

      externalSources = await extractSourceSummaries(detectedUrls, metadata.title);
    }

    logger.logStep(
      'source_extraction',
      `${detectedUrls.length} URLs to process`,
      `Summarized ${externalSources.length} sources`,
      `Types: ${externalSources.map(s => s.type).join(', ')}`,
      `Sources: ${externalSources.map(s => s.title).join(', ')}`,
      externalSources.length > 0 || detectedUrls.length === 0
    );
  } catch (error) {
    console.log('Source extraction failed, continuing without sources:', error);
    logger.logStep('source_extraction', `${detectedUrls.length} URLs`, 'Extraction failed', String(error), '', false);
    externalSources = [];
  }

  // Step 6: Build knowledge base (50%)
  onProgress?.({
    step: 'building_knowledge',
    progress: 50,
    message: 'Building knowledge base...',
  });

  let knowledgeBase: KnowledgeBase = buildKnowledgeBase(transcript || undefined);
  if (knowledgeBase.sources.length === 0) {
    knowledgeBase = generateSampleSources(metadata.title);
  }

  // Phase 8: Process enhanced segments BEFORE topic generation
  let preProcessedSegments: EnhancedTranscriptSegment[] | undefined;
  if (rawSegments.length > 0) {
    preProcessedSegments = processTranscriptForSession(rawSegments as TranscriptSegment[]);
  }

  // Step 7: Content analysis (60%)
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
      if (error instanceof RateLimitError) {
        console.log('Content analysis skipped: rate limit hit');
      } else {
        console.warn('Content analysis failed, falling back to single-stage generation:', error);
      }
      contentAnalysis = undefined;
    }
  }

  logger.logStep(
    'content_analysis',
    `Transcript with ${chapters.length} chapters`,
    `Identified ${contentAnalysis?.concepts?.length || 0} concepts`,
    `Domain: ${contentAnalysis?.subjectDomain || 'unknown'}, Complexity: ${contentAnalysis?.overallComplexity || 'unknown'}`,
    `Concepts: ${contentAnalysis?.concepts?.map(c => c.name).join(', ') || 'none'}`,
    !!contentAnalysis
  );

  // Step 8: Generate topics and questions (80%)
  onProgress?.({
    step: 'generating_topics',
    progress: 80,
    message: 'Generating topics & questions...',
  });

  let topics;
  let estimatedDuration;

  try {
    const options: TopicGenerationOptions = {
      transcript: transcript || undefined,
      enhancedSegments: preProcessedSegments,
      contentAnalysis,
    };
    const result = await generateTopicsFromVideo(metadata, options);
    topics = result.topics;
    estimatedDuration = result.estimatedDuration;
  } catch (error) {
    throw new Error(`Failed to generate learning content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  logger.logStep(
    'question_generation',
    `${topics.length} topics requested`,
    `Generated ${topics.length} topics with ${topics.reduce((sum, t) => sum + t.questions.length, 0)} questions`,
    `Used ${contentAnalysis ? 'two-stage' : 'single-stage'} pipeline`,
    `Topics: ${topics.map(t => t.title).join(', ')}`,
    topics.length > 0
  );

  if (!metadata.duration || metadata.duration === 0) {
    metadata.duration = estimatedDuration * 60;
  }

  // Link enhanced segments to topics
  let enhancedSegments = preProcessedSegments;
  if (enhancedSegments && topics.length > 0) {
    enhancedSegments = linkSegmentsToTopics(enhancedSegments, topics);
  }

  // Link chapters to topic questions
  if (chapters.length > 0 && topics.length > 0) {
    linkChaptersToTopics(chapters, topics);
  }

  // Finalize processing log
  const processingLog: ProcessingLog = logger.finalize();

  // Step 9: Create lesson object (100%)
  onProgress?.({
    step: 'ready',
    progress: 100,
    message: 'Lesson ready!',
  });

  const lesson: Lesson = {
    id: lessonId,
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
      questionsPassed: 0,
      questionsFailed: 0,
      questionsNeutral: 0,
    },
    currentTopicIndex: 0,
    currentQuestionIndex: 0,
    difficulty: 'standard',
    status: 'overview',
    transcript: transcript || undefined,
    chapters: chapters.length > 0 ? chapters : undefined,
    transcriptSegments,
    enhancedSegments,
    externalSources: externalSources.length > 0 ? externalSources : undefined,
    contentAnalysis,
    processingLog,
  };

  return lesson;
}

// Backward compatibility alias
export const createSession = createLesson;

// Resume an existing lesson
export function resumeSession(session: Lesson): Lesson {
  if (session.status === 'completed') {
    return session;
  }
  return {
    ...session,
    status: 'active',
  };
}

// Complete a lesson
export function completeSession(session: Lesson): Lesson {
  return {
    ...session,
    status: 'completed',
    completedAt: Date.now(),
  };
}

// Calculate lesson statistics
export function calculateSessionStats(session: Lesson) {
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
