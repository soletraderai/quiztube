import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import Toast from '../components/ui/Toast';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';

interface ReviewItem {
  topicId: string;
  topicName: string;
  topicDescription: string | null;
  masteryLevel: string;
  questionId: string;
  questionText: string;
  correctAnswer: string | null;
  difficulty: string;
  videoTitle: string;
  videoThumbnail: string;
  channelName: string;
}

interface QuickReviewData {
  items: ReviewItem[];
  totalQuestions: number;
  estimatedMinutes: number;
}

type ReviewPhase = 'question' | 'feedback';
type FeedbackType = 'excellent' | 'good' | 'needs-improvement';

// Detect feedback sentiment
function detectFeedbackType(feedback: string): FeedbackType {
  const lowerFeedback = feedback.toLowerCase();
  const excellentPhrases = ['great', 'excellent', 'perfect', 'spot on', 'exactly right', 'you nailed'];
  const improvementPhrases = ['not quite', 'close', 'almost', 'partially', 'let me clarify', 'actually', 'however'];

  if (excellentPhrases.some(phrase => lowerFeedback.includes(phrase))) {
    return 'excellent';
  }
  if (improvementPhrases.some(phrase => lowerFeedback.includes(phrase))) {
    return 'needs-improvement';
  }
  return 'good';
}

export default function ReviewSession() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewData, setReviewData] = useState<QuickReviewData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState<ReviewPhase>('question');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const [correctCount, setCorrectCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Fetch quick review data
  useEffect(() => {
    const fetchReviewData = async () => {
      if (!isAuthenticated()) {
        navigate('/login');
        return;
      }

      try {
        const data = await api.get<QuickReviewData>('/topics/quick-review');
        setReviewData(data);

        if (data.items.length === 0) {
          setToast({ message: 'No topics due for review!', type: 'info' });
          setTimeout(() => navigate('/'), 2000);
        }
      } catch (err) {
        console.error('Failed to fetch review data:', err);
        setToast({ message: 'Failed to load review session', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchReviewData();
  }, [isAuthenticated, navigate]);

  const currentItem = reviewData?.items[currentIndex];
  const totalQuestions = reviewData?.totalQuestions || 0;
  const isComplete = currentIndex >= totalQuestions;

  // Handle answer submission
  const handleSubmit = async () => {
    if (!answer.trim() || !currentItem) {
      setToast({ message: 'Please enter an answer', type: 'error' });
      return;
    }

    setSubmitting(true);

    try {
      // Call API to submit answer
      const result = await api.post<{ isCorrect: boolean; feedback: string }>(`/questions/${currentItem.questionId}/answer`, {
        userAnswer: answer,
        timeTakenSeconds: Math.floor((Date.now() - startTime) / 1000),
      });

      setFeedback(result.feedback);

      // Determine if correct based on feedback type
      const feedbackType = detectFeedbackType(result.feedback);
      if (feedbackType === 'excellent' || feedbackType === 'good') {
        setCorrectCount(prev => prev + 1);
      }

      // Update topic review using SM-2 quality rating
      const quality = feedbackType === 'excellent' ? 5 : feedbackType === 'good' ? 4 : 2;
      await api.post(`/topics/${currentItem.topicId}/review`, { quality });

      setPhase('feedback');
    } catch (err) {
      console.error('Failed to submit answer:', err);
      // Provide fallback feedback
      setFeedback('Good effort! Keep practicing to reinforce your understanding.');
      setPhase('feedback');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle continue to next question
  const handleContinue = () => {
    setCurrentIndex(prev => prev + 1);
    setAnswer('');
    setFeedback(null);
    setPhase('question');
  };

  // Handle skip
  const handleSkip = () => {
    setCurrentIndex(prev => prev + 1);
    setAnswer('');
    setFeedback(null);
    setPhase('question');
  };

  // Handle end review early
  const handleEndReview = () => {
    if (window.confirm('Are you sure you want to end this review session?')) {
      navigate('/');
    }
  };

  // Calculate session time
  const getSessionTime = () => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="text-center py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-border/20 rounded w-1/2 mx-auto"></div>
            <div className="h-4 bg-border/20 rounded w-3/4 mx-auto"></div>
            <div className="h-32 bg-border/20 rounded"></div>
          </div>
          <p className="mt-4 text-text/70">Loading review session...</p>
        </Card>
      </div>
    );
  }

  // No items state
  if (!reviewData || reviewData.items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="text-center py-12">
          <div className="space-y-4">
            <svg className="w-16 h-16 mx-auto text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="font-heading text-2xl font-bold text-text">All Caught Up!</h1>
            <p className="text-text/70">No topics are due for review right now.</p>
            <Button onClick={() => navigate('/')}>Back to Home</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Completion state
  if (isComplete) {
    const sessionTimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="text-center py-8">
          <div className="space-y-6">
            {/* Success animation */}
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-success/20 rounded-full animate-ping"></div>
              <div className="relative w-24 h-24 bg-success/30 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <div>
              <h1 className="font-heading text-2xl font-bold text-text">Quick Review Complete!</h1>
              <p className="text-text/70 mt-2">Great job reinforcing your knowledge!</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t-3 border-border">
              <div className="text-center">
                <div className="font-heading text-3xl font-bold text-primary">{totalQuestions}</div>
                <div className="text-sm text-text/70">Questions</div>
              </div>
              <div className="text-center">
                <div className="font-heading text-3xl font-bold text-success">{accuracy}%</div>
                <div className="text-sm text-text/70">Accuracy</div>
              </div>
              <div className="text-center">
                <div className="font-heading text-3xl font-bold text-secondary">
                  {Math.floor(sessionTimeSeconds / 60)}:{(sessionTimeSeconds % 60).toString().padStart(2, '0')}
                </div>
                <div className="text-sm text-text/70">Time</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button onClick={() => navigate('/')} className="flex-1">
                Back to Home
              </Button>
              <Button variant="ghost" onClick={() => navigate('/library')}>
                View Library
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-secondary text-text text-xs font-bold border-2 border-border">
                QUICK REVIEW
              </span>
              <span className="text-sm text-text/70">{getSessionTime()}</span>
            </div>
            <h1 className="font-heading text-xl font-bold text-text mt-2">
              Question {currentIndex + 1} of {totalQuestions}
            </h1>
          </div>

          <div className="text-right">
            <div className="text-sm text-text/70">
              {correctCount} / {currentIndex} correct
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar
            current={currentIndex}
            total={totalQuestions}
            label="Progress"
          />
        </div>
      </Card>

      {/* Topic Context */}
      {currentItem && (
        <Card className="bg-surface/50">
          <div className="flex items-center gap-3">
            <img
              src={currentItem.videoThumbnail}
              alt=""
              className="w-16 h-12 object-cover border-2 border-border"
            />
            <div className="flex-1 min-w-0">
              <p className="font-heading font-semibold text-text text-sm truncate">
                {currentItem.topicName}
              </p>
              <p className="text-xs text-text/70 truncate">
                {currentItem.videoTitle} • {currentItem.channelName}
              </p>
            </div>
            <span className={`px-2 py-1 text-xs font-bold border-2 border-border ${
              currentItem.masteryLevel === 'MASTERED' ? 'bg-success/20' :
              currentItem.masteryLevel === 'FAMILIAR' ? 'bg-secondary/20' :
              currentItem.masteryLevel === 'DEVELOPING' ? 'bg-primary/20' :
              'bg-surface'
            }`}>
              {currentItem.masteryLevel}
            </span>
          </div>
        </Card>
      )}

      {/* Question Phase */}
      {phase === 'question' && currentItem && (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-lg font-bold text-text mb-2">
                Question
              </h2>
              <p className="text-text text-lg">{currentItem.questionText}</p>
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
                className="w-full p-4 border-3 border-border bg-surface font-body text-text min-h-[120px] focus:outline-none focus:shadow-brutal"
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleSubmit}
                loading={submitting}
                disabled={submitting || !answer.trim()}
                className="flex-1"
              >
                Submit Answer
              </Button>
              <Button variant="ghost" onClick={handleSkip} disabled={submitting}>
                Skip
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Feedback Phase */}
      {phase === 'feedback' && feedback && currentItem && (() => {
        const feedbackType = detectFeedbackType(feedback);
        const colors = {
          excellent: { bg: 'bg-success/20', icon: 'text-success' },
          good: { bg: 'bg-primary/20', icon: 'text-text' },
          'needs-improvement': { bg: 'bg-secondary/20', icon: 'text-text' },
        };
        const c = colors[feedbackType];

        return (
          <Card className="animate-fade-in">
            <div className="space-y-6">
              {/* Feedback Icon */}
              <div className="flex justify-center">
                <div className={`w-16 h-16 rounded-full ${c.bg} flex items-center justify-center`}>
                  {feedbackType === 'excellent' ? (
                    <svg className={`w-8 h-8 ${c.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : feedbackType === 'needs-improvement' ? (
                    <svg className={`w-8 h-8 ${c.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  ) : (
                    <svg className={`w-8 h-8 ${c.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                    </svg>
                  )}
                </div>
              </div>

              <div>
                <h2 className="font-heading text-lg font-bold text-text mb-2">
                  Your Answer
                </h2>
                <p className="text-text bg-surface p-3 border-2 border-border">
                  {answer}
                </p>
              </div>

              <div>
                <h2 className="font-heading text-lg font-bold text-text mb-2">
                  Feedback
                </h2>
                <p className="text-text">{feedback}</p>
              </div>

              <Button onClick={handleContinue} className="w-full">
                {currentIndex + 1 < totalQuestions ? 'Next Question' : 'Finish Review'}
              </Button>
            </div>
          </Card>
        );
      })()}

      {/* End Review Button */}
      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={handleEndReview}>
          End Review Early
        </Button>
      </div>
    </div>
  );
}
