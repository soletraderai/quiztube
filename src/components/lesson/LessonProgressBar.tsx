import { motion } from 'framer-motion';

interface LessonProgressBarProps {
  /** Current question number within topic */
  currentQuestion: number;
  /** Total questions in current topic */
  totalQuestions: number;
  /** Current topic number */
  currentTopic: number;
  /** Total topics */
  totalTopics: number;
  /** Whether to show detailed breakdown */
  showDetails?: boolean;
}

export default function LessonProgressBar({
  currentQuestion,
  totalQuestions,
  currentTopic,
  totalTopics,
  showDetails = false,
}: LessonProgressBarProps) {
  // Calculate overall progress
  const topicProgress = (currentTopic - 1) / totalTopics; // Topics completed
  const questionProgress = (currentQuestion / totalQuestions) / totalTopics; // Current topic progress
  const overallProgress = Math.round((topicProgress + questionProgress) * 100);

  return (
    <div className="w-full" role="progressbar" aria-valuenow={overallProgress} aria-valuemin={0} aria-valuemax={100}>
      {/* Progress bar container */}
      <div className="relative h-3 bg-surface border-2 border-border overflow-hidden">
        {/* Topic segments */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: totalTopics }).map((_, i) => (
            <div
              key={i}
              className="flex-1 border-r border-border/30 last:border-r-0"
            />
          ))}
        </div>

        {/* Progress fill */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-eg-violet"
          initial={{ width: 0 }}
          animate={{ width: `${overallProgress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Labels */}
      {showDetails && (
        <div className="flex justify-between mt-2 text-xs font-body text-text/70">
          <span>
            Topic {currentTopic} of {totalTopics}
          </span>
          <span>
            Question {currentQuestion} of {totalQuestions}
          </span>
        </div>
      )}
    </div>
  );
}
