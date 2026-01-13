/**
 * LearningPathDetail Page
 * View details of a specific learning path
 */
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ProgressBar from '../components/ui/ProgressBar';
import Toast from '../components/ui/Toast';
import { StaggeredItem } from '../components/ui/StaggeredList';
import { useSessionStore } from '../stores/sessionStore';
import { useDocumentTitle } from '../hooks';

// Storage key for learning path item order
const getOrderStorageKey = (pathId: string) => `quiztube-path-order-${pathId}`;

interface PathItem {
  id: string;
  title: string;
  videoTitle: string;
  videoThumbnail?: string;
  channel: string;
  sessionId: string;
  topicId: string;
  completed: boolean;
  skipped: boolean;
  questionsTotal: number;
  questionsAnswered: number;
}

export default function LearningPathDetail() {
  const { pathId } = useParams<{ pathId: string }>();
  const navigate = useNavigate();
  const { library, updateSession } = useSessionStore();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // Load custom order from localStorage
  useEffect(() => {
    if (pathId) {
      const stored = localStorage.getItem(getOrderStorageKey(pathId));
      if (stored) {
        try {
          setCustomOrder(JSON.parse(stored));
        } catch {
          setCustomOrder([]);
        }
      }
    }
  }, [pathId]);

  // Save custom order to localStorage
  const saveOrder = useCallback((order: string[]) => {
    if (pathId) {
      localStorage.setItem(getOrderStorageKey(pathId), JSON.stringify(order));
      setCustomOrder(order);
    }
  }, [pathId]);

  // Generate path data from sessions
  const pathData = useMemo(() => {
    if (!pathId) return null;

    const items: PathItem[] = [];
    let pathTitle = '';
    let pathCategory = '';

    library.sessions.forEach((session) => {
      session.topics.forEach((topic) => {
        const categoryKey = topic.title.split(' ')[0].toLowerCase();

        if (categoryKey === pathId) {
          pathCategory = topic.title.split(' ')[0];
          pathTitle = `${pathCategory} Learning Path`;

          items.push({
            id: `${session.id}-${topic.title}`,
            title: topic.title,
            videoTitle: session.video.title,
            videoThumbnail: session.video.thumbnailUrl,
            channel: session.video.channel,
            sessionId: session.id,
            topicId: topic.id,
            completed: topic.completed || false,
            skipped: topic.skipped || false,
            questionsTotal: topic.questions.length,
            questionsAnswered: topic.questions.filter(q => q.userAnswer).length,
          });
        }
      });
    });

    if (items.length === 0) return null;

    // Apply custom order if exists
    let orderedItems = items;
    if (customOrder.length > 0) {
      orderedItems = [...items].sort((a, b) => {
        const aIndex = customOrder.indexOf(a.id);
        const bIndex = customOrder.indexOf(b.id);
        // Items not in custom order go to the end
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }

    const totalItems = items.length;
    const completedItems = items.filter(i => i.completed).length;
    const skippedItems = items.filter(i => i.skipped).length;
    const progress = Math.round((completedItems / totalItems) * 100);

    return {
      id: pathId,
      title: pathTitle,
      category: pathCategory,
      items: orderedItems,
      totalItems,
      completedItems,
      skippedItems,
      progress,
      totalQuestions: items.reduce((acc, i) => acc + i.questionsTotal, 0),
      answeredQuestions: items.reduce((acc, i) => acc + i.questionsAnswered, 0),
    };
  }, [pathId, library.sessions, customOrder]);

  // Handle skipping a topic
  const handleSkipTopic = (sessionId: string, topicId: string, topicTitle: string) => {
    const session = library.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const updatedTopics = session.topics.map(topic =>
      topic.id === topicId ? { ...topic, skipped: true } : topic
    );

    updateSession(sessionId, { topics: updatedTopics });
    setToast({ message: `"${topicTitle}" marked as skipped`, type: 'info' });
  };

  // Handle unskipping a topic
  const handleUnskipTopic = (sessionId: string, topicId: string, topicTitle: string) => {
    const session = library.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const updatedTopics = session.topics.map(topic =>
      topic.id === topicId ? { ...topic, skipped: false } : topic
    );

    updateSession(sessionId, { topics: updatedTopics });
    setToast({ message: `"${topicTitle}" restored to path`, type: 'success' });
  };

  // Handle moving an item up
  const handleMoveUp = (_itemId: string, currentIndex: number) => {
    if (currentIndex === 0 || !pathData) return;
    const currentOrderIds = pathData.items.map(i => i.id);
    const newOrder = [...currentOrderIds];
    [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
    saveOrder(newOrder);
    setToast({ message: 'Item moved up', type: 'success' });
  };

  // Handle moving an item down
  const handleMoveDown = (_itemId: string, currentIndex: number) => {
    if (!pathData || currentIndex === pathData.items.length - 1) return;
    const currentOrderIds = pathData.items.map(i => i.id);
    const newOrder = [...currentOrderIds];
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
    saveOrder(newOrder);
    setToast({ message: 'Item moved down', type: 'success' });
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId || !pathData) return;

    const currentOrderIds = pathData.items.map(i => i.id);
    const draggedIndex = currentOrderIds.indexOf(draggedItem);
    const targetIndex = currentOrderIds.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...currentOrderIds];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    saveOrder(newOrder);
    setDraggedItem(null);
    setToast({ message: 'Order updated', type: 'success' });
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  useDocumentTitle(pathData?.title || 'Learning Path');

  if (!pathData) {
    return (
      <div className="space-y-8">
        <Card className="text-center py-12">
          <span className="material-icons text-6xl text-text/30 mb-4" aria-hidden="true">
            error_outline
          </span>
          <h1 className="font-heading text-2xl font-bold text-text mb-2">
            Learning Path Not Found
          </h1>
          <p className="text-text/70 mb-6">
            This learning path doesn't exist or you haven't studied any topics in this category yet.
          </p>
          <Button onClick={() => navigate('/learning-paths')}>
            View All Paths
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text/70" aria-label="Breadcrumb">
        <Link to="/learning-paths" className="hover:text-text transition-colors">
          Learning Paths
        </Link>
        <span className="material-icons text-xs" aria-hidden="true">chevron_right</span>
        <span className="text-text font-semibold">{pathData.category}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 text-sm font-bold bg-primary border-2 border-border">
              {pathData.category}
            </span>
            {pathData.progress === 100 ? (
              <span className="flex items-center gap-1 text-success font-semibold">
                <span className="material-icons text-base" aria-hidden="true">check_circle</span>
                Completed
              </span>
            ) : pathData.progress > 0 ? (
              <span className="flex items-center gap-1 text-primary font-semibold">
                <span className="material-icons text-base" aria-hidden="true">play_circle</span>
                In Progress
              </span>
            ) : (
              <span className="flex items-center gap-1 text-text/60 font-semibold">
                <span className="material-icons text-base" aria-hidden="true">pause_circle</span>
                Not Started
              </span>
            )}
          </div>
          <h1 className="font-heading text-3xl font-bold text-text">{pathData.title}</h1>
          <p className="font-body text-lg text-text/70 mt-1">
            {pathData.totalItems} topic{pathData.totalItems !== 1 ? 's' : ''} across your learning sessions
          </p>
        </div>
        <Button onClick={() => navigate('/')}>
          <span className="material-icons mr-2 text-base" aria-hidden="true">add</span>
          Add More Content
        </Button>
      </div>

      {/* Progress Overview */}
      <Card>
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold text-text">Progress Overview</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-surface border-2 border-border">
              <p className="font-heading text-3xl font-bold text-text">{pathData.progress}%</p>
              <p className="text-sm text-text/70">Complete</p>
            </div>
            <div className="text-center p-4 bg-surface border-2 border-border">
              <p className="font-heading text-3xl font-bold text-primary">
                {pathData.completedItems}/{pathData.totalItems}
              </p>
              <p className="text-sm text-text/70">Topics</p>
            </div>
            <div className="text-center p-4 bg-surface border-2 border-border">
              <p className="font-heading text-3xl font-bold text-secondary">
                {pathData.answeredQuestions}
              </p>
              <p className="text-sm text-text/70">Questions Answered</p>
            </div>
            <div className="text-center p-4 bg-surface border-2 border-border">
              <p className="font-heading text-3xl font-bold text-text">
                {Math.ceil(pathData.totalItems * 5)}
              </p>
              <p className="text-sm text-text/70">Est. Minutes</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text/70">Overall Progress</span>
              <span className="font-semibold text-text">{pathData.progress}%</span>
            </div>
            <ProgressBar value={pathData.progress} max={100} size="lg" />
          </div>
        </div>
      </Card>

      {/* Topics List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold text-text">Topics in This Path</h2>
          <button
            onClick={() => setIsReordering(!isReordering)}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm font-semibold border-2 border-border transition-all ${
              isReordering ? 'bg-primary shadow-brutal' : 'bg-surface hover:shadow-brutal'
            }`}
          >
            <span className="material-icons text-base" aria-hidden="true">
              {isReordering ? 'check' : 'swap_vert'}
            </span>
            {isReordering ? 'Done' : 'Reorder'}
          </button>
        </div>

        <div className="space-y-4">
          {pathData.items.map((item, index) => (
            <StaggeredItem key={item.id} index={index} baseDelay={50} staggerDelay={30}>
              <Card
                className={`transition-all hover:shadow-brutal ${
                  item.completed ? 'border-success/50 bg-success/5' :
                  item.skipped ? 'border-text/20 bg-text/5 opacity-60' : ''
                } ${draggedItem === item.id ? 'opacity-50 scale-95' : ''}`}
                draggable={isReordering}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, item.id)}
                onDragEnd={handleDragEnd}
              >
                <div className="flex items-start gap-4">
                  {/* Reorder Controls */}
                  {isReordering && (
                    <div className="flex flex-col items-center justify-center gap-1 py-2">
                      <button
                        onClick={() => handleMoveUp(item.id, index)}
                        disabled={index === 0}
                        className={`p-1 border border-border transition-colors ${
                          index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-primary/20'
                        }`}
                        aria-label="Move up"
                      >
                        <span className="material-icons text-sm" aria-hidden="true">keyboard_arrow_up</span>
                      </button>
                      <span className="material-icons text-text/40 cursor-grab" aria-hidden="true">drag_indicator</span>
                      <button
                        onClick={() => handleMoveDown(item.id, index)}
                        disabled={index === pathData.items.length - 1}
                        className={`p-1 border border-border transition-colors ${
                          index === pathData.items.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-primary/20'
                        }`}
                        aria-label="Move down"
                      >
                        <span className="material-icons text-sm" aria-hidden="true">keyboard_arrow_down</span>
                      </button>
                    </div>
                  )}

                  {/* Order Number */}
                  {!isReordering && (
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-text text-background font-bold text-sm">
                      {index + 1}
                    </div>
                  )}

                  {/* Thumbnail */}
                  <div
                    className="w-24 h-16 flex-shrink-0 bg-border/20 border-2 border-border overflow-hidden cursor-pointer"
                    onClick={() => !isReordering && navigate(`/session/${item.sessionId}/notes`)}
                  >
                    {item.videoThumbnail ? (
                      <img
                        src={item.videoThumbnail}
                        alt=""
                        className={`w-full h-full object-cover ${item.skipped ? 'grayscale' : ''}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-icons text-text/30" aria-hidden="true">videocam</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`flex-1 min-w-0 ${isReordering ? '' : 'cursor-pointer'}`}
                        onClick={() => !isReordering && navigate(`/session/${item.sessionId}/notes`)}
                      >
                        <h3 className={`font-heading font-bold truncate ${item.skipped ? 'text-text/50 line-through' : 'text-text'}`}>
                          {item.title}
                        </h3>
                        <p className="text-sm text-text/70 truncate mt-1">
                          From: {item.videoTitle}
                        </p>
                        <p className="text-xs text-text/50 mt-1">
                          {item.channel}
                        </p>
                      </div>

                      {/* Status and Skip Button */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        {item.skipped ? (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs font-bold bg-text/10 text-text/50 border border-border">
                            <span className="material-icons text-sm" aria-hidden="true">block</span>
                            Skipped
                          </span>
                        ) : item.completed ? (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs font-bold bg-success/20 text-success border border-success/30">
                            <span className="material-icons text-sm" aria-hidden="true">check</span>
                            Done
                          </span>
                        ) : item.questionsAnswered > 0 ? (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs font-bold bg-primary/20 text-primary border border-primary/30">
                            <span className="material-icons text-sm" aria-hidden="true">edit</span>
                            In Progress
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs font-bold bg-border/20 text-text/60 border border-border">
                            <span className="material-icons text-sm" aria-hidden="true">circle</span>
                            Pending
                          </span>
                        )}

                        {/* Skip/Unskip Button */}
                        {!item.completed && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.skipped) {
                                handleUnskipTopic(item.sessionId, item.topicId, item.title);
                              } else {
                                handleSkipTopic(item.sessionId, item.topicId, item.title);
                              }
                            }}
                            className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold border border-border transition-colors ${
                              item.skipped
                                ? 'bg-primary/10 hover:bg-primary/20 text-primary'
                                : 'bg-surface hover:bg-text/10 text-text/60'
                            }`}
                            aria-label={item.skipped ? `Restore ${item.title}` : `Skip ${item.title}`}
                          >
                            <span className="material-icons text-sm" aria-hidden="true">
                              {item.skipped ? 'undo' : 'skip_next'}
                            </span>
                            {item.skipped ? 'Restore' : 'Skip'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {!item.skipped && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-text/60 mb-1">
                          <span>{item.questionsAnswered}/{item.questionsTotal} questions</span>
                          <span>{Math.round((item.questionsAnswered / Math.max(item.questionsTotal, 1)) * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-border/20 border border-border overflow-hidden">
                          <div
                            className={`h-full transition-all ${item.completed ? 'bg-success' : 'bg-primary'}`}
                            style={{ width: `${(item.questionsAnswered / Math.max(item.questionsTotal, 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </StaggeredItem>
          ))}
        </div>
      </div>

      {/* Actions */}
      <Card className="bg-primary/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="font-heading font-bold text-text">Continue Learning</h3>
            <p className="text-sm text-text/70">
              {pathData.progress < 100
                ? `You have ${pathData.totalItems - pathData.completedItems - pathData.skippedItems} topics left to complete${pathData.skippedItems > 0 ? ` (${pathData.skippedItems} skipped)` : ''}`
                : 'Congratulations! You completed this learning path'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => navigate('/learning-paths')}>
              All Paths
            </Button>
            {pathData.progress < 100 && (
              <Button onClick={() => navigate('/')}>
                Find More Videos
              </Button>
            )}
          </div>
        </div>
      </Card>

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
