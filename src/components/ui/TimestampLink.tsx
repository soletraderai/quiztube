/**
 * TimestampLink Component
 * Clickable timestamp that links to specific point in YouTube video
 */
import { useMemo } from 'react';

export interface TimestampLinkProps {
  /** Timestamp in seconds */
  timestamp: number;
  /** YouTube video ID */
  videoId: string;
  /** Custom click handler (overrides default YouTube link) */
  onClick?: (timestamp: number) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate YouTube URL with timestamp
 */
function getYouTubeUrl(videoId: string, timestamp: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestamp)}s`;
}

export default function TimestampLink({
  timestamp,
  videoId,
  onClick,
  className = '',
}: TimestampLinkProps) {
  const formattedTime = useMemo(() => formatTimestamp(timestamp), [timestamp]);
  const youtubeUrl = useMemo(() => getYouTubeUrl(videoId, timestamp), [videoId, timestamp]);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(timestamp);
    }
    // If no custom handler, let the default link behavior open YouTube
  };

  return (
    <a
      href={youtubeUrl}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-primary font-mono text-sm hover:underline cursor-pointer ${className}`}
      aria-label={`Jump to ${formattedTime} in video`}
    >
      [{formattedTime}]
    </a>
  );
}

// Re-export the formatting function for use elsewhere
export { formatTimestamp, getYouTubeUrl };
