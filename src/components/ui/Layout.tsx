import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';
import OfflineBanner from './OfflineBanner';
import Breadcrumb from './Breadcrumb';
import PageTransition from './PageTransition';
import { useAuthStore } from '../../stores/authStore';

const API_BASE = 'http://localhost:3001/api';

interface ApproachingGoal {
  id: string;
  title: string;
  daysRemaining: number;
  progressPercentage: number;
  predictedOnTime: boolean;
}

export default function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const [dueTopicsCount, setDueTopicsCount] = useState(0);
  const [showReviewBanner, setShowReviewBanner] = useState(true);
  const [approachingGoals, setApproachingGoals] = useState<ApproachingGoal[]>([]);
  const [showGoalDeadlineBanner, setShowGoalDeadlineBanner] = useState(true);

  // Fetch topics due for review
  useEffect(() => {
    const fetchDueTopics = async () => {
      if (!isAuthenticated()) return;

      try {
        const { accessToken } = useAuthStore.getState();
        const response = await fetch(`${API_BASE}/topics/due-for-review`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const topics = await response.json();
          setDueTopicsCount(topics.length);
        }
      } catch (err) {
        console.error('Failed to fetch due topics:', err);
      }
    };

    fetchDueTopics();
  }, [isAuthenticated, location.pathname]);

  // Fetch goals with approaching deadlines
  useEffect(() => {
    const fetchApproachingGoals = async () => {
      if (!isAuthenticated() || user?.tier !== 'PRO') return;

      try {
        const { accessToken } = useAuthStore.getState();
        const response = await fetch(`${API_BASE}/goals/approaching-deadlines?days=7`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const goals = await response.json();
          setApproachingGoals(goals);
        }
      } catch (err) {
        console.error('Failed to fetch approaching goals:', err);
      }
    };

    fetchApproachingGoals();
  }, [isAuthenticated, user?.tier, location.pathname]);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/feed', label: 'Your Feed' },
    { to: '/library', label: 'Library' },
    { to: '/goals', label: 'Goals' },
    { to: '/settings', label: 'Settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Review Due Notification Banner */}
      {isAuthenticated() && dueTopicsCount > 0 && showReviewBanner && (
        <div className="bg-secondary border-b-3 border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-heading font-semibold text-text">
                  You have <strong>{dueTopicsCount}</strong> topic{dueTopicsCount !== 1 ? 's' : ''} due for review!
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/library"
                  className="px-3 py-1 bg-primary border-2 border-border font-heading font-semibold text-sm hover:shadow-brutal transition-all"
                >
                  Review Now
                </Link>
                <button
                  onClick={() => setShowReviewBanner(false)}
                  className="p-1 hover:bg-background/50 transition-colors"
                  aria-label="Dismiss notification"
                >
                  <svg className="w-4 h-4 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goal Deadline Reminder Banner */}
      {isAuthenticated() && user?.tier === 'PRO' && approachingGoals.length > 0 && showGoalDeadlineBanner && (
        <div className="bg-primary/30 border-b-3 border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-heading font-semibold text-text">
                  {approachingGoals.length === 1 ? (
                    <>
                      <strong>"{approachingGoals[0].title}"</strong> due in{' '}
                      <strong>{approachingGoals[0].daysRemaining}</strong> day{approachingGoals[0].daysRemaining !== 1 ? 's' : ''}
                      {!approachingGoals[0].predictedOnTime && (
                        <span className="text-error ml-2">(at risk)</span>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>{approachingGoals.length}</strong> goals have deadlines approaching!
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/goals"
                  className="px-3 py-1 bg-primary border-2 border-border font-heading font-semibold text-sm hover:shadow-brutal transition-all"
                >
                  View Goals
                </Link>
                <button
                  onClick={() => setShowGoalDeadlineBanner(false)}
                  className="p-1 hover:bg-background/50 transition-colors"
                  aria-label="Dismiss notification"
                >
                  <svg className="w-4 h-4 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="skip-link"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="bg-surface border-b-3 border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link
              to="/"
              className="font-heading font-bold text-xl sm:text-2xl text-text hover:text-primary transition-colors"
            >
              YouTube Learning
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-4" role="navigation" aria-label="Main navigation">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 font-heading font-semibold border-3 border-border transition-all ${
                    isActive(link.to)
                      ? 'bg-primary shadow-brutal'
                      : 'bg-surface hover:bg-primary hover:shadow-brutal'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Subscription Tier Badge */}
              {isAuthenticated() && user && (
                <span
                  className={`px-3 py-1 font-heading font-bold text-sm border-2 border-border ${
                    user.tier === 'PRO'
                      ? 'bg-secondary text-text'
                      : 'bg-surface text-text/70'
                  }`}
                  title={`Your subscription tier: ${user.tier}`}
                >
                  {user.tier}
                </span>
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden brutal-button p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav
              className="md:hidden py-4 border-t-3 border-border"
              role="navigation"
              aria-label="Mobile navigation"
            >
              <div className="flex flex-col space-y-2">
                {/* Subscription Tier Badge - Mobile */}
                {isAuthenticated() && user && (
                  <div className="px-4 py-2">
                    <span
                      className={`inline-block px-3 py-1 font-heading font-bold text-sm border-2 border-border ${
                        user.tier === 'PRO'
                          ? 'bg-secondary text-text'
                          : 'bg-surface text-text/70'
                      }`}
                    >
                      {user.tier} Plan
                    </span>
                  </div>
                )}
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 font-heading font-semibold border-3 border-border transition-all ${
                      isActive(link.to)
                        ? 'bg-primary shadow-brutal'
                        : 'bg-surface hover:bg-primary'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />
        <ErrorBoundary>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t-3 border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-text/70 font-body">
            YouTube Learning Tool - Transform videos into active learning
          </p>
        </div>
      </footer>
    </div>
  );
}
