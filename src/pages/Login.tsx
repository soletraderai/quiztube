import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Toast from '../components/ui/Toast';
import MigrationPrompt from '../components/ui/MigrationPrompt';
import { useAuthStore, authApi } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setAccessToken, setLoading, isLoading } = useAuthStore();
  const { getLocalSessionCount, migrateLocalSessions, dismissMigration, migrationDismissed } = useSessionStore();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [localSessionCount, setLocalSessionCount] = useState(0);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    const email = formData.email.trim();
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.login(formData.email.trim(), formData.password);

      // Set auth state
      setUser(response.user);
      setAccessToken(response.accessToken);

      setToast({ message: 'Login successful!', type: 'success' });

      // Check for local sessions that need migration
      const sessionCount = getLocalSessionCount();

      if (sessionCount > 0 && !migrationDismissed) {
        // Show migration prompt
        setLocalSessionCount(sessionCount);
        setShowMigrationPrompt(true);
      } else {
        // Redirect to home
        setTimeout(() => {
          navigate('/');
        }, 500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setToast({ message, type: 'error' });
      setErrors({ general: message });
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    await migrateLocalSessions();
  };

  const handleSkipMigration = () => {
    dismissMigration();
    setShowMigrationPrompt(false);
    navigate('/');
  };

  const handleMigrationClose = () => {
    setShowMigrationPrompt(false);
    navigate('/');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Migration Prompt Modal */}
      <MigrationPrompt
        isOpen={showMigrationPrompt}
        onClose={handleMigrationClose}
        sessionCount={localSessionCount}
        onMigrate={handleMigrate}
        onSkip={handleSkipMigration}
      />

      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="font-heading text-4xl font-bold text-text">
              Teachy
            </h1>
          </Link>
          <p className="mt-2 text-text/70 font-body">
            Sign in to continue learning
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General error display */}
            {errors.general && (
              <div className="bg-error/10 border-3 border-error p-4 text-error font-body text-sm">
                {errors.general}
              </div>
            )}

            {/* Email */}
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              error={errors.email}
              required
              autoComplete="email"
              autoFocus
            />

            {/* Password */}
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              error={errors.password}
              required
              autoComplete="current-password"
            />

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-secondary hover:text-secondary/80 font-body underline"
              >
                Forgot your password?
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isLoading}
              disabled={isLoading}
            >
              Sign In
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-3 border-border/30" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-surface text-text/60 font-body">
                  or continue with
                </span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="w-full flex items-center justify-center gap-3"
              onClick={() => setToast({ message: 'Google sign-in coming soon!', type: 'info' })}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          </form>
        </Card>

        {/* Sign Up Link */}
        <p className="mt-6 text-center text-text/70 font-body">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="text-secondary hover:text-secondary/80 font-semibold underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
