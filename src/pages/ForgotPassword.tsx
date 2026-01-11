import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Toast from '../components/ui/Toast';
import { authApi } from '../stores/authStore';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const validateEmail = (): boolean => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail()) {
      return;
    }

    setLoading(true);

    try {
      await authApi.forgotPassword(email.trim());
      setSubmitted(true);
      setToast({ message: 'If an account exists, a reset link has been sent.', type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset link. Please try again.';
      setToast({ message, type: 'error' });
    } finally {
      setLoading(false);
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
            Reset your password
          </p>
        </div>

        <Card>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-text/70 font-body text-sm">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {/* Email */}
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                error={error}
                required
                autoComplete="email"
                autoFocus
              />

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={loading}
                disabled={loading}
              >
                Send Reset Link
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
                Check your email
              </h2>
              <p className="text-text/70 font-body text-sm">
                If an account exists for <strong>{email}</strong>, you'll receive an email with instructions to reset your password.
              </p>
              <p className="text-text/60 font-body text-xs">
                Didn't receive an email? Check your spam folder or{' '}
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-secondary underline hover:no-underline"
                >
                  try again
                </button>
              </p>
            </div>
          )}
        </Card>

        {/* Back to Login Link */}
        <p className="mt-6 text-center text-text/70 font-body">
          Remember your password?{' '}
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
