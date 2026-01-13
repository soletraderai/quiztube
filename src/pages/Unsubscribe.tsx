import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const API_BASE = 'http://localhost:3001/api';

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const unsubscribe = async () => {
      if (!userId || !token) {
        setStatus('error');
        setErrorMessage('Invalid unsubscribe link.');
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/email-prompts/unsubscribe?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unsubscribe failed');
        }

        setStatus('success');
        setEmail(data.email || '');
      } catch (err) {
        setStatus('error');
        const message = err instanceof Error ? err.message : 'Unsubscribe failed. Please try again.';
        setErrorMessage(message);
      }
    };

    unsubscribe();
  }, [userId, token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="font-heading text-4xl font-bold text-text">
              Teachy
            </h1>
          </Link>
          <p className="mt-2 text-text/70 font-body">
            Email Preferences
          </p>
        </div>

        <Card>
          {status === 'loading' && (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 mx-auto border-3 border-border border-t-primary animate-spin" />
              <h2 className="font-heading text-xl font-bold text-text">
                Processing...
              </h2>
              <p className="text-text/70 font-body text-sm">
                Please wait while we update your preferences.
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
                Unsubscribed Successfully
              </h2>
              <p className="text-text/70 font-body text-sm">
                {email ? (
                  <>You've been unsubscribed from email prompts at <strong>{email}</strong>.</>
                ) : (
                  <>You've been unsubscribed from email prompts.</>
                )}
              </p>
              <p className="text-text/60 font-body text-xs">
                You will no longer receive review questions via email.
              </p>
              <div className="space-y-3 pt-4">
                <Link to="/settings">
                  <Button className="w-full">
                    Manage Email Preferences
                  </Button>
                </Link>
                <Link to="/">
                  <Button variant="ghost" className="w-full">
                    Go to Home
                  </Button>
                </Link>
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
                Unsubscribe Failed
              </h2>
              <p className="text-text/70 font-body text-sm">
                {errorMessage || 'This unsubscribe link is invalid or has expired.'}
              </p>
              <div className="space-y-3 pt-4">
                <Link to="/settings">
                  <Button className="w-full">
                    Manage Email Preferences
                  </Button>
                </Link>
                <p className="text-text/60 font-body text-xs">
                  You can also manage your email preferences from the Settings page.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
