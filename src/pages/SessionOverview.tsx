import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Toast from '../components/ui/Toast';
import { useSessionStore } from '../stores/sessionStore';
import { formatDuration } from '../services/youtube';
import { useDocumentTitle } from '../hooks';

export default function SessionOverview() {
  useDocumentTitle('Session Overview');
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { getSession, setCurrentSession, updateSession } = useSessionStore();

  const session = sessionId ? getSession(sessionId) : undefined;

  // Adjustment mode state
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  // Phase 7 F9: Expandable topic preview state
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (session) {
      setCurrentSession(session);
      // Initialize all topics as selected
      setSelectedTopics(new Set(session.topics.map(t => t.id)));
    }
  }, [session, setCurrentSession]);

  // Session not found
  if (!session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="text-center py-12 max-w-md">
          <div className="space-y-4">
            <h1 className="font-heading text-2xl font-bold text-text">
              Session Not Found
            </h1>
            <p className="text-text/70">
              This session doesn't exist or has been deleted.
            </p>
            <Button onClick={() => navigate('/')}>
              Start New Session
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const totalQuestions = session.topics.reduce(
    (sum, topic) => sum + topic.questions.length,
    0
  );

  // Calculate selected stats when in adjust mode
  const selectedTopicsArray = session.topics.filter(t => selectedTopics.has(t.id));
  const selectedQuestionsCount = selectedTopicsArray.reduce(
    (sum, topic) => sum + topic.questions.length,
    0
  );

  // Estimate session duration (roughly 2-3 min per topic)
  const estimatedMinutes = Math.round(session.topics.length * 2.5);
  const selectedEstimatedMinutes = Math.round(selectedTopicsArray.length * 2.5);

  // Toggle topic selection
  const toggleTopicSelection = (topicId: string) => {
    setSelectedTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  // Toggle adjust mode
  const handleToggleAdjustMode = () => {
    if (isAdjustMode) {
      // Exiting adjust mode - reset to all topics selected
      setSelectedTopics(new Set(session?.topics.map(t => t.id) || []));
    }
    setIsAdjustMode(!isAdjustMode);
  };

  // Phase 7 F9: Toggle individual topic expansion
  const toggleTopicExpansion = (topicId: string) => {
    setExpandedTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  // Phase 7 F9: Expand/collapse all topics
  const handleExpandAll = () => {
    if (session) {
      setExpandedTopics(new Set(session.topics.map(t => t.id)));
    }
  };

  const handleCollapseAll = () => {
    setExpandedTopics(new Set());
  };

  // Apply adjustments and start learning
  const handleStartLearning = () => {
    if (isAdjustMode && selectedTopics.size === 0) {
      setToast({ message: 'Please select at least one topic', type: 'error' });
      return;
    }

    // If in adjust mode, filter the session topics
    if (isAdjustMode && session && sessionId) {
      const filteredTopics = session.topics.filter(t => selectedTopics.has(t.id));
      if (filteredTopics.length < session.topics.length) {
        updateSession(sessionId, { topics: filteredTopics });
        setToast({ message: `Session adjusted to ${filteredTopics.length} topic${filteredTopics.length !== 1 ? 's' : ''}`, type: 'success' });
      }
    }

    navigate(`/session/${sessionId}/active`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Video Info */}
      <Card>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Thumbnail */}
          {session.video.thumbnailUrl && (
            <div className="md:w-1/3">
              <img
                src={session.video.thumbnailUrl}
                alt={`Thumbnail for ${session.video.title}`}
                className="w-full h-auto border-3 border-border"
              />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 space-y-4">
            <h1 className="font-heading text-2xl font-bold text-text">
              {session.video.title}
            </h1>

            <p className="text-text/70">
              {session.video.channel}
            </p>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="bg-primary/20 border-2 border-border px-3 py-1">
                <span className="font-heading font-semibold">
                  {isAdjustMode && selectedTopics.size < session.topics.length
                    ? `${selectedTopics.size}/${session.topics.length} topics`
                    : `${session.topics.length} topics`
                  }
                </span>
              </div>
              <div className="bg-secondary/20 border-2 border-border px-3 py-1">
                <span className="font-heading font-semibold">
                  {isAdjustMode && selectedTopics.size < session.topics.length
                    ? `${selectedQuestionsCount}/${totalQuestions} questions`
                    : `${totalQuestions} questions`
                  }
                </span>
              </div>
              {session.video.duration > 0 && (
                <div className="bg-accent/20 border-2 border-border px-3 py-1">
                  <span className="font-heading font-semibold">
                    {formatDuration(session.video.duration)}
                  </span>
                </div>
              )}
              <div className="bg-surface border-2 border-border px-3 py-1">
                <span className="font-heading font-semibold">
                  ~{isAdjustMode && selectedTopics.size < session.topics.length
                    ? selectedEstimatedMinutes
                    : estimatedMinutes
                  } min learning
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Topics Preview */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-heading text-xl font-bold text-text">
            Topics to Cover
          </h2>
          <div className="flex gap-2">
            {/* Phase 7 F9: Expand/Collapse All buttons */}
            <button
              onClick={expandedTopics.size === session.topics.length ? handleCollapseAll : handleExpandAll}
              className="px-3 py-2 text-sm font-heading border-2 border-border bg-surface hover:bg-primary/10 transition-colors"
            >
              {expandedTopics.size === session.topics.length ? 'Collapse All' : 'Expand All'}
            </button>
            <button
              onClick={handleToggleAdjustMode}
              className={`px-4 py-2 font-heading font-semibold border-3 border-border transition-all ${
                isAdjustMode
                  ? 'bg-secondary text-text shadow-brutal'
                  : 'bg-surface text-text hover:bg-primary/10'
              }`}
              aria-pressed={isAdjustMode}
            >
              {isAdjustMode ? 'Cancel Adjust' : 'Adjust Topics'}
            </button>
          </div>
        </div>

        {isAdjustMode && (
          <p className="text-sm text-text/70 mb-4 bg-primary/10 border-2 border-border p-3">
            Click on topics to include/exclude them from your session. Selected: {selectedTopics.size} of {session.topics.length}
          </p>
        )}

        <ol className="space-y-3">
          {session.topics.map((topic, index) => {
            const isSelected = selectedTopics.has(topic.id);
            const isExpanded = expandedTopics.has(topic.id);
            return (
              <li
                key={topic.id}
                className={`border-2 border-border transition-colors ${
                  isAdjustMode && !isSelected
                    ? 'bg-surface/50 opacity-50'
                    : 'bg-surface'
                }`}
              >
                {/* Topic Header */}
                <div
                  onClick={isAdjustMode ? () => toggleTopicSelection(topic.id) : undefined}
                  className={`flex items-start gap-3 p-3 ${
                    isAdjustMode ? 'cursor-pointer hover:bg-primary/10' : ''
                  }`}
                  role={isAdjustMode ? 'checkbox' : undefined}
                  aria-checked={isAdjustMode ? isSelected : undefined}
                  tabIndex={isAdjustMode ? 0 : undefined}
                  onKeyDown={isAdjustMode ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleTopicSelection(topic.id);
                    }
                  } : undefined}
                >
                  {isAdjustMode && (
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                      <div className={`w-6 h-6 border-3 border-border flex items-center justify-center ${
                        isSelected ? 'bg-primary' : 'bg-surface'
                      }`}>
                        {isSelected && (
                          <svg className="w-4 h-4 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
                  <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center border-2 border-border font-heading font-bold ${
                    isAdjustMode && !isSelected ? 'bg-surface' : 'bg-primary'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-heading font-semibold text-text">
                      {topic.title}
                    </h3>
                    <p className="text-sm text-text/70 mt-1">
                      {topic.questions.length} question{topic.questions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {/* Phase 7 F9: Expand/collapse button */}
                  {!isAdjustMode && (
                    <button
                      onClick={() => toggleTopicExpansion(topic.id)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center border-2 border-border bg-surface hover:bg-primary/10 transition-colors"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Collapse questions' : 'Expand questions'}
                    >
                      <motion.svg
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-4 h-4 text-text"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </motion.svg>
                    </button>
                  )}
                </div>

                {/* Phase 7 F9: Expandable questions list */}
                <AnimatePresence>
                  {isExpanded && !isAdjustMode && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-0 border-t-2 border-border mt-0">
                        <ol className="space-y-2 mt-3">
                          {topic.questions.map((question, qIndex) => (
                            <li
                              key={question.id}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary/20 border border-border text-xs font-semibold">
                                Q{qIndex + 1}
                              </span>
                              <span className="text-text/80 leading-relaxed">
                                {question.text}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Knowledge Base Sources */}
      {session.knowledgeBase.sources.length > 0 && (
        <Card>
          <h2 className="font-heading text-xl font-bold text-text mb-4">
            Enriched Sources
          </h2>
          <p className="text-sm text-text/70 mb-4">
            Additional context gathered from referenced materials:
          </p>

          <ul className="space-y-2">
            {session.knowledgeBase.sources.slice(0, 5).map((source, index) => (
              <li
                key={index}
                className="flex items-center gap-2 text-sm"
              >
                <span className={`px-2 py-0.5 text-xs font-heading font-semibold border-2 border-border ${
                  source.type === 'github' ? 'bg-success/20' :
                  source.type === 'documentation' ? 'bg-secondary/20' :
                  'bg-primary/20'
                }`}>
                  {source.type}
                </span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary hover:underline truncate"
                >
                  {source.title}
                </a>
              </li>
            ))}
            {session.knowledgeBase.sources.length > 5 && (
              <li className="text-sm text-text/70">
                +{session.knowledgeBase.sources.length - 5} more sources
              </li>
            )}
          </ul>
        </Card>
      )}

      {/* Start Button */}
      <div className="flex flex-col items-center gap-4">
        {isAdjustMode && selectedTopics.size < session.topics.length && (
          <p className="text-sm text-text/70">
            {selectedTopics.size === 0
              ? 'Select at least one topic to continue'
              : `Starting with ${selectedTopics.size} of ${session.topics.length} topics`
            }
          </p>
        )}
        <Button
          size="lg"
          onClick={handleStartLearning}
          className="px-12"
          disabled={isAdjustMode && selectedTopics.size === 0}
        >
          {isAdjustMode && selectedTopics.size < session.topics.length
            ? 'Start with Selected Topics'
            : 'Start Learning'
          }
        </Button>
      </div>

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
