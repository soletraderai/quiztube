import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import StaggeredList, { StaggeredItem } from '../components/ui/StaggeredList';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';

interface CommitmentData {
  date: string;
  targetMinutes: number;
  baseTargetMinutes: number;
  currentMinutes: number;
  progress: number;
  commitmentMet: boolean;
  questionsAnswered: number;
  sessionsCompleted: number;
  busyWeekMode: boolean;
  vacationMode: boolean;
}

const API_BASE = 'http://localhost:3001/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const { accessToken, isAuthenticated } = useAuthStore();
  const { library } = useSessionStore();
  const [commitment, setCommitment] = useState<CommitmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get recent sessions (last 3)
  const recentSessions = library.sessions.slice(0, 3);

  useEffect(() => {
    const fetchCommitment = async () => {
      if (!isAuthenticated()) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/commitment/today`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch commitment data');
        }

        const data = await response.json();
        setCommitment(data);
      } catch (err) {
        console.error('Failed to fetch commitment:', err);
        setError(err instanceof Error ? err.message : 'Failed to load commitment');
      } finally {
        setLoading(false);
      }
    };

    fetchCommitment();
  }, [accessToken, isAuthenticated]);

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-text">
          Dashboard
        </h1>
        <p className="font-body text-lg text-text/70">
          Track your learning progress and daily commitment
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Daily Commitment Widget */}
        <Card className="md:col-span-2 lg:col-span-1">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-heading text-xl font-bold text-text">
                Today's Commitment
              </h2>
              <div className="flex gap-2">
                {commitment?.busyWeekMode && (
                  <span className="px-2 py-1 text-sm bg-primary/30 border-2 border-border font-heading">
                    Busy Week
                  </span>
                )}
                {commitment?.vacationMode && (
                  <span className="px-2 py-1 text-sm bg-secondary/20 border-2 border-border font-heading">
                    Vacation Mode
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="h-4 w-32 bg-border/20 animate-pulse" />
                <div className="h-8 bg-border/20 animate-pulse" />
                <div className="h-4 w-24 bg-border/20 animate-pulse" />
              </div>
            ) : error ? (
              <div className="text-center py-6">
                <p className="text-text/60">{error}</p>
                <button
                  onClick={() => navigate('/settings')}
                  className="mt-2 text-secondary underline hover:no-underline"
                >
                  Configure in Settings
                </button>
              </div>
            ) : commitment ? (
              <div className="space-y-4">
                {/* Target Display */}
                <div className="flex items-baseline justify-between">
                  <span className="text-text/70">Daily Target:</span>
                  <span className="font-heading font-bold text-lg">
                    {formatTime(commitment.targetMinutes)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <ProgressBar
                    current={commitment.currentMinutes}
                    total={commitment.targetMinutes}
                    showPercentage
                    label={`${formatTime(commitment.currentMinutes)} / ${formatTime(commitment.targetMinutes)}`}
                  />
                </div>

                {/* Commitment Status */}
                {commitment.commitmentMet ? (
                  <div className="flex items-center gap-2 text-success">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-heading font-semibold">Goal reached!</span>
                  </div>
                ) : (
                  <div className="text-text/60">
                    <span className="font-heading">
                      {formatTime(commitment.targetMinutes - commitment.currentMinutes)} to go
                    </span>
                  </div>
                )}

                {/* Daily Stats */}
                <div className="pt-4 border-t-2 border-border/30">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="font-heading text-2xl font-bold text-text">
                        {commitment.questionsAnswered}
                      </p>
                      <p className="text-sm text-text/60">Questions Answered</p>
                    </div>
                    <div>
                      <p className="font-heading text-2xl font-bold text-text">
                        {commitment.sessionsCompleted}
                      </p>
                      <p className="text-sm text-text/60">Sessions Today</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-text/60">Set up your daily commitment in Settings</p>
                <button
                  onClick={() => navigate('/settings')}
                  className="mt-2 text-secondary underline hover:no-underline"
                >
                  Go to Settings
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Stats Card */}
        <Card>
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-text">
              Quick Stats
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text/70">Total Sessions</span>
                <span className="font-heading font-bold text-lg">{library.sessions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text/70">Topics Completed</span>
                <span className="font-heading font-bold text-lg">
                  {library.sessions.reduce((acc, s) => acc + s.score.topicsCompleted, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text/70">Questions Answered</span>
                <span className="font-heading font-bold text-lg">
                  {library.sessions.reduce((acc, s) => acc + s.score.questionsAnswered, 0)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Actions Card */}
        <Card>
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-text">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/')}
                className="w-full px-4 py-3 font-heading font-semibold text-left bg-primary border-3 border-border shadow-brutal hover:shadow-brutal-hover transition-all"
              >
                Start New Session
              </button>
              <button
                onClick={() => navigate('/library')}
                className="w-full px-4 py-3 font-heading font-semibold text-left bg-surface border-3 border-border shadow-brutal-sm hover:shadow-brutal transition-all"
              >
                View Library
              </button>
              <button
                onClick={() => navigate('/goals')}
                className="w-full px-4 py-3 font-heading font-semibold text-left bg-surface border-3 border-border shadow-brutal-sm hover:shadow-brutal transition-all"
              >
                Manage Goals
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl font-bold text-text">
              Recent Sessions
            </h2>
            <button
              onClick={() => navigate('/library')}
              className="text-secondary underline hover:no-underline font-heading"
            >
              View All
            </button>
          </div>

          <StaggeredList className="grid gap-4 md:grid-cols-3">
            {recentSessions.map((session, index) => (
              <StaggeredItem key={session.id} index={index}>
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => navigate(`/session/${session.id}/notes`)}
                >
                  {session.video.thumbnailUrl && (
                    <img
                      src={session.video.thumbnailUrl}
                      alt={`Thumbnail for ${session.video.title}`}
                      className="w-full h-32 object-cover border-3 border-border mb-4"
                      loading="lazy"
                    />
                  )}
                  <h3 className="font-heading font-semibold text-text line-clamp-2">
                    {session.video.title}
                  </h3>
                  <p className="text-sm text-text/70 mt-2">
                    {session.video.channel}
                  </p>
                  <p className="text-xs text-text/50 mt-1">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                  <div className="mt-3 pt-3 border-t-2 border-border/30">
                    <p className="text-sm font-heading">
                      {session.score.topicsCompleted}/{session.topics.length} topics completed
                    </p>
                  </div>
                </Card>
              </StaggeredItem>
            ))}
          </StaggeredList>
        </div>
      )}

      {/* Empty State when no sessions */}
      {recentSessions.length === 0 && (
        <Card className="text-center py-12">
          <div className="space-y-4">
            <svg
              className="w-16 h-16 mx-auto text-text/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="font-heading text-xl font-bold text-text">
              No sessions yet
            </h3>
            <p className="text-text/70">
              Start your learning journey by creating your first session!
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-3 font-heading font-bold bg-primary border-3 border-border shadow-brutal hover:shadow-brutal-hover transition-all"
            >
              Create First Session
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
