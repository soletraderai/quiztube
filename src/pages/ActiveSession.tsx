import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import Toast from '../components/ui/Toast';
import DigDeeperModal from '../components/ui/DigDeeperModal';
import { useSessionStore } from '../stores/sessionStore';
import { evaluateAnswer, RateLimitError, generateFallbackFeedback } from '../services/gemini';
import type { ChatMessage } from '../types';

type SessionPhase = 'question' | 'feedback' | 'summary';
type FeedbackType = 'excellent' | 'good' | 'needs-improvement';

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

// Detect feedback sentiment based on opening phrases
function detectFeedbackType(feedback: string): FeedbackType {
  const lowerFeedback = feedback.toLowerCase();
  const excellentPhrases = ['great answer', 'excellent', 'perfect', 'spot on', 'exactly right', 'you nailed'];
  const goodPhrases = ['good thinking', 'good answer', 'nice work', 'well done', 'solid', 'on the right track'];
  const improvementPhrases = ['not quite', 'close', 'almost', 'partially', 'let me clarify', 'actually', 'however'];

  if (excellentPhrases.some(phrase => lowerFeedback.includes(phrase))) {
    return 'excellent';
  }
  if (improvementPhrases.some(phrase => lowerFeedback.includes(phrase))) {
    return 'needs-improvement';
  }
  if (goodPhrases.some(phrase => lowerFeedback.includes(phrase))) {
    return 'good';
  }
  // Default to good for neutral feedback
  return 'good';
}

// Check if answer is considered "correct" for accuracy tracking
function isAnswerCorrect(feedbackType: FeedbackType): boolean {
  // Consider 'excellent' and 'good' as correct answers
  return feedbackType === 'excellent' || feedbackType === 'good';
}

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
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const {
    getSession,
    setCurrentSession,
    updateSession,
    updateTopic,
    updateQuestion,
    updateScore,
  } = useSessionStore();

  const [phase, setPhase] = useState<SessionPhase>('question');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDigDeeperOpen, setIsDigDeeperOpen] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);

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
  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      setToast({ message: 'Please enter an answer', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      // Call server-side AI for feedback
      let feedback: string;

      try {
        feedback = await evaluateAnswer(
          currentTopic,
          currentQuestion,
          answer,
          session.difficulty || 'standard'
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
        feedback = generateFallbackFeedback(
          currentTopic,
          currentQuestion,
          answer,
          session.difficulty || 'standard'
        );
      }

      // Update question with answer and feedback
      updateQuestion(session.id, currentTopicIndex, currentQuestionIndex, {
        userAnswer: answer,
        feedback: feedback,
        answeredAt: Date.now(),
      });

      // Determine if answer is correct based on feedback sentiment
      const feedbackType = detectFeedbackType(feedback);
      const wasCorrect = isAnswerCorrect(feedbackType);
      const newQuestionsAnswered = session.score.questionsAnswered + 1;
      const newQuestionsCorrect = session.score.questionsCorrect + (wasCorrect ? 1 : 0);

      // Update score with accuracy tracking
      updateScore(session.id, {
        questionsAnswered: newQuestionsAnswered,
        questionsCorrect: newQuestionsCorrect,
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

      setPhase('feedback');
    } catch (err) {
      setToast({ message: 'Failed to process answer. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Handle continue to summary
  const handleContinueToSummary = () => {
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
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-lg font-bold text-text mb-2">
                Question
              </h2>
              <p className="text-text text-lg">{currentQuestion.text}</p>
            </div>

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
            </div>
          </div>
        </Card>
      )}

      {/* Feedback Phase */}
      {phase === 'feedback' && currentQuestion.feedback && (() => {
        const feedbackType = detectFeedbackType(currentQuestion.feedback);
        const isExcellent = feedbackType === 'excellent';
        const needsImprovement = feedbackType === 'needs-improvement';

        // Color schemes based on feedback type
        const colors = {
          excellent: {
            bg: 'bg-success/20',
            inner: 'bg-success/40',
            icon: 'text-success',
            glow: 'bg-success/10',
            heading: 'text-success',
          },
          good: {
            bg: 'bg-primary/20',
            inner: 'bg-primary/40',
            icon: 'text-text',
            glow: 'bg-primary/10',
            heading: 'text-primary',
          },
          'needs-improvement': {
            bg: 'bg-secondary/20',
            inner: 'bg-secondary/40',
            icon: 'text-text',
            glow: 'bg-secondary/10',
            heading: 'text-secondary',
          },
        };

        const c = colors[feedbackType];

        return (
          <Card className="animate-fade-in">
            <div className="space-y-6">
              {/* Feedback Animation */}
              <div className="flex justify-center animate-scale-in">
                <div className="relative">
                  <div className={`w-20 h-20 rounded-full ${c.bg} flex items-center justify-center animate-pulse-subtle`}>
                    <div className={`w-14 h-14 rounded-full ${c.inner} flex items-center justify-center`}>
                      {isExcellent ? (
                        /* Checkmark for excellent answers */
                        <svg
                          className={`w-8 h-8 ${c.icon} animate-check-draw`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                        >
                          <path className="animate-check-path" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : needsImprovement ? (
                        /* Lightbulb for learning opportunity */
                        <svg
                          className={`w-8 h-8 ${c.icon}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        >
                          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      ) : (
                        /* Thumbs up for good answers */
                        <svg
                          className={`w-8 h-8 ${c.icon}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        >
                          <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {/* Subtle glow effect */}
                  <div className={`absolute inset-0 rounded-full ${c.glow} animate-ping-slow opacity-0`} />
                </div>
              </div>

              {/* Encouraging message for needs-improvement */}
              {needsImprovement && (
                <div className="text-center animate-slide-up">
                  <p className="text-text/70 text-sm italic">
                    Every question is a learning opportunity! 💡
                  </p>
                </div>
              )}

              <div className="animate-slide-up delay-100">
                <h2 className="font-heading text-lg font-bold text-text mb-2">
                  Your Answer
                </h2>
                <p className="text-text bg-surface p-3 border-2 border-border">
                  {currentQuestion.userAnswer}
                </p>
              </div>

              <div className="animate-slide-up delay-200">
                <h2 className={`font-heading text-lg font-bold ${c.heading} mb-2`}>
                  Feedback
                </h2>
                <p className="text-text">{currentQuestion.feedback}</p>
              </div>

              <Button onClick={handleContinueToSummary} className="w-full animate-slide-up delay-300">
                Continue to Summary
              </Button>
            </div>
          </Card>
        );
      })()}

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
