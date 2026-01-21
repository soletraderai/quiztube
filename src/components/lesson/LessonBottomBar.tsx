import { motion } from 'framer-motion';
import Button from '../ui/Button';

interface LessonBottomBarProps {
  onSaveLesson: () => void;
  onSubmitAnswer?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  canSubmit?: boolean;
  showSubmit?: boolean;
}

export default function LessonBottomBar({
  onSaveLesson,
  onSubmitAnswer,
  submitLabel = 'Submit Answer',
  isSubmitting = false,
  canSubmit = true,
  showSubmit = true,
}: LessonBottomBarProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed bottom-0 left-0 right-0 z-30 bg-eg-paper border-t-3 border-eg-ink"
    >
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        {/* Left side: Save Lesson button */}
        <button
          onClick={onSaveLesson}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-eg-ink font-heading font-semibold text-sm text-eg-ink hover:bg-surface transition-colors shadow-[2px_2px_0_0_#1a1a2e] hover:shadow-[3px_3px_0_0_#1a1a2e] hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
          aria-label="Save lesson and exit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save Lesson
        </button>

        {/* Right side: Submit button */}
        {showSubmit && onSubmitAnswer && (
          <Button
            variant="pop-violet"
            size="md"
            onClick={onSubmitAnswer}
            disabled={!canSubmit || isSubmitting}
            loading={isSubmitting}
            className="min-w-[140px]"
          >
            {submitLabel}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
