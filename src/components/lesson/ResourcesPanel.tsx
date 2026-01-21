import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { ParsedTranscriptSegment, ScrapedResource } from '../../types';
import TranscriptSection from './TranscriptSection';
import LessonResourcesSection from './LessonResourcesSection';

interface ResourcesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: ParsedTranscriptSegment[];
  resources: ScrapedResource[];
  currentTimestamp?: number;
  videoUrl: string;
}

export default function ResourcesPanel({
  isOpen,
  onClose,
  transcript,
  resources,
  currentTimestamp,
  videoUrl,
}: ResourcesPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-eg-ink/20 z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-eg-paper border-l-3 border-eg-ink z-50 overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Resources panel"
            tabIndex={-1}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-3 border-eg-ink bg-eg-violet">
              <h2 className="font-heading font-bold text-white">
                Resources
              </h2>
              <button
                onClick={onClose}
                className="p-1 text-white/80 hover:text-white transition-colors"
                aria-label="Close resources panel"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Transcript Section */}
              <div className="border-b border-border">
                <TranscriptSection
                  segments={transcript}
                  currentTimestamp={currentTimestamp}
                  videoUrl={videoUrl}
                />
              </div>

              {/* Resources Section */}
              {resources.length > 0 && (
                <LessonResourcesSection resources={resources} />
              )}

              {/* Empty state if no content */}
              {transcript.length === 0 && resources.length === 0 && (
                <div className="p-6 text-center text-text/60">
                  <svg className="w-12 h-12 mx-auto mb-3 text-text/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="font-body text-sm">
                    No resources available for this lesson.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
