import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import Toast from '../components/ui/Toast';
import DigDeeperModal from '../components/ui/DigDeeperModal';
import CodeEditor from '../components/ui/CodeEditor';
import CodePlayground from '../components/ui/CodePlayground';
import MaterialIcon from '../components/ui/MaterialIcon';
import EvaluationFeedback from '../components/ui/EvaluationFeedback';
import { useHelpContext } from '../components/ui/SidebarLayout';
import { useSessionStore } from '../stores/sessionStore';
import { evaluateAnswer, RateLimitError, generateFallbackFeedback } from '../services/gemini';
import { formatTimestamp, generateYouTubeTimestampUrl } from '../services/transcript';
import { useDocumentTitle } from '../hooks';
import type { ChatMessage, EvaluationResult } from '../types';

// Phase 7: Removed 'feedback' phase - feedback now shows inline
type SessionPhase = 'question' | 'summary';

// Question transition animation variants
const questionVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

// Check if URL is valid
const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

// Source type icons
const sourceTypeIcons: Record<string, { icon: React.ReactNode; color: string }> = {
  github: {
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    ),
    color: 'bg-gray-800 text-white',
  },
  documentation: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
      </svg>
    ),
    color: 'bg-primary text-text',
  },
  article: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
      </svg>
    ),
    color: 'bg-secondary text-text',
  },
  other: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
      </svg>
    ),
    color: 'bg-accent text-text',
  },
};

// Calculate optimal difficulty based on accuracy - targets 70-80% accuracy zone
function calculateOptimalDifficulty(
  questionsAnswered: number,
  questionsCorrect: number,
  currentDifficulty: 'standard' | 'easier' | 'harder'
): 'standard' | 'easier' | 'harder' | null {
  // Need at least 3 answers to calibrate
  if (questionsAnswered < 3) return null;

  const accuracy = (questionsCorrect / questionsAnswered) * 100;

  // Target: 70-80% accuracy zone
  if (accuracy > 85 && currentDifficulty !== 'harder') {
    // User is getting too many right - make it harder
    return 'harder';
  } else if (accuracy < 65 && currentDifficulty !== 'easier') {
    // User is struggling - make it easier
    return 'easier';
  } else if (accuracy >= 70 && accuracy <= 80 && currentDifficulty !== 'standard') {
    // In the sweet spot - return to standard
    return 'standard';
  }

  return null; // No change needed
}

export default function ActiveSession() {
  useDocumentTitle('Learning Session');
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const {
    getSession,
    setCurrentSession,
    updateSession,
    updateTopic,
    updateQuestion,
    updateScore,
    saveSnippet,
  } = useSessionStore();

  const [phase, setPhase] = useState<SessionPhase>('question');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDigDeeperOpen, setIsDigDeeperOpen] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(() => {
    // Load preference from localStorage, default to true
    const stored = localStorage.getItem('quiztube_show_code_editor');
    return stored !== null ? stored === 'true' : true;
  });
  // Phase 7: Inline evaluation result state
  const [inlineEvaluation, setInlineEvaluation] = useState<EvaluationResult | null>(null);
  const [showInlineFeedback, setShowInlineFeedback] = useState(false);
  // Phase 7 F5: Expandable topic summary
  const [isTopicSummaryExpanded, setIsTopicSummaryExpanded] = useState(false);

  // Help panel context
  const { openHelp, closeHelp, setTranscriptContext, clearTranscriptContext } = useHelpContext();

  // Save code editor preference to localStorage
  useEffect(() => {
    localStorage.setItem('quiztube_show_code_editor', String(showCodeEditor));
  }, [showCodeEditor]);

  const session = sessionId ? getSession(sessionId) : undefined;

  // Intercept navigation link clicks while session is active
  useEffect(() => {
    const handleNavClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]');

      if (link && session?.status === 'active') {
        const href = link.getAttribute('href');
        // Only intercept internal navigation links (not external links or session links)
        if (href && !href.startsWith('http') && !href.includes('/session/')) {
          e.preventDefault();
          e.stopPropagation();
          const confirmed = window.confirm(
            'You have an active learning session. Are you sure you want to leave? Your progress will be saved.'
          );
          if (confirmed) {
            navigate(href);
          }
        }
      }
    };

    document.addEventListener('click', handleNavClick, true);
    return () => document.removeEventListener('click', handleNavClick, true);
  }, [session?.status, navigate]);

  // Warn before leaving with browser navigation (refresh, close tab)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (session?.status === 'active') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session?.status]);

  // Phase 7 F2: Update help panel transcript context when topic changes
  useEffect(() => {
    if (session) {
      const topicIndex = session.currentTopicIndex || 0;
      const topic = session.topics[topicIndex];
      if (topic) {
        setTranscriptContext({
          transcriptSegments: session.transcriptSegments,
          currentTimestampStart: topic.timestampStart,
          currentTimestampEnd: topic.timestampEnd,
          videoUrl: session.video?.url,
        });
      }
    }
    // Clear transcript context on unmount
    return () => {
      clearTranscriptContext();
    };
  }, [session?.id, session?.currentTopicIndex, setTranscriptContext, clearTranscriptContext]);

  useEffect(() => {
    if (session && session.status !== 'completed') {
      setCurrentSession(session);
      // Update session to active status
      if (session.status === 'overview') {
        updateSession(session.id, { status: 'active' });
      }
    }
  }, [session?.id, session?.status, setCurrentSession, updateSession]);

  // Redirect if session not found or already completed
  if (!session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="text-center py-12 max-w-md">
          <div className="space-y-4">
            <h1 className="font-heading text-2xl font-bold text-text">
              Session Not Found
            </h1>
            <p className="text-text/70">
              This session doesn't exist or has been deleted.
            </p>
            <Button onClick={() => navigate('/')}>
              Start New Session
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (session.status === 'completed') {
    navigate(`/session/${sessionId}/notes`);
    return null;
  }

  const currentTopicIndex = session.currentTopicIndex || 0;
  const currentQuestionIndex = session.currentQuestionIndex || 0;
  const currentTopic = session.topics[currentTopicIndex];
  const currentQuestion = currentTopic?.questions[currentQuestionIndex];

  const totalTopics = session.topics.length;
  const completedTopics = session.topics.filter((t) => t.completed || t.skipped).length;

  // Handle answer submission
  // Phase 7: Updated to use EvaluationResult and show inline feedback
  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      setToast({ message: 'Please enter an answer', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      // Call server-side AI for evaluation (now returns EvaluationResult)
      let evaluation: EvaluationResult;

      try {
        evaluation = await evaluateAnswer(
          currentTopic,
          currentQuestion,
          answer,
          session.difficulty || 'standard',
          session.knowledgeBase?.sources
        );
      } catch (apiError) {
        console.error('AI API error:', apiError);
        // Handle rate limit errors specifically
        if (apiError instanceof RateLimitError) {
          setToast({
            message: `${apiError.message} Using contextual feedback for now.`,
            type: 'error',
          });
        }
        // Fallback to contextual feedback if API fails
        evaluation = generateFallbackFeedback(
          currentTopic,
          currentQuestion,
          answer,
          session.difficulty || 'standard'
        );
      }

      // Update question with answer and evaluation result
      updateQuestion(session.id, currentTopicIndex, currentQuestionIndex, {
        userAnswer: answer,
        feedback: evaluation.feedback,
        answeredAt: Date.now(),
        evaluationResult: evaluation,
      });

      // Phase 7: Update score based on three-tier evaluation
      const wasCorrect = evaluation.result === 'pass';
      const newQuestionsAnswered = session.score.questionsAnswered + 1;
      const newQuestionsCorrect = session.score.questionsCorrect + (wasCorrect ? 1 : 0);

      // Update score with three-tier counts
      updateScore(session.id, {
        questionsAnswered: newQuestionsAnswered,
        questionsCorrect: newQuestionsCorrect,
        questionsPassed: (session.score.questionsPassed || 0) + (evaluation.result === 'pass' ? 1 : 0),
        questionsFailed: (session.score.questionsFailed || 0) + (evaluation.result === 'fail' ? 1 : 0),
        questionsNeutral: (session.score.questionsNeutral || 0) + (evaluation.result === 'neutral' ? 1 : 0),
      });

      // Auto-calibrate difficulty based on accuracy (target: 70-80% zone)
      const newDifficulty = calculateOptimalDifficulty(
        newQuestionsAnswered,
        newQuestionsCorrect,
        session.difficulty || 'standard'
      );

      if (newDifficulty) {
        updateSession(session.id, { difficulty: newDifficulty });
        const accuracy = Math.round((newQuestionsCorrect / newQuestionsAnswered) * 100);
        const difficultyLabel = newDifficulty === 'harder' ? 'increased' : newDifficulty === 'easier' ? 'decreased' : 'adjusted';
        setToast({
          message: `Difficulty ${difficultyLabel} to match your ${accuracy}% accuracy`,
          type: 'info',
        });
      }

      // Phase 7: Show inline feedback instead of changing phase
      setInlineEvaluation(evaluation);
      setShowInlineFeedback(true);
    } catch (err) {
      setToast({ message: 'Connection issue. Your answer was saved locally.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Handle continue to summary (Phase 7: from inline feedback)
  const handleContinueToSummary = () => {
    setShowInlineFeedback(false);
    setInlineEvaluation(null);
    setPhase('summary');
  };

  // Handle continue to next topic
  const handleContinue = () => {
    // Mark current topic as completed
    updateTopic(session.id, currentTopicIndex, { completed: true });
    updateScore(session.id, {
      topicsCompleted: session.score.topicsCompleted + 1,
    });

    // Move to next topic
    moveToNextTopic();
  };

  // Handle skip
  const handleSkip = () => {
    updateTopic(session.id, currentTopicIndex, { skipped: true });
    updateScore(session.id, {
      topicsSkipped: session.score.topicsSkipped + 1,
    });

    moveToNextTopic();
  };

  // Handle bookmark
  const handleBookmark = () => {
    const newBookmarked = !currentTopic.bookmarked;
    updateTopic(session.id, currentTopicIndex, { bookmarked: newBookmarked });

    updateScore(session.id, {
      bookmarkedTopics: newBookmarked
        ? session.score.bookmarkedTopics + 1
        : session.score.bookmarkedTopics - 1,
    });

    setToast({
      message: newBookmarked ? 'Topic bookmarked!' : 'Bookmark removed',
      type: 'success',
    });
  };

  // Handle dig deeper
  const handleDigDeeper = () => {
    setIsDigDeeperOpen(true);
  };

  // Handle dig deeper conversation update
  const handleDigDeeperConversationUpdate = (messages: ChatMessage[]) => {
    updateTopic(session!.id, currentTopicIndex, {
      digDeeperConversation: messages,
    });
    // Update dig deeper count if this is a new conversation
    if (messages.length === 2 && session!.score.digDeeperCount === 0) {
      updateScore(session!.id, {
        digDeeperCount: session!.score.digDeeperCount + 1,
      });
    } else if (messages.length > 0 && messages.length % 2 === 0) {
      // Increment for each exchange (user message + assistant response)
      const currentCount = session!.topics.filter(t => t.digDeeperConversation && t.digDeeperConversation.length > 0).length;
      if (currentCount > session!.score.digDeeperCount) {
        updateScore(session!.id, {
          digDeeperCount: currentCount,
        });
      }
    }
  };

  // Handle generating new question from dig deeper
  const handleGenerateQuestion = (_newQuestion: string) => {
    setToast({ message: 'New question generated! It will appear in your next topic.', type: 'success' });
    // For now just show a toast - in a full implementation, we could add this to the topic's questions
  };

  // Handle difficulty change
  const handleDifficultyChange = (difficulty: 'easier' | 'harder') => {
    updateSession(session.id, { difficulty });
    setToast({ message: `Difficulty set to ${difficulty}`, type: 'info' });
  };

  // Move to next topic or complete session
  const moveToNextTopic = () => {
    // Close help panel when moving to next question (Feature 770)
    closeHelp();

    const nextIndex = currentTopicIndex + 1;

    if (nextIndex >= session.topics.length) {
      // Session complete
      updateSession(session.id, {
        status: 'completed',
        completedAt: Date.now(),
      });
      navigate(`/session/${sessionId}/notes`);
    } else {
      // Move to next topic
      updateSession(session.id, {
        currentTopicIndex: nextIndex,
        currentQuestionIndex: 0,
      });
      setPhase('question');
      setAnswer('');
      // Phase 7: Reset inline feedback state
      setShowInlineFeedback(false);
      setInlineEvaluation(null);
      setIsTopicSummaryExpanded(false);
    }
  };

  // Handle end session early
  const handleEndSession = () => {
    if (window.confirm('Are you sure you want to end this session? Your progress will be saved.')) {
      updateSession(session.id, {
        status: 'completed',
        completedAt: Date.now(),
      });
      navigate(`/session/${sessionId}/notes`);
    }
  };

  if (!currentTopic || !currentQuestion) {
    return (
      <Card className="text-center py-12">
        <p>No more topics available.</p>
        <Button onClick={() => navigate(`/session/${sessionId}/notes`)}>
          View Session Notes
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Progress Header */}
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">
              Topic {currentTopicIndex + 1} of {totalTopics}
            </h1>
            <p className="text-sm text-text/70">{currentTopic.title}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Accuracy indicator - shows after answering 3+ questions */}
            {session.score.questionsAnswered >= 3 && (
              <div className="text-sm text-center">
                <span className="font-heading font-semibold">
                  {Math.round((session.score.questionsCorrect / session.score.questionsAnswered) * 100)}%
                </span>
                <span className="text-text/60 ml-1">accuracy</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant={session.difficulty === 'easier' ? 'primary' : 'ghost'}
                onClick={() => handleDifficultyChange('easier')}
              >
                Easier
              </Button>
              <Button
                size="sm"
                variant={session.difficulty === 'harder' ? 'primary' : 'ghost'}
                onClick={() => handleDifficultyChange('harder')}
              >
                Harder
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar
            current={completedTopics}
            total={totalTopics}
            label="Progress"
          />
        </div>
      </Card>

      {/* Sources Panel */}
      {session.knowledgeBase?.sources && session.knowledgeBase.sources.length > 0 && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
            className="w-full flex items-center justify-between p-0 text-left"
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
              <span className="font-heading font-semibold text-text">
                Sources ({session.knowledgeBase.sources.length})
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-text/70 transition-transform duration-200 ${isSourcesExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {isSourcesExpanded && (
            <div className="mt-4 space-y-3 border-t-2 border-border pt-4">
              {session.knowledgeBase.sources.map((source, index) => {
                const sourceType = sourceTypeIcons[source.type] || sourceTypeIcons.other;
                const urlValid = isValidUrl(source.url);

                // For invalid URLs, show non-clickable div with warning
                if (!urlValid) {
                  return (
                    <div
                      key={index}
                      className="block p-3 bg-surface/50 border-2 border-border opacity-60"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center border-2 border-border bg-yellow-100 text-yellow-700`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-semibold text-text text-sm truncate">
                              {source.title}
                            </span>
                            <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">
                              Link Unavailable
                            </span>
                          </div>
                          <p className="text-sm text-text/70 mt-1 line-clamp-2">
                            {source.snippet}
                          </p>
                          <p className="text-xs text-yellow-600 mt-1">
                            This source link may be broken or unavailable
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-surface/50 border-2 border-border hover:shadow-brutal transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center border-2 border-border ${sourceType.color}`}>
                        {sourceType.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-semibold text-text text-sm truncate">
                            {source.title}
                          </span>
                          <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-surface border border-border rounded capitalize">
                            {source.type}
                          </span>
                        </div>
                        <p className="text-sm text-text/70 mt-1 line-clamp-2">
                          {source.snippet}
                        </p>
                      </div>
                      <svg className="flex-shrink-0 w-4 h-4 text-text/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                      </svg>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Question Phase */}
      {phase === 'question' && (
        <Card>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentTopicIndex}-${currentQuestionIndex}`}
              variants={questionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Phase 7 F6: Timestamp Badge */}
              {(currentTopic.timestampStart !== undefined || currentTopic.timestampEnd !== undefined) && (
                <div className="flex items-center gap-2">
                  <a
                    href={generateYouTubeTimestampUrl(session.video.url, currentTopic.timestampStart || 0)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border-2 border-primary/30 rounded-full text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      From video: {formatTimestamp(currentTopic.timestampStart || 0)}
                      {currentTopic.timestampEnd !== undefined && ` - ${formatTimestamp(currentTopic.timestampEnd)}`}
                    </span>
                  </a>
                  {currentTopic.sectionName && (
                    <span className="text-xs text-text/60">
                      ({currentTopic.sectionName})
                    </span>
                  )}
                </div>
              )}

              {/* Phase 7 F5: Expandable Topic Summary */}
              <div className="border-2 border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setIsTopicSummaryExpanded(!isTopicSummaryExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-surface/50 hover:bg-surface transition-colors"
                  aria-expanded={isTopicSummaryExpanded}
                  aria-controls="topic-summary"
                >
                  <span className="text-sm font-medium text-text/80">
                    {isTopicSummaryExpanded ? 'Hide topic context' : 'Show topic context'}
                  </span>
                  <motion.svg
                    animate={{ rotate: isTopicSummaryExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-4 h-4 text-text/60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </button>
                <AnimatePresence>
                  {isTopicSummaryExpanded && (
                    <motion.div
                      id="topic-summary"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 border-t-2 border-border">
                        <p className="text-sm text-text/80">{currentTopic.summary}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <h2 className="font-heading text-lg font-bold text-text mb-2">
                  Question
                </h2>
                <p className="text-text text-lg">{currentQuestion.text}</p>
              </div>

            {/* Phase 7 F1: Code Editor for code questions OR legacy programming topics */}
            {(currentQuestion.isCodeQuestion || currentTopic.codeExample) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-heading font-semibold text-text flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    {/* F1: Show "Code Challenge" for code questions, "Code Example" for legacy */}
                    {currentQuestion.isCodeQuestion ? 'Code Challenge' : 'Code Example'}
                    {['javascript', 'typescript', 'python'].includes(currentQuestion.codeChallenge?.language || currentTopic.codeLanguage || '') && (
                      <span className="text-xs text-text/60 font-normal ml-2">(Click Run to execute)</span>
                    )}
                    {['html', 'css'].includes(currentQuestion.codeChallenge?.language || currentTopic.codeLanguage || '') && (
                      <span className="text-xs text-text/60 font-normal ml-2">(Live Preview)</span>
                    )}
                  </h3>
                  <button
                    onClick={() => setShowCodeEditor(!showCodeEditor)}
                    className="flex items-center gap-1 px-3 py-1 text-sm font-heading border-2 border-border bg-surface hover:bg-primary/10 transition-colors"
                    aria-label={showCodeEditor ? 'Hide code editor' : 'Show code editor'}
                  >
                    <MaterialIcon
                      name={showCodeEditor ? 'visibility_off' : 'visibility'}
                      size="sm"
                      decorative
                    />
                    {showCodeEditor ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showCodeEditor && (
                  <>
                    {/* F1: Use code challenge template if available, otherwise fallback to topic code example */}
                    {(() => {
                      const codeToUse = currentQuestion.codeChallenge?.template || currentTopic.codeExample || '';
                      const languageToUse = currentQuestion.codeChallenge?.language || currentTopic.codeLanguage || 'javascript';
                      return (['javascript', 'typescript', 'python', 'html', 'css'].includes(languageToUse)) ? (
                      <CodePlayground
                        initialCode={codeToUse}
                        language={languageToUse}
                        onSaveSnippet={(code, lang) => {
                          if (sessionId) {
                            saveSnippet(sessionId, {
                              code,
                              language: lang,
                              topicId: currentTopic.id,
                              topicTitle: currentTopic.title,
                            });
                          }
                        }}
                      />
                    ) : (
                      <CodeEditor
                        initialCode={codeToUse}
                        language={languageToUse}
                        readOnly={true}
                        className="max-h-[300px] overflow-auto"
                      />
                    );
                    })()}
                  </>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="answer"
                className="block font-heading font-semibold text-text mb-2"
              >
                Your Answer
              </label>
              <textarea
                id="answer"
                className="w-full p-4 border-3 border-border bg-surface font-body text-text min-h-[150px] focus:outline-none focus:shadow-brutal"
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={loading}
                maxLength={5000}
              />
              {answer.length > 4500 && (
                <p className="text-xs text-error mt-1">
                  {5000 - answer.length} characters remaining
                </p>
              )}
            </div>

            {/* Show buttons only when not showing inline feedback */}
            {!showInlineFeedback && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleSubmitAnswer}
                  loading={loading}
                  disabled={loading || !answer.trim()}
                  className="flex-1"
                >
                  Submit Answer
                </Button>
                <Button variant="ghost" onClick={handleSkip} disabled={loading}>
                  Skip
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openHelp('session')}
                  disabled={loading}
                  className="sm:ml-auto"
                >
                  <MaterialIcon name="help_outline" size="sm" className="mr-1" decorative />
                  Get Help
                </Button>
              </div>
            )}

            {/* Phase 7: Inline Evaluation Feedback */}
            {inlineEvaluation && (
              <EvaluationFeedback
                result={inlineEvaluation}
                userAnswer={answer}
                onContinue={handleContinueToSummary}
                isVisible={showInlineFeedback}
              />
            )}
            </motion.div>
          </AnimatePresence>
        </Card>
      )}

      {/* Summary Phase */}
      {phase === 'summary' && (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-lg font-bold text-secondary mb-2">
                Topic Summary
              </h2>
              <p className="text-text">{currentTopic.summary}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleContinue} className="flex-1">
                Continue
              </Button>
              <Button
                variant={currentTopic.bookmarked ? 'secondary' : 'ghost'}
                onClick={handleBookmark}
              >
                {currentTopic.bookmarked ? 'Bookmarked' : 'Bookmark'}
              </Button>
              <Button variant="ghost" onClick={handleDigDeeper}>
                Dig Deeper
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* End Session Button */}
      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={handleEndSession}>
          End Session Early
        </Button>
      </div>

      {/* Dig Deeper Modal */}
      <DigDeeperModal
        isOpen={isDigDeeperOpen}
        onClose={() => setIsDigDeeperOpen(false)}
        topic={currentTopic}
        conversation={currentTopic.digDeeperConversation || []}
        onConversationUpdate={handleDigDeeperConversationUpdate}
        onGenerateQuestion={handleGenerateQuestion}
      />
    </div>
  );
}
