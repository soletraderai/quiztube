/**
 * RecommendationCard Component
 * Display individual content recommendation with action button
 */
import MaterialIcon from './MaterialIcon';
import Button from './Button';

export type RecommendationType = 'review' | 'continue' | 'expand' | 'new';

export interface RecommendationData {
  id: string;
  title: string;
  thumbnail?: string;
  channel?: string;
  reason?: string;
  type: RecommendationType;
  sessionId?: string;
  videoId?: string;
  progress?: number; // 0-100 completion percentage
}

export interface RecommendationCardProps {
  /** Recommendation data */
  recommendation: RecommendationData;
  /** Called when action button is clicked */
  onAction: (recommendation: RecommendationData) => void;
  /** Compact mode for smaller layouts */
  compact?: boolean;
}

// Type configuration for styling and labels
const typeConfig: Record<
  RecommendationType,
  { icon: string; color: string; label: string; actionText: string }
> = {
  review: {
    icon: 'replay',
    color: 'text-warning',
    label: 'Review',
    actionText: 'Review Now',
  },
  continue: {
    icon: 'play_arrow',
    color: 'text-primary',
    label: 'Continue',
    actionText: 'Continue',
  },
  expand: {
    icon: 'explore',
    color: 'text-secondary',
    label: 'Related',
    actionText: 'Explore',
  },
  new: {
    icon: 'add_circle',
    color: 'text-success',
    label: 'New',
    actionText: 'Start',
  },
};

export default function RecommendationCard({
  recommendation,
  onAction,
  compact = false,
}: RecommendationCardProps) {
  const { title, thumbnail, channel, reason, type, progress } = recommendation;
  const config = typeConfig[type];

  const handleClick = () => {
    onAction(recommendation);
  };

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 p-3 bg-surface border-3 border-border hover:shadow-brutal-sm transition-shadow cursor-pointer"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        {/* Thumbnail */}
        <div className="relative w-20 h-12 shrink-0 bg-border rounded overflow-hidden">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MaterialIcon name="video_library" size="lg" className="text-text/30" decorative />
            </div>
          )}
          {/* Type Badge */}
          <div className={`absolute top-1 left-1 px-1 py-0.5 text-xs font-bold bg-text ${config.color} rounded`}>
            {config.label}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-sm text-text truncate">{title}</p>
          {channel && (
            <p className="text-xs text-text/70 truncate">{channel}</p>
          )}
        </div>

        {/* Action Icon */}
        <MaterialIcon name={config.icon} size="lg" className={config.color} />
      </div>
    );
  }

  return (
    <div className="bg-surface border-3 border-border hover:shadow-brutal transition-shadow">
      {/* Thumbnail Section */}
      <div className="relative aspect-video bg-border">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MaterialIcon name="video_library" size="2xl" className="text-text/30" decorative />
          </div>
        )}

        {/* Type Badge */}
        <div className={`absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-text ${config.color} rounded flex items-center gap-1`}>
          <MaterialIcon name={config.icon} size="sm" decorative />
          {config.label}
        </div>

        {/* Progress Bar */}
        {progress !== undefined && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-border">
            <div
              className="h-full bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4">
        <h3 className="font-heading font-bold text-text mb-1 line-clamp-2">
          {title}
        </h3>
        {channel && (
          <p className="text-sm text-text/70 mb-2">{channel}</p>
        )}
        {reason && (
          <p className="text-sm text-text/60 mb-3 italic">
            <MaterialIcon name="lightbulb" size="sm" className="inline mr-1" decorative />
            {reason}
          </p>
        )}

        {/* Action Button */}
        <Button
          variant={type === 'review' ? 'secondary' : 'primary'}
          size="sm"
          onClick={handleClick}
          className="w-full"
        >
          <MaterialIcon name={config.icon} size="sm" className="mr-2" decorative />
          {config.actionText}
        </Button>
      </div>
    </div>
  );
}
