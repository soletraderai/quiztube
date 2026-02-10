/**
 * Centralized Route Configuration
 * Single source of truth for all application routes
 */

// Route path constants
export const ROUTES = {
  // Auth routes (no layout)
  auth: {
    login: '/login',
    signup: '/signup',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    verifyEmail: '/verify-email/:token',
    unsubscribe: '/unsubscribe',
    onboarding: '/onboarding',
    callback: '/auth/callback',
  },

  // Public routes (with top navbar)
  public: {
    home: '/',
    pricing: '/pricing',
    terms: '/terms',
    privacy: '/privacy',
    notFound: '/404',
  },

  // App routes (with sidebar navigation - requires auth)
  app: {
    dashboard: '/dashboard',
    settings: '/settings',
    library: '/library',
    feed: '/feed',
    goals: '/goals',
    review: '/review',
    knowledgeMap: '/knowledge-map',
    learningPaths: '/learning-paths',
    learningPathDetail: '/learning-paths/:pathId',
    // Timed sessions
    timedSessions: '/timed-sessions',
    timedSessionHistory: '/timed-sessions/history',
    timedSessionActive: '/timed-sessions/:sessionId/active',
    timedSessionResults: '/timed-sessions/:sessionId/results',
    // Learning sessions (canonical /lesson/ paths)
    lessonOverview: '/lesson/:lessonId/overview',
    lessonActive: '/lesson/:lessonId/active',
    lessonNotes: '/lesson/:lessonId/notes',
    // Backward compat aliases
    sessionOverview: '/session/:sessionId/overview',
    sessionActive: '/session/:sessionId/active',
    sessionNotes: '/session/:sessionId/notes',
  },

  // Subscription routes
  subscription: {
    checkoutSuccess: '/checkout/success',
  },
} as const;

// Helper to generate dynamic routes with type-safe parameters
export const generateRoute = {
  verifyEmail: (token: string) => `/verify-email/${token}`,
  timedSessionActive: (sessionId: string) => `/timed-sessions/${sessionId}/active`,
  timedSessionResults: (sessionId: string) => `/timed-sessions/${sessionId}/results`,
  // Phase 12: canonical /lesson/ paths
  lessonOverview: (lessonId: string) => `/lesson/${lessonId}/overview`,
  lessonActive: (lessonId: string) => `/lesson/${lessonId}/active`,
  lessonNotes: (lessonId: string) => `/lesson/${lessonId}/notes`,
  // Backward compat aliases
  sessionOverview: (sessionId: string) => `/lesson/${sessionId}/overview`,
  sessionActive: (sessionId: string) => `/lesson/${sessionId}/active`,
  sessionNotes: (sessionId: string) => `/lesson/${sessionId}/notes`,
};

/**
 * Type-safe URL generator for lesson routes (Phase 12)
 */
export function getLessonUrl(
  lessonId: string,
  type: 'overview' | 'active' | 'notes' = 'notes'
): string {
  switch (type) {
    case 'overview':
      return generateRoute.lessonOverview(lessonId);
    case 'active':
      return generateRoute.lessonActive(lessonId);
    case 'notes':
    default:
      return generateRoute.lessonNotes(lessonId);
  }
}

// Backward compat alias
export const getSessionUrl = getLessonUrl;

/**
 * Type-safe URL generator for timed session routes
 */
export function getTimedSessionUrl(
  sessionId: string,
  type: 'active' | 'results'
): string {
  return type === 'active'
    ? generateRoute.timedSessionActive(sessionId)
    : generateRoute.timedSessionResults(sessionId);
}

// Route metadata for navigation menus
export const NAV_ITEMS = {
  main: [
    { path: ROUTES.app.dashboard, label: 'Dashboard', icon: 'dashboard' },
    { path: ROUTES.app.library, label: 'Library', icon: 'video_library' },
    { path: ROUTES.app.feed, label: 'Your Feed', icon: 'subscriptions' },
    { path: ROUTES.app.goals, label: 'Goals', icon: 'trending_up', proOnly: true },
    { path: ROUTES.app.timedSessions, label: 'Timed Sessions', icon: 'timer' },
  ],
  secondary: [
    { path: ROUTES.app.settings, label: 'Settings', icon: 'settings' },
    { path: ROUTES.app.knowledgeMap, label: 'Knowledge Map', icon: 'hub', proOnly: true },
  ],
  public: [
    { path: ROUTES.public.home, label: 'Home' },
    { path: ROUTES.public.pricing, label: 'Pricing' },
  ],
  legal: [
    { path: ROUTES.public.terms, label: 'Terms' },
    { path: ROUTES.public.privacy, label: 'Privacy' },
  ],
} as const;

// Route access levels
export type RouteAccess = 'public' | 'auth' | 'pro';

export const ROUTE_ACCESS: Record<string, RouteAccess> = {
  [ROUTES.public.home]: 'public',
  [ROUTES.public.pricing]: 'public',
  [ROUTES.public.terms]: 'public',
  [ROUTES.public.privacy]: 'public',
  [ROUTES.auth.login]: 'public',
  [ROUTES.auth.signup]: 'public',
  [ROUTES.auth.forgotPassword]: 'public',
  [ROUTES.auth.resetPassword]: 'public',
  [ROUTES.app.dashboard]: 'auth',
  [ROUTES.app.settings]: 'auth',
  [ROUTES.app.library]: 'auth',
  [ROUTES.app.feed]: 'auth',
  [ROUTES.app.timedSessions]: 'auth',
  [ROUTES.app.goals]: 'pro',
  [ROUTES.app.knowledgeMap]: 'pro',
};
