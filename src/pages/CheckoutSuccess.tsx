import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Toast from '../components/ui/Toast';
import { useAuthStore, authApi, backendUserToAuthUser } from '../stores/authStore';
import { useDocumentTitle } from '../hooks';

export default function CheckoutSuccess() {
  useDocumentTitle('Checkout Success');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken, setUser } = useAuthStore();
  const [isProcessing, setIsProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [billingType, setBillingType] = useState<'monthly' | 'yearly'>('monthly');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const verifyCheckout = async () => {
      const sessionId = searchParams.get('session_id');
      const devMode = searchParams.get('dev_mode');
      const billing = searchParams.get('billing') as 'monthly' | 'yearly' | null;

      if (billing) {
        setBillingType(billing);
      }

      // Development mode - simulate subscription upgrade
      if (devMode === 'true') {
        try {
          // Call API to simulate upgrade in dev mode
          const response = await fetch('http://localhost:3001/api/subscriptions/dev-upgrade', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ billingType: billing || 'monthly' }),
          });

          if (response.ok) {
            // Refresh user data to get updated tier
            const backendData = await authApi.getMe();
            setUser(backendUserToAuthUser(backendData));
            setSuccess(true);
            setToast({ message: 'Welcome to Pro! Your subscription is now active.', type: 'success' });
          } else {
            throw new Error('Failed to activate subscription');
          }
        } catch (error) {
          setToast({ message: 'Failed to verify subscription', type: 'error' });
          setSuccess(false);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // Production mode - verify with Stripe session ID
      if (!sessionId) {
        setIsProcessing(false);
        setSuccess(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:3001/api/subscriptions/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ sessionId }),
        });

        if (response.ok) {
          // Refresh user data to get updated tier
          const backendData = await authApi.getMe();
          setUser(backendUserToAuthUser(backendData));
          setSuccess(true);
          setToast({ message: 'Welcome to Pro! Your subscription is now active.', type: 'success' });
        } else {
          throw new Error('Failed to verify subscription');
        }
      } catch (error) {
        setToast({ message: 'Failed to verify subscription', type: 'error' });
        setSuccess(false);
      } finally {
        setIsProcessing(false);
      }
    };

    verifyCheckout();
  }, [searchParams, accessToken, setUser]);

  const price = billingType === 'monthly' ? '$12' : '$99';
  const period = billingType === 'monthly' ? 'month' : 'year';

  if (isProcessing) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <Card className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6"></div>
          <h1 className="font-heading text-2xl font-bold text-text mb-2">
            Processing Your Subscription
          </h1>
          <p className="text-text/70">
            Please wait while we confirm your payment...
          </p>
        </Card>
      </div>
    );
  }

  if (!success) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <Card className="text-center">
          <div className="w-16 h-16 bg-error/20 border-3 border-border rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-error"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="font-heading text-2xl font-bold text-text mb-2">
            Something Went Wrong
          </h1>
          <p className="text-text/70 mb-6">
            We couldn't verify your subscription. If you were charged, please contact support.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="ghost" onClick={() => navigate('/pricing')}>
              Back to Pricing
            </Button>
            <Button variant="primary" onClick={() => navigate('/settings')}>
              Contact Support
            </Button>
          </div>
        </Card>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <Card className="text-center">
        {/* Success Checkmark Animation */}
        <div className="w-20 h-20 bg-success/20 border-3 border-border rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
          <svg
            className="w-10 h-10 text-success animate-draw-check"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="font-heading text-3xl font-bold text-text mb-2">
          Welcome to Pro!
        </h1>

        <p className="text-text/70 mb-6">
          Your subscription is now active. You have unlimited access to all Pro features.
        </p>

        {/* Subscription Details */}
        <div className="bg-surface border-3 border-border p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="font-heading font-semibold text-text">
              Pro Plan ({billingType})
            </span>
            <span className="font-heading text-lg font-bold text-text">
              {price}/{period}
            </span>
          </div>
          <p className="text-sm text-text/60 mt-2">
            {billingType === 'monthly'
              ? 'Billed monthly. Cancel anytime.'
              : 'Billed annually. Save 33% compared to monthly.'}
          </p>
        </div>

        {/* Pro Features Summary */}
        <div className="text-left mb-6">
          <h3 className="font-heading font-bold text-text mb-3">
            What's Included:
          </h3>
          <ul className="space-y-2">
            {[
              'Unlimited learning sessions',
              'Advanced AI question generation',
              'Custom learning goals',
              'Progress analytics & insights',
              'Priority support',
            ].map((feature, index) => (
              <li key={index} className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-success flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-text/80">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="primary" size="lg" onClick={() => navigate('/')}>
            Start Learning
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate('/settings')}>
            Manage Subscription
          </Button>
        </div>
      </Card>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
