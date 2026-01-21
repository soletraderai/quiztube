import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ParsedTranscriptSegment } from '../../types';

interface TranscriptSectionProps {
  segments: ParsedTranscriptSegment[];
  currentTimestamp?: number;
  videoUrl: string;
}

// Format timestamp for display (seconds to MM:SS)
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Build YouTube URL with timestamp
function buildYouTubeLink(videoUrl: string, timestamp: number): string {
  const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (!match) return videoUrl;

  const videoId = match[1];
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestamp)}s`;
}

export default function TranscriptSection({
  segments,
  currentTimestamp,
  videoUrl,
}: TranscriptSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const currentSegmentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current segment when it changes
  useEffect(() => {
    if (currentSegmentRef.current && currentTimestamp !== undefined) {
      currentSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTimestamp]);

  // Find the segment closest to current timestamp
  const currentSegmentIndex = segments.findIndex(
    (seg) => currentTimestamp !== undefined &&
             currentTimestamp >= seg.startTime &&
             currentTimestamp < seg.endTime
  );

  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="p-4">
      {/* Section header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-eg-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="font-heading font-bold text-sm text-text">
            Transcript
          </h3>
          <span className="text-xs text-text/50 font-body">
            {segments.length} segments
          </span>
        </div>
        <motion.svg
          animate={{ rotate: isExpanded ? 180 : 0 }}
          className="w-4 h-4 text-text/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      {/* Transcript content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-3 max-h-64 overflow-y-auto"
        >
          <div className="space-y-1">
            {segments.map((segment, index) => {
              const isCurrent = index === currentSegmentIndex;

              return (
                <div
                  key={index}
                  ref={isCurrent ? currentSegmentRef : undefined}
                  className={`flex gap-2 p-2 rounded transition-colors ${
                    isCurrent ? 'bg-eg-violet/10 border-l-2 border-eg-violet' : 'hover:bg-surface'
                  }`}
                >
                  <a
                    href={buildYouTubeLink(videoUrl, segment.startTime)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-mono text-eg-violet hover:underline"
                    aria-label={`Jump to ${formatTimestamp(segment.startTime)}`}
                  >
                    {formatTimestamp(segment.startTime)}
                  </a>
                  <p className="text-sm font-body text-text/80 leading-relaxed">
                    {segment.text}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
