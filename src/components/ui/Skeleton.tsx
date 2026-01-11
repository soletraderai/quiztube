interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export default function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-border/20';

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    card: 'rounded-none border-3 border-border/20',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} ${variantClasses.text}`}
            style={{
              ...style,
              width: i === lines - 1 ? '75%' : style.width || '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

// Pre-built skeleton layouts for common use cases
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`border-3 border-border/20 p-4 bg-surface ${className}`}>
      <div className="space-y-4">
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" lines={3} />
        <div className="flex gap-2">
          <Skeleton width={80} height={36} />
          <Skeleton width={80} height={36} />
        </div>
      </div>
    </div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="border-3 border-border/20 p-4 bg-surface shadow-brutal-sm">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <Skeleton width={120} height={68} className="shrink-0" />
        {/* Content */}
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" height={20} width="80%" />
          <Skeleton variant="text" height={16} width="50%" />
          <Skeleton variant="text" height={14} width="30%" />
        </div>
      </div>
    </div>
  );
}

export function GoalCardSkeleton() {
  return (
    <div className="border-3 border-border/20 p-4 bg-surface">
      <div className="flex justify-between items-start mb-3">
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" width="70%" height={20} />
          <Skeleton variant="text" width="40%" height={14} />
        </div>
        <Skeleton width={60} height={24} />
      </div>
      <Skeleton height={8} className="mb-2" />
      <div className="flex justify-between">
        <Skeleton width={80} height={14} />
        <Skeleton width={60} height={14} />
      </div>
    </div>
  );
}

export function SettingsSectionSkeleton() {
  return (
    <div className="border-3 border-border/20 p-6 bg-surface space-y-4">
      <Skeleton variant="text" width={150} height={24} />
      <div className="space-y-3">
        <Skeleton height={48} />
        <Skeleton height={48} />
        <Skeleton height={48} />
      </div>
    </div>
  );
}

export function FeedChannelSkeleton() {
  return (
    <div className="border-3 border-border/20 p-4 bg-surface flex items-center gap-4">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" height={18} />
        <Skeleton variant="text" width="40%" height={14} />
      </div>
      <Skeleton width={70} height={32} />
    </div>
  );
}

export function LibrarySessionSkeleton() {
  return (
    <div className="border-3 border-border/20 p-4 bg-surface">
      <div className="flex gap-4 mb-4">
        <Skeleton width={160} height={90} className="shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="80%" height={20} />
          <Skeleton variant="text" width="50%" height={14} />
          <div className="flex gap-2 mt-2">
            <Skeleton width={60} height={20} />
            <Skeleton width={80} height={20} />
          </div>
        </div>
      </div>
      <Skeleton height={4} className="mb-2" />
      <div className="flex justify-between">
        <Skeleton width={100} height={14} />
        <Skeleton width={80} height={14} />
      </div>
    </div>
  );
}
