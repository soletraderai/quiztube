// Tutor personality type
export type TutorPersonality = 'PROFESSOR' | 'COACH' | 'DIRECT' | 'CREATIVE';

// Learning style type
export type LearningStyle = 'visual' | 'reading' | 'auditory' | 'kinesthetic';

// Settings type
export interface Settings {
  userName: string;
  geminiApiKey: string;
  language: string;
  tutorPersonality: TutorPersonality;
  learningStyle: LearningStyle;
}

// Video metadata type
export interface VideoMetadata {
  url: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
  channel: string;
  publishDate?: string;
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
  userAnswer: string | null;
  feedback: string | null;
  answeredAt: number | null;
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
}

// Session score type
export interface SessionScore {
  topicsCompleted: number;
  topicsSkipped: number;
  questionsAnswered: number;
  bookmarkedTopics: number;
  digDeeperCount: number;
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

// API response types
export interface TranscriptSegment {
  text: string;
  duration: number;
  offset: number;
}

// Processing state for session creation
export interface ProcessingState {
  step: 'fetching_video' | 'extracting_transcript' | 'building_knowledge' | 'generating_topics' | 'ready';
  progress: number;
  message: string;
}
