import { useParams, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useSessionStore } from '../stores/sessionStore';

export default function SessionNotes() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { getSession } = useSessionStore();

  const session = sessionId ? getSession(sessionId) : undefined;

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
            <Button onClick={() => navigate('/library')}>
              Go to Library
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate completion percentage
  const completionRate = session.score.topicsCompleted / session.topics.length;
  const hasAnsweredQuestions = session.score.questionsAnswered > 0;

  // Get encouraging message based on performance
  const getCompletionMessage = () => {
    if (completionRate >= 0.8 && hasAnsweredQuestions) {
      return "Excellent work! You've demonstrated great engagement with the material.";
    } else if (completionRate >= 0.5) {
      return "Good progress! Keep learning and exploring new topics.";
    } else if (hasAnsweredQuestions) {
      return "Nice effort! Every question answered helps build understanding.";
    } else {
      return "Session complete! Consider revisiting topics for deeper learning.";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Congratulations Banner */}
      {session.completedAt && (
        <Card className="bg-success/20 border-success">
          <div className="text-center py-2">
            <h2 className="font-heading text-xl font-bold text-success mb-1">
              Session Complete!
            </h2>
            <p className="text-text/80">
              {getCompletionMessage()}
            </p>
          </div>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <h1 className="font-heading text-3xl font-bold text-text">
          Session Notes
        </h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/')}>
            New Session
          </Button>
          <Button variant="ghost" onClick={() => navigate('/library')}>
            Library
          </Button>
        </div>
      </div>

      {/* Video Info Card */}
      <Card>
        <div className="flex flex-col md:flex-row gap-6">
          {session.video.thumbnailUrl && (
            <div className="md:w-1/3">
              <img
                src={session.video.thumbnailUrl}
                alt={`Thumbnail for ${session.video.title}`}
                className="w-full h-auto border-3 border-border"
              />
            </div>
          )}

          <div className="flex-1 space-y-3">
            <h2 className="font-heading text-xl font-bold text-text">
              {session.video.title}
            </h2>
            <p className="text-text/70">{session.video.channel}</p>
            <a
              href={session.video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:underline text-sm"
            >
              Watch on YouTube
            </a>

            <div className="pt-3 border-t-2 border-border/30 text-sm text-text/70">
              <p>Started: {formatDate(session.createdAt)}</p>
              {session.completedAt && (
                <p>Completed: {formatDate(session.completedAt)}</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Score Summary */}
      <Card className="bg-primary/10">
        <h2 className="font-heading text-xl font-bold text-text mb-4">
          Session Score
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-surface border-2 border-border">
            <p className="text-3xl font-heading font-bold text-success">
              {session.score.topicsCompleted}
            </p>
            <p className="text-xs text-text/70 mt-1">Completed</p>
          </div>
          <div className="text-center p-3 bg-surface border-2 border-border">
            <p className="text-3xl font-heading font-bold text-text/50">
              {session.score.topicsSkipped}
            </p>
            <p className="text-xs text-text/70 mt-1">Skipped</p>
          </div>
          <div className="text-center p-3 bg-surface border-2 border-border">
            <p className="text-3xl font-heading font-bold text-secondary">
              {session.score.questionsAnswered}
            </p>
            <p className="text-xs text-text/70 mt-1">Answered</p>
          </div>
          <div className="text-center p-3 bg-surface border-2 border-border">
            <p className="text-3xl font-heading font-bold text-primary">
              {session.score.bookmarkedTopics}
            </p>
            <p className="text-xs text-text/70 mt-1">Bookmarked</p>
          </div>
          <div className="text-center p-3 bg-surface border-2 border-border">
            <p className="text-3xl font-heading font-bold text-text">
              {session.score.digDeeperCount}
            </p>
            <p className="text-xs text-text/70 mt-1">Dig Deeper</p>
          </div>
        </div>
      </Card>

      {/* Topics & Q&A */}
      <div className="space-y-6">
        <h2 className="font-heading text-xl font-bold text-text">
          Topics & Questions
        </h2>

        {session.topics.map((topic, topicIndex) => (
          <Card
            key={topic.id}
            className={`${topic.bookmarked ? 'border-primary border-4' : ''}`}
          >
            {/* Topic Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 flex items-center justify-center bg-primary border-2 border-border font-heading font-bold text-sm">
                    {topicIndex + 1}
                  </span>
                  <h3 className="font-heading text-lg font-bold text-text">
                    {topic.title}
                  </h3>
                </div>
              </div>

              <div className="flex gap-2">
                {topic.skipped && (
                  <span className="px-2 py-1 text-xs font-heading font-semibold bg-text/10 border-2 border-border">
                    Skipped
                  </span>
                )}
                {topic.bookmarked && (
                  <span className="px-2 py-1 text-xs font-heading font-semibold bg-primary border-2 border-border">
                    Bookmarked
                  </span>
                )}
                {topic.completed && (
                  <span className="px-2 py-1 text-xs font-heading font-semibold bg-success border-2 border-border">
                    Completed
                  </span>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="mb-4 p-3 bg-secondary/10 border-2 border-border">
              <p className="text-sm font-heading font-semibold text-secondary mb-1">
                Summary
              </p>
              <p className="text-text">{topic.summary}</p>
            </div>

            {/* Questions */}
            {topic.questions.map((question, qIndex) => (
              <div
                key={question.id}
                className="mb-4 last:mb-0 p-4 bg-surface border-2 border-border"
              >
                <p className="font-heading font-semibold text-text mb-2">
                  Q{qIndex + 1}: {question.text}
                </p>

                {question.userAnswer && (
                  <div className="mt-3">
                    <p className="text-sm font-heading text-text/70 mb-1">
                      Your Answer:
                    </p>
                    <p className="text-text bg-primary/10 p-2 border border-border">
                      {question.userAnswer}
                    </p>
                  </div>
                )}

                {question.feedback && (
                  <div className="mt-3">
                    <p className="text-sm font-heading text-success mb-1">
                      Feedback:
                    </p>
                    <p className="text-text">{question.feedback}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Dig Deeper Conversation */}
            {topic.digDeeperConversation && topic.digDeeperConversation.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-border/30">
                <p className="font-heading font-semibold text-text mb-3">
                  Dig Deeper Conversation
                </p>
                <div className="space-y-2">
                  {topic.digDeeperConversation.map((message, mIndex) => (
                    <div
                      key={mIndex}
                      className={`p-3 ${
                        message.role === 'user'
                          ? 'bg-primary/20 ml-8'
                          : 'bg-secondary/20 mr-8'
                      } border-2 border-border`}
                    >
                      <p className="text-xs text-text/70 mb-1">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </p>
                      <p className="text-text">{message.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Source Snippets */}
      {session.knowledgeBase.sources.length > 0 && (
        <Card>
          <h2 className="font-heading text-xl font-bold text-text mb-4">
            Source Materials
          </h2>

          <div className="space-y-4">
            {session.knowledgeBase.sources.map((source, index) => (
              <div
                key={index}
                className="p-4 bg-surface border-2 border-border"
              >
                <div className="flex items-start gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-heading font-semibold border border-border ${
                      source.type === 'github'
                        ? 'bg-success/20'
                        : source.type === 'documentation'
                        ? 'bg-secondary/20'
                        : 'bg-primary/20'
                    }`}
                  >
                    {source.type}
                  </span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-heading font-semibold text-secondary hover:underline"
                  >
                    {source.title}
                  </a>
                </div>
                <p className="text-sm text-text/80 font-mono">
                  {source.snippet}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4 pb-8">
        <Button onClick={() => navigate('/')} size="lg">
          Start New Session
        </Button>
        <Button variant="ghost" onClick={() => navigate('/library')} size="lg">
          View Library
        </Button>
      </div>
    </div>
  );
}
