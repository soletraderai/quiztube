import { Link, useParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import MaterialIcon from '../components/ui/MaterialIcon';
import { useActiveTimedSession, useDocumentTitle } from '../hooks';
import type { TimedSessionType, TimedSessionStatus } from '../types';

// Session type labels
const SESSION_LABELS: Record<TimedSessionType, string> = {
  RAPID: 'Rapid Fire',
  FOCUSED: 'Focused Session',
  COMPREHENSIVE: 'Comprehensive',
};

// Format time for display
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Get performance message based on accuracy
function getPerformanceMessage(accuracy: number, status: TimedSessionStatus): { title: string; message: string; color: string } {
  if (status === 'ABANDONED') {
    return {
      title: 'Session Abandoned',
      message: 'No worries! Learning is a journey, not a race. Try again when you\'re ready.',
      color: 'text-text/70',
    };
  }

  if (accuracy >= 90) {
    return {
      title: 'Outstanding!',
      message: 'Excellent mastery! You\'re really understanding this material.',
      color: 'text-success',
    };
  } else if (accuracy >= 80) {
    return {
      title: 'Great Work!',
      message: 'Solid performance! Keep up the momentum.',
      color: 'text-success',
    };
  } else if (accuracy >= 70) {
    return {
      title: 'Good Progress!',
      message: 'You\'re on the right track. A few more reviews will solidify your knowledge.',
      color: 'text-primary',
    };
  } else if (accuracy >= 60) {
    return {
      title: 'Keep Going!',
      message: 'Practice makes perfect. Try reviewing the topics you missed.',
      color: 'text-secondary',
    };
  } else {
    return {
      title: 'Room to Grow',
      message: 'Don\'t give up! Each session helps strengthen your understanding.',
      color: 'text-text/70',
    };
  }
}

export default function TimedSessionResults() {
  useDocumentTitle('Session Results');
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data: session, isLoading, error } = useActiveTimedSession(sessionId);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="text-center py-12 max-w-md">
          <div className="w-12 h-12 mx-auto border-3 border-border border-t-primary animate-spin mb-4" />
          <p className="text-text/70">Loading results...</p>
        </Card>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="text-center py-12 max-w-md">
          <h2 className="font-heading text-xl font-bold text-text mb-2">Results Not Found</h2>
          <p className="text-text/70 mb-4">This session may not exist or results are unavailable.</p>
          <Link to="/timed-sessions">
            <Button>Back to Timed Sessions</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const accuracy = session.questionsAnswered > 0
    ? Math.round((session.questionsCorrect / session.questionsAnswered) * 100)
    : 0;

  const performance = getPerformanceMessage(accuracy, session.status);

  // Calculate time stats
  const timeUsed = session.timeUsedSeconds;
  const timeLimit = session.timeLimitSeconds;
  const timeRemaining = Math.max(0, timeLimit - timeUsed);
  const avgTimePerQuestion = session.questionsAnswered > 0
    ? Math.round(timeUsed / session.questionsAnswered)
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <p className="text-text/60 text-sm mb-2">
          {formatDate(session.completedAt || session.createdAt)}
        </p>
        <h1 className="font-heading text-3xl font-bold text-text mb-2">
          {SESSION_LABELS[session.sessionType]} Complete
        </h1>
        <p className={`text-lg font-medium ${performance.color}`}>
          {performance.title}
        </p>
      </div>

      {/* Main Score Card */}
      <Card className="text-center py-8">
        {/* Accuracy Circle */}
        <div className="relative w-40 h-40 mx-auto mb-6">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-border"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={`${accuracy * 3.39} 339`}
              strokeLinecap="round"
              className={
                accuracy >= 80 ? 'text-success' :
                accuracy >= 60 ? 'text-primary' :
                'text-secondary'
              }
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className={`font-heading text-4xl font-bold ${
              accuracy >= 80 ? 'text-success' :
              accuracy >= 60 ? 'text-primary' :
              'text-secondary'
            }`}>
              {accuracy}%
            </span>
            <span className="text-sm text-text/60">Accuracy</span>
          </div>
        </div>

        <p className="text-text/70 max-w-md mx-auto">{performance.message}</p>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <div className="text-3xl font-bold text-text">
            {session.questionsCorrect}
          </div>
          <div className="text-sm text-text/60">Correct</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-text">
            {session.questionsAnswered - session.questionsCorrect}
          </div>
          <div className="text-sm text-text/60">Incorrect</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-text">
            {session.questionsTotal - session.questionsAnswered}
          </div>
          <div className="text-sm text-text/60">Skipped</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-text">
            {session.questionsTotal}
          </div>
          <div className="text-sm text-text/60">Total</div>
        </Card>
      </div>

      {/* Time Stats */}
      <Card>
        <h2 className="font-heading text-lg font-bold text-text mb-4">Time Analysis</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-surface border-2 border-border">
            <div className="font-mono text-2xl font-bold text-text">
              {formatTime(timeUsed)}
            </div>
            <div className="text-sm text-text/60">Time Used</div>
          </div>
          <div className="text-center p-4 bg-surface border-2 border-border">
            <div className="font-mono text-2xl font-bold text-primary">
              {formatTime(timeRemaining)}
            </div>
            <div className="text-sm text-text/60">Time Left</div>
          </div>
          <div className="text-center p-4 bg-surface border-2 border-border">
            <div className="font-mono text-2xl font-bold text-text">
              {avgTimePerQuestion}s
            </div>
            <div className="text-sm text-text/60">Avg per Question</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-text/60 mb-1">
            <span>Time Used</span>
            <span>{Math.round((timeUsed / timeLimit) * 100)}%</span>
          </div>
          <div className="h-3 bg-border border-2 border-border">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (timeUsed / timeLimit) * 100)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Session Status Badge */}
      {session.status === 'ABANDONED' && (
        <Card className="bg-error/10 border-error">
          <div className="flex items-center gap-3">
            <MaterialIcon name="warning" size="lg" className="text-error" />
            <div>
              <div className="font-heading font-semibold text-text">Session Abandoned</div>
              <div className="text-sm text-text/70">
                This session was ended early. Your progress up to that point has been saved.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link to="/timed-sessions" className="flex-1">
          <Button className="w-full">
            <MaterialIcon name="refresh" size="md" className="mr-2" decorative />
            Try Again
          </Button>
        </Link>
        <Link to="/review" className="flex-1">
          <Button variant="secondary" className="w-full">
            <MaterialIcon name="assignment" size="md" className="mr-2" decorative />
            Review Topics
          </Button>
        </Link>
        <Link to="/dashboard" className="flex-1">
          <Button variant="ghost" className="w-full">
            <MaterialIcon name="home" size="md" className="mr-2" decorative />
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
