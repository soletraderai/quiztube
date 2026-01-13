# Changelog

All notable changes to Teachy (QuizzTube) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- TanStack Query integration for data fetching with automatic caching
- Custom React hooks for Dashboard (`useCommitment`, `useLearningInsights`)
- Custom React hooks for Goals (`useGoals`, `useGoalSuggestions`)
- Mutation hooks for Goals CRUD operations (`useCreateGoal`, `useUpdateGoal`, `useDeleteGoal`)
- Supabase Auth integration with Google OAuth support
- OAuth callback handler (`/auth/callback` route)
- Supabase client libraries (frontend and backend)
- Knowledge base persistence to database (`POST /api/sessions/:id/sources`)
- AI feedback now references knowledge base sources for richer responses
- **Timed Sessions feature** (Phase 3):
  - Three session types: Rapid (5min/10q), Focused (15min/20q), Comprehensive (30min/30q)
  - Real-time countdown timer with 1-minute warning
  - Skip, abandon, and next question controls
  - AI-powered answer evaluation with graceful fallback
  - Results page with accuracy circle visualization and performance feedback
  - Session history page with filtering and sorting
  - New routes: `/timed-sessions`, `/timed-sessions/history`, `/timed-sessions/:id/active`, `/timed-sessions/:id/results`
  - TanStack Query hooks: `useTimedSessionHistory`, `useActiveTimedSession`, `useCreateTimedSession`, `useUpdateTimedSession`
  - Backend endpoints: `GET /api/timed-sessions/:id/questions`, `POST /api/ai/evaluate-timed-answer`
- **Knowledge Map Optimization** (Phase 4):
  - Web Worker for force-directed layout calculations (offloads main thread)
  - requestAnimationFrame for smooth pan/zoom interactions
  - Batch drawing by color groups for better rendering performance
  - Layout progress indicator during calculation
  - Simple circular layout fallback for small datasets (<50 nodes)
- **Email Infrastructure** (Phase 7):
  - Resend SDK integration for production email delivery
  - Bounce/failure webhook handler (`/api/webhooks/resend`)
  - Automatic email disable on hard bounces and spam complaints
  - node-cron scheduler for automated jobs
  - Weekly summary emails (Sundays 10 AM UTC)
  - Daily email prompts for Pro users (hourly, respects timezone)
- **Notification & ML Features** (Phase 8):
  - SM-2 spaced repetition algorithm for topic prioritization
  - Topic priority scoring based on: overdue time, mastery level, difficulty
  - Notification timing optimizer (respects user timezone and preferred time)
  - Quiet hours enforcement (no notifications before 7 AM or after 10 PM)
  - Preferred learning days support
- **Stripe Integration** (Phase 6):
  - Teachy Pro product with monthly ($9.99) and yearly ($99.90) pricing
  - 14-day free trial for new Pro subscribers
  - Trial eligibility tracking (prevents double trials)
  - Payment method collection during trial signup
  - Stripe Customer Portal integration for subscription management
  - Webhook handlers for trial events (`customer.subscription.trial_will_end`)
  - Enhanced subscription status endpoint with trial info (`isTrialing`, `trialDaysRemaining`, `eligibleForTrial`)
  - Setup script for Stripe product/price creation (`scripts/setup-stripe-products.ts`)

### Changed
- Migrated authentication from JWT to Supabase Auth
- Refactored Dashboard.tsx to use TanStack Query hooks (removed ~128 lines of manual fetch logic)
- Refactored Goals.tsx to use TanStack Query hooks and mutations (removed ~150 lines)
- Updated auth middleware to support both legacy JWT and Supabase tokens
- Extended query keys in `queryClient.ts` for commitment, learningInsights, and goals
- Enhanced `evaluateAnswer` API to accept knowledge base sources
- Session save flow now automatically persists knowledge base to SessionSource table
- **KnowledgeMap.tsx complete rewrite** with performance optimizations (useMemo, useCallback)
- **CodePlayground.tsx complete rewrite** (Phase 5):
  - Removed Python/Pyodide support (JavaScript only)
  - Replaced `new Function()` with isolated iframe sandbox (`allow-scripts` only)
  - Blocked dangerous APIs: fetch, XMLHttpRequest, WebSocket, Worker, localStorage, etc.
  - Console output captured via postMessage communication
  - Added 5-second execution timeout for infinite loop protection
  - Added React Error Boundary for graceful crash recovery
- **Email service rewrite** (Phase 7):
  - Replaced nodemailer SMTP with Resend SDK (nodemailer kept as dev fallback)
  - Added `sendPromptFeedbackEmail` function for email prompt responses
  - Added `validateUnsubscribeToken` helper for secure unsubscribe
- **Webhooks enhancement** (Phase 7):
  - Added Resend webhook handler for email.bounced, email.complained, email.delivered events
  - Updated email-inbound webhook to use centralized email service
- **Stripe webhook handlers enhanced** (Phase 6):
  - `checkout.session.completed` now detects trial status and sets `TRIALING`
  - `customer.subscription.updated` properly maps all Stripe statuses including `trialing`
  - `customer.subscription.trial_will_end` handler added for 3-day trial ending reminder
  - `invoice.payment_succeeded` handler added for recurring payment tracking
  - Improved logging for all subscription events
- **Checkout flow enhanced** (Phase 6):
  - Added `subscription_data.trial_period_days` for eligible users
  - Added trial metadata to checkout session
  - Upsert pattern for subscription record creation

### Fixed
- All 12 pre-existing TypeScript errors resolved
- Fixed `correctAnswers` → `questionsCorrect` in Dashboard.tsx
- Fixed `isAuthenticated` → `isAuthenticated()` in Library.tsx
- Fixed type annotations in Onboarding.tsx for LearningStyle
- Extended Settings and VideoMetadata interfaces in types/index.ts

---

## [0.9.0] - 2026-01-13

### Added
- Terms of Service and Privacy Policy pages
- Pro-only restriction for Code Playground
- Code editor reset and fullscreen functionality
- Mobile-responsive layout for code editor
- Code examples for programming tutorials
- Pro-only Learning Insights section on Dashboard
- Onboarding resume functionality
- Dashboard metrics and activity charts
- Free tier session limits (3 sessions for free users)

### Changed
- Dashboard caching improvements
- Source error handling enhancements

---

## [0.8.0] - 2026-01-12

### Added
- Quick review session for spaced repetition
- Difficulty calibration with accuracy tracking
- Start session directly from Feed video
- Timezone-aware day reset for commitment tracking
- Daily commitment level selector
- Busy week mode and vacation mode toggles
- Dashboard page with daily commitment widget
- Collapsible Sources panel in ActiveSession
- Unfollow confirmation modal in Feed
- Channel search functionality in Feed
- Follow channel prompt after session completion
- Commitment Calendar component
- Logout functionality with token refresh
- Onboarding flow improvements

### Changed
- Review maximum daily limit verification
- Skip option for review sessions

---

## [0.7.0] - 2026-01-12

### Added
- Subscription reactivation flow
- Monthly checkout flow ($12/month)
- Yearly pricing option ($99/year)
- Tutor personality integration in AI prompts
- Login/Signup call-to-action improvements
- LocalStorage migration with partial data handling
- Cross-device session sync for library
- Cloud persistence for active sessions
- Reduced motion accessibility support

### Changed
- Free tier pricing display updates
- Search debounce optimization
- Account deletion endpoint fixes

### Fixed
- Personality-aware fallback responses
- API key validation

---

## [0.6.0] - 2026-01-11

### Added
- Page transitions with Framer Motion
- Staggered list animations
- Modal open/close animations
- Skeleton loading screens (replacing spinners)
- Adaptive feedback animation based on answer quality
- Button press animation
- Correct answer celebration animation
- Progress bar fill animation
- Animated number counters
- Completion checkmark animation
- Card hover lift effect
- Focus state indicators
- Notification slide-in animation
- Animated Tooltip component
- Error state shake animation for form inputs

### Changed
- Replaced bouncy animations with professional easing
- Optimized animations for GPU acceleration

### Fixed
- Added ease-out to brutal-button transition

---

## [0.5.0] - 2026-01-10

### Added
- Knowledge base source extraction with type classification
- Fallback question generation for Dig Deeper mode
- Contextual fallback feedback for answer evaluation
- Dig Deeper chat modal with conversation persistence

### Changed
- Enhanced difficulty selection to affect API calls
- Added date filter UI improvements

---

## [0.4.0] - 2026-01-09

### Added
- Pagination in Library page
- Breadcrumb navigation component
- Session topic adjustment feature
- Video unavailable handling
- Error boundaries for graceful error handling
- Offline mode detection
- Lazy loading for performance
- Input character limits

### Changed
- Heading hierarchy fixes for accessibility

---

## [0.3.0] - 2026-01-08

### Added
- Feed page with YouTube channel integration
- Active session page with question flow
- Session notes and review pages
- Library page for session management
- Settings page with account management
- Pricing page with subscription tiers
- Goals page for PRO users
- Knowledge Map visualization
- Spaced repetition review system

---

## [0.2.0] - 2026-01-08

### Added
- Express.js backend API with Prisma ORM
- PostgreSQL database integration
- Redis caching layer
- JWT authentication system
- Gemini AI integration for question generation
- YouTube transcript fetching
- User, Session, Topic, Question models
- Subscription and payment tracking models

---

## [0.1.0] - 2026-01-08

### Added
- Initial project setup with Vite + React + TypeScript
- Tailwind CSS with neo-brutalist design system
- Core UI components (Card, Button, Input, Modal, Toast)
- Zustand stores for auth and session state
- React Router with protected routes
- Basic page structure (Home, Login, Signup)
- Project documentation and progress tracking

---

## Version History Summary

| Version | Date | Features | Progress |
|---------|------|----------|----------|
| 0.1.0 | 2026-01-08 | Initial setup | 49/302 (16.2%) |
| 0.2.0 | 2026-01-08 | Backend API | 165/302 (54.6%) |
| 0.3.0 | 2026-01-08 | Core pages | 209/302 (69.2%) |
| 0.4.0 | 2026-01-09 | UX improvements | 265/302 (87.7%) |
| 0.5.0 | 2026-01-10 | AI enhancements | 294/302 (97.4%) |
| 0.6.0 | 2026-01-11 | Animations | 302/415 (72.8%)* |
| 0.7.0 | 2026-01-12 | Subscriptions | 169/415 (40.7%)* |
| 0.8.0 | 2026-01-12 | Dashboard & Reviews | 290/415 (69.9%) |
| 0.9.0 | 2026-01-13 | Pro features | 372/415 (89.6%) |
| Unreleased | 2026-01-13 | Phases 0-8 (incl. Stripe) | ~411/415 (~99%) |

*Note: Feature count increased from 302 to 415 during Phase 2 planning, causing apparent progress decrease.

---

## Links

- [Phase 1-2 Todo](../docs/phase-1-2-todo.md) - Current implementation plan
- [Project Repository](https://github.com/your-org/teachy) - Source code
