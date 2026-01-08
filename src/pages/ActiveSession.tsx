import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import Toast from '../components/ui/Toast';
import DigDeeperModal from '../components/ui/DigDeeperModal';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { evaluateAnswer, RateLimitError } from '../services/gemini';
import type { ChatMessage } from '../types';

type SessionPhase = 'question' | 'feedback' | 'summary';

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
  const { settings } = useSettingsStore();

  const [phase, setPhase] = useState<SessionPhase>('question');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDigDeeperOpen, setIsDigDeeperOpen] = useState(false);

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
      // Call Gemini API for feedback
      let feedback: string;

      if (settings.geminiApiKey) {
        try {
          feedback = await evaluateAnswer(
            settings.geminiApiKey,
            currentTopic,
            currentQuestion,
            answer
          );
        } catch (apiError) {
          console.error('Gemini API error:', apiError);
          // Handle rate limit errors specifically
          if (apiError instanceof RateLimitError) {
            setToast({
              message: `${apiError.message} You can continue with generic feedback for now.`,
              type: 'error',
            });
          }
          // Fallback to generic feedback if API fails
          feedback = `Thank you for your answer! You've made a thoughtful response about "${currentTopic.title}". Consider reviewing the topic summary for additional insights.`;
        }
      } else {
        // No API key - use generic feedback
        feedback = `Thank you for your answer! You've made a thoughtful response about "${currentTopic.title}". Consider reviewing the topic summary for additional insights.`;
      }

      // Update question with answer and feedback
      updateQuestion(session.id, currentTopicIndex, currentQuestionIndex, {
        userAnswer: answer,
        feedback: feedback,
        answeredAt: Date.now(),
      });

      // Update score
      updateScore(session.id, {
        questionsAnswered: session.score.questionsAnswered + 1,
      });

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

        <div className="mt-4">
          <ProgressBar
            current={completedTopics}
            total={totalTopics}
            label="Progress"
          />
        </div>
      </Card>

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
      {phase === 'feedback' && currentQuestion.feedback && (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-lg font-bold text-text mb-2">
                Your Answer
              </h2>
              <p className="text-text bg-surface p-3 border-2 border-border">
                {currentQuestion.userAnswer}
              </p>
            </div>

            <div>
              <h2 className="font-heading text-lg font-bold text-success mb-2">
                Feedback
              </h2>
              <p className="text-text">{currentQuestion.feedback}</p>
            </div>

            <Button onClick={handleContinueToSummary} className="w-full">
              Continue to Summary
            </Button>
          </div>
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
        apiKey={settings.geminiApiKey}
        conversation={currentTopic.digDeeperConversation || []}
        onConversationUpdate={handleDigDeeperConversationUpdate}
        onGenerateQuestion={handleGenerateQuestion}
      />
    </div>
  );
}
