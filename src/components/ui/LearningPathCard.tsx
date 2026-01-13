/**
 * LearningPathCard Component
 * Display learning path summary with progress
 */
import { Link } from 'react-router-dom';
import MaterialIcon from './MaterialIcon';
import ProgressBar from './ProgressBar';

export interface LearningPathData {
  id: string;
  title: string;
  description?: string;
  totalItems: number;
  completedItems: number;
  estimatedTime?: string;
  thumbnail?: string;
  status: 'active' | 'completed' | 'paused';
  category?: string;
}

export interface LearningPathCardProps {
  /** Learning path data */
  learningPath: LearningPathData;
  /** Link to detail view */
  detailUrl?: string;
  /** Called when card is clicked */
  onClick?: () => void;
  /** Compact mode for list views */
  compact?: boolean;
}

export default function LearningPathCard({
  learningPath,
  detailUrl,
  onClick,
  compact = false,
}: LearningPathCardProps) {
  const {
    id,
    title,
    description,
    totalItems,
    completedItems,
    estimatedTime,
    thumbnail,
    status,
    category,
  } = learningPath;

  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Status configuration
  const statusConfig = {
    active: { icon: 'play_circle', color: 'text-primary', label: 'In Progress' },
    completed: { icon: 'check_circle', color: 'text-success', label: 'Completed' },
    paused: { icon: 'pause_circle', color: 'text-warning', label: 'Paused' },
  };

  const config = statusConfig[status];

  const cardContent = (
    <>
      {/* Thumbnail / Icon */}
      <div className={`relative ${compact ? 'w-16 h-16 shrink-0' : 'aspect-video'} bg-border rounded overflow-hidden`}>
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <MaterialIcon name="school" size={compact ? 'lg' : '2xl'} className="text-primary" decorative />
          </div>
        )}
        {/* Status Badge */}
        {!compact && (
          <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-surface border border-border rounded flex items-center gap-1 ${config.color}`}>
            <MaterialIcon name={config.icon} size="sm" decorative />
            {config.label}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={compact ? 'flex-1 min-w-0' : 'p-4'}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {category && (
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                {category}
              </span>
            )}
            <h3 className={`font-heading font-bold text-text ${compact ? 'text-sm truncate' : 'text-lg mb-1'}`}>
              {title}
            </h3>
            {!compact && description && (
              <p className="text-sm text-text/70 line-clamp-2 mb-3">{description}</p>
            )}
          </div>
          {compact && (
            <span className={`shrink-0 ${config.color}`}>
              <MaterialIcon name={config.icon} size="md" decorative />
            </span>
          )}
        </div>

        {/* Progress */}
        <div className={compact ? 'mt-1' : 'mt-3'}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text/70">
              {completedItems}/{totalItems} items
            </span>
            <span className="font-bold text-text">{progress}%</span>
          </div>
          <ProgressBar value={progress} max={100} size={compact ? 'sm' : 'md'} />
        </div>

        {/* Meta Info */}
        {!compact && estimatedTime && (
          <div className="flex items-center gap-4 mt-3 text-xs text-text/70">
            <span className="flex items-center gap-1">
              <MaterialIcon name="schedule" size="sm" decorative />
              {estimatedTime}
            </span>
          </div>
        )}
      </div>
    </>
  );

  const cardClasses = `bg-surface border-3 border-border hover:shadow-brutal-sm transition-shadow ${
    compact ? 'flex items-center gap-3 p-3' : ''
  } ${onClick || detailUrl ? 'cursor-pointer' : ''}`;

  // Wrap in Link if detailUrl provided
  if (detailUrl) {
    return (
      <Link to={detailUrl} className={cardClasses}>
        {cardContent}
      </Link>
    );
  }

  // Otherwise, handle click
  return (
    <div
      className={cardClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {cardContent}
    </div>
  );
}
