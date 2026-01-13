/**
 * CreatorEngagementPrompt Component
 * Post-session prompt to encourage engagement with content creator
 */
import MaterialIcon from './MaterialIcon';
import Button from './Button';

export interface CreatorEngagementPromptProps {
  /** Creator's channel name */
  creatorName: string;
  /** Creator's channel thumbnail */
  creatorThumbnail?: string;
  /** YouTube video ID */
  videoId: string;
  /** YouTube channel ID */
  channelId: string;
  /** Called when user clicks Like */
  onLike?: () => void;
  /** Called when user clicks Maybe Later */
  onDismiss?: () => void;
  /** Called when user clicks Subscribe */
  onSubscribe?: () => void;
  /** Whether to show the Subscribe button */
  showSubscribe?: boolean;
}

export default function CreatorEngagementPrompt({
  creatorName,
  creatorThumbnail,
  videoId,
  channelId,
  onLike,
  onDismiss,
  onSubscribe,
  showSubscribe = true,
}: CreatorEngagementPromptProps) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const channelUrl = `https://www.youtube.com/channel/${channelId}?sub_confirmation=1`;

  const handleLikeClick = () => {
    // Open YouTube video page for liking
    window.open(videoUrl, '_blank', 'noopener,noreferrer');
    onLike?.();
  };

  const handleSubscribeClick = () => {
    // Open YouTube channel with subscription confirmation
    window.open(channelUrl, '_blank', 'noopener,noreferrer');
    onSubscribe?.();
  };

  return (
    <div className="bg-surface border-3 border-border shadow-brutal p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        {/* Creator Avatar */}
        {creatorThumbnail ? (
          <img
            src={creatorThumbnail}
            alt={creatorName}
            className="w-12 h-12 rounded-full border-2 border-border"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <span className="font-bold text-text">
              {creatorName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Prompt Text */}
        <div className="flex-1">
          <p className="font-heading font-bold text-text">
            Enjoyed this session?
          </p>
          <p className="text-sm text-text/70">
            Show <span className="font-semibold">{creatorName}</span> some appreciation!
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Like Button */}
        <Button variant="primary" onClick={handleLikeClick}>
          <MaterialIcon name="thumb_up" size="sm" className="mr-2" decorative />
          Like on YouTube
        </Button>

        {/* Subscribe Button */}
        {showSubscribe && (
          <Button variant="secondary" onClick={handleSubscribeClick}>
            <MaterialIcon name="subscriptions" size="sm" className="mr-2" decorative />
            Subscribe
          </Button>
        )}

        {/* Maybe Later Button */}
        <Button variant="ghost" onClick={onDismiss}>
          Maybe Later
        </Button>
      </div>

      {/* Small print */}
      <p className="mt-4 text-xs text-text/50">
        <MaterialIcon name="info" size="sm" className="inline mr-1" decorative />
        This opens YouTube in a new tab. Your engagement helps support free content creators.
      </p>
    </div>
  );
}
