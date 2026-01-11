import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Toast from '../components/ui/Toast';
import { useAuthStore, authApi } from '../stores/authStore';

export default function Signup() {
  const navigate = useNavigate();
  const { setUser, setAccessToken, setLoading, isLoading } = useAuthStore();

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Display name validation
    const displayName = formData.displayName.trim();
    if (!displayName) {
      newErrors.displayName = 'Display name is required';
    } else if (displayName.length > 100) {
      newErrors.displayName = 'Display name must be 100 characters or less';
    }

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
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const response = await authApi.signup(
        formData.email.trim(),
        formData.password,
        formData.displayName.trim()
      );

      // Set auth state
      setUser(response.user);
      setAccessToken(response.accessToken);

      setToast({ message: 'Account created! Please check your email to verify.', type: 'success' });

      // Redirect to onboarding
      setTimeout(() => {
        navigate('/onboarding');
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setToast({ message, type: 'error' });
      setErrors({ general: message });
    } finally {
      setLoading(false);
    }
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

      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="font-heading text-4xl font-bold text-text">
              Teachy
            </h1>
          </Link>
          <p className="mt-2 text-text/70 font-body">
            Create your account to start learning
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

            {/* Display Name */}
            <Input
              label="Display Name"
              type="text"
              placeholder="Your name"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              error={errors.displayName}
              required
              autoComplete="name"
              autoFocus
            />

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
            />

            {/* Password */}
            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              error={errors.password}
              required
              autoComplete="new-password"
              helperText="Must be at least 8 characters"
            />

            {/* Confirm Password */}
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              required
              autoComplete="new-password"
            />

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isLoading}
              disabled={isLoading}
            >
              Create Account
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

            {/* Terms */}
            <p className="text-xs text-text/60 font-body text-center">
              By creating an account, you agree to our{' '}
              <a href="#" className="text-secondary underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-secondary underline">Privacy Policy</a>
            </p>
          </form>
        </Card>

        {/* Sign In Link */}
        <p className="mt-6 text-center text-text/70 font-body">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-secondary hover:text-secondary/80 font-semibold underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
