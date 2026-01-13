import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Toast from '../components/ui/Toast';
import { useAuthStore } from '../stores/authStore';

const pricingPlans = {
  free: {
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    description: 'Perfect for casual learners getting started',
    features: [
      '3 learning sessions per month',
      '10 questions per session',
      'Coach personality only',
      'Session history (last 10)',
      'Community support',
    ],
    limitations: [
      'No advanced AI features',
      'No priority support',
      'Limited session storage',
    ],
  },
  pro: {
    name: 'Pro',
    price: { monthly: 12, yearly: 99 },
    description: 'For serious learners who want to maximize retention',
    features: [
      'Unlimited learning sessions',
      'Advanced question generation',
      'Full session history',
      'Premium AI responses',
      'Priority email support',
      'Custom learning goals',
      'Progress analytics',
      'Export notes to PDF',
      'Dig deeper conversations',
      'Knowledge map visualization',
    ],
    popular: true,
  },
};

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const navigate = useNavigate();
  const { user, isAuthenticated, accessToken } = useAuthStore();

  const yearlyDiscount = Math.round(
    ((pricingPlans.pro.price.monthly * 12 - pricingPlans.pro.price.yearly) /
      (pricingPlans.pro.price.monthly * 12)) *
      100
  );

  const handleSelectPlan = async (plan: 'free' | 'pro') => {
    if (!isAuthenticated()) {
      // Redirect to signup with plan info
      navigate(`/signup?plan=${plan}&billing=${billingCycle}`);
      return;
    }

    if (plan === 'free') {
      // Already on free or just stay on free
      return;
    }

    if (plan === 'pro' && user?.tier === 'FREE') {
      setIsLoading(true);
      try {
        const response = await fetch('http://localhost:3001/api/subscriptions/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ priceType: billingCycle }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Check for development mode simulation
          if (data.error === 'STRIPE_NOT_CONFIGURED') {
            // Development mode - simulate checkout success
            setToast({ message: 'Development mode: Simulating checkout...', type: 'info' });
            setTimeout(() => {
              navigate(`/checkout/success?dev_mode=true&billing=${billingCycle}`);
            }, 500);
            return;
          }
          throw new Error(data.message || 'Failed to start checkout');
        }

        // Redirect to Stripe checkout
        if (data.url) {
          window.location.href = data.url;
        }
      } catch (error) {
        setToast({
          message: error instanceof Error ? error.message : 'Failed to start checkout',
          type: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-text">
          Simple, Transparent Pricing
        </h1>
        <p className="font-body text-lg text-text/70 max-w-2xl mx-auto">
          Choose the plan that fits your learning journey. Upgrade anytime.
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center items-center gap-4 mb-12">
        <span
          className={`font-heading font-semibold ${
            billingCycle === 'monthly' ? 'text-text' : 'text-text/50'
          }`}
        >
          Monthly
        </span>
        <button
          onClick={() =>
            setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')
          }
          className="relative w-16 h-8 bg-surface border-3 border-border shadow-brutal rounded-none focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={`Switch to ${billingCycle === 'monthly' ? 'yearly' : 'monthly'} billing`}
        >
          <span
            className={`absolute top-1 w-6 h-5 bg-primary border-2 border-border transition-all duration-200 ${
              billingCycle === 'yearly' ? 'left-8' : 'left-1'
            }`}
          />
        </button>
        <span
          className={`font-heading font-semibold ${
            billingCycle === 'yearly' ? 'text-text' : 'text-text/50'
          }`}
        >
          Yearly
        </span>
        {billingCycle === 'yearly' && (
          <span className="bg-success text-text text-sm font-heading font-bold px-2 py-1 border-2 border-border">
            Save {yearlyDiscount}%
          </span>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Free Tier */}
        <Card className="relative flex flex-col">
          <div className="mb-6">
            <h2 className="font-heading text-2xl font-bold text-text">
              {pricingPlans.free.name}
            </h2>
            <p className="text-text/70 mt-2">{pricingPlans.free.description}</p>
          </div>

          <div className="mb-6">
            <span className="font-heading text-5xl font-bold text-text">$0</span>
            <span className="text-text/70 ml-2">forever</span>
          </div>

          <ul className="space-y-3 mb-8 flex-grow">
            {pricingPlans.free.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-success flex-shrink-0 mt-0.5"
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
            {pricingPlans.free.limitations?.map((limitation, index) => (
              <li key={`limit-${index}`} className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-text/40 flex-shrink-0 mt-0.5"
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
                <span className="text-text/50">{limitation}</span>
              </li>
            ))}
          </ul>

          <Button
            variant="ghost"
            size="lg"
            className="w-full"
            onClick={() => handleSelectPlan('free')}
          >
            {user?.tier === 'FREE' ? 'Current Plan' : 'Get Started Free'}
          </Button>
        </Card>

        {/* Pro Tier */}
        <Card className="relative flex flex-col border-primary">
          {/* Popular Badge */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <span className="bg-primary text-text font-heading font-bold text-sm px-4 py-1 border-3 border-border shadow-brutal-sm">
              MOST POPULAR
            </span>
          </div>

          <div className="mb-6 pt-4">
            <h2 className="font-heading text-2xl font-bold text-text">
              {pricingPlans.pro.name}
            </h2>
            <p className="text-text/70 mt-2">{pricingPlans.pro.description}</p>
          </div>

          <div className="mb-6">
            <span className="font-heading text-5xl font-bold text-text">
              ${billingCycle === 'monthly'
                ? pricingPlans.pro.price.monthly.toFixed(2)
                : (pricingPlans.pro.price.yearly / 12).toFixed(2)}
            </span>
            <span className="text-text/70 ml-2">/ month</span>
            {billingCycle === 'yearly' && (
              <p className="text-sm text-text/60 mt-1">
                Billed annually (${pricingPlans.pro.price.yearly.toFixed(2)}/year)
              </p>
            )}
          </div>

          <ul className="space-y-3 mb-8 flex-grow">
            {pricingPlans.pro.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-success flex-shrink-0 mt-0.5"
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

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => handleSelectPlan('pro')}
            disabled={isLoading || user?.tier === 'PRO'}
          >
            {isLoading ? 'Processing...' : user?.tier === 'PRO' ? 'Current Plan' : 'Upgrade to Pro'}
          </Button>
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="mt-16 max-w-3xl mx-auto">
        <h2 className="font-heading text-2xl font-bold text-text text-center mb-8">
          Frequently Asked Questions
        </h2>

        <div className="space-y-6">
          <Card>
            <h3 className="font-heading font-bold text-text mb-2">
              Can I switch plans anytime?
            </h3>
            <p className="text-text/70">
              Yes! You can upgrade to Pro anytime. If you downgrade, you'll keep Pro
              features until the end of your billing period.
            </p>
          </Card>

          <Card>
            <h3 className="font-heading font-bold text-text mb-2">
              What happens to my sessions if I downgrade?
            </h3>
            <p className="text-text/70">
              Your session history is preserved. You'll still have access to view past
              sessions, but new session creation will be limited to the Free tier
              allowance.
            </p>
          </Card>

          <Card>
            <h3 className="font-heading font-bold text-text mb-2">
              Is there a free trial for Pro?
            </h3>
            <p className="text-text/70">
              We offer a 7-day money-back guarantee. If Pro isn't right for you, contact
              us within 7 days for a full refund.
            </p>
          </Card>

          <Card>
            <h3 className="font-heading font-bold text-text mb-2">
              Do you offer team or education discounts?
            </h3>
            <p className="text-text/70">
              Yes! Contact us at support@teachy.app for special pricing for teams and
              educational institutions.
            </p>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="mt-16 text-center">
        <Card className="inline-block bg-primary/10">
          <h3 className="font-heading text-xl font-bold text-text mb-2">
            Not sure which plan is right for you?
          </h3>
          <p className="text-text/70 mb-4">
            Start with Free and upgrade when you're ready.
          </p>
          <Button variant="primary" onClick={() => navigate('/signup')}>
            Get Started Free
          </Button>
        </Card>
      </div>

      {/* Toast notifications */}
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
