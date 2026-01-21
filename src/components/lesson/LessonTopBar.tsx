import { motion } from 'framer-motion';
import Button from '../ui/Button';

interface LessonTopBarProps {
  topicTitle: string;
  topicNumber: number;
  totalTopics: number;
  videoTitle: string;
  progress: number; // 0-100
  onBack: () => void;
  onToggleResources: () => void;
  isResourcesOpen?: boolean;
}

export default function LessonTopBar({
  topicTitle,
  topicNumber,
  totalTopics,
  videoTitle,
  progress,
  onBack,
  onToggleResources,
  isResourcesOpen = false,
}: LessonTopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-eg-paper border-b-3 border-eg-ink">
      {/* Progress bar at very top */}
      <div className="h-1.5 bg-surface">
        <motion.div
          className="h-full bg-eg-violet"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Lesson progress"
        />
      </div>

      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        {/* Left section: Back button and topic info */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-text/70 hover:text-text transition-colors shrink-0"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline font-body text-sm">Back</span>
          </button>

          <div className="h-6 w-px bg-border shrink-0" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="shrink-0 px-2 py-0.5 bg-eg-violet text-white text-xs font-heading font-bold rounded-sm">
                Topic {topicNumber}/{totalTopics}
              </span>
              <h1 className="font-heading font-bold text-text truncate">
                {topicTitle}
              </h1>
            </div>
            <p className="text-xs text-text/60 font-body truncate mt-0.5">
              {videoTitle}
            </p>
          </div>
        </div>

        {/* Right section: Resources toggle */}
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleResources}
            aria-label={isResourcesOpen ? 'Close resources panel' : 'Open resources panel'}
            aria-expanded={isResourcesOpen}
            className={`flex items-center gap-2 ${isResourcesOpen ? 'bg-eg-violet/10' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="hidden sm:inline">Resources</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
