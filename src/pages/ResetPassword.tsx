import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Toast from '../components/ui/Toast';
import { authApi } from '../stores/authStore';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

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

    if (!token) {
      setToast({ message: 'Invalid reset link. Please request a new one.', type: 'error' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(token, formData.password);
      setSuccess(true);
      setToast({ message: 'Password reset successful!', type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
      setToast({ message, type: 'error' });
      setErrors({ general: message });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block">
              <h1 className="font-heading text-4xl font-bold text-text">
                Teachy
              </h1>
            </Link>
          </div>
          <Card>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-error/20 border-3 border-error flex items-center justify-center">
                <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-bold text-text">
                Invalid Reset Link
              </h2>
              <p className="text-text/70 font-body text-sm">
                This password reset link is invalid or has expired.
              </p>
              <Button
                onClick={() => navigate('/forgot-password')}
                className="w-full"
              >
                Request New Link
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

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
            Set your new password
          </p>
        </div>

        <Card>
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* General error display */}
              {errors.general && (
                <div className="bg-error/10 border-3 border-error p-4 text-error font-body text-sm">
                  {errors.general}
                </div>
              )}

              {/* New Password */}
              <Input
                label="New Password"
                type="password"
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                error={errors.password}
                required
                autoComplete="new-password"
                autoFocus
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
                loading={loading}
                disabled={loading}
              >
                Reset Password
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-success/20 border-3 border-success flex items-center justify-center">
                <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-bold text-text">
                Password Reset Complete
              </h2>
              <p className="text-text/70 font-body text-sm">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Go to Sign In
              </Button>
            </div>
          )}
        </Card>

        {/* Back to Login Link */}
        {!success && (
          <p className="mt-6 text-center text-text/70 font-body">
            Remember your password?{' '}
            <Link
              to="/login"
              className="text-secondary hover:text-secondary/80 font-semibold underline"
            >
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
