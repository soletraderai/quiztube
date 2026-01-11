import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import ErrorBoundary from './ErrorBoundary';
import OfflineBanner from './OfflineBanner';
import Breadcrumb from './Breadcrumb';
import { useAuthStore } from '../../stores/authStore';

export default function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/library', label: 'Library' },
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
          <Outlet />
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
