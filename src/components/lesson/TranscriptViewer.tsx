import { useEffect, useRef, useState } from 'react';
import type { Chapter } from '../../types';
import { formatTimestamp } from '../../services/transcript';

interface TranscriptViewerProps {
  chapters: Chapter[];
  transcript: string;
  activeChapterId?: string;
  onTimestampClick?: (seconds: number) => void;
  videoUrl?: string;
}

export function TranscriptViewer({ chapters, transcript, activeChapterId, onTimestampClick, videoUrl }: TranscriptViewerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeChapterId && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeChapterId]);

  const handleTimestampClick = (seconds: number) => {
    if (onTimestampClick) {
      onTimestampClick(seconds);
    } else if (videoUrl) {
      const url = videoUrl.includes('?')
        ? `${videoUrl}&t=${Math.floor(seconds)}s`
        : `${videoUrl}?t=${Math.floor(seconds)}s`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="border-2 border-black bg-white">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="w-full flex items-center justify-between p-3 font-bold text-sm hover:bg-gray-50"
        aria-expanded={isVisible}
      >
        <span>View Transcript</span>
        <span className="text-lg">{isVisible ? '−' : '+'}</span>
      </button>
      {isVisible && (
        <div className="border-t-2 border-black max-h-96 overflow-y-auto p-4 space-y-4">
          {chapters.length > 0 ? (
            chapters.map((chapter) => (
              <div
                key={chapter.id}
                ref={activeChapterId === chapter.id ? activeRef : undefined}
                className={`${activeChapterId === chapter.id ? 'bg-[#FFDE59]/20 border-l-4 border-l-[#FFDE59] pl-3' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm">{chapter.title}</h3>
                  <button
                    onClick={() => handleTimestampClick(chapter.startTime)}
                    className="text-xs text-[#00D4FF] hover:underline font-mono"
                    title="Play from here"
                  >
                    ▶ {formatTimestamp(chapter.startTime)}
                  </button>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{chapter.content}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{transcript}</p>
          )}
        </div>
      )}
    </div>
  );
}
