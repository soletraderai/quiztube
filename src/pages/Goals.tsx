import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Toast from '../components/ui/Toast';
import ProgressBar from '../components/ui/ProgressBar';
import { GoalCardSkeleton } from '../components/ui/Skeleton';
import { StaggeredItem } from '../components/ui/StaggeredList';
import CompletionCheckmark from '../components/ui/CompletionCheckmark';
import Tooltip from '../components/ui/Tooltip';
import { useAuthStore } from '../stores/authStore';

interface Goal {
  id: string;
  title: string;
  goalType: 'TIME' | 'TOPIC' | 'OUTCOME';
  targetValue: number | null;
  currentValue: number;
  targetUnit: string | null;
  deadline: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  completedAt: string | null;
  createdAt: string;
  milestones: Milestone[];
}

interface GoalSuggestion {
  id: string;
  type: 'TIME' | 'TOPIC' | 'OUTCOME';
  title: string;
  description: string;
  targetValue?: number;
  targetUnit?: string;
  reason: string;
}

interface Milestone {
  id: string;
  milestonePercentage: number;
  reachedAt: string | null;
}

interface WizardData {
  goalType: 'TIME' | 'TOPIC' | 'OUTCOME' | null;
  title: string;
  targetValue: number | null;
  targetUnit: string;
  deadline: string;
}

const API_BASE = 'http://localhost:3001/api';

const GOAL_TYPE_INFO = {
  TIME: {
    name: 'Time Goal',
    description: 'Set a target amount of learning time',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    units: ['hours', 'minutes'],
    defaultUnit: 'hours',
  },
  TOPIC: {
    name: 'Topic Goal',
    description: 'Complete a specific number of topics',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    units: ['topics'],
    defaultUnit: 'topics',
  },
  OUTCOME: {
    name: 'Outcome Goal',
    description: 'Achieve a specific learning outcome',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    units: ['sessions', 'mastered topics'],
    defaultUnit: 'sessions',
  },
};

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    goalType: null,
    title: '',
    targetValue: null,
    targetUnit: '',
    deadline: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'ABANDONED'>('ACTIVE');
  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editData, setEditData] = useState<{ targetValue: number | null; deadline: string }>({
    targetValue: null,
    deadline: '',
  });
  const [showCompletionCheckmark, setShowCompletionCheckmark] = useState(false);

  const navigate = useNavigate();
  const { accessToken, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (user?.tier !== 'PRO') {
      navigate('/pricing');
      return;
    }
    fetchGoals();
    fetchSuggestions();
  }, [accessToken, isAuthenticated, user, navigate, statusFilter]);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/goals?status=${statusFilter}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to fetch goals');
      }

      const data = await response.json();
      setGoals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals');
      setToast({ message: 'Failed to load goals', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      setLoadingSuggestions(true);

      const response = await fetch(`${API_BASE}/goals/suggestions`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleUseSuggestion = (suggestion: GoalSuggestion) => {
    setWizardData({
      goalType: suggestion.type,
      title: suggestion.title,
      targetValue: suggestion.targetValue || null,
      targetUnit: suggestion.targetUnit || GOAL_TYPE_INFO[suggestion.type].defaultUnit,
      deadline: '',
    });
    setWizardStep(3); // Skip to deadline step since we have the basics
    setShowWizard(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setEditData({
      targetValue: goal.targetValue,
      deadline: goal.deadline ? goal.deadline.split('T')[0] : '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingGoal) return;

    try {
      setSubmitting(true);

      const response = await fetch(`${API_BASE}/goals/${editingGoal.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...(editData.targetValue !== null && { targetValue: editData.targetValue }),
          deadline: editData.deadline || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update goal');
      }

      setToast({ message: 'Goal updated successfully!', type: 'success' });
      setEditingGoal(null);
      fetchGoals();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to update goal',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGoal = async () => {
    if (!wizardData.goalType || !wizardData.title.trim()) {
      setToast({ message: 'Please fill in all required fields', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`${API_BASE}/goals`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: wizardData.title,
          goalType: wizardData.goalType,
          ...(wizardData.targetValue !== null && { targetValue: wizardData.targetValue }),
          ...(wizardData.targetUnit && { targetUnit: wizardData.targetUnit }),
          ...(wizardData.deadline && { deadline: wizardData.deadline }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create goal');
      }

      setToast({ message: 'Goal created successfully!', type: 'success' });
      setShowWizard(false);
      resetWizard();
      fetchGoals();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to create goal',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setWizardData({
      goalType: null,
      title: '',
      targetValue: null,
      targetUnit: '',
      deadline: '',
    });
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      const response = await fetch(`${API_BASE}/goals/${goalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete goal');
      }

      setToast({ message: 'Goal deleted', type: 'success' });
      fetchGoals();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to delete goal',
        type: 'error',
      });
    }
  };

  const handleMarkComplete = async (goalId: string) => {
    if (!confirm('Mark this goal as completed?')) return;

    try {
      const response = await fetch(`${API_BASE}/goals/${goalId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to complete goal');
      }

      // Show completion checkmark animation
      setShowCompletionCheckmark(true);
      // Delay the toast and refresh until after animation
      setTimeout(() => {
        setToast({ message: 'Goal completed! Great job!', type: 'success' });
        fetchGoals();
      }, 1000);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to complete goal',
        type: 'error',
      });
    }
  };

  const calculateProgress = (goal: Goal): number => {
    if (!goal.targetValue) return 0;
    return Math.min((goal.currentValue / goal.targetValue) * 100, 100);
  };

  const renderWizardStep = () => {
    switch (wizardStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="font-heading text-2xl font-bold text-text">Choose Goal Type</h3>
              <p className="text-text/70">What kind of goal would you like to set?</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(Object.keys(GOAL_TYPE_INFO) as Array<keyof typeof GOAL_TYPE_INFO>).map((type) => {
                const info = GOAL_TYPE_INFO[type];
                const isSelected = wizardData.goalType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setWizardData({ ...wizardData, goalType: type, targetUnit: info.defaultUnit })}
                    className={`p-6 border-3 border-border rounded-none transition-all text-left ${
                      isSelected
                        ? 'bg-primary shadow-[4px_4px_0_#000]'
                        : 'bg-surface hover:shadow-[4px_4px_0_#000]'
                    }`}
                  >
                    <div className={`mb-4 ${isSelected ? 'text-text' : 'text-text/70'}`}>
                      {info.icon}
                    </div>
                    <h4 className="font-heading font-bold text-text mb-1">{info.name}</h4>
                    <p className="text-sm text-text/70">{info.description}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowWizard(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setWizardStep(2)}
                disabled={!wizardData.goalType}
              >
                Next
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="font-heading text-2xl font-bold text-text">Define Your Goal</h3>
              <p className="text-text/70">Give your goal a name and target</p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <Input
                label="Goal Title"
                placeholder="e.g., Learn React fundamentals"
                value={wizardData.title}
                onChange={(e) => setWizardData({ ...wizardData, title: e.target.value })}
                required
              />
              {wizardData.goalType !== 'OUTCOME' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Target"
                    type="number"
                    placeholder="10"
                    value={wizardData.targetValue?.toString() || ''}
                    onChange={(e) => setWizardData({ ...wizardData, targetValue: parseInt(e.target.value) || null })}
                  />
                  <div>
                    <label className="block text-sm font-semibold text-text mb-2">Unit</label>
                    <select
                      value={wizardData.targetUnit}
                      onChange={(e) => setWizardData({ ...wizardData, targetUnit: e.target.value })}
                      className="w-full px-4 py-3 border-3 border-border bg-surface font-body text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {wizardData.goalType && GOAL_TYPE_INFO[wizardData.goalType].units.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between gap-3">
              <Button variant="secondary" onClick={() => setWizardStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => setWizardStep(3)}
                disabled={!wizardData.title.trim()}
              >
                Next
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="font-heading text-2xl font-bold text-text">Set a Deadline (Optional)</h3>
              <p className="text-text/70">When would you like to achieve this goal?</p>
            </div>
            <div className="max-w-md mx-auto">
              <Input
                label="Deadline"
                type="date"
                value={wizardData.deadline}
                onChange={(e) => setWizardData({ ...wizardData, deadline: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex justify-between gap-3">
              <Button variant="secondary" onClick={() => setWizardStep(2)}>
                Back
              </Button>
              <Button
                onClick={() => setWizardStep(4)}
              >
                Review
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="font-heading text-2xl font-bold text-text">Review Your Goal</h3>
              <p className="text-text/70">Make sure everything looks correct</p>
            </div>
            <Card className="max-w-md mx-auto bg-primary/10">
              <div className="space-y-4">
                <div>
                  <span className="text-sm text-text/60">Goal Type</span>
                  <p className="font-heading font-bold text-text">
                    {wizardData.goalType && GOAL_TYPE_INFO[wizardData.goalType].name}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-text/60">Title</span>
                  <p className="font-heading font-bold text-text">{wizardData.title}</p>
                </div>
                {wizardData.targetValue && (
                  <div>
                    <span className="text-sm text-text/60">Target</span>
                    <p className="font-heading font-bold text-text">
                      {wizardData.targetValue} {wizardData.targetUnit}
                    </p>
                  </div>
                )}
                {wizardData.deadline && (
                  <div>
                    <span className="text-sm text-text/60">Deadline</span>
                    <p className="font-heading font-bold text-text">
                      {new Date(wizardData.deadline).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </Card>
            <div className="flex justify-between gap-3">
              <Button variant="secondary" onClick={() => setWizardStep(3)}>
                Back
              </Button>
              <Button onClick={handleCreateGoal} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Goal'}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="font-heading text-4xl font-bold text-text">Your Goals</h1>
          <p className="font-body text-lg text-text/70">Loading your goals...</p>
        </div>

        {/* Skeleton loading screens */}
        <div className="space-y-4">
          <GoalCardSkeleton />
          <GoalCardSkeleton />
          <GoalCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Completion Checkmark Animation */}
      <CompletionCheckmark
        show={showCompletionCheckmark}
        onComplete={() => setShowCompletionCheckmark(false)}
        message="Goal Complete!"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-bold text-text">Your Goals</h1>
          <p className="font-body text-lg text-text/70">
            Track your learning progress with personal goals
          </p>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Goal
        </Button>
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-overlay">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto modal-content">
            {/* Wizard Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text/60">Step {wizardStep} of 4</span>
              </div>
              <ProgressBar current={wizardStep} total={4} showPercentage={false} showCount={false} />
            </div>
            {renderWizardStep()}
          </Card>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-overlay">
          <Card className="w-full max-w-md modal-content">
            <h3 className="font-heading text-xl font-bold text-text mb-4">Edit Goal</h3>
            <p className="text-text/70 mb-6">{editingGoal.title}</p>

            <div className="space-y-4">
              {editingGoal.goalType !== 'OUTCOME' && (
                <div>
                  <label className="block text-sm font-semibold text-text mb-2">
                    Target Value ({editingGoal.targetUnit})
                  </label>
                  <input
                    type="number"
                    value={editData.targetValue || ''}
                    onChange={(e) => setEditData({ ...editData, targetValue: parseInt(e.target.value) || null })}
                    className="w-full px-4 py-3 border-3 border-border bg-surface font-body text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter target value"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-text mb-2">Deadline</label>
                <input
                  type="date"
                  value={editData.deadline}
                  onChange={(e) => setEditData({ ...editData, deadline: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-3 border-border bg-surface font-body text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setEditingGoal(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Goal Suggestions */}
      {showSuggestions && suggestions.length > 0 && statusFilter === 'ACTIVE' && (
        <Card className="bg-secondary/20">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <svg className="w-5 h-5 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-heading font-bold text-text">Suggested Goals</h3>
                <p className="text-sm text-text/70">Based on your learning activity</p>
              </div>
            </div>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-text/40 hover:text-text transition-colors"
              aria-label="Hide suggestions"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((suggestion, index) => (
              <StaggeredItem key={suggestion.id} index={index} baseDelay={100} staggerDelay={75}>
              <div
                className="p-4 border-2 border-border bg-surface hover:shadow-brutal transition-all cursor-pointer h-full"
                onClick={() => handleUseSuggestion(suggestion)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 bg-primary/30 text-text uppercase">
                    {suggestion.type}
                  </span>
                </div>
                <h4 className="font-heading font-bold text-text mb-1">{suggestion.title}</h4>
                <p className="text-sm text-text/70 mb-2">{suggestion.description}</p>
                <p className="text-xs text-text/50 italic">{suggestion.reason}</p>
              </div>
              </StaggeredItem>
            ))}
          </div>
        </Card>
      )}

      {loadingSuggestions && statusFilter === 'ACTIVE' && (
        <Card className="bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
            <span className="text-text/70">Finding goal suggestions based on your activity...</span>
          </div>
        </Card>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['ACTIVE', 'COMPLETED', 'ABANDONED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 border-3 border-border font-heading font-bold text-sm transition-all ${
              statusFilter === status
                ? 'bg-primary shadow-[3px_3px_0_#000]'
                : 'bg-surface hover:shadow-[3px_3px_0_#000]'
            }`}
          >
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Goals List */}
      {error ? (
        <Card className="text-center py-8">
          <p className="text-error mb-4">{error}</p>
          <Button onClick={fetchGoals}>Try Again</Button>
        </Card>
      ) : goals.length === 0 ? (
        <Card className="text-center py-12">
          <div className="space-y-4">
            <svg
              className="w-16 h-16 mx-auto text-text/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            <h3 className="font-heading text-xl font-bold text-text">
              No {statusFilter.toLowerCase()} goals
            </h3>
            <p className="text-text/70 max-w-md mx-auto">
              {statusFilter === 'ACTIVE'
                ? 'Set your first learning goal to track your progress!'
                : `You don't have any ${statusFilter.toLowerCase()} goals yet.`}
            </p>
            {statusFilter === 'ACTIVE' && (
              <Button onClick={() => setShowWizard(true)}>Create Your First Goal</Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal, index) => (
            <StaggeredItem key={goal.id} index={index} baseDelay={100} staggerDelay={75}>
            <Card className="flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-text">
                    {GOAL_TYPE_INFO[goal.goalType]?.icon}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-text/60 uppercase">
                      {GOAL_TYPE_INFO[goal.goalType]?.name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {goal.status === 'ACTIVE' && (
                    <>
                      <Tooltip content="Mark as completed" position="top">
                        <button
                          onClick={() => handleMarkComplete(goal.id)}
                          className="text-text/40 hover:text-success transition-colors"
                          aria-label="Mark goal complete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      </Tooltip>
                      <Tooltip content="Edit goal" position="top">
                        <button
                          onClick={() => handleEditGoal(goal)}
                          className="text-text/40 hover:text-primary transition-colors"
                          aria-label="Edit goal"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip content="Delete goal" position="top">
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-text/40 hover:text-error transition-colors"
                      aria-label="Delete goal"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </Tooltip>
                </div>
              </div>

              <h3 className="font-heading font-bold text-lg text-text mb-2">{goal.title}</h3>

              {goal.targetValue && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text/70">Progress</span>
                    <span className="font-semibold text-text">
                      {goal.currentValue} / {goal.targetValue} {goal.targetUnit}
                    </span>
                  </div>
                  <ProgressBar current={goal.currentValue} total={goal.targetValue || 1} showPercentage={false} showCount={false} />
                </div>
              )}

              {/* Milestones */}
              <div className="flex gap-2 mb-4">
                {goal.milestones.map((milestone) => (
                  <Tooltip
                    key={milestone.id}
                    content={`${milestone.milestonePercentage}% ${milestone.reachedAt ? 'reached' : 'pending'}`}
                    position="bottom"
                  >
                    <div
                      className={`flex-1 h-2 border border-border cursor-help ${
                        milestone.reachedAt ? 'bg-success' : 'bg-surface'
                      }`}
                    />
                  </Tooltip>
                ))}
              </div>

              <div className="mt-auto pt-3 border-t-2 border-border/30 flex justify-between items-center text-sm">
                <span className="text-text/50">
                  Created {new Date(goal.createdAt).toLocaleDateString()}
                </span>
                {goal.deadline && (
                  <span className={`font-semibold ${
                    new Date(goal.deadline) < new Date() ? 'text-error' : 'text-text/70'
                  }`}>
                    Due {new Date(goal.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Card>
            </StaggeredItem>
          ))}
        </div>
      )}
    </div>
  );
}
