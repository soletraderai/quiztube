import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Card from '../components/ui/Card';
import Toast from '../components/ui/Toast';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import type { TutorPersonality } from '../types';

interface LearningModelData {
  hasData: boolean;
  message?: string;
  optimalTime?: string;
  avgSessionDuration?: number;
  difficultySweetSpot?: number | null;
  preferredPacing?: string | null;
  preferredDevice?: string | null;
  sessionsAnalyzed?: number;
  confidenceScore?: number;
  patterns?: Array<{
    id: string;
    patternType: string;
    patternData: Record<string, unknown>;
    createdAt: string;
  }>;
  signals?: {
    timeOfDay: boolean;
    sessionDuration: boolean;
    difficulty: boolean;
    pacing: boolean;
    device: boolean;
  };
}

const API_BASE = 'http://localhost:3001/api';

// Signal Toggle Component
interface SignalToggleProps {
  label: string;
  description: string;
  signal: string;
  enabled: boolean;
  onToggle: (signal: string, enabled: boolean) => void;
}

function SignalToggle({ label, description, signal, enabled, onToggle }: SignalToggleProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-background border border-border/50">
      <div>
        <p className="font-heading font-semibold text-text text-sm">{label}</p>
        <p className="text-xs text-text/60">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onToggle(signal, !enabled)}
        className={`relative w-12 h-6 rounded-none border-2 border-border transition-colors ${
          enabled ? 'bg-primary' : 'bg-surface'
        }`}
        role="switch"
        aria-checked={enabled}
        aria-label={`Toggle ${label}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-text transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

const tutorPersonalityOptions: {
  value: TutorPersonality;
  label: string;
  description: string;
  preview: string;
  proOnly: boolean;
}[] = [
  {
    value: 'PROFESSOR',
    label: 'The Professor',
    description: 'Academic and thorough explanations with context and theory',
    preview: '"Let me explain this concept in depth. First, consider the underlying principles..."',
    proOnly: true,
  },
  {
    value: 'COACH',
    label: 'The Coach',
    description: 'Encouraging and supportive, celebrates progress',
    preview: '"Great effort! You\'re on the right track. Let\'s build on what you\'ve learned..."',
    proOnly: false,
  },
  {
    value: 'DIRECT',
    label: 'The Direct',
    description: 'Concise and to-the-point, no fluff',
    preview: '"Correct. Key point: X does Y. Next topic."',
    proOnly: true,
  },
  {
    value: 'CREATIVE',
    label: 'The Creative',
    description: 'Uses analogies, stories, and creative examples',
    preview: '"Think of it like cooking a recipe - each ingredient (concept) builds on the last..."',
    proOnly: true,
  },
];

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
];

const learningStyleOptions = [
  { value: 'visual', label: 'Visual', description: 'Learn best with diagrams, charts, and videos' },
  { value: 'reading', label: 'Reading/Writing', description: 'Prefer text-based learning and note-taking' },
  { value: 'auditory', label: 'Auditory', description: 'Learn best by listening and discussion' },
  { value: 'kinesthetic', label: 'Hands-on', description: 'Learn by doing and practical examples' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { settings, setSettings } = useSettingsStore();
  const { user, isAuthenticated } = useAuthStore();

  // Check if user has Pro tier
  const isPro = isAuthenticated() && user?.tier === 'PRO';

  const [formData, setFormData] = useState({
    userName: settings.userName,
    geminiApiKey: settings.geminiApiKey,
    language: settings.language,
    tutorPersonality: settings.tutorPersonality || 'PROFESSOR',
    learningStyle: settings.learningStyle || 'visual',
    displayName: user?.name || settings.userName || '',
    avatarUrl: user?.avatarUrl || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [learningModel, setLearningModel] = useState<LearningModelData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingModel, setResettingModel] = useState(false);

  // Fetch learning model data
  useEffect(() => {
    const fetchLearningModel = async () => {
      if (!isAuthenticated()) return;

      setLoadingInsights(true);
      try {
        const { accessToken } = useAuthStore.getState();
        const response = await fetch(`${API_BASE}/learning-model`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setLearningModel(data);
        }
      } catch (err) {
        console.error('Failed to fetch learning model:', err);
      } finally {
        setLoadingInsights(false);
      }
    };

    fetchLearningModel();
  }, [isAuthenticated]);

  // Handle signal toggle
  const handleSignalToggle = async (signal: string, enabled: boolean) => {
    try {
      const { accessToken } = useAuthStore.getState();
      const response = await fetch(`${API_BASE}/learning-model/signals`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ signal, enabled }),
      });

      if (response.ok) {
        // Update local state
        setLearningModel((prev) => {
          if (!prev || !prev.signals) return prev;
          return {
            ...prev,
            signals: {
              ...prev.signals,
              [signal]: enabled,
            },
          };
        });
        setToast({ message: `${enabled ? 'Enabled' : 'Disabled'} ${signal} tracking`, type: 'success' });
      } else {
        setToast({ message: 'Failed to update signal setting', type: 'error' });
      }
    } catch (err) {
      console.error('Failed to toggle signal:', err);
      setToast({ message: 'Failed to update signal setting', type: 'error' });
    }
  };

  // Handle reset learning model
  const handleResetModel = async () => {
    setResettingModel(true);
    try {
      const { accessToken } = useAuthStore.getState();
      const response = await fetch(`${API_BASE}/learning-model`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        setLearningModel({ hasData: false, message: 'No learning data yet. Complete more sessions to build your profile.' });
        setShowResetConfirm(false);
        setToast({ message: 'Learning model has been reset', type: 'success' });
      } else {
        setToast({ message: 'Failed to reset learning model', type: 'error' });
      }
    } catch (err) {
      console.error('Failed to reset model:', err);
      setToast({ message: 'Failed to reset learning model', type: 'error' });
    } finally {
      setResettingModel(false);
    }
  };

  // Track if form has unsaved changes
  useEffect(() => {
    const hasChanges =
      formData.userName !== settings.userName ||
      formData.geminiApiKey !== settings.geminiApiKey ||
      formData.language !== settings.language ||
      formData.tutorPersonality !== (settings.tutorPersonality || 'PROFESSOR');
    setIsDirty(hasChanges);
  }, [formData, settings]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Username validation
    const trimmedName = formData.userName.trim();
    if (!trimmedName) {
      newErrors.userName = 'Username is required';
    } else if (trimmedName.length > 50) {
      newErrors.userName = 'Username must be 50 characters or less';
    }

    // API Key validation
    const trimmedKey = formData.geminiApiKey.trim();
    if (!trimmedKey) {
      newErrors.geminiApiKey = 'API key is required';
    } else if (trimmedKey.length < 10) {
      newErrors.geminiApiKey = 'API key seems too short';
    }

    // Language validation
    if (!formData.language) {
      newErrors.language = 'Please select a language';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation first
    if (!validateForm()) {
      setToast({ message: 'Please fix the errors above', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      // Server-side validation fallback
      const validationResponse = await fetch('http://localhost:3001/api/validate/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: formData.userName,
          geminiApiKey: formData.geminiApiKey,
          language: formData.language,
        }),
      });

      const validationResult = await validationResponse.json();

      if (!validationResponse.ok) {
        // Server returned validation errors
        if (validationResult.errors) {
          setErrors(validationResult.errors);
          setToast({ message: 'Server validation failed. Please fix the errors above.', type: 'error' });
          return;
        }
        throw new Error(validationResult.error || 'Server validation failed');
      }

      // Save settings after server validation passes
      setSettings({
        userName: formData.userName.trim(),
        geminiApiKey: formData.geminiApiKey.trim(),
        language: formData.language,
        tutorPersonality: formData.tutorPersonality as TutorPersonality,
      });

      setToast({ message: 'Settings saved successfully!', type: 'success' });
      setIsDirty(false);
    } catch (err) {
      // If server is unavailable, fall back to client validation (which already passed)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        // Network error - server unavailable, proceed with client-only validation
        setSettings({
          userName: formData.userName.trim(),
          geminiApiKey: formData.geminiApiKey.trim(),
          language: formData.language,
          tutorPersonality: formData.tutorPersonality as TutorPersonality,
        });
        setToast({ message: 'Settings saved successfully!', type: 'success' });
        setIsDirty(false);
      } else {
        setToast({ message: err instanceof Error ? err.message : 'Failed to save settings', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setToast({ message: 'Please select an image file', type: 'error' });
        return;
      }
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setToast({ message: 'Image must be less than 2MB', type: 'error' });
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setFormData((prev) => ({ ...prev, avatarUrl: reader.result as string }));
        setIsDirty(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border-3 border-border shadow-brutal max-w-md w-full p-6">
            <h3 className="font-heading text-xl font-bold text-text mb-3">
              Reset Learning Model?
            </h3>
            <p className="text-text/70 mb-6">
              Are you sure you want to reset your learning model? This will delete all your learning patterns and insights. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={handleResetModel}
                loading={resettingModel}
                disabled={resettingModel}
                className="flex-1"
              >
                Yes, Reset Model
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowResetConfirm(false)}
                disabled={resettingModel}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <h1 className="font-heading text-3xl font-bold text-text mb-6">
        Settings
      </h1>

      {/* Profile Section */}
      <Card className="mb-6">
        <h2 className="font-heading text-xl font-bold text-text mb-4">Profile</h2>
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {avatarPreview || formData.avatarUrl ? (
                <img
                  src={avatarPreview || formData.avatarUrl}
                  alt="Profile avatar"
                  className="w-24 h-24 rounded-full border-3 border-border object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-3 border-border bg-primary flex items-center justify-center">
                  <span className="font-heading text-2xl font-bold text-text">
                    {getInitials(formData.displayName || formData.userName || 'U')}
                  </span>
                </div>
              )}
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary border-2 border-border rounded-full flex items-center justify-center cursor-pointer hover:shadow-brutal transition-shadow"
              >
                <svg className="w-4 h-4 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </label>
            </div>
            <p className="text-xs text-text/60">Click to change avatar</p>
          </div>

          {/* Display Name */}
          <div className="flex-1">
            <Input
              label="Display Name"
              type="text"
              placeholder="Enter your display name"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              helperText="This is how you'll appear across the app"
            />
            <p className="mt-2 text-sm text-text/60">
              Email: {user?.email || 'Not available'}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Name */}
          <Input
            label="Your Name"
            type="text"
            placeholder="Enter your name"
            value={formData.userName}
            onChange={(e) => handleInputChange('userName', e.target.value)}
            error={errors.userName}
            required
            maxLength={50}
          />

          {/* API Key */}
          <Input
            label="Gemini API Key"
            type="password"
            placeholder="Enter your Gemini API key"
            value={formData.geminiApiKey}
            onChange={(e) => handleInputChange('geminiApiKey', e.target.value)}
            error={errors.geminiApiKey}
            required
            helperText={
              <span>
                Get your API key from{' '}
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary underline hover:no-underline"
                >
                  Google AI Studio
                </a>
              </span>
            }
          />

          {/* Language */}
          <Select
            label="Language"
            options={languageOptions}
            value={formData.language}
            onChange={(e) => handleInputChange('language', e.target.value)}
            error={errors.language}
            required
          />

          {/* Learning Preferences Section */}
          <div className="pt-4 border-t-2 border-border/30">
            <h3 className="font-heading text-lg font-bold text-text mb-4">Learning Preferences</h3>

            {/* Learning Style */}
            <div className="space-y-3 mb-6">
              <label className="block font-heading font-semibold text-text">
                Learning Style
              </label>
              <p className="text-sm text-text/70">
                How do you prefer to learn new concepts?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {learningStyleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleInputChange('learningStyle', option.value)}
                    className={`p-4 text-left border-3 border-border transition-all ${
                      formData.learningStyle === option.value
                        ? 'bg-primary shadow-brutal'
                        : 'bg-surface hover:bg-primary/30 hover:shadow-brutal-sm'
                    }`}
                  >
                    <span className="font-heading font-bold text-text block">{option.label}</span>
                    <span className="text-sm text-text/70">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tutor Personality */}
          <div className="space-y-3">
            <label className="block font-heading font-semibold text-text">
              Tutor Personality
            </label>
            <p className="text-sm text-text/70">
              Choose how your AI tutor communicates with you
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {tutorPersonalityOptions.map((option) => {
                const isLocked = option.proOnly && !isPro;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !isLocked && handleInputChange('tutorPersonality', option.value)}
                    disabled={isLocked}
                    className={`p-4 text-left border-3 border-border transition-all relative ${
                      isLocked
                        ? 'bg-surface/50 opacity-60 cursor-not-allowed'
                        : formData.tutorPersonality === option.value
                        ? 'bg-primary shadow-brutal'
                        : 'bg-surface hover:bg-primary/30 hover:shadow-brutal-sm'
                    }`}
                  >
                    {/* PRO Badge */}
                    {isLocked && (
                      <span className="absolute top-2 right-2 bg-secondary text-text text-xs font-heading font-bold px-2 py-0.5 border border-border">
                        PRO
                      </span>
                    )}
                    <div className="font-heading font-bold text-text mb-1">
                      {option.label}
                    </div>
                    <div className="text-sm text-text/70 mb-2">
                      {option.description}
                    </div>
                    <div className="text-xs text-text/60 italic font-mono bg-background/50 p-2 border border-border/30">
                      {option.preview}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button
              type="submit"
              size="lg"
              className="flex-1"
              loading={loading}
              disabled={loading}
            >
              Save Settings
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="flex-1"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      {/* API Key Info */}
      <Card className="mt-6 bg-secondary/10">
        <h2 className="font-heading text-lg font-bold text-text mb-2">
          About your API Key
        </h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-text/80">
          <li>Your API key is stored locally in your browser</li>
          <li>It is never sent to any server except Google's Gemini API</li>
          <li>You can get a free API key from Google AI Studio</li>
          <li>Clear your browser data to remove stored settings</li>
        </ul>
      </Card>

      {/* Learning Insights */}
      {isAuthenticated() && (
        <Card className="mt-6">
          <h2 className="font-heading text-xl font-bold text-text mb-4">
            Learning Insights
          </h2>

          {loadingInsights ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
            </div>
          ) : learningModel?.hasData ? (
            <div className="space-y-6">
              {/* Best Learning Time */}
              {learningModel.optimalTime && (
                <div className="bg-primary/10 p-4 border-3 border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-5 h-5 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-heading font-bold text-text">Best Learning Time</p>
                      <p className="text-text/70 capitalize">
                        You learn best in the <strong>{learningModel.optimalTime}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Average Session Duration */}
              {learningModel.avgSessionDuration && learningModel.avgSessionDuration > 0 && (
                <div className="bg-surface p-4 border-3 border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <svg className="w-5 h-5 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-heading font-bold text-text">Average Session Duration</p>
                      <p className="text-text/70">
                        <strong>{Math.round(learningModel.avgSessionDuration / 60)}</strong> minutes per session
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sessions Analyzed */}
              <div className="bg-surface p-4 border-3 border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-heading font-bold text-text">Sessions Analyzed</p>
                    <p className="text-text/70">
                      <strong>{learningModel.sessionsAnalyzed}</strong> session{learningModel.sessionsAnalyzed !== 1 ? 's' : ''} analyzed
                    </p>
                  </div>
                </div>
              </div>

              {/* Confidence Score */}
              {learningModel.confidenceScore !== undefined && (
                <div className="bg-surface p-4 border-3 border-border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-heading font-bold text-text">Model Confidence</p>
                    <p className="text-sm text-text/70">{Math.round(learningModel.confidenceScore * 100)}%</p>
                  </div>
                  <div className="w-full bg-background border-2 border-border h-4">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(learningModel.confidenceScore * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-text/50 mt-2">
                    Complete more sessions to improve model accuracy
                  </p>
                </div>
              )}

              {/* Recent Patterns */}
              {learningModel.patterns && learningModel.patterns.length > 0 && (
                <div>
                  <p className="font-heading font-semibold text-text mb-2">Recent Learning Patterns</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {learningModel.patterns.slice(0, 5).map((pattern) => (
                      <div key={pattern.id} className="text-sm bg-background p-2 border border-border/50">
                        <span className="text-text/70">
                          Session at <strong className="text-text">{(pattern.patternData.timeOfDay as string) || 'unknown time'}</strong>
                          {pattern.patternData.questionsAnswered && (
                            <> - {pattern.patternData.questionsCorrect as number}/{pattern.patternData.questionsAnswered as number} correct</>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signal Toggles */}
              {learningModel.signals && (
                <div className="border-t-3 border-border pt-6">
                  <p className="font-heading font-semibold text-text mb-2">Data Collection Settings</p>
                  <p className="text-sm text-text/60 mb-4">Choose which signals the learning model uses to personalize your experience.</p>
                  <div className="space-y-3">
                    <SignalToggle
                      label="Time of Day"
                      description="Track when you learn best"
                      signal="timeOfDay"
                      enabled={learningModel.signals.timeOfDay}
                      onToggle={handleSignalToggle}
                    />
                    <SignalToggle
                      label="Session Duration"
                      description="Track your preferred session length"
                      signal="sessionDuration"
                      enabled={learningModel.signals.sessionDuration}
                      onToggle={handleSignalToggle}
                    />
                    <SignalToggle
                      label="Difficulty"
                      description="Track your preferred difficulty level"
                      signal="difficulty"
                      enabled={learningModel.signals.difficulty}
                      onToggle={handleSignalToggle}
                    />
                    <SignalToggle
                      label="Pacing"
                      description="Track your learning pace preferences"
                      signal="pacing"
                      enabled={learningModel.signals.pacing}
                      onToggle={handleSignalToggle}
                    />
                    <SignalToggle
                      label="Device"
                      description="Track device-specific patterns"
                      signal="device"
                      enabled={learningModel.signals.device}
                      onToggle={handleSignalToggle}
                    />
                  </div>
                </div>
              )}

              {/* Reset Model Section */}
              <div className="border-t-3 border-border pt-6">
                <p className="font-heading font-semibold text-text mb-2">Reset Learning Model</p>
                <p className="text-sm text-text/60 mb-4">
                  This will permanently delete all your learning data and patterns. This action cannot be undone.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={resettingModel}
                >
                  Reset Model
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-text/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-text/70">
                {learningModel?.message || 'No learning data yet. Complete more sessions to build your profile.'}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
