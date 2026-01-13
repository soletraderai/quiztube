/**
 * CreatorCard Component
 * Display creator info with engagement action buttons
 */
import MaterialIcon from './MaterialIcon';
import Button from './Button';

export interface CreatorInfo {
  channelId: string;
  channelName: string;
  channelThumbnail?: string;
  subscriberCount?: string;
  videoId?: string;
}

export interface CreatorCardProps {
  /** Creator information */
  creator: CreatorInfo;
  /** Called when Like button is clicked */
  onLike?: () => void;
  /** Called when Comment button is clicked */
  onComment?: () => void;
  /** Called when Subscribe button is clicked */
  onSubscribe?: () => void;
  /** Whether the user has already liked */
  isLiked?: boolean;
  /** Whether the user has already subscribed */
  isSubscribed?: boolean;
  /** Whether to show engagement tracking message */
  showEngagementMessage?: boolean;
  /** Compact mode for smaller layouts */
  compact?: boolean;
}

export default function CreatorCard({
  creator,
  onLike,
  onComment,
  onSubscribe,
  isLiked = false,
  isSubscribed = false,
  showEngagementMessage = false,
  compact = false,
}: CreatorCardProps) {
  const { channelId, channelName, channelThumbnail, subscriberCount, videoId } = creator;

  // Generate YouTube URLs
  const channelUrl = `https://www.youtube.com/channel/${channelId}`;
  const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;

  const handleLikeClick = () => {
    if (videoUrl) {
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
    }
    onLike?.();
  };

  const handleCommentClick = () => {
    if (videoUrl) {
      window.open(`${videoUrl}#comments`, '_blank', 'noopener,noreferrer');
    }
    onComment?.();
  };

  const handleSubscribeClick = () => {
    window.open(`${channelUrl}?sub_confirmation=1`, '_blank', 'noopener,noreferrer');
    onSubscribe?.();
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-surface border-3 border-border">
        {/* Avatar */}
        {channelThumbnail ? (
          <img
            src={channelThumbnail}
            alt={channelName}
            className="w-10 h-10 rounded-full border-2 border-border"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <span className="font-bold text-text text-sm">
              {channelName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-heading font-bold text-sm text-text hover:text-primary truncate block"
          >
            {channelName}
          </a>
          {subscriberCount && (
            <p className="text-xs text-text/70">{subscriberCount} subscribers</p>
          )}
        </div>

        {/* Quick Subscribe */}
        <Button
          variant={isSubscribed ? 'secondary' : 'primary'}
          size="sm"
          onClick={handleSubscribeClick}
        >
          {isSubscribed ? 'Subscribed' : 'Subscribe'}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-surface border-3 border-border">
      {/* Header with avatar and info */}
      <div className="flex items-center gap-4 mb-4">
        {/* Avatar */}
        {channelThumbnail ? (
          <img
            src={channelThumbnail}
            alt={channelName}
            className="w-16 h-16 rounded-full border-3 border-border"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center border-3 border-border">
            <span className="font-heading font-bold text-text text-xl">
              {channelName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Channel Info */}
        <div className="flex-1 min-w-0">
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-heading font-bold text-lg text-text hover:text-primary truncate block"
          >
            {channelName}
          </a>
          {subscriberCount && (
            <p className="text-sm text-text/70">{subscriberCount} subscribers</p>
          )}
        </div>
      </div>

      {/* Engagement Message */}
      {showEngagementMessage && (
        <p className="text-sm text-text/70 mb-4">
          Enjoyed this content? Show the creator some love!
        </p>
      )}

      {/* Engagement Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Like Button */}
        <Button
          variant={isLiked ? 'secondary' : 'outline'}
          size="sm"
          onClick={handleLikeClick}
        >
          <MaterialIcon
            name={isLiked ? 'thumb_up' : 'thumb_up_off_alt'}
            size="sm"
            className="mr-1"
            decorative
          />
          Like
        </Button>

        {/* Comment Button */}
        <Button variant="outline" size="sm" onClick={handleCommentClick}>
          <MaterialIcon name="comment" size="sm" className="mr-1" decorative />
          Comment
        </Button>

        {/* Subscribe Button */}
        <Button
          variant={isSubscribed ? 'secondary' : 'primary'}
          size="sm"
          onClick={handleSubscribeClick}
        >
          <MaterialIcon
            name={isSubscribed ? 'notifications_active' : 'subscriptions'}
            size="sm"
            className="mr-1"
            decorative
          />
          {isSubscribed ? 'Subscribed' : 'Subscribe'}
        </Button>
      </div>

      {/* Open on YouTube Link */}
      <div className="mt-4 pt-4 border-t border-border">
        <a
          href={videoUrl || channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <MaterialIcon name="open_in_new" size="sm" decorative />
          {videoUrl ? 'Watch on YouTube' : 'View Channel'}
        </a>
      </div>
    </div>
  );
}
