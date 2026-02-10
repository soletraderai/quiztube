import { useState } from 'react';
import type { Chapter } from '../../types';
import { formatTimestamp } from '../../services/transcript';

interface ChapterListProps {
  chapters: Chapter[];
  onChapterClick?: (chapter: Chapter) => void;
  activeChapterId?: string;
}

export function ChapterList({ chapters, onChapterClick, activeChapterId }: ChapterListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (chapters.length === 0) return null;

  return (
    <div className="border-2 border-black bg-white">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 font-bold text-sm hover:bg-gray-50"
        aria-expanded={isExpanded}
      >
        <span>Chapters ({chapters.length})</span>
        <span className="text-lg">{isExpanded ? '−' : '+'}</span>
      </button>
      {isExpanded && (
        <ul role="list" className="border-t-2 border-black">
          {chapters.map((chapter) => (
            <li
              key={chapter.id}
              role="listitem"
              className={`flex items-center justify-between p-3 border-b border-gray-200 cursor-pointer hover:bg-yellow-50 transition-colors ${
                activeChapterId === chapter.id ? 'bg-[#FFDE59]/30 border-l-4 border-l-[#FFDE59]' : ''
              }`}
              onClick={() => onChapterClick?.(chapter)}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onChapterClick?.(chapter)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{chapter.title}</p>
                <p className="text-xs text-gray-500">
                  {formatTimestamp(chapter.startTime)} – {formatTimestamp(chapter.endTime)}
                </p>
              </div>
              <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                {Math.round(chapter.duration / 60)}m
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
