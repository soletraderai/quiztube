// Tutor personality type
export type TutorPersonality = 'PROFESSOR' | 'COACH' | 'DIRECT' | 'CREATIVE';

// Question type classification (Bloom's taxonomy levels + code)
export type QuestionType = 'comprehension' | 'application' | 'analysis' | 'synthesis' | 'evaluation' | 'code';

// Evaluation result from AI (three-tier system)
export interface EvaluationResult {
  result: 'pass' | 'fail' | 'neutral';
  feedback: string;
  correctAnswer?: string;
  keyPointsHit: string[];
  keyPointsMissed: string[];
}

// Code challenge configuration for code questions
export interface CodeChallenge {
  template: string;
  language: string;
}

// Learning style type
export type LearningStyle = 'visual' | 'reading' | 'auditory' | 'kinesthetic';

// Language variant type for onboarding
export type LanguageVariant = 'BRITISH' | 'AMERICAN' | 'AUSTRALIAN';

// Settings type
export interface Settings {
  userName: string;
  language: string;
  tutorPersonality: TutorPersonality;
  learningStyle: LearningStyle;
  // Onboarding preferences
  languageVariant?: LanguageVariant;
  dailyCommitment?: number;    // Minutes per day
  preferredTime?: string;      // e.g., '09:00'
  learningDays?: string[];     // e.g., ['Mon', 'Tue', 'Wed']
}

// Video metadata type
export interface VideoMetadata {
  url: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
  channel: string;
  publishDate?: string;
  id?: string;           // YouTube video ID
  channelId?: string;    // YouTube channel ID
}

// Knowledge base source type
export interface KnowledgeSource {
  url: string;
  title: string;
  snippet: string;
  type: 'github' | 'documentation' | 'article' | 'other';
}

// Knowledge base type
export interface KnowledgeBase {
  sources: KnowledgeSource[];
}

// Phase 8: Scraped resource from external URLs mentioned in transcript
export interface ScrapedResource {
  id: string;
  sourceUrl: string;                                              // REQUIRED - always preserve for attribution
  sourceType: 'github' | 'documentation' | 'article' | 'tool';
  title: string;
  overview: string;                                               // AI-summarized overview
  rawContent: string;                                             // Key excerpts (max 2000 chars)
  scrapedAt: number;                                              // Timestamp
  error?: string;                                                 // If scraping failed
}

// Question type
export interface Question {
  id: string;
  text: string;
  difficulty: 'standard' | 'easier' | 'harder';
  expectedAnswer?: string; // Hints about expected answer for better feedback evaluation
  userAnswer: string | null;
  feedback: string | null;
  answeredAt: number | null;
  // Phase 7: Question classification and timestamps
  questionType?: QuestionType;
  isCodeQuestion?: boolean;
  codeChallenge?: CodeChallenge;
  timestampStart?: number; // seconds into video
  timestampEnd?: number;   // seconds into video
  evaluationResult?: EvaluationResult;
  // Phase 8: Source context for contextual questions
  sourceQuote?: string;           // Direct quote from transcript this question is based on
  sourceTimestamp?: number;       // Timestamp in video where source content appears
  sourceSegmentId?: string;       // ID of the transcript segment
  relatedResourceIds?: string[];  // IDs of scraped resources related to this question
}

// Dig deeper conversation message type
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Phase 10: Content Analysis types for two-stage question generation pipeline
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
export type DOKLevel = 1 | 2 | 3 | 4;

export interface ExtractedConcept {
  id: string;
  name: string;
  definition: string;
  bloomLevel: BloomLevel;
  dokLevel: DOKLevel;
  importance: 'core' | 'supporting' | 'tangential';
  prerequisites: string[];
  sourceQuote: string;
  sourceTimestamp: number;
  misconceptions: string[];
}

export interface ConceptRelationship {
  fromConceptId: string;
  toConceptId: string;
  type: 'depends-on' | 'contrasts-with' | 'example-of' | 'part-of' | 'leads-to';
  explanation: string;
}

export interface ContentSection {
  title: string;
  timestampStart: number;
  timestampEnd: number;
  conceptIds: string[];
  keyExamples: string[];
  complexityLevel: 'introductory' | 'intermediate' | 'advanced';
}

export interface ContentAnalysis {
  videoId: string;
  analyzedAt: number;
  concepts: ExtractedConcept[];
  relationships: ConceptRelationship[];
  sections: ContentSection[];
  overallComplexity: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  subjectDomain: string;
  estimatedPrerequisites: string[];
}

// Phase 9: Topic category types
export type TopicCategory =
  | 'concept'      // Core concepts and definitions
  | 'technique'    // Methods, processes, how-to
  | 'comparison'   // Comparing alternatives, trade-offs
  | 'example'      // Code examples, demonstrations
  | 'application'  // Practical use cases
  | 'theory'       // Theoretical foundations
  | 'best-practice'; // Guidelines and recommendations

// Phase 9: Topic icon identifiers
export type TopicIcon =
  | 'lightbulb'    // concept
  | 'wrench'       // technique
  | 'scale'        // comparison
  | 'code'         // example
  | 'rocket'       // application
  | 'book'         // theory
  | 'star';        // best-practice

// Topic type
export interface Topic {
  id: string;
  title: string;
  summary: string;
  questions: Question[];
  digDeeperConversation: ChatMessage[] | null;
  bookmarked: boolean;
  skipped: boolean;
  completed: boolean;
  // Code-related fields for programming topics
  codeExample?: string;
  codeLanguage?: string;
  // Phase 7: Timestamp fields for video reference
  timestampStart?: number; // seconds into video
  timestampEnd?: number;   // seconds into video
  sectionName?: string;    // Named section from video (e.g., "Introduction", "Key Concepts")
  // Phase 9: Topic categorization for UI display
  category?: TopicCategory;
  icon?: TopicIcon;
}

// Code snippet type
export interface CodeSnippet {
  id: string;
  code: string;
  language: string;
  topicId: string | null;
  topicTitle: string | null;
  savedAt: number;
  name?: string;
}

// Session score type
export interface SessionScore {
  topicsCompleted: number;
  topicsSkipped: number;
  questionsAnswered: number;
  questionsCorrect: number;
  bookmarkedTopics: number;
  digDeeperCount: number;
  // Phase 7: Three-tier evaluation counts
  questionsPassed: number;
  questionsFailed: number;
  questionsNeutral: number;
}

// Phase 9: Session progress for pause/resume functionality
export interface SessionProgress {
  currentTopicIndex: number;
  currentQuestionIndex: number;
  answeredQuestions: string[];  // Question IDs that have been answered
  isPaused: boolean;
  pausedAt?: number;            // Timestamp when paused
}

// Session type
export interface Session {
  id: string;
  createdAt: number;
  completedAt: number | null;
  video: VideoMetadata;
  knowledgeBase: KnowledgeBase;
  topics: Topic[];
  score: SessionScore;
  currentTopicIndex: number;
  currentQuestionIndex: number;
  difficulty: 'standard' | 'easier' | 'harder';
  status: 'processing' | 'overview' | 'active' | 'completed';
  savedSnippets?: CodeSnippet[];
  transcript?: string;  // Raw YouTube transcript text for note generation
  structuredNotes?: StructuredNotes;  // AI-generated structured notes from transcript
  // Phase 7 F2: Parsed transcript segments for help panel context
  transcriptSegments?: ParsedTranscriptSegment[];
  // Phase 8: Enhanced transcript segments with IDs and topic linking
  enhancedSegments?: EnhancedTranscriptSegment[];
  // Phase 8: Scraped external resources from URLs in transcript
  scrapedResources?: ScrapedResource[];
  // Phase 9: Progress tracking for pause/resume
  progress?: SessionProgress;
  // Phase 10: Content analysis from two-stage pipeline
  contentAnalysis?: ContentAnalysis;
}

// Structured notes generated from video transcript
export interface NoteSection {
  id: string;
  title: string;
  timestamp: string;  // Format: [MM:SS]
  content: string;
  keyPoints: string[];
}

export interface StructuredNotes {
  generatedAt: number;
  sections: NoteSection[];
  summary: string;
}

// Library type (collection of sessions)
export interface Library {
  sessions: Session[];
}

// Session overview for display
export interface SessionOverview {
  video: VideoMetadata;
  topicCount: number;
  questionCount: number;
  estimatedDuration: number;
  topics: { id: string; title: string }[];
}

// API response types (raw YouTube format)
export interface TranscriptSegment {
  text: string;
  duration: number;
  offset: number;
}

// Phase 7: Parsed transcript segment with absolute timestamps
export interface ParsedTranscriptSegment {
  text: string;
  startTime: number; // seconds
  endTime: number;   // seconds
}

// Phase 8: Enhanced transcript segment with ID and topic linking
export interface EnhancedTranscriptSegment extends ParsedTranscriptSegment {
  id: string;              // Unique identifier for the segment
  duration: number;        // Computed: endTime - startTime
  speakerLabel?: string;   // Optional speaker identification
  topicId?: string;        // Link to associated topic by timestamp overlap
}

// Processing state for session creation
export interface ProcessingState {
  step: 'fetching_video' | 'extracting_transcript' | 'fetching_resources' | 'building_knowledge' | 'analyzing_content' | 'generating_topics' | 'ready';
  progress: number;
  message: string;
}

// Timed Session types
export type TimedSessionType = 'RAPID' | 'FOCUSED' | 'COMPREHENSIVE';
export type TimedSessionStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

export interface TimedSession {
  id: string;
  userId: string;
  sessionType: TimedSessionType;
  topicFilter: string | null;
  questionsTotal: number;
  questionsAnswered: number;
  questionsCorrect: number;
  timeLimitSeconds: number;
  timeUsedSeconds: number;
  status: TimedSessionStatus;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  // Computed fields from API
  timeRemaining?: number;
  progress?: number;
}

export interface TimedSessionConfig {
  type: TimedSessionType;
  label: string;
  description: string;
  questions: number;
  timeLimit: number; // seconds
  icon: string;
}

// Question for timed sessions (from stored topics)
export interface TimedQuestion {
  id: string;
  topicId: string;
  topicName: string;
  questionText: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}
