import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore, authApi } from '../stores/authStore';
import { useDocumentTitle } from '../hooks';
import MaterialIcon from '../components/ui/MaterialIcon';

export default function AuthCallback() {
  useDocumentTitle('Authenticating');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { setUser, setAccessToken, setSupabaseSession } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      if (!isSupabaseConfigured()) {
        setError('Authentication not configured');
        return;
      }

      try {
        // Check for error in URL params
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          setError(errorDescription || errorParam);
          return;
        }

        // Get the session from URL hash (Supabase puts tokens in hash)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError(sessionError.message);
          return;
        }

        if (!session) {
          // Try to exchange code for session if using PKCE flow
          const code = searchParams.get('code');
          if (code) {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

            if (exchangeError) {
              console.error('Code exchange error:', exchangeError);
              setError(exchangeError.message);
              return;
            }

            if (data.session) {
              await handleSuccessfulAuth(data.session);
              return;
            }
          }

          setError('No session found. Please try signing in again.');
          return;
        }

        await handleSuccessfulAuth(session);
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    const handleSuccessfulAuth = async (session: any) => {
      setSupabaseSession(session);
      setAccessToken(session.access_token);

      // Fetch user profile from backend to get tier and other info
      try {
        const backendUser = await authApi.getMe();
        setUser({
          id: backendUser.id || session.user.id,
          email: session.user.email || '',
          displayName:
            backendUser.displayName ||
            session.user.user_metadata?.display_name ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'User',
          emailVerified: !!session.user.email_confirmed_at,
          tier: backendUser.tier || 'FREE',
          onboardingCompleted: backendUser.onboardingCompleted || false,
          avatarUrl: backendUser.avatarUrl || session.user.user_metadata?.avatar_url,
        });

        // Redirect based on onboarding status
        if (!backendUser.onboardingCompleted) {
          navigate('/onboarding', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch {
        // Backend user fetch failed, use Supabase data
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          displayName:
            session.user.user_metadata?.display_name ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'User',
          emailVerified: !!session.user.email_confirmed_at,
          tier: 'FREE',
          onboardingCompleted: false,
          avatarUrl: session.user.user_metadata?.avatar_url,
        });

        // New user, go to onboarding
        navigate('/onboarding', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, searchParams, setUser, setAccessToken, setSupabaseSession]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="brutal-card p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MaterialIcon name="close" size={32} className="text-red-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Authentication Failed</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="brutal-button bg-[#FFDE59] px-6 py-3 font-semibold"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="brutal-card p-8 text-center">
          <div className="w-16 h-16 bg-[#FFDE59] rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <MaterialIcon name="lock" size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Completing sign in...</h1>
          <p className="text-gray-600">Please wait while we set up your account.</p>
        </div>
      </div>
    </div>
  );
}
