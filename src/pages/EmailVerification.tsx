import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Toast from '../components/ui/Toast';
import { useAuthStore, authApi } from '../stores/authStore';

export default function EmailVerification() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { user, setUser } = useAuthStore();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage('Invalid verification link.');
        return;
      }

      try {
        await authApi.verifyEmail(token);
        setStatus('success');

        // Update user state if logged in
        if (user) {
          setUser({ ...user, emailVerified: true });
        }

        setToast({ message: 'Email verified successfully!', type: 'success' });
      } catch (err) {
        setStatus('error');
        const message = err instanceof Error ? err.message : 'Verification failed. Please try again.';
        setErrorMessage(message);
        setToast({ message, type: 'error' });
      }
    };

    verifyEmail();
  }, [token, user, setUser]);

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
            Email Verification
          </p>
        </div>

        <Card>
          {status === 'loading' && (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 mx-auto border-3 border-border border-t-primary animate-spin" />
              <h2 className="font-heading text-xl font-bold text-text">
                Verifying your email...
              </h2>
              <p className="text-text/70 font-body text-sm">
                Please wait while we verify your email address.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-success/20 border-3 border-success flex items-center justify-center">
                <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-bold text-text">
                Email Verified!
              </h2>
              <p className="text-text/70 font-body text-sm">
                Your email has been successfully verified. You can now access all features.
              </p>
              <div className="space-y-3 pt-4">
                {user ? (
                  <Button
                    onClick={() => navigate('/')}
                    className="w-full"
                  >
                    Go to Dashboard
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => navigate('/login')}
                      className="w-full"
                    >
                      Sign In
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => navigate('/')}
                      className="w-full"
                    >
                      Go to Home
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-error/20 border-3 border-error flex items-center justify-center">
                <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-bold text-text">
                Verification Failed
              </h2>
              <p className="text-text/70 font-body text-sm">
                {errorMessage || 'This verification link is invalid or has expired.'}
              </p>
              <div className="space-y-3 pt-4">
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full"
                >
                  Go to Sign In
                </Button>
                <p className="text-text/60 font-body text-xs">
                  Need a new verification email? Sign in and request a new one from your account settings.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
