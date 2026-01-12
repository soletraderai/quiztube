import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { TutorPersonality } from '../types';

type OnboardingStep = 'welcome' | 'learning-style' | 'personality' | 'language-variant' | 'commitment' | 'complete';

type LanguageVariant = 'BRITISH' | 'AMERICAN' | 'AUSTRALIAN';

const commitmentLevels = [
  { minutes: 5, label: '5 minutes', description: 'Quick daily check-in' },
  { minutes: 15, label: '15 minutes', description: 'Focused learning session' },
  { minutes: 30, label: '30 minutes', description: 'Deep dive learning' },
  { minutes: 45, label: '45 minutes', description: 'Comprehensive study' },
];

const weekDays = [
  { id: 'Mon', label: 'M' },
  { id: 'Tue', label: 'T' },
  { id: 'Wed', label: 'W' },
  { id: 'Thu', label: 'T' },
  { id: 'Fri', label: 'F' },
  { id: 'Sat', label: 'S' },
  { id: 'Sun', label: 'S' },
];

const languageVariants: {
  id: LanguageVariant;
  label: string;
  description: string;
  example: string;
}[] = [
  {
    id: 'BRITISH',
    label: 'British English',
    description: 'UK spelling and expressions',
    example: '"Colour", "Behaviour", "Organisation"',
  },
  {
    id: 'AMERICAN',
    label: 'American English',
    description: 'US spelling and expressions',
    example: '"Color", "Behavior", "Organization"',
  },
  {
    id: 'AUSTRALIAN',
    label: 'Australian English',
    description: 'Australian spelling and expressions',
    example: '"Colour", "Behaviour", with local idioms',
  },
];

const learningStyles = [
  {
    id: 'visual',
    label: 'Visual',
    description: 'Learn best with diagrams, charts, and videos',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    id: 'reading',
    label: 'Reading/Writing',
    description: 'Prefer text-based learning and note-taking',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    id: 'auditory',
    label: 'Auditory',
    description: 'Learn best by listening and discussion',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    ),
  },
  {
    id: 'hands-on',
    label: 'Hands-on',
    description: 'Learn by doing and practical examples',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
      </svg>
    ),
  },
];

const tutorPersonalities: {
  id: TutorPersonality;
  label: string;
  description: string;
  preview: string;
}[] = [
  {
    id: 'COACH',
    label: 'The Coach',
    description: 'Encouraging and supportive, celebrates progress',
    preview: '"Great effort! You\'re on the right track. Let\'s build on what you\'ve learned..."',
  },
  {
    id: 'PROFESSOR',
    label: 'The Professor',
    description: 'Academic and thorough explanations with context',
    preview: '"Let me explain this concept in depth. First, consider the underlying principles..."',
  },
  {
    id: 'DIRECT',
    label: 'The Direct',
    description: 'Concise and to-the-point, no fluff',
    preview: '"Correct. Key point: X does Y. Next topic."',
  },
  {
    id: 'CREATIVE',
    label: 'The Creative',
    description: 'Uses analogies, stories, and creative examples',
    preview: '"Think of it like cooking a recipe - each ingredient builds on the last..."',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const { settings, setSettings } = useSettingsStore();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedStyle, setSelectedStyle] = useState(settings.learningStyle || 'visual');
  const [selectedPersonality, setSelectedPersonality] = useState<TutorPersonality>(
    settings.tutorPersonality || 'COACH'
  );
  const [selectedLanguageVariant, setSelectedLanguageVariant] = useState<LanguageVariant>('AMERICAN');
  const [selectedCommitment, setSelectedCommitment] = useState(15);
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Redirect if onboarding already completed
  useEffect(() => {
    if (user?.onboardingCompleted) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleContinue = () => {
    if (step === 'welcome') {
      setStep('learning-style');
    } else if (step === 'learning-style') {
      setSettings({ learningStyle: selectedStyle });
      setStep('personality');
    } else if (step === 'personality') {
      setSettings({ tutorPersonality: selectedPersonality });
      setStep('language-variant');
    } else if (step === 'language-variant') {
      setSettings({ languageVariant: selectedLanguageVariant });
      setStep('commitment');
    } else if (step === 'commitment') {
      setSettings({
        dailyCommitment: selectedCommitment,
        preferredTime: preferredTime,
        learningDays: selectedDays,
      });
      setStep('complete');
    }
  };

  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const handleComplete = async () => {
    try {
      const { accessToken } = useAuthStore.getState();
      const response = await fetch('http://localhost:3002/api/users/complete-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          learningStyle: selectedStyle,
          tutorPersonality: selectedPersonality,
          languageVariant: selectedLanguageVariant,
          dailyCommitmentMinutes: selectedCommitment,
          preferredTime: preferredTime,
          preferredDays: selectedDays,
        }),
      });

      if (response.ok) {
        // Update user state
        if (user) {
          setUser({ ...user, onboardingCompleted: true });
        }
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // Still navigate home even if API fails
      if (user) {
        setUser({ ...user, onboardingCompleted: true });
      }
      navigate('/');
    }
  };

  const handleSkip = () => {
    if (user) {
      setUser({ ...user, onboardingCompleted: true });
    }
    navigate('/');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            {['welcome', 'learning-style', 'personality', 'language-variant', 'commitment', 'complete'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-3 h-3 border-2 border-border ${
                    step === s ? 'bg-primary' : i < ['welcome', 'learning-style', 'personality', 'language-variant', 'commitment', 'complete'].indexOf(step) ? 'bg-secondary' : 'bg-surface'
                  }`}
                />
                {i < 5 && <div className="w-6 h-0.5 bg-border" />}
              </div>
            ))}
          </div>
        </div>

        {/* Welcome Step */}
        {step === 'welcome' && (
          <Card className="text-center p-8">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-primary border-3 border-border flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h1 className="font-heading text-3xl font-bold text-text mb-2">
                Welcome, {user.displayName}!
              </h1>
              <p className="text-text/70 text-lg">
                Let's personalize your learning experience to help you learn more effectively.
              </p>
            </div>

            <div className="space-y-4">
              <Button onClick={handleContinue} className="w-full">
                Continue
              </Button>
              <button
                onClick={handleSkip}
                className="text-text/60 hover:text-text transition-colors text-sm"
              >
                Skip for now
              </button>
            </div>
          </Card>
        )}

        {/* Learning Style Step */}
        {step === 'learning-style' && (
          <Card className="p-8">
            <div className="text-center mb-6">
              <h2 className="font-heading text-2xl font-bold text-text mb-2">
                How do you learn best?
              </h2>
              <p className="text-text/70">
                We'll tailor content and questions to match your preferred learning style.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {learningStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`p-4 border-3 border-border text-left transition-all ${
                    selectedStyle === style.id
                      ? 'bg-primary shadow-brutal'
                      : 'bg-surface hover:bg-primary/30'
                  }`}
                >
                  <div className="text-text mb-2">{style.icon}</div>
                  <h3 className="font-heading font-bold text-text">{style.label}</h3>
                  <p className="text-sm text-text/70">{style.description}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep('welcome')}>
                Back
              </Button>
              <Button onClick={handleContinue} className="flex-1">
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* Tutor Personality Step */}
        {step === 'personality' && (
          <Card className="p-8">
            <div className="text-center mb-6">
              <h2 className="font-heading text-2xl font-bold text-text mb-2">
                Choose your AI tutor style
              </h2>
              <p className="text-text/70">
                Select how you'd like your tutor to communicate with you.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {tutorPersonalities.map((personality) => (
                <button
                  key={personality.id}
                  onClick={() => setSelectedPersonality(personality.id)}
                  className={`w-full p-4 border-3 border-border text-left transition-all ${
                    selectedPersonality === personality.id
                      ? 'bg-primary shadow-brutal'
                      : 'bg-surface hover:bg-primary/30'
                  }`}
                >
                  <h3 className="font-heading font-bold text-text">{personality.label}</h3>
                  <p className="text-sm text-text/70 mb-2">{personality.description}</p>
                  <p className="text-xs text-text/50 italic">{personality.preview}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep('learning-style')}>
                Back
              </Button>
              <Button onClick={handleContinue} className="flex-1">
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* Language Variant Step */}
        {step === 'language-variant' && (
          <Card className="p-8">
            <div className="text-center mb-6">
              <h2 className="font-heading text-2xl font-bold text-text mb-2">
                Choose your language variant
              </h2>
              <p className="text-text/70">
                Select which English variant you prefer for spelling and expressions.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {languageVariants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedLanguageVariant(variant.id)}
                  className={`w-full p-4 border-3 border-border text-left transition-all ${
                    selectedLanguageVariant === variant.id
                      ? 'bg-primary shadow-brutal'
                      : 'bg-surface hover:bg-primary/30'
                  }`}
                >
                  <h3 className="font-heading font-bold text-text">{variant.label}</h3>
                  <p className="text-sm text-text/70 mb-2">{variant.description}</p>
                  <p className="text-xs text-text/50 italic">{variant.example}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep('personality')}>
                Back
              </Button>
              <Button onClick={handleContinue} className="flex-1">
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* Commitment Step */}
        {step === 'commitment' && (
          <Card className="p-8">
            <div className="text-center mb-6">
              <h2 className="font-heading text-2xl font-bold text-text mb-2">
                Set your daily commitment
              </h2>
              <p className="text-text/70">
                How much time can you dedicate to learning each day?
              </p>
            </div>

            {/* Commitment Level */}
            <div className="mb-6">
              <h3 className="font-heading font-bold text-text mb-3">Daily learning time</h3>
              <div className="grid grid-cols-2 gap-3">
                {commitmentLevels.map((level) => (
                  <button
                    key={level.minutes}
                    onClick={() => setSelectedCommitment(level.minutes)}
                    className={`p-3 border-3 border-border text-left transition-all ${
                      selectedCommitment === level.minutes
                        ? 'bg-primary shadow-brutal'
                        : 'bg-surface hover:bg-primary/30'
                    }`}
                  >
                    <span className="font-heading font-bold text-text">{level.label}</span>
                    <p className="text-xs text-text/60">{level.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Time */}
            <div className="mb-6">
              <h3 className="font-heading font-bold text-text mb-3">Preferred learning time</h3>
              <input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full p-3 border-3 border-border bg-surface text-text font-body focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Learning Days */}
            <div className="mb-8">
              <h3 className="font-heading font-bold text-text mb-3">Learning days</h3>
              <div className="flex justify-center gap-2">
                {weekDays.map((day, idx) => (
                  <button
                    key={day.id + idx}
                    onClick={() => toggleDay(day.id)}
                    className={`w-10 h-10 border-3 border-border font-bold transition-all ${
                      selectedDays.includes(day.id)
                        ? 'bg-primary shadow-brutal'
                        : 'bg-surface hover:bg-primary/30'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text/60 text-center mt-2">
                {selectedDays.length} days selected
              </p>
            </div>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep('language-variant')}>
                Back
              </Button>
              <Button onClick={handleContinue} className="flex-1">
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <Card className="text-center p-8">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-secondary border-3 border-border flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-heading text-2xl font-bold text-text mb-2">
                You're all set!
              </h2>
              <p className="text-text/70">
                Your learning experience has been personalized. You can always update these preferences in Settings.
              </p>
            </div>

            <div className="bg-surface border-3 border-border p-4 mb-6 text-left">
              <h3 className="font-heading font-bold text-text mb-2">Your preferences:</h3>
              <ul className="space-y-2 text-sm text-text/70">
                <li>
                  <strong>Learning Style:</strong>{' '}
                  {learningStyles.find((s) => s.id === selectedStyle)?.label}
                </li>
                <li>
                  <strong>Tutor:</strong>{' '}
                  {tutorPersonalities.find((p) => p.id === selectedPersonality)?.label}
                </li>
                <li>
                  <strong>Language:</strong>{' '}
                  {languageVariants.find((v) => v.id === selectedLanguageVariant)?.label}
                </li>
                <li>
                  <strong>Daily Commitment:</strong>{' '}
                  {commitmentLevels.find((c) => c.minutes === selectedCommitment)?.label}
                </li>
                <li>
                  <strong>Preferred Time:</strong> {preferredTime}
                </li>
                <li>
                  <strong>Learning Days:</strong> {selectedDays.join(', ')}
                </li>
              </ul>
            </div>

            <Button onClick={handleComplete} className="w-full">
              Start Learning
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
