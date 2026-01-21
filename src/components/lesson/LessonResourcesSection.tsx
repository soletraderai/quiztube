import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ScrapedResource } from '../../types';
import ResourceCard from './ResourceCard';

interface LessonResourcesSectionProps {
  resources: ScrapedResource[];
}

export default function LessonResourcesSection({ resources }: LessonResourcesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (resources.length === 0) {
    return null;
  }

  // Group resources by type
  const groupedResources = resources.reduce((acc, resource) => {
    const type = resource.sourceType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(resource);
    return acc;
  }, {} as Record<string, ScrapedResource[]>);

  return (
    <div className="p-4">
      {/* Section header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-eg-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <h3 className="font-heading font-bold text-sm text-text">
            External Resources
          </h3>
          <span className="text-xs text-text/50 font-body">
            {resources.length} {resources.length === 1 ? 'link' : 'links'}
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

      {/* Resources content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-3 space-y-4"
        >
          {Object.entries(groupedResources).map(([type, typeResources]) => (
            <div key={type}>
              {/* Type label */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-heading font-bold uppercase text-text/50 tracking-wide">
                  {type === 'github' ? 'GitHub' : type.charAt(0).toUpperCase() + type.slice(1)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Resource cards */}
              <div className="space-y-2">
                {typeResources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
