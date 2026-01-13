/**
 * LearningPaths Page
 * List and manage learning paths
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Toast from '../components/ui/Toast';
import LearningPathCard, { type LearningPathData } from '../components/ui/LearningPathCard';
import { StaggeredItem } from '../components/ui/StaggeredList';
import { useSessionStore } from '../stores/sessionStore';
import { useDocumentTitle } from '../hooks';
import { apiFetch } from '../services/api';

interface NewPathFormData {
  title: string;
  description: string;
  category: string;
}

interface AIRecommendation {
  order: number;
  title: string;
  searchQuery: string;
  channel: string;
  duration: string;
  reason: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface AILearningPath {
  pathTitle: string;
  pathDescription: string;
  estimatedDuration: string;
  recommendations: AIRecommendation[];
  milestones: { afterVideo: number; achievement: string }[];
}

export default function LearningPaths() {
  useDocumentTitle('Learning Paths');
  const navigate = useNavigate();
  const { library } = useSessionStore();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<NewPathFormData>({
    title: '',
    description: '',
    category: '',
  });
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPath, setAiPath] = useState<AILearningPath | null>(null);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);

  // Generate learning paths from session data
  const generateLearningPaths = (): LearningPathData[] => {
    const topicCategories: Record<string, {
      id: string;
      title: string;
      sessions: typeof library.sessions;
      totalTopics: number;
      completedTopics: number;
      category: string;
      thumbnail?: string;
    }> = {};

    library.sessions.forEach((session) => {
      session.topics.forEach((topic) => {
        // Use first word of topic as category
        const categoryKey = topic.title.split(' ')[0].toLowerCase();
        const categoryName = topic.title.split(' ')[0];

        if (!topicCategories[categoryKey]) {
          topicCategories[categoryKey] = {
            id: categoryKey,
            title: `${categoryName} Learning Path`,
            sessions: [],
            totalTopics: 0,
            completedTopics: 0,
            category: categoryName,
            thumbnail: session.video.thumbnailUrl,
          };
        }
        topicCategories[categoryKey].sessions.push(session);
        topicCategories[categoryKey].totalTopics += 1;
        if (topic.completed) {
          topicCategories[categoryKey].completedTopics += 1;
        }
      });
    });

    // Convert to learning path data
    return Object.values(topicCategories)
      .filter((cat) => cat.totalTopics >= 1) // Include all paths
      .sort((a, b) => {
        const aProgress = a.completedTopics / a.totalTopics;
        const bProgress = b.completedTopics / b.totalTopics;
        // Prioritize in-progress paths
        if (aProgress > 0 && aProgress < 1 && (bProgress === 0 || bProgress === 1)) return -1;
        if (bProgress > 0 && bProgress < 1 && (aProgress === 0 || aProgress === 1)) return 1;
        return b.totalTopics - a.totalTopics;
      })
      .map((cat) => {
        const progress = cat.completedTopics / cat.totalTopics;
        let status: 'active' | 'completed' | 'paused' = 'active';
        if (progress === 1) status = 'completed';
        else if (progress === 0) status = 'paused';

        return {
          id: cat.id,
          title: cat.title,
          description: `${cat.sessions.length} video${cat.sessions.length !== 1 ? 's' : ''} covering ${cat.category.toLowerCase()} topics`,
          totalItems: cat.totalTopics,
          completedItems: cat.completedTopics,
          estimatedTime: `${Math.ceil(cat.totalTopics * 5)} min`,
          status,
          category: cat.category,
          thumbnail: cat.thumbnail,
        };
      });
  };

  const allPaths = generateLearningPaths();

  // Filter paths
  const filteredPaths = filter === 'all'
    ? allPaths
    : allPaths.filter(path => path.status === filter);

  const handleCreatePath = async () => {
    if (!formData.title.trim()) {
      setToast({ message: 'Please enter a title for your learning path', type: 'error' });
      return;
    }

    setIsGenerating(true);
    setShowCreateModal(false);

    try {
      // Get existing videos user has watched
      const existingVideos = library.sessions.map(session => ({
        title: session.video.title,
        channel: session.video.channel,
      }));

      // Call AI to generate learning path
      const response = await apiFetch<AILearningPath>('/ai/generate-learning-path', {
        method: 'POST',
        body: JSON.stringify({
          goal: formData.title,
          topic: formData.category || formData.title,
          existingVideos,
          preferredDuration: 'medium',
        }),
      });

      setAiPath(response);
      setShowAIRecommendations(true);
      setToast({ message: 'AI generated your personalized learning path!', type: 'success' });
    } catch (error) {
      console.error('Failed to generate AI learning path:', error);
      // Fallback message
      setToast({
        message: 'Learning paths are generated from your session topics. Start learning videos on this topic to build your path!',
        type: 'info'
      });
    } finally {
      setIsGenerating(false);
      setFormData({ title: '', description: '', category: '' });
    }
  };

  const handlePathClick = (pathId: string) => {
    // Navigate to learning path detail page
    navigate(`/learning-paths/${pathId}`);
  };

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-bold text-text">Learning Paths</h1>
          <p className="font-body text-lg text-text/70">
            Your personalized learning journeys based on topics you've studied
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <span className="material-icons mr-2 text-base" aria-hidden="true">add</span>
          Create Path
        </Button>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <h2 className="font-heading text-xl font-bold text-text mb-4">Create Learning Path</h2>
            <p className="text-text/70 mb-6 text-sm">
              Learning paths are automatically generated from your session topics.
              Start a new path by learning videos on a specific topic.
            </p>

            <div className="space-y-4">
              <Input
                label="Path Title"
                placeholder="e.g., JavaScript Fundamentals"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
              <Input
                label="Description (optional)"
                placeholder="What will you learn?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <Input
                label="Category (optional)"
                placeholder="e.g., Programming"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreatePath} disabled={isGenerating} className="flex-1">
                {isGenerating ? (
                  <>
                    <span className="material-icons animate-spin mr-2 text-base" aria-hidden="true">autorenew</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="material-icons mr-2 text-base" aria-hidden="true">auto_awesome</span>
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* AI Recommendations Modal */}
      {showAIRecommendations && aiPath && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl my-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-icons text-primary" aria-hidden="true">auto_awesome</span>
                  <h2 className="font-heading text-xl font-bold text-text">AI-Generated Learning Path</h2>
                </div>
                <h3 className="font-heading text-lg text-text">{aiPath.pathTitle}</h3>
                <p className="text-text/70 text-sm mt-1">{aiPath.pathDescription}</p>
              </div>
              <button
                onClick={() => setShowAIRecommendations(false)}
                className="p-1 hover:bg-text/10 transition-colors"
                aria-label="Close"
              >
                <span className="material-icons" aria-hidden="true">close</span>
              </button>
            </div>

            <div className="flex items-center gap-4 mb-4 text-sm text-text/70">
              <span className="flex items-center gap-1">
                <span className="material-icons text-base" aria-hidden="true">schedule</span>
                {aiPath.estimatedDuration}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-icons text-base" aria-hidden="true">video_library</span>
                {aiPath.recommendations.length} videos
              </span>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {aiPath.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className={`p-3 border-2 border-border bg-surface hover:shadow-brutal transition-all cursor-pointer ${
                    rec.difficulty === 'beginner' ? 'border-l-success border-l-4' :
                    rec.difficulty === 'intermediate' ? 'border-l-primary border-l-4' :
                    'border-l-error border-l-4'
                  }`}
                  onClick={() => {
                    // Open YouTube search for this video
                    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(rec.searchQuery)}`, '_blank');
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold bg-text text-background px-2 py-0.5">
                          {rec.order}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 ${
                          rec.difficulty === 'beginner' ? 'bg-success/20 text-success' :
                          rec.difficulty === 'intermediate' ? 'bg-primary/20 text-text' :
                          'bg-error/20 text-error'
                        }`}>
                          {rec.difficulty}
                        </span>
                      </div>
                      <h4 className="font-heading font-bold text-text">{rec.title}</h4>
                      <p className="text-xs text-text/60 mt-1">{rec.channel} • {rec.duration}</p>
                      <p className="text-sm text-text/70 mt-2">{rec.reason}</p>
                    </div>
                    <span className="material-icons text-text/40" aria-hidden="true">open_in_new</span>
                  </div>
                </div>
              ))}
            </div>

            {aiPath.milestones.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-border">
                <h4 className="font-heading font-bold text-text mb-2 flex items-center gap-2">
                  <span className="material-icons text-primary" aria-hidden="true">flag</span>
                  Milestones
                </h4>
                <div className="space-y-2">
                  {aiPath.milestones.map((milestone, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary font-bold">After video {milestone.afterVideo}:</span>
                      <span className="text-text/70">{milestone.achievement}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowAIRecommendations(false)} className="flex-1">
                Close
              </Button>
              <Button
                onClick={() => {
                  // Open first video search
                  if (aiPath.recommendations[0]) {
                    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(aiPath.recommendations[0].searchQuery)}`, '_blank');
                  }
                  setShowAIRecommendations(false);
                }}
                className="flex-1"
              >
                <span className="material-icons mr-2 text-base" aria-hidden="true">play_arrow</span>
                Start Learning
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="text-center py-8 px-12">
            <span className="material-icons text-5xl text-primary animate-spin mb-4" aria-hidden="true">
              autorenew
            </span>
            <h3 className="font-heading text-xl font-bold text-text mb-2">Generating Your Path</h3>
            <p className="text-text/70">AI is creating a personalized learning path for you...</p>
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'completed', 'paused'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 border-3 border-border font-heading font-bold text-sm transition-all ${
              filter === status
                ? 'bg-primary shadow-[3px_3px_0_#000]'
                : 'bg-surface hover:shadow-[3px_3px_0_#000]'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-2 text-text/60">
                ({allPaths.filter(p => p.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center py-4">
          <p className="font-heading text-3xl font-bold text-text">{allPaths.length}</p>
          <p className="text-sm text-text/70">Total Paths</p>
        </Card>
        <Card className="text-center py-4">
          <p className="font-heading text-3xl font-bold text-primary">
            {allPaths.filter(p => p.status === 'active').length}
          </p>
          <p className="text-sm text-text/70">In Progress</p>
        </Card>
        <Card className="text-center py-4">
          <p className="font-heading text-3xl font-bold text-success">
            {allPaths.filter(p => p.status === 'completed').length}
          </p>
          <p className="text-sm text-text/70">Completed</p>
        </Card>
        <Card className="text-center py-4">
          <p className="font-heading text-3xl font-bold text-text">
            {allPaths.reduce((acc, p) => acc + p.totalItems, 0)}
          </p>
          <p className="text-sm text-text/70">Total Topics</p>
        </Card>
      </div>

      {/* Learning Paths Grid */}
      {filteredPaths.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPaths.map((path, index) => (
            <StaggeredItem key={path.id} index={index} baseDelay={50} staggerDelay={50}>
              <LearningPathCard
                learningPath={path}
                onClick={() => handlePathClick(path.id)}
              />
            </StaggeredItem>
          ))}
        </div>
      ) : library.sessions.length === 0 ? (
        <Card className="text-center py-12">
          <div className="space-y-4">
            <span className="material-icons text-6xl text-text/30" aria-hidden="true">
              route
            </span>
            <h3 className="font-heading text-xl font-bold text-text">
              No Learning Paths Yet
            </h3>
            <p className="text-text/70 max-w-md mx-auto">
              Learning paths are automatically created from the topics you study.
              Start watching videos and answering questions to build your first path!
            </p>
            <Button onClick={() => navigate('/')}>
              Start Learning
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="text-center py-8">
          <p className="text-text/70">
            No {filter} paths found. Try changing your filter.
          </p>
        </Card>
      )}

      {/* Tips Section */}
      <Card className="bg-secondary/10">
        <div className="flex items-start gap-4">
          <span className="material-icons text-secondary text-2xl flex-shrink-0" aria-hidden="true">
            lightbulb
          </span>
          <div>
            <h3 className="font-heading font-bold text-text mb-2">How Learning Paths Work</h3>
            <ul className="space-y-2 text-sm text-text/70">
              <li className="flex items-start gap-2">
                <span className="material-icons text-xs mt-1" aria-hidden="true">check</span>
                Paths are automatically generated from topics in your sessions
              </li>
              <li className="flex items-start gap-2">
                <span className="material-icons text-xs mt-1" aria-hidden="true">check</span>
                Watch more videos on a topic to expand your learning path
              </li>
              <li className="flex items-start gap-2">
                <span className="material-icons text-xs mt-1" aria-hidden="true">check</span>
                Complete questions to track your progress in each path
              </li>
              <li className="flex items-start gap-2">
                <span className="material-icons text-xs mt-1" aria-hidden="true">check</span>
                Click on a path to see related videos in your library
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
