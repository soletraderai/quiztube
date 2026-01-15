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
}

// Dig deeper conversation message type
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

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

// Processing state for session creation
export interface ProcessingState {
  step: 'fetching_video' | 'extracting_transcript' | 'building_knowledge' | 'generating_topics' | 'ready';
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
