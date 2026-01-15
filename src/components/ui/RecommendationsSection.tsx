/**
 * RecommendationsSection Component
 * Dashboard section displaying content recommendations
 */
import RecommendationCard, { RecommendationData, RecommendationType } from './RecommendationCard';
import MaterialIcon from './MaterialIcon';
import Card from './Card';

export interface RecommendationsSectionProps {
  /** Title for the section */
  title?: string;
  /** Array of recommendations to display */
  recommendations: RecommendationData[];
  /** Called when a recommendation is clicked */
  onRecommendationClick: (recommendation: RecommendationData) => void;
  /** Maximum number of recommendations to show */
  maxItems?: number;
  /** Whether to use compact cards */
  compact?: boolean;
  /** Show empty state when no recommendations */
  showEmptyState?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Filter by recommendation type */
  filterType?: RecommendationType;
  /** Loading state */
  loading?: boolean;
}

export default function RecommendationsSection({
  title = 'Recommendations',
  recommendations,
  onRecommendationClick,
  maxItems = 4,
  compact = false,
  showEmptyState = true,
  emptyMessage = 'No recommendations available yet. Complete more sessions to get personalized suggestions.',
  filterType,
  loading = false,
}: RecommendationsSectionProps) {
  // Filter recommendations by type if specified
  const filteredRecommendations = filterType
    ? recommendations.filter((r) => r.type === filterType)
    : recommendations;

  // Limit to maxItems
  const displayedRecommendations = filteredRecommendations.slice(0, maxItems);

  if (loading) {
    return (
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-40 bg-border animate-pulse rounded" />
          </div>
          <div className={compact ? 'space-y-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'}>
            {[...Array(compact ? 3 : 4)].map((_, i) => (
              <div key={i} className={compact ? 'h-16 bg-border animate-pulse rounded' : 'aspect-video bg-border animate-pulse rounded'} />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (showEmptyState && displayedRecommendations.length === 0) {
    return (
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xl font-bold text-text">{title}</h2>
            <MaterialIcon name="recommend" size="lg" className="text-primary" decorative />
          </div>
          <div className="text-center py-8">
            <MaterialIcon name="explore" size="xl" className="text-text/30 mb-4" decorative />
            <p className="text-text/70 max-w-md mx-auto">{emptyMessage}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xl font-bold text-text">{title}</h2>
            <MaterialIcon name="recommend" size="lg" className="text-primary" decorative />
          </div>
          {filteredRecommendations.length > maxItems && (
            <span className="text-sm text-text/70">
              Showing {maxItems} of {filteredRecommendations.length}
            </span>
          )}
        </div>

        {/* Recommendations Grid or List */}
        {compact ? (
          <div className="space-y-2">
            {displayedRecommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                onAction={onRecommendationClick}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayedRecommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                onAction={onRecommendationClick}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
