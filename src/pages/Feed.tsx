import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Toast from '../components/ui/Toast';
import { FeedChannelSkeleton } from '../components/ui/Skeleton';
import { StaggeredItem } from '../components/ui/StaggeredList';
import { useAuthStore } from '../stores/authStore';

interface FollowedChannel {
  id: string;
  channelId: string;
  channelName: string;
  channelThumbnail: string | null;
  sessionsCompleted: number;
  lastSessionAt: string | null;
  followedAt: string;
}

interface FeedData {
  channels: FollowedChannel[];
  watchedVideoIds: string[];
  feed: any[];
}

interface SearchResult {
  channelId: string;
  channelName: string;
}

const API_BASE = 'http://localhost:3001/api';

export default function Feed() {
  const [feedData, setFeedData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Unfollow confirmation state
  const [unfollowConfirm, setUnfollowConfirm] = useState<FollowedChannel | null>(null);

  const navigate = useNavigate();
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    fetchFeed();
  }, [accessToken, isAuthenticated, navigate]);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/channels/feed`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to fetch feed');
      }

      const data = await response.json();
      setFeedData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      setToast({ message: 'Failed to load feed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollowClick = (channel: FollowedChannel) => {
    setUnfollowConfirm(channel);
  };

  const handleUnfollowConfirm = async () => {
    if (!unfollowConfirm) return;

    try {
      const response = await fetch(`${API_BASE}/channels/${unfollowConfirm.channelId}/unfollow`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to unfollow channel');
      }

      setToast({ message: 'Channel unfollowed', type: 'success' });
      setUnfollowConfirm(null);
      fetchFeed(); // Refresh the feed
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to unfollow channel',
        type: 'error',
      });
      setUnfollowConfirm(null);
    }
  };

  const handleUnfollowCancel = () => {
    setUnfollowConfirm(null);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`${API_BASE}/channels/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleFollowFromSearch = async (channel: SearchResult) => {
    try {
      const response = await fetch(`${API_BASE}/channels/${channel.channelId}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          channelName: channel.channelName,
          channelThumbnail: null,
        }),
      });

      if (response.ok) {
        setToast({ message: `Now following ${channel.channelName}`, type: 'success' });
        setSearchResults(prev => prev.filter(r => r.channelId !== channel.channelId));
        fetchFeed(); // Refresh the feed
      }
    } catch (err) {
      setToast({
        message: 'Failed to follow channel',
        type: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="font-heading text-4xl font-bold text-text">Your Feed</h1>
          <p className="font-body text-lg text-text/70">Loading your personalized feed...</p>
        </div>

        {/* Skeleton loading screens */}
        <Card>
          <h2 className="font-heading text-2xl font-bold text-text mb-4">Followed Channels</h2>
          <div className="space-y-4">
            <FeedChannelSkeleton />
            <FeedChannelSkeleton />
            <FeedChannelSkeleton />
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
        <div className="text-center space-y-4">
          <h1 className="font-heading text-4xl font-bold text-text">Your Feed</h1>
          <p className="font-body text-lg text-error">{error}</p>
          <Button onClick={fetchFeed}>Try Again</Button>
        </div>
      </div>
    );
  }

  const hasFollowedChannels = feedData && feedData.channels.length > 0;

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="font-heading text-4xl font-bold text-text">Your Feed</h1>
        <p className="font-body text-lg text-text/70">
          {hasFollowedChannels
            ? 'Videos from your followed channels'
            : 'Follow channels to see their videos here'}
        </p>
      </div>

      {/* Channel Search Section */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold text-text">Find Channels to Follow</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
            >
              {showSearch ? 'Hide Search' : 'Show Search'}
            </Button>
          </div>

          {showSearch && (
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search channels from your sessions..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full px-4 py-3 bg-surface border-3 border-border font-body text-text placeholder:text-text/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-text/70">{searchResults.length} channel{searchResults.length !== 1 ? 's' : ''} found</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {searchResults.map((result) => (
                      <div
                        key={result.channelId}
                        className="flex items-center justify-between p-3 bg-surface border-2 border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full border-2 border-border bg-secondary/20 flex items-center justify-center">
                            <span className="font-heading font-bold text-text">
                              {result.channelName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-heading font-semibold text-text truncate">
                            {result.channelName}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleFollowFromSearch(result)}
                        >
                          Follow
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !searching && (
                <p className="text-center text-text/60 py-4">
                  No channels found matching "{searchQuery}". Try a different search or complete more learning sessions.
                </p>
              )}

              {!searchQuery && (
                <p className="text-center text-text/60 py-4">
                  Search for channels from videos you've watched to follow them.
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Followed Channels Section */}
      {hasFollowedChannels && (
        <div className="space-y-4">
          <h2 className="font-heading text-2xl font-bold text-text">
            Followed Channels ({feedData.channels.length})
          </h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {feedData.channels.map((channel, index) => (
              <StaggeredItem key={channel.id} index={index} baseDelay={100} staggerDelay={75}>
              <Card hoverable className="flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  {channel.channelThumbnail ? (
                    <img
                      src={channel.channelThumbnail}
                      alt={channel.channelName}
                      className="w-12 h-12 rounded-full border-2 border-border object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full border-2 border-border bg-primary/20 flex items-center justify-center">
                      <span className="font-heading font-bold text-lg text-text">
                        {channel.channelName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-text truncate">
                      {channel.channelName}
                    </h3>
                    <p className="text-sm text-text/60">
                      {channel.sessionsCompleted} session{channel.sessionsCompleted !== 1 ? 's' : ''} completed
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t-2 border-border/30 flex justify-between items-center">
                  <span className="text-xs text-text/50">
                    Followed {new Date(channel.followedAt).toLocaleDateString()}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUnfollowClick(channel)}
                  >
                    Unfollow
                  </Button>
                </div>
              </Card>
              </StaggeredItem>
            ))}
          </div>
        </div>
      )}

      {/* Watched Videos Info */}
      {feedData && feedData.watchedVideoIds.length > 0 && (
        <Card className="bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="font-heading font-semibold text-text">
                {feedData.watchedVideoIds.length} video{feedData.watchedVideoIds.length !== 1 ? 's' : ''} watched
              </p>
              <p className="text-sm text-text/60">
                Already-watched videos are excluded from your feed
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!hasFollowedChannels && (
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="font-heading text-xl font-bold text-text">
              No followed channels yet
            </h3>
            <p className="text-text/70 max-w-md mx-auto">
              When you complete learning sessions, you can follow the channel to see more videos from them in your feed.
            </p>
            <Button onClick={() => navigate('/')}>
              Start a Learning Session
            </Button>
          </div>
        </Card>
      )}

      {/* Feed Info - Placeholder for future YouTube API integration */}
      {hasFollowedChannels && (
        <Card className="bg-primary/10 border-primary">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="font-heading font-semibold text-text">
                Your Feed is Ready
              </p>
              <p className="text-sm text-text/70 mt-1">
                You're following {feedData.channels.length} channel{feedData.channels.length !== 1 ? 's' : ''}.
                New videos from these channels will appear here. Videos you've already watched ({feedData.watchedVideoIds.length}) are automatically excluded.
              </p>
              <div className="mt-4">
                <Button onClick={() => navigate('/')} variant="primary">
                  Start New Session
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Unfollow Confirmation Modal */}
      {unfollowConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full animate-in fade-in zoom-in duration-200">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border-2 border-border bg-error/20 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-error"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-heading text-xl font-bold text-text">
                    Unfollow Channel?
                  </h3>
                  <p className="text-sm text-text/60">
                    {unfollowConfirm.channelName}
                  </p>
                </div>
              </div>

              <p className="text-text/70">
                Are you sure you want to unfollow this channel? You won't see their videos in your feed anymore.
              </p>

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  variant="ghost"
                  onClick={handleUnfollowCancel}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleUnfollowConfirm}
                  className="bg-error/10 border-error text-error hover:bg-error/20"
                >
                  Yes, Unfollow
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
