import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import MaterialIcon from './MaterialIcon';
import Button from './Button';
import {
  findRelevantSegments,
  formatTimestamp,
  generateYouTubeTimestampUrl,
} from '../../services/transcript';
import type { ParsedTranscriptSegment } from '../../types';

// Simple analytics tracking for help panel usage
interface HelpPanelEvent {
  timestamp: number;
  context: string;
  questionId?: string;
  sessionId?: string;
  action: 'open' | 'close' | 'section_view';
  sectionId?: string;
}

const ANALYTICS_KEY = 'quiztube_help_analytics';

function trackHelpPanelEvent(event: Omit<HelpPanelEvent, 'timestamp'>) {
  try {
    const existing = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]') as HelpPanelEvent[];
    const newEvent: HelpPanelEvent = {
      ...event,
      timestamp: Date.now(),
    };
    // Keep only last 100 events to prevent storage bloat
    const updated = [...existing.slice(-99), newEvent];
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(updated));
    console.log('[Analytics] Help panel event:', newEvent);
  } catch (error) {
    console.warn('Failed to track help panel event:', error);
  }
}

// Export for external access to analytics data
export function getHelpPanelAnalytics(): HelpPanelEvent[] {
  try {
    return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
  } catch {
    return [];
  }
}

interface HelpSection {
  id: string;
  title: string;
  content: string;
  timestamp?: string; // Format: "MM:SS"
}

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current context for help (e.g., "session", "dashboard", "review") */
  context?: string;
  /** Session-specific notes if viewing a session */
  sessionNotes?: HelpSection[];
  /** Video timestamp callback (for session context) */
  onTimestampClick?: (timestamp: string) => void;
  /** Question ID for tracking (analytics) */
  questionId?: string;
  /** Session ID for tracking (analytics) */
  sessionId?: string;
  // Phase 7 F2: Transcript context props
  /** Parsed transcript segments for current video */
  transcriptSegments?: ParsedTranscriptSegment[];
  /** Current timestamp range for the topic (start time in seconds) */
  currentTimestampStart?: number;
  /** Current timestamp range for the topic (end time in seconds) */
  currentTimestampEnd?: number;
  /** YouTube video URL for "Jump to video" feature */
  videoUrl?: string;
}

// Default help content by context
const defaultHelpContent: Record<string, HelpSection[]> = {
  dashboard: [
    {
      id: 'dashboard-overview',
      title: 'Dashboard Overview',
      content: 'Your dashboard shows your learning progress, daily goals, and recent activity. Track your streak and see recommended content.',
    },
    {
      id: 'daily-goal',
      title: 'Daily Goal',
      content: 'Set your daily learning goal in Settings. The progress bar shows how close you are to your target for today.',
    },
    {
      id: 'activity-chart',
      title: 'Activity Chart',
      content: 'The activity chart shows your learning time over the past week or month. Click the tabs to switch views.',
    },
  ],
  session: [
    {
      id: 'session-overview',
      title: 'Lesson Overview',
      content: 'Watch the video and answer questions to test your understanding. Questions appear at key points in the content.',
    },
    {
      id: 'answer-questions',
      title: 'Answering Questions',
      content: 'Select the answer you think is correct. After submitting, you\'ll see an explanation and can continue to the next question.',
    },
    {
      id: 'session-progress',
      title: 'Lesson Progress',
      content: 'Your progress is saved automatically. You can pause and return to continue later.',
    },
  ],
  review: [
    {
      id: 'review-overview',
      title: 'Review Mode',
      content: 'Review mode helps reinforce your learning using spaced repetition. Questions you struggle with will appear more often.',
    },
    {
      id: 'confidence-rating',
      title: 'Confidence Ratings',
      content: 'After each question, rate your confidence. This helps the system personalize your review schedule.',
    },
  ],
  library: [
    {
      id: 'library-overview',
      title: 'Your Library',
      content: 'Your library contains all your completed and in-progress learning sessions. Filter and search to find specific content.',
    },
    {
      id: 'session-status',
      title: 'Lesson Status',
      content: 'Lessons show their completion status. Green means complete, yellow means in progress, and gray means not started.',
    },
  ],
  default: [
    {
      id: 'getting-started',
      title: 'Getting Started',
      content: 'Welcome to QuizTube! Transform any YouTube video into an interactive learning session. Paste a URL to get started.',
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts',
      content: 'Use Cmd/Ctrl+B to toggle the sidebar, Escape to close modals, and Arrow keys to navigate lists.',
    },
    {
      id: 'need-help',
      title: 'Need More Help?',
      content: 'Visit our documentation or contact support at support@quiztube.app for personalized assistance.',
    },
  ],
};

export default function HelpPanel({
  isOpen,
  onClose,
  context = 'default',
  sessionNotes,
  onTimestampClick,
  questionId,
  sessionId,
  // Phase 7 F2: Transcript context props
  transcriptSegments,
  currentTimestampStart,
  currentTimestampEnd,
  videoUrl,
}: HelpPanelProps) {
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasTrackedOpen = useRef(false);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track help panel open/close events
  useEffect(() => {
    if (isOpen && !hasTrackedOpen.current) {
      trackHelpPanelEvent({
        action: 'open',
        context,
        questionId,
        sessionId,
      });
      hasTrackedOpen.current = true;
    } else if (!isOpen && hasTrackedOpen.current) {
      trackHelpPanelEvent({
        action: 'close',
        context,
        questionId,
        sessionId,
      });
      hasTrackedOpen.current = false;
    }
  }, [isOpen, context, questionId, sessionId]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Trap focus in panel when open
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  // Prevent body scroll when open on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile, isOpen]);

  const helpContent = sessionNotes && sessionNotes.length > 0
    ? sessionNotes
    : defaultHelpContent[context] || defaultHelpContent.default;

  const handleTimestampClick = (timestamp: string) => {
    if (onTimestampClick) {
      onTimestampClick(timestamp);
    }
  };

  // Format timestamp for display (local helper, prefixed to avoid conflict with imported formatTimestamp)
  const formatTimestampDisplay = (timestamp: string) => {
    return `[${timestamp}]`;
  };

  // Phase 7 F2: Get relevant transcript excerpts for current topic
  const relevantExcerpts = transcriptSegments && currentTimestampStart !== undefined && currentTimestampEnd !== undefined
    ? findRelevantSegments(transcriptSegments, currentTimestampStart, currentTimestampEnd, 3)
    : [];

  // Phase 7 F2: Handle "Jump to video" click
  const handleJumpToVideo = (timestampSeconds: number) => {
    if (videoUrl) {
      const ytUrl = generateYouTubeTimestampUrl(videoUrl, timestampSeconds);
      window.open(ytUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const panelContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-3 border-border bg-surface">
        <div className="flex items-center gap-3">
          <MaterialIcon name="help_outline" size="lg" className="text-primary" />
          <h2 className="font-heading font-bold text-lg text-text">
            {sessionNotes ? 'Session Notes' : 'Help'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-background/50 rounded transition-colors"
          aria-label="Close help panel"
        >
          <MaterialIcon name="close" size="lg" className="text-text" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Phase 7.6 F2: Video Context Section - always show if we have video context */}
        {videoUrl && (
          <div className="p-4 bg-secondary/10 border-3 border-secondary/30">
            <div className="flex items-center gap-2 mb-3">
              <MaterialIcon name="subtitles" size="md" className="text-secondary" />
              <h3 className="font-heading font-bold text-text">
                Video Context
              </h3>
            </div>

            {/* Show excerpts if available */}
            {relevantExcerpts.length > 0 ? (
              <>
                <p className="text-xs text-text/60 mb-3">
                  Relevant excerpts from the video transcript:
                </p>
                <div className="space-y-3">
                  {relevantExcerpts.map((excerpt, index) => (
                    <div
                      key={index}
                      className="p-3 bg-surface border-2 border-border rounded"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <button
                          onClick={() => handleJumpToVideo(excerpt.startTime)}
                          className="text-xs font-mono text-secondary hover:underline flex items-center gap-1"
                          aria-label={`Jump to video at ${formatTimestamp(excerpt.startTime)}`}
                        >
                          <MaterialIcon name="play_circle" size="sm" className="text-secondary" />
                          {formatTimestamp(excerpt.startTime)}
                        </button>
                      </div>
                      <p className="text-sm text-text/80 leading-relaxed line-clamp-3">
                        "{excerpt.text}"
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* Fallback when no transcript excerpts available */
              <p className="text-sm text-text/60 italic">
                {!transcriptSegments || transcriptSegments.length === 0
                  ? "Transcript not available for this video. Watch the video directly for context."
                  : "Watch the video for context on this topic."}
              </p>
            )}

            {/* Jump to video section button - always show if we have videoUrl */}
            <button
              onClick={() => handleJumpToVideo(currentTimestampStart ?? 0)}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-white font-semibold rounded border-2 border-border hover:bg-secondary/90 transition-colors"
            >
              <MaterialIcon name="open_in_new" size="sm" className="text-white" />
              {currentTimestampStart !== undefined ? 'Watch this section on YouTube' : 'Watch on YouTube'}
            </button>
          </div>
        )}

        {helpContent.map((section) => (
          <div
            key={section.id}
            className="p-4 bg-surface border-3 border-border hover:shadow-brutal-sm transition-shadow"
          >
            <div className="flex items-start gap-3">
              <MaterialIcon
                name={sessionNotes ? 'article' : 'lightbulb'}
                size="md"
                className="text-primary mt-1 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-heading font-bold text-text">
                    {section.title}
                  </h3>
                  {section.timestamp && (
                    <button
                      onClick={() => handleTimestampClick(section.timestamp!)}
                      className="text-xs text-primary font-mono hover:underline"
                    >
                      {formatTimestampDisplay(section.timestamp)}
                    </button>
                  )}
                </div>
                <p className="text-sm text-text/70 leading-relaxed">
                  {section.content}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Still Stuck Section */}
        {!sessionNotes && (
          <div className="mt-6 p-4 bg-primary/10 border-3 border-primary/30">
            <div className="flex items-start gap-3">
              <MaterialIcon name="support_agent" size="lg" className="text-primary" />
              <div>
                <h3 className="font-heading font-bold text-text mb-1">
                  Still Stuck?
                </h3>
                <p className="text-sm text-text/70 mb-3">
                  Can't find what you're looking for? Contact our support team.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open('mailto:support@quiztube.app')}
                >
                  <MaterialIcon name="email" size="sm" className="mr-2" decorative />
                  Contact Support
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (!isOpen) return null;

  // Mobile: Bottom sheet style
  if (isMobile) {
    return createPortal(
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-50"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Bottom Sheet */}
        <div
          ref={panelRef}
          tabIndex={-1}
          className="fixed bottom-0 left-0 right-0 h-[80vh] bg-background border-t-3 border-border z-50 flex flex-col rounded-t-lg animate-slide-up"
          role="dialog"
          aria-label="Help panel"
        >
          {/* Drag handle */}
          <div className="flex justify-center py-2">
            <div className="w-12 h-1 bg-border rounded-full" />
          </div>
          {panelContent}
        </div>
      </>,
      document.body
    );
  }

  // Desktop: Slide-out panel
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Slide-out Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="fixed top-0 right-0 h-full w-96 max-w-full bg-background border-l-3 border-border shadow-brutal-lg z-50 flex flex-col animate-slide-in-right"
        role="dialog"
        aria-label="Help panel"
      >
        {panelContent}
      </div>
    </>,
    document.body
  );
}

// Hook for managing help panel state
export function useHelpPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState('default');

  const openHelp = (newContext?: string) => {
    if (newContext) setContext(newContext);
    setIsOpen(true);
  };

  const closeHelp = () => setIsOpen(false);

  return {
    isOpen,
    context,
    openHelp,
    closeHelp,
  };
}
