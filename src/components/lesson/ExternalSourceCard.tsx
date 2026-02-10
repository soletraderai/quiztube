import type { ExternalSource } from '../../types';

interface ExternalSourceCardProps {
  source: ExternalSource;
}

const TYPE_STYLES: Record<ExternalSource['type'], { label: string; color: string }> = {
  github: { label: 'GitHub', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  documentation: { label: 'Docs', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  article: { label: 'Article', color: 'bg-green-100 text-green-800 border-green-300' },
  platform: { label: 'Platform', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-800 border-gray-300' },
};

export function ExternalSourceCard({ source }: ExternalSourceCardProps) {
  const style = TYPE_STYLES[source.type];

  return (
    <div className="border-2 border-black p-3 bg-white hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow">
      <div className="flex items-start gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 border ${style.color} whitespace-nowrap`}>
          {style.label}
        </span>
        <div className="flex-1 min-w-0">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-sm hover:text-[#00D4FF] block truncate"
          >
            {source.title}
          </a>
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{source.summary}</p>
          {source.relevance && (
            <p className="text-xs text-gray-400 mt-1 italic">{source.relevance}</p>
          )}
        </div>
      </div>
    </div>
  );
}
