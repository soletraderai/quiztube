import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import RetroProgressBar from '../components/ui/RetroProgressBar';
import BrutalBadge from '../components/ui/BrutalBadge';
import StaggeredList, { StaggeredItem } from '../components/ui/StaggeredList';
import LearningPathCard, { type LearningPathData } from '../components/ui/LearningPathCard';
import EmptyState from '../components/ui/EmptyState';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useCommitment, useLearningInsights, useDueTopics, useDocumentTitle } from '../hooks';
import { getGreeting } from '../utils/greeting';

type ChartView = 'week' | 'month';

interface DayActivity {
  date: Date;
  dayLabel: string;
  minutes: number;
  sessions: number;
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { library } = useSessionStore();
  const [chartView, setChartView] = useState<ChartView>('week');

  const isPro = user?.tier === 'PRO';

  // Generate personalized greeting
  const greeting = useMemo(() => {
    const isFirstVisit = library.sessions.length === 0;
    // Use browser timezone for now (could fetch from user preferences)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return getGreeting(user?.displayName, timezone, undefined, isFirstVisit);
  }, [user?.displayName, library.sessions.length]);

  // Use TanStack Query hooks for data fetching
  const {
    data: commitment,
    isPending: loading,
    error: commitmentError,
  } = useCommitment();

  const { data: insights } = useLearningInsights();

  // Fetch topics due for review
  const { data: dueTopics } = useDueTopics();

  const error = commitmentError?.message || null;

  // Get recent sessions (last 3)
  const recentSessions = library.sessions.slice(0, 3);

  // Calculate activity data for chart
  const getActivityData = (): DayActivity[] => {
    const days = chartView === 'week' ? 7 : 30;
    const data: DayActivity[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      // Find sessions on this day
      const sessionsOnDay = library.sessions.filter((s) => {
        const sessionDate = new Date(s.createdAt);
        return sessionDate >= date && sessionDate < nextDay;
      });

      // Calculate minutes (estimate 2 min per question)
      const minutes = sessionsOnDay.reduce(
        (acc, s) => acc + s.score.questionsAnswered * 2,
        0
      );

      const dayLabel = chartView === 'week'
        ? date.toLocaleDateString('en', { weekday: 'short' })
        : date.getDate().toString();

      data.push({
        date,
        dayLabel,
        minutes,
        sessions: sessionsOnDay.length,
      });
    }

    return data;
  };

  const activityData = getActivityData();
  const maxMinutes = Math.max(...activityData.map((d) => d.minutes), 1);

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
      {/* Header with Personalized Greeting */}
      <div className="text-center space-y-3">
        <h1 className="font-heading text-4xl sm:text-5xl font-black text-text animate-fade-in">
          {greeting}
        </h1>
        <p className="font-body text-lg text-text/70">
          Track your learning progress and daily commitment
        </p>
      </div>

      {/* Main Content Grid - responsive to larger screens */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {/* Daily Commitment Widget */}
        <Card popStyle shadowColor="lime" className="md:col-span-2 lg:col-span-1">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-heading text-xl font-bold text-text">
                Today's Commitment
              </h2>
              <div className="flex gap-2">
                {commitment?.busyWeekMode && (
                  <BrutalBadge color="orange" size="sm">Busy Week</BrutalBadge>
                )}
                {commitment?.vacationMode && (
                  <BrutalBadge color="cyan" size="sm">Vacation</BrutalBadge>
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
                  <div className="text-sm text-text/70 mb-1">
                    {formatTime(commitment.currentMinutes)} / {formatTime(commitment.targetMinutes)}
                  </div>
                  <RetroProgressBar
                    value={commitment.currentMinutes}
                    max={commitment.targetMinutes}
                    segments={10}
                    color="lime"
                    showLabel={true}
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
                      <p className="text-sm text-text/60">Lessons Today</p>
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
        <Card popStyle shadowColor="cyan">
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-text">
              Quick Stats
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text/70">Total Lessons</span>
                <span className="font-heading font-bold text-lg">{library.sessions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text/70">Time Invested</span>
                <span className="font-heading font-bold text-lg">
                  {formatTime(library.sessions.reduce((acc, s) => {
                    // Estimate 2 minutes per question answered
                    return acc + (s.score.questionsAnswered * 2);
                  }, 0))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text/70">Topics Covered</span>
                <span className="font-heading font-bold text-lg">
                  {library.sessions.reduce((acc, s) => acc + s.topics.length, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text/70">Accuracy</span>
                <span className="font-heading font-bold text-lg">
                  {(() => {
                    const totalAnswered = library.sessions.reduce((acc, s) => acc + s.score.questionsAnswered, 0);
                    const totalCorrect = library.sessions.reduce((acc, s) => acc + (s.score.questionsCorrect || 0), 0);
                    if (totalAnswered === 0) return '—';
                    return `${Math.round((totalCorrect / totalAnswered) * 100)}%`;
                  })()}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Actions Card */}
        <Card popStyle shadowColor="violet">
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-text">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/', { state: { newSession: true } })}
                className="w-full px-4 py-3 font-heading font-semibold text-left bg-primary border-3 border-border shadow-brutal hover:shadow-brutal-hover transition-all"
              >
                Start New Lesson
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

      {/* Continue Series Recommendations */}
      {(() => {
        // Group sessions by channel to find series
        const channelSessions: Record<string, { channel: string; sessions: typeof library.sessions; lastSessionDate: number }> = {};

        library.sessions.forEach((session) => {
          const channelKey = session.video.channel.toLowerCase();
          if (!channelSessions[channelKey]) {
            channelSessions[channelKey] = {
              channel: session.video.channel,
              sessions: [],
              lastSessionDate: 0,
            };
          }
          channelSessions[channelKey].sessions.push(session);
          const sessionDate = new Date(session.createdAt).getTime();
          if (sessionDate > channelSessions[channelKey].lastSessionDate) {
            channelSessions[channelKey].lastSessionDate = sessionDate;
          }
        });

        // Find channels with 2+ sessions (potential series)
        const seriesChannels = Object.values(channelSessions)
          .filter((ch) => ch.sessions.length >= 2)
          .sort((a, b) => b.lastSessionDate - a.lastSessionDate)
          .slice(0, 3); // Show max 3 series

        // Show empty state for new users with no sessions
        if (library.sessions.length === 0) {
          return (
            <Card>
              <EmptyState
                icon={
                  <span className="material-icons text-6xl" aria-hidden="true">
                    play_circle_outline
                  </span>
                }
                title="No sessions yet"
                description="Start your first learning session to see your progress here."
                action={{
                  label: "Start Learning",
                  onClick: () => navigate('/', { state: { newSession: true } }),
                }}
              />
            </Card>
          );
        }

        // Don't show section if no series recommendations yet
        if (seriesChannels.length === 0) return null;

        return (
          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-bold text-text">
                  Continue Series
                </h2>
                <span className="material-icons text-secondary" aria-hidden="true">
                  play_circle
                </span>
              </div>
              <p className="text-sm text-text/70">
                Pick up where you left off with these creators
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {seriesChannels.map((channelData, index) => {
                  const mostRecentSession = channelData.sessions.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )[0];
                  const completedCount = channelData.sessions.filter(
                    (s) => s.status === 'completed'
                  ).length;

                  return (
                    <div
                      key={index}
                      className="p-4 bg-surface border-3 border-border shadow-brutal-sm hover:shadow-brutal transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {mostRecentSession.video.thumbnailUrl ? (
                          <img
                            src={mostRecentSession.video.thumbnailUrl}
                            alt={`${channelData.channel} thumbnail`}
                            className="w-16 h-12 object-cover border-2 border-border flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-12 bg-primary/30 border-2 border-border flex items-center justify-center flex-shrink-0">
                            <span className="material-icons text-text/50">videocam</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-heading font-semibold text-text truncate">
                            {channelData.channel}
                          </h3>
                          <p className="text-xs text-text/60 mt-1">
                            {channelData.sessions.length} videos • {completedCount} completed
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          // Navigate to home with the most recent video URL for auto-start
                          navigate('/', {
                            state: {
                              videoUrl: mostRecentSession.video.url,
                              autoStart: true,
                            },
                          });
                        }}
                        className="w-full mt-3 px-3 py-2 font-heading font-semibold text-sm bg-secondary border-2 border-border shadow-brutal-sm hover:shadow-brutal transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-icons text-base" aria-hidden="true">
                          play_arrow
                        </span>
                        Continue
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Due for Review Card */}
      {dueTopics && dueTopics.length > 0 && (
        <Card popStyle shadowColor="orange">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-text">
                Due for Review
              </h2>
              <BrutalBadge color="orange" size="sm">{dueTopics.length}</BrutalBadge>
            </div>
            <p className="text-sm text-text/70">
              Topics from spaced repetition ready for review
            </p>
            <div className="flex items-center justify-between p-4 bg-eg-orange/20 border-3 border-eg-ink">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-eg-orange border-2 border-eg-ink flex items-center justify-center">
                  <span className="font-heading text-xl font-bold text-white">{dueTopics.length}</span>
                </div>
                <div>
                  <p className="font-heading font-semibold text-text">
                    {dueTopics.length} topic{dueTopics.length !== 1 ? 's' : ''} due
                  </p>
                  <p className="text-sm text-text/60">
                    Estimated {Math.ceil(dueTopics.length * 2)} min review
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/review')}
                className="px-4 py-2 font-heading font-semibold bg-eg-orange text-white border-3 border-eg-ink shadow-brutal-sm hover:shadow-brutal transition-all flex items-center gap-2"
              >
                <span className="material-icons text-base" aria-hidden="true">
                  play_arrow
                </span>
                Quick Review
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Review Needed - Topics with <70% accuracy */}
      {library.sessions.length > 0 && (() => {
        // Calculate accuracy for each topic
        const topicAccuracy: Record<string, {
          name: string;
          totalQuestions: number;
          correctAnswers: number;
          accuracy: number;
          sessionId: string;
        }> = {};

        library.sessions.forEach((session) => {
          session.topics.forEach((topic) => {
            const key = topic.title.toLowerCase().slice(0, 30);
            if (!topicAccuracy[key]) {
              topicAccuracy[key] = {
                name: topic.title,
                totalQuestions: 0,
                correctAnswers: 0,
                accuracy: 0,
                sessionId: session.id,
              };
            }
            topic.questions.forEach((q) => {
              if (q.userAnswer) {
                topicAccuracy[key].totalQuestions += 1;
                // Count as correct if feedback is positive or if user answered
                // (we don't have explicit correctness, so we use answered as a proxy)
                if (q.feedback && q.feedback.toLowerCase().includes('great') ||
                    q.feedback && q.feedback.toLowerCase().includes('correct') ||
                    q.feedback && q.feedback.toLowerCase().includes('excellent')) {
                  topicAccuracy[key].correctAnswers += 1;
                }
              }
            });
          });
        });

        // Calculate accuracy and find topics needing review
        const needsReview = Object.values(topicAccuracy)
          .filter((t) => t.totalQuestions >= 2)
          .map((t) => ({
            ...t,
            accuracy: t.totalQuestions > 0
              ? Math.round((t.correctAnswers / t.totalQuestions) * 100)
              : 0,
          }))
          .filter((t) => t.accuracy < 70)
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 3);

        if (needsReview.length === 0) return null;

        return (
          <Card className="border-error/50">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-xl font-bold text-text">
                    Review Needed
                  </h2>
                  <span className="material-icons text-error" aria-hidden="true">
                    priority_high
                  </span>
                </div>
                <button
                  onClick={() => navigate('/review')}
                  className="px-4 py-2 font-heading font-semibold text-sm bg-error/20 border-2 border-border shadow-brutal-sm hover:shadow-brutal transition-all flex items-center gap-2"
                >
                  <span className="material-icons text-base" aria-hidden="true">
                    refresh
                  </span>
                  Start Review
                </button>
              </div>
              <p className="text-sm text-text/70">
                Topics with less than 70% accuracy need more practice
              </p>
              <div className="space-y-2">
                {needsReview.map((topic, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-error/10 border-2 border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-semibold text-text truncate">
                        {topic.name}
                      </p>
                      <p className="text-xs text-text/60">
                        {topic.correctAnswers}/{topic.totalQuestions} correct
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-sm font-bold border-2 border-border ${
                      topic.accuracy < 50 ? 'bg-error/30 text-error' : 'bg-primary/30 text-text'
                    }`}>
                      {topic.accuracy}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Learning Paths Section */}
      {library.sessions.length > 0 && (() => {
        // Generate learning paths from session data
        // Group sessions by topic category to create learning paths
        const topicCategories: Record<string, {
          id: string;
          title: string;
          sessions: typeof library.sessions;
          totalTopics: number;
          completedTopics: number;
          category: string;
        }> = {};

        library.sessions.forEach((session) => {
          session.topics.forEach((topic) => {
            // Use first word of topic as category
            const categoryKey = topic.title.split(' ')[0].toLowerCase();
            const categoryName = topic.title.split(' ')[0];

            if (!topicCategories[categoryKey]) {
              topicCategories[categoryKey] = {
                id: categoryKey,
                title: `${categoryName} Learning Path`,
                sessions: [],
                totalTopics: 0,
                completedTopics: 0,
                category: categoryName,
              };
            }
            topicCategories[categoryKey].sessions.push(session);
            topicCategories[categoryKey].totalTopics += 1;
            if (topic.completed) {
              topicCategories[categoryKey].completedTopics += 1;
            }
          });
        });

        // Convert to learning path data and filter to meaningful ones
        const learningPaths: LearningPathData[] = Object.values(topicCategories)
          .filter((cat) => cat.totalTopics >= 2) // At least 2 topics
          .sort((a, b) => {
            // Sort by recent activity and progress
            const aProgress = a.completedTopics / a.totalTopics;
            const bProgress = b.completedTopics / b.totalTopics;
            // Prioritize in-progress paths (not 0% and not 100%)
            if (aProgress > 0 && aProgress < 1 && (bProgress === 0 || bProgress === 1)) return -1;
            if (bProgress > 0 && bProgress < 1 && (aProgress === 0 || aProgress === 1)) return 1;
            return b.totalTopics - a.totalTopics;
          })
          .slice(0, 4)
          .map((cat) => {
            const progress = cat.completedTopics / cat.totalTopics;
            let status: 'active' | 'completed' | 'paused' = 'active';
            if (progress === 1) status = 'completed';
            else if (progress === 0) status = 'paused';

            return {
              id: cat.id,
              title: cat.title,
              description: `${cat.sessions.length} video${cat.sessions.length !== 1 ? 's' : ''} covering ${cat.category.toLowerCase()} topics`,
              totalItems: cat.totalTopics,
              completedItems: cat.completedTopics,
              estimatedTime: `${Math.ceil(cat.totalTopics * 5)} min`,
              status,
              category: cat.category,
            };
          });

        if (learningPaths.length === 0) return null;

        return (
          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 id="learning-paths-heading" className="font-heading text-xl font-bold text-text">
                    Learning Paths
                  </h2>
                  <span className="material-icons text-primary" aria-hidden="true">
                    route
                  </span>
                </div>
                <button
                  onClick={() => navigate('/goals')}
                  className="text-secondary underline hover:no-underline font-heading text-sm"
                >
                  Manage Paths
                </button>
              </div>
              <p className="text-sm text-text/70">
                Your personalized learning journeys based on topics you've studied
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="list" aria-labelledby="learning-paths-heading">
                {learningPaths.map((path) => (
                  <div key={path.id} role="listitem">
                    <LearningPathCard
                      learningPath={path}
                      onClick={() => navigate('/goals')}
                    />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Knowledge Gaps Section (Pro Only) */}
      {isPro && library.sessions.length > 0 ? (
        <Card popStyle shadowColor="pink">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 id="knowledge-gaps-heading" className="font-heading text-xl font-bold text-text">
                Knowledge Gaps
              </h2>
              <BrutalBadge color="violet">PRO</BrutalBadge>
            </div>
            <p className="text-sm text-text/70">
              Topics where you may need more practice
            </p>
            <div className="space-y-3" role="list" aria-labelledby="knowledge-gaps-heading">
              {(() => {
                // Aggregate topic performance - track completion percentage and source videos
                const topicStats: Record<string, {
                  name: string;
                  totalQuestions: number;
                  answeredQuestions: number;
                  skippedCount: number;
                  completedCount: number;
                  totalInstances: number;
                  // Track sessions containing this topic for video suggestions
                  sessions: Array<{ id: string; video: typeof library.sessions[0]['video']; hasUnansweredQuestions: boolean }>;
                }> = {};

                library.sessions.forEach((session) => {
                  session.topics.forEach((topic) => {
                    const key = topic.title.toLowerCase().slice(0, 30);
                    if (!topicStats[key]) {
                      topicStats[key] = {
                        name: topic.title,
                        totalQuestions: 0,
                        answeredQuestions: 0,
                        skippedCount: 0,
                        completedCount: 0,
                        totalInstances: 0,
                        sessions: [],
                      };
                    }
                    topicStats[key].totalInstances += 1;
                    topicStats[key].totalQuestions += topic.questions.length;
                    const answered = topic.questions.filter((q) => q.userAnswer).length;
                    topicStats[key].answeredQuestions += answered;
                    if (topic.skipped) topicStats[key].skippedCount += 1;
                    if (topic.completed) topicStats[key].completedCount += 1;
                    // Track this session if it has unanswered questions for this topic
                    const hasUnansweredQuestions = answered < topic.questions.length;
                    topicStats[key].sessions.push({
                      id: session.id,
                      video: session.video,
                      hasUnansweredQuestions,
                    });
                  });
                });

                // Calculate completion rate and find gaps
                // Knowledge gaps = topics with low completion rate (answered few questions)
                const knowledgeGaps = Object.values(topicStats)
                  .filter((t) => t.totalQuestions >= 2) // At least 2 questions available
                  .map((t) => ({
                    ...t,
                    completionRate: Math.round((t.answeredQuestions / t.totalQuestions) * 100),
                  }))
                  .filter((t) => t.completionRate < 60) // Less than 60% questions answered
                  .sort((a, b) => a.completionRate - b.completionRate)
                  .slice(0, 5);

                if (knowledgeGaps.length === 0) {
                  return (
                    <div className="text-center py-6">
                      <span className="material-icons text-4xl text-secondary/50 mb-2" aria-hidden="true">
                        check_circle
                      </span>
                      <p className="text-text/60">
                        Great job! No significant knowledge gaps detected.
                      </p>
                    </div>
                  );
                }

                return knowledgeGaps.map((topic, index) => {
                  const isVeryLow = topic.completionRate < 30;
                  // Find the best video suggestion - prefer one with unanswered questions
                  const suggestedSession = topic.sessions.find((s) => s.hasUnansweredQuestions) || topic.sessions[0];

                  return (
                    <div
                      key={index}
                      className="p-3 bg-surface border-2 border-border space-y-2"
                      role="listitem"
                      aria-label={`${topic.name}: ${topic.completionRate}% completion`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-heading font-semibold text-text truncate max-w-[60%]">
                          {topic.name}
                        </span>
                        <span className={`px-2 py-0.5 text-sm font-bold border-2 border-border ${
                          isVeryLow ? 'bg-error/20 text-error' : 'bg-primary/30 text-text'
                        }`}>
                          {topic.completionRate}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-text/60">
                        <span>{topic.answeredQuestions}/{topic.totalQuestions} questions answered</span>
                        {isVeryLow && (
                          <span className="flex items-center gap-1 text-error">
                            <span className="material-icons text-sm" aria-hidden="true">priority_high</span>
                            Needs attention
                          </span>
                        )}
                      </div>
                      <div
                        className="h-2 bg-border/20 border border-border overflow-hidden"
                        role="progressbar"
                        aria-valuenow={topic.completionRate}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${topic.name} completion`}
                      >
                        <div
                          className={`h-full transition-all ${isVeryLow ? 'bg-error' : 'bg-primary'}`}
                          style={{ width: `${topic.completionRate}%` }}
                        />
                      </div>
                      {/* Suggested video to address this gap */}
                      {suggestedSession && (
                        <div className="mt-2 pt-2 border-t border-border/30">
                          <p className="text-xs text-text/50 mb-2">Suggested video:</p>
                          <button
                            onClick={() => navigate('/', { state: { videoUrl: suggestedSession.video.url, autoStart: true } })}
                            className="w-full flex items-center gap-2 p-2 bg-primary/10 border border-border hover:bg-primary/20 transition-colors text-left"
                          >
                            {suggestedSession.video.thumbnailUrl ? (
                              <img
                                src={suggestedSession.video.thumbnailUrl}
                                alt=""
                                className="w-12 h-9 object-cover border border-border flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-9 bg-border/20 border border-border flex items-center justify-center flex-shrink-0">
                                <span className="material-icons text-sm text-text/30">videocam</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-heading text-text truncate">
                                {suggestedSession.video.title}
                              </p>
                              <p className="text-xs text-text/50 truncate">
                                {suggestedSession.video.channel}
                              </p>
                            </div>
                            <span className="material-icons text-secondary text-lg flex-shrink-0" aria-hidden="true">
                              play_circle
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </Card>
      ) : library.sessions.length > 0 ? (
        /* Knowledge Gaps Pro Teaser for Free Users */
        <Card popStyle className="relative overflow-hidden classified-folder">
          {/* CLASSIFIED stamp overlay */}
          <div className="classified-stamp">CLASSIFIED</div>
          {/* Scanline overlay effect */}
          <div className="scanline-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-eg-paper/90 z-10" />
          <div className="space-y-4 blur-sm">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-text">
                Knowledge Gaps
              </h2>
              <BrutalBadge color="violet">PRO</BrutalBadge>
            </div>
            <p className="text-sm text-text/70">
              Topics where you may need more practice
            </p>
            <div className="space-y-3">
              {/* Placeholder items */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 bg-surface border-2 border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-semibold text-text">Sample Topic {i}</span>
                    <span className="px-2 py-0.5 text-sm font-bold border-2 border-border bg-error/20 text-error">
                      {20 + i * 10}%
                    </span>
                  </div>
                  <div className="h-2 bg-border/20 border border-border overflow-hidden">
                    <div className="h-full bg-error" style={{ width: `${20 + i * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center">
              <span className="material-icons text-4xl text-eg-violet mb-2" aria-hidden="true">
                psychology
              </span>
              <p className="font-heading font-bold text-text mb-2">Identify Knowledge Gaps</p>
              <p className="text-sm text-text/60 mb-4 max-w-xs">
                Pro users can see which topics need more practice and get personalized video suggestions
              </p>
              <button
                onClick={() => navigate('/pricing')}
                className="px-4 py-2 font-heading font-bold bg-eg-violet text-white border-3 border-eg-ink shadow-brutal hover:shadow-brutal-hover transition-all"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Pro Insights Section */}
      {isPro ? (
        <Card popStyle shadowColor="pink">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-text">
                Learning Insights
              </h2>
              <BrutalBadge color="violet">PRO</BrutalBadge>
            </div>

            {insights ? (
              <div className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-surface border-2 border-border">
                    <p className="text-xs text-text/60 mb-1">Best Time</p>
                    <p className="font-heading font-bold text-text">{insights.bestTime}</p>
                  </div>
                  <div className="p-3 bg-surface border-2 border-border">
                    <p className="text-xs text-text/60 mb-1">Avg Duration</p>
                    <p className="font-heading font-bold text-text">{insights.avgSessionDuration} min</p>
                  </div>
                  <div className="p-3 bg-surface border-2 border-border">
                    <p className="text-xs text-text/60 mb-1">Preferred Difficulty</p>
                    <p className="font-heading font-bold text-text">{insights.preferredDifficulty}</p>
                  </div>
                  <div className="p-3 bg-surface border-2 border-border">
                    <p className="text-xs text-text/60 mb-1">Learning Streak</p>
                    <p className="font-heading font-bold text-text">{insights.learningStreak} days</p>
                  </div>
                </div>

                {/* Learning Patterns */}
                {insights.patterns.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-heading font-semibold text-text">Learning Patterns</h3>
                    <div className="space-y-2">
                      {insights.patterns.map((pattern, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-2 bg-primary/10 border border-border"
                        >
                          <svg className="w-4 h-4 mt-0.5 text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-sm text-text">{pattern.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-text/60">Complete more sessions to unlock personalized insights</p>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card popStyle className="relative overflow-hidden classified-folder">
          {/* CLASSIFIED stamp overlay */}
          <div className="classified-stamp">CLASSIFIED</div>
          {/* Scanline overlay effect */}
          <div className="scanline-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-eg-paper/90 z-10" />
          <div className="space-y-4 blur-sm">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-text">
                Learning Insights
              </h2>
              <BrutalBadge color="violet">PRO</BrutalBadge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-surface border-2 border-border">
                <p className="text-xs text-text/60 mb-1">Best Time</p>
                <p className="font-heading font-bold text-text">Morning</p>
              </div>
              <div className="p-3 bg-surface border-2 border-border">
                <p className="text-xs text-text/60 mb-1">Avg Duration</p>
                <p className="font-heading font-bold text-text">20 min</p>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center">
              <span className="material-icons text-4xl text-eg-pink mb-2" aria-hidden="true">
                insights
              </span>
              <p className="font-heading font-bold text-text mb-2">Unlock Learning Insights</p>
              <button
                onClick={() => navigate('/pricing')}
                className="px-4 py-2 font-heading font-bold bg-eg-violet text-white border-3 border-eg-ink shadow-brutal hover:shadow-brutal-hover transition-all"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Activity Chart */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 id="activity-chart-heading" className="font-heading text-xl font-bold text-text">
              Activity
            </h2>
            <div className="flex gap-1" role="group" aria-label="Chart time period">
              <button
                onClick={() => setChartView('week')}
                aria-pressed={chartView === 'week'}
                className={`px-3 py-1 text-sm font-heading border-2 border-border transition-all ${
                  chartView === 'week'
                    ? 'bg-primary shadow-brutal-sm'
                    : 'bg-surface hover:bg-primary/30'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setChartView('month')}
                aria-pressed={chartView === 'month'}
                className={`px-3 py-1 text-sm font-heading border-2 border-border transition-all ${
                  chartView === 'month'
                    ? 'bg-primary shadow-brutal-sm'
                    : 'bg-surface hover:bg-primary/30'
                }`}
              >
                Month
              </button>
            </div>
          </div>

          {/* Screen reader accessible data table */}
          <div className="sr-only">
            <table aria-label={`Activity data for the last ${chartView === 'week' ? '7' : '30'} days`}>
              <caption>Learning activity showing minutes studied and sessions completed per day</caption>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Minutes</th>
                  <th>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {activityData.map((day, index) => (
                  <tr key={index}>
                    <td>{day.date.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}</td>
                    <td>{day.minutes} minutes</td>
                    <td>{day.sessions} sessions</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar Chart - visual only */}
          <div
            className="h-40 flex items-end justify-between gap-1"
            role="img"
            aria-labelledby="activity-chart-heading"
            aria-describedby="activity-chart-summary"
            aria-hidden="false"
          >
            {activityData.map((day, index) => (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-1"
                title={`${day.dayLabel}: ${day.minutes} min • ${day.sessions} session${day.sessions !== 1 ? 's' : ''}`}
                role="presentation"
              >
                <div
                  className={`w-full border-2 border-border transition-all ${
                    day.minutes > 0 ? 'bg-primary' : 'bg-border/20'
                  }`}
                  style={{
                    height: `${Math.max((day.minutes / maxMinutes) * 100, day.minutes > 0 ? 10 : 4)}%`,
                    minHeight: day.minutes > 0 ? '8px' : '4px',
                  }}
                  aria-hidden="true"
                />
                <span className="text-xs text-text/60 font-heading" aria-hidden="true">
                  {chartView === 'week' ? day.dayLabel : (index % 5 === 0 || index === activityData.length - 1 ? day.dayLabel : '')}
                </span>
              </div>
            ))}
          </div>

          {/* Chart Legend / Summary */}
          <div id="activity-chart-summary" className="flex justify-between text-sm text-text/60">
            <span>
              Total: {formatTime(activityData.reduce((acc, d) => acc + d.minutes, 0))}
            </span>
            <span>
              {activityData.filter((d) => d.sessions > 0).length} active day{activityData.filter((d) => d.sessions > 0).length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </Card>

      {/* Topic Performance */}
      {library.sessions.length > 0 && (
        <Card>
          <div className="space-y-4">
            <h2 id="topic-performance-heading" className="font-heading text-xl font-bold text-text">
              Topic Performance
            </h2>
            <div className="space-y-3" role="list" aria-labelledby="topic-performance-heading">
              {(() => {
                // Aggregate topic performance across all sessions
                const topicStats: Record<string, { name: string; total: number; completed: number; questionsAnswered: number }> = {};

                library.sessions.forEach((session) => {
                  session.topics.forEach((topic) => {
                    const key = topic.title.toLowerCase().slice(0, 30);
                    if (!topicStats[key]) {
                      topicStats[key] = { name: topic.title, total: 0, completed: 0, questionsAnswered: 0 };
                    }
                    topicStats[key].total += 1;
                    if (topic.questions.every((q) => q.userAnswer)) {
                      topicStats[key].completed += 1;
                    }
                    topicStats[key].questionsAnswered += topic.questions.filter((q) => q.userAnswer).length;
                  });
                });

                // Sort by questions answered (engagement)
                const sortedTopics = Object.values(topicStats)
                  .sort((a, b) => b.questionsAnswered - a.questionsAnswered)
                  .slice(0, 5);

                if (sortedTopics.length === 0) {
                  return (
                    <p className="text-text/60 text-center py-4">
                      Complete some sessions to see your topic performance
                    </p>
                  );
                }

                const maxQuestions = Math.max(...sortedTopics.map((t) => t.questionsAnswered), 1);

                return sortedTopics.map((topic, index) => {
                  const percentage = (topic.questionsAnswered / maxQuestions) * 100;
                  const isStrength = percentage >= 80;

                  return (
                    <div
                      key={index}
                      className="space-y-1"
                      role="listitem"
                      aria-label={`${topic.name}: ${topic.questionsAnswered} questions answered${isStrength ? ', marked as strength' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-heading text-text truncate max-w-[60%] flex items-center gap-2">
                          {topic.name}
                          {isStrength && (
                            <BrutalBadge color="lime" size="sm">Strength</BrutalBadge>
                          )}
                        </span>
                        <span className="text-sm text-text/60">
                          {topic.questionsAnswered} questions
                        </span>
                      </div>
                      <div
                        className="h-2 bg-border/20 border border-border overflow-hidden"
                        role="progressbar"
                        aria-valuenow={topic.questionsAnswered}
                        aria-valuemin={0}
                        aria-valuemax={maxQuestions}
                        aria-label={`${topic.name} progress`}
                      >
                        <div
                          className={`h-full transition-all ${isStrength ? 'bg-secondary' : 'bg-primary'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </Card>
      )}

      {/* Recommended for You Section */}
      {library.sessions.length > 0 && (() => {
        // Generate recommendations based on user's learning patterns
        const channelCounts: Record<string, {
          channel: string;
          count: number;
          thumbnail?: string;
          lastVideoTitle: string;
          lastVideoUrl: string;
        }> = {};

        library.sessions.forEach((session) => {
          const key = session.video.channel.toLowerCase();
          if (!channelCounts[key]) {
            channelCounts[key] = {
              channel: session.video.channel,
              count: 0,
              thumbnail: session.video.thumbnailUrl,
              lastVideoTitle: session.video.title,
              lastVideoUrl: session.video.url,
            };
          }
          channelCounts[key].count += 1;
          // Update with most recent video
          if (session.createdAt > (library.sessions.find(s => s.video.channel.toLowerCase() === key)?.createdAt || 0)) {
            channelCounts[key].thumbnail = session.video.thumbnailUrl;
            channelCounts[key].lastVideoTitle = session.video.title;
            channelCounts[key].lastVideoUrl = session.video.url;
          }
        });

        // Recommend channels user engages with most
        const recommendations = Object.values(channelCounts)
          .filter((c) => c.count >= 1)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        if (recommendations.length === 0) return null;

        return (
          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-xl font-bold text-text">
                    Recommended for You
                  </h2>
                  <span className="material-icons text-secondary" aria-hidden="true">
                    auto_awesome
                  </span>
                </div>
              </div>
              <p className="text-sm text-text/70">
                Continue learning from creators you've enjoyed
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="p-4 bg-surface border-2 border-border hover:shadow-brutal-sm transition-all cursor-pointer"
                    onClick={() => navigate('/')}
                  >
                    <div className="flex items-start gap-3">
                      {rec.thumbnail ? (
                        <img
                          src={rec.thumbnail}
                          alt={`${rec.channel} thumbnail`}
                          className="w-16 h-12 object-cover border-2 border-border flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-12 bg-primary/30 border-2 border-border flex items-center justify-center flex-shrink-0">
                          <span className="material-icons text-text/50">smart_display</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading font-semibold text-text truncate">
                          {rec.channel}
                        </h3>
                        <p className="text-xs text-text/60 mt-1">
                          {rec.count} video{rec.count !== 1 ? 's' : ''} watched
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-text/70 mt-2 line-clamp-2">
                      {rec.lastVideoTitle}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })()}

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

          <StaggeredList className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recentSessions.map((session, index) => (
              <StaggeredItem key={session.id} index={index}>
                <Card
                  hoverable
                  className="cursor-pointer"
                  onClick={() => navigate(`/lesson/${session.id}/notes`)}
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

    </div>
  );
}
