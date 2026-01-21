import { motion } from 'framer-motion';
import type { Topic } from '../../types';
import CategoryBadge from './CategoryBadge';
import Card from '../ui/Card';

interface CurrentContextCardProps {
  topic: Topic;
  videoUrl: string;
  onEasier?: () => void;
  onHarder?: () => void;
  showDifficultyControls?: boolean;
}

// Format timestamp for display (seconds to MM:SS)
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Build YouTube URL with timestamp
function buildYouTubeLink(videoUrl: string, timestamp?: number): string {
  if (!timestamp) return videoUrl;

  // Extract video ID
  const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (!match) return videoUrl;

  const videoId = match[1];
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestamp)}s`;
}

export default function CurrentContextCard({
  topic,
  videoUrl,
  onEasier,
  onHarder,
  showDifficultyControls = false,
}: CurrentContextCardProps) {
  const hasCategory = topic.category && topic.icon;
  const hasTimestamp = topic.timestampStart !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card popStyle shadowColor="violet" className="relative overflow-hidden">
        {/* Category badge - overlapping top edge */}
        {hasCategory && (
          <div className="absolute -top-0.5 left-4 -translate-y-1/2">
            <CategoryBadge
              category={topic.category!}
              icon={topic.icon!}
            />
          </div>
        )}

        <div className={`${hasCategory ? 'pt-4' : 'pt-2'} pb-4 px-4`}>
          {/* Topic title */}
          <h2 className="font-heading font-bold text-lg text-text mb-2">
            {topic.title}
          </h2>

          {/* Summary - no answer spoilers */}
          <p className="font-body text-sm text-text/80 mb-3 leading-relaxed">
            {topic.summary}
          </p>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-text/60">
            {/* Timestamp link */}
            {hasTimestamp && (
              <a
                href={buildYouTubeLink(videoUrl, topic.timestampStart)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-eg-violet transition-colors"
                aria-label={`Watch from ${formatTimestamp(topic.timestampStart!)}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatTimestamp(topic.timestampStart!)}</span>
                {topic.timestampEnd && (
                  <span>- {formatTimestamp(topic.timestampEnd)}</span>
                )}
              </a>
            )}

            {/* Section name if available */}
            {topic.sectionName && (
              <>
                <span className="text-text/30">|</span>
                <span className="text-text/60">{topic.sectionName}</span>
              </>
            )}
          </div>

          {/* Difficulty adjustment controls */}
          {showDifficultyControls && (onEasier || onHarder) && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
              <span className="text-xs font-body text-text/60">Adjust difficulty:</span>
              {onEasier && (
                <button
                  onClick={onEasier}
                  className="px-2 py-1 text-xs font-heading border-2 border-border bg-surface hover:bg-eg-lime hover:border-eg-lime hover:text-eg-ink transition-colors"
                >
                  Easier
                </button>
              )}
              {onHarder && (
                <button
                  onClick={onHarder}
                  className="px-2 py-1 text-xs font-heading border-2 border-border bg-surface hover:bg-eg-pink hover:border-eg-pink hover:text-white transition-colors"
                >
                  Harder
                </button>
              )}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
