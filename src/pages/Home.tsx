import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Toast from '../components/ui/Toast';
import ProgressBar from '../components/ui/ProgressBar';
import { useSettingsStore } from '../stores/settingsStore';
import { useSessionStore } from '../stores/sessionStore';
import { createSession } from '../services/session';
import { RateLimitError } from '../services/gemini';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { ProcessingState } from '../types';

export default function Home() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const navigate = useNavigate();
  const { isConfigured } = useSettingsStore();
  const { library, createSession: saveSession } = useSessionStore();
  const isOnline = useOnlineStatus();

  // Get recent sessions (last 5)
  const recentSessions = library.sessions.slice(0, 5);

  const validateYouTubeUrl = (url: string): boolean => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return false;

    // Match various YouTube URL formats
    const youtubePatterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
    ];

    return youtubePatterns.some((pattern) => pattern.test(trimmedUrl));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check if online
    if (!isOnline) {
      setError('You are offline. Please connect to the internet to start a new session.');
      setToast({ message: 'You are offline. Please connect to the internet.', type: 'error' });
      return;
    }

    // Check if settings are configured (user name set)
    if (!isConfigured()) {
      setToast({ message: 'Please configure your name in Settings first', type: 'error' });
      setTimeout(() => navigate('/settings'), 2000);
      return;
    }

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError('Please enter a YouTube URL');
      return;
    }

    if (!validateYouTubeUrl(trimmedUrl)) {
      setError('Please enter a valid YouTube URL (youtube.com/watch?v=... or youtu.be/...)');
      return;
    }

    setLoading(true);
    setProcessingState({
      step: 'fetching_video',
      progress: 0,
      message: 'Starting...',
    });

    try {
      // Create the session using our services
      const session = await createSession(
        trimmedUrl,
        (state) => setProcessingState(state)
      );

      // Save session to store
      saveSession(session);

      setToast({ message: 'Session created successfully!', type: 'success' });
      setUrl('');

      // Navigate to session overview
      setTimeout(() => {
        navigate(`/session/${session.id}/overview`);
      }, 500);
    } catch (err) {
      let errorMessage: string;

      // Handle rate limit errors specifically with retry guidance
      if (err instanceof RateLimitError) {
        errorMessage = `${err.message} Please wait ${err.retryAfter} seconds before trying again.`;
      } else {
        errorMessage = err instanceof Error ? err.message : 'Failed to process video';
      }

      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
      setProcessingState(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-text">
          Learn from YouTube
        </h1>
        <p className="font-body text-lg text-text/70 max-w-2xl mx-auto">
          Transform any YouTube video into an interactive learning session.
          Answer questions, get feedback, and retain more.
        </p>
      </div>

      {/* URL Input Card */}
      <Card className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="font-heading text-2xl font-bold text-text">
            Start New Session
          </h2>

          <Input
            label="YouTube URL"
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            error={error}
            required
            disabled={loading}
            aria-describedby="url-hint"
          />
          <p id="url-hint" className="text-sm text-text/60">
            Paste a YouTube video URL to start learning
          </p>

          {/* Processing Progress */}
          {processingState && (
            <div className="space-y-2">
              <ProgressBar
                current={processingState.progress}
                total={100}
                label={processingState.message}
                showPercentage={false}
              />
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Start Learning'}
          </Button>
        </form>
      </Card>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-heading text-2xl font-bold text-text">
            Recent Sessions
          </h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentSessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:shadow-brutal-hover transition-shadow"
                onClick={() => navigate(`/session/${session.id}/notes`)}
              >
                {/* Thumbnail */}
                {session.video.thumbnailUrl && (
                  <img
                    src={session.video.thumbnailUrl}
                    alt={`Thumbnail for ${session.video.title}`}
                    className="w-full h-32 object-cover border-3 border-border mb-4"
                    loading="lazy"
                  />
                )}

                {/* Title */}
                <h3 className="font-heading font-semibold text-lg text-text line-clamp-2">
                  {session.video.title}
                </h3>

                {/* Channel & Date */}
                <p className="text-sm text-text/70 mt-2">
                  {session.video.channel}
                </p>
                <p className="text-xs text-text/50 mt-1">
                  {new Date(session.createdAt).toLocaleDateString()}
                </p>

                {/* Score */}
                <div className="mt-3 pt-3 border-t-2 border-border/30">
                  <p className="text-sm font-heading">
                    {session.score.topicsCompleted}/{session.topics.length} topics completed
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentSessions.length === 0 && (
        <Card className="text-center py-12 max-w-2xl mx-auto">
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
              Paste a YouTube URL above to start your first learning session!
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
