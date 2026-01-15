/**
 * EvaluationFeedback Component
 * Phase 7: Three-tier feedback display (Pass/Fail/Neutral)
 * Shows evaluation results with visual indicators and key points
 */

import { motion, AnimatePresence } from 'framer-motion';
import MaterialIcon from './MaterialIcon';
import type { EvaluationResult } from '../../types';

interface EvaluationFeedbackProps {
  result: EvaluationResult;
  userAnswer: string;
  onContinue: () => void;
  isVisible: boolean;
}

// Styling configuration for each result type
const resultConfig = {
  pass: {
    bgColor: 'bg-success/20',
    borderColor: 'border-success',
    textColor: 'text-success',
    icon: 'check_circle',
    title: 'Correct!',
  },
  fail: {
    bgColor: 'bg-error/20',
    borderColor: 'border-error',
    textColor: 'text-error',
    icon: 'cancel',
    title: 'Not quite',
  },
  neutral: {
    bgColor: 'bg-warning/20',
    borderColor: 'border-warning',
    textColor: 'text-warning',
    icon: 'help',
    title: 'Partial understanding',
  },
} as const;

// Animation variants for icons
const iconVariants = {
  pass: {
    initial: { scale: 0, rotate: -180 },
    animate: { scale: 1, rotate: 0 },
  },
  fail: {
    initial: { scale: 0, x: 0 },
    animate: { scale: 1, x: [0, -4, 4, -4, 4, 0] },
  },
  neutral: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
  },
};

export function EvaluationFeedback({
  result,
  userAnswer,
  onContinue,
  isVisible,
}: EvaluationFeedbackProps) {
  const config = resultConfig[result.result];
  const iconAnim = iconVariants[result.result];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mt-6"
        >
          <div
            className={`${config.bgColor} ${config.borderColor} border-3 rounded-lg p-6`}
          >
            {/* Header with icon and title */}
            <div className="flex items-center gap-3 mb-4">
              <motion.div
                initial={iconAnim.initial}
                animate={iconAnim.animate}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <MaterialIcon
                  name={config.icon}
                  size="xl"
                  className={config.textColor}
                />
              </motion.div>
              <h3 className={`text-xl font-bold ${config.textColor}`}>
                {config.title}
              </h3>
            </div>

            {/* Feedback text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-text mb-4 leading-relaxed"
            >
              {result.feedback}
            </motion.p>

            {/* Your answer (collapsed view) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-surface/50 rounded-md p-3 mb-4"
            >
              <p className="text-xs font-medium text-text-secondary mb-1">
                Your answer:
              </p>
              <p className="text-sm text-text line-clamp-3">{userAnswer}</p>
            </motion.div>

            {/* Correct answer (for fail/neutral) */}
            {result.result !== 'pass' && result.correctAnswer && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="bg-primary/10 border-2 border-primary/30 rounded-md p-3 mb-4"
              >
                <p className="text-xs font-medium text-primary mb-1">
                  What a complete answer should include:
                </p>
                <p className="text-sm text-text">{result.correctAnswer}</p>
              </motion.div>
            )}

            {/* Key points sections */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              {/* Points hit (always show if any) */}
              {result.keyPointsHit.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-success mb-2 flex items-center gap-1">
                    <MaterialIcon name="check_circle" size="sm" className="text-success" />
                    What you got right:
                  </p>
                  <ul className="space-y-1">
                    {result.keyPointsHit.map((point, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-text-secondary flex items-start gap-2"
                      >
                        <span className="text-success mt-1">+</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Points missed (for fail/neutral) */}
              {result.keyPointsMissed.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-warning mb-2 flex items-center gap-1">
                    <MaterialIcon name="help" size="sm" className="text-warning" />
                    {result.result === 'fail' ? 'What to review:' : 'Could improve on:'}
                  </p>
                  <ul className="space-y-1">
                    {result.keyPointsMissed.map((point, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-text-secondary flex items-start gap-2"
                      >
                        <span className="text-warning mt-1">-</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>

            {/* Continue button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={onContinue}
              className={`mt-6 w-full flex items-center justify-center gap-2 px-6 py-3
                bg-primary text-white font-bold rounded-lg border-3 border-text
                shadow-brutal hover:shadow-brutal-lg hover:-translate-y-0.5
                transition-all duration-200`}
            >
              Continue
              <MaterialIcon name="chevron_right" size="md" className="text-white" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default EvaluationFeedback;
