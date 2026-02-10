import { useState } from 'react';
import type { ExternalSource } from '../../types';
import { ExternalSourceCard } from './ExternalSourceCard';

interface ExternalSourcesListProps {
  sources: ExternalSource[];
}

export function ExternalSourcesList({ sources }: ExternalSourcesListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="border-2 border-black bg-white">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 font-bold text-sm hover:bg-gray-50"
        aria-expanded={isExpanded}
      >
        <span>{sources.length} external source{sources.length !== 1 ? 's' : ''} referenced</span>
        <span className="text-lg">{isExpanded ? '−' : '+'}</span>
      </button>
      {isExpanded && (
        <div className="border-t-2 border-black p-3 space-y-2">
          {sources.map((source) => (
            <ExternalSourceCard key={source.id} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}
