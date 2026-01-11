# Teachy - Phase 2 Product Requirements Document

**Version:** 2.2 | **Updated:** January 2026 | **Status:** Ready for Development

---

## Document Purpose

This document defines **what** we are building and **why**. Implementation decisions are left to the development team. Each section includes success criteria so developers understand what "done" looks like.

---

## Executive Summary

### The Problem

People watch hours of educational YouTube content but retain almost nothing. Studies show viewers forget 90% of video content within a week. This is wasted time and missed potential.

### The Solution

Teachy transforms passive video watching into active learning by:
1. Generating questions from any YouTube video using AI
2. Evaluating free-form answers and providing feedback
3. Using spaced repetition to ensure long-term retention
4. Adapting to each user's optimal learning conditions

### What Exists (v1.0 - Completed)

- Functional React app with YouTube transcript extraction
- Gemini-powered question generation and answer evaluation
- Session library with localStorage persistence
- 98.3% test coverage

**Limitation:** Browser-only storage means no multi-device access, no accounts, no business model.

### What We're Building (v2.0)

**Infrastructure:**
- User authentication and cloud persistence
- Subscription billing (Free/Pro tiers)
- API proxy for cost management and security

**Features (15 total):**
- 6 P0 (Launch): Onboarding, Daily Commitment, Progress Dashboard, Session Summary, Micro-interactions, Source Attribution
- 5 P1 (Month 1): Channel Following, Intelligent Learning, Tutor Personalities, Spaced Repetition, Email Prompts
- 4 P2 (Month 2): Knowledge Map, Code Editor, Timed Sessions, Learning Goals

---

## Design Philosophy

These principles guide all decisions:

| Principle | What It Means | Why It Matters |
|-----------|---------------|----------------|
| Hyper-personalisation | App observes behaviour and adapts automatically | Creates loyalty; users feel understood |
| Professional aesthetic | No gamification, points, badges, streaks, or emojis | Respects adult users; justifies premium pricing |
| Premium feel | Polished animations, considered typography and spacing | Differentiates from utilitarian competitors |
| Respect for users | No dark patterns, guilt messaging, or manipulation | Builds trust; reduces churn |

---

# Part 1: Business Context

## Target Users

### Primary Profile

Self-directed learners who watch educational YouTube and want to retain what they learn.

- **Age:** 25-45 primarily
- **Income:** Can afford $12/month for valuable tools
- **Location:** English-speaking countries (AU, UK, US)
- **Mindset:** Goal-oriented, time-conscious, quality-focused

### User Segments

| Segment | % of Market | Primary Need | Success Looks Like |
|---------|-------------|--------------|-------------------|
| Career Advancers | 40% | Track learning for professional growth | "I can demonstrate skill development" |
| Skill Builders | 30% | Practice alongside learning (esp. coding) | "I can actually do this thing" |
| Exam Preppers | 20% | Retain knowledge for certifications | "I passed my exam" |
| Curious Learners | 10% | Build broad knowledge enjoyably | "I can discuss these topics intelligently" |

### Jobs to Be Done

1. **Retain what I watch** - Remember important concepts from videos
2. **Prove I learned** - Have evidence for myself and others
3. **Build habits** - Learn consistently, not sporadically
4. **Learn efficiently** - Maximum retention for time invested
5. **Feel progress** - See knowledge growing over time

---

## Business Model

### Pricing

| Tier | Price | Purpose |
|------|-------|---------|
| Free | $0 | Experience core value; encourage upgrade |
| Pro | $12/month or $99/year | Full individual experience |

### Free Tier Limits

- 3 sessions per month
- 10 questions per session maximum
- Basic progress tracking only
- Default tutor personality only
- No: email prompts, export, spaced repetition, code editor

**Rationale:** Users experience value but feel constrained for serious use.

### Pro Tier Includes

Everything unlimited plus: all personalities, email prompts, export, full spaced repetition, code editor, knowledge map, custom goals, priority support.

---

## Success Metrics

### North Star

**Weekly Learning Minutes per User** - Target: 60 minutes/week

Why: Directly measures mission achievement. Revenue follows engagement.

### Key Metrics

| Category | Metric | Target |
|----------|--------|--------|
| Activation | Onboarding completion | >85% |
| Activation | Time to first value | <3 min |
| Engagement | Sessions per user per week | >3 |
| Engagement | Commitment achievement rate | >50% |
| Retention | Day 7 retention | >40% |
| Retention | Day 30 retention | >30% |
| Revenue | Free to Pro conversion | >5% |
| Revenue | Monthly churn (Pro) | <5% |
| Quality | NPS score | >50 |
| Quality | Page load time | <2s |

---

# Part 2: Technical Requirements

## System Architecture

### Components Needed

| Component | Purpose | Key Requirements |
|-----------|---------|------------------|
| Frontend | User interface | Fast, responsive, mobile-friendly, smooth animations |
| Backend API | Business logic, AI proxy, data management | Secure, scalable, <500ms response time |
| Database | Persistent storage | Encrypted, backed up, user data isolation |

### External Services

| Service | Purpose | Key Requirements |
|---------|---------|------------------|
| Authentication | User accounts, sessions, OAuth | Email/password, Google OAuth, password reset |
| Payments | Subscriptions, billing | Recurring billing, webhooks, customer portal |
| AI | Question generation, answer evaluation | Consistent quality, <10s generation time |
| Email | Transactional and learning prompts | Reliable delivery, inbound processing for replies |
| YouTube | Transcript extraction | Metadata extraction, handle missing transcripts |

**Important - Gemini API Migration:**

The current v1.0 dashboard allows users to enter their own Gemini API key. This must be removed in v2.0. Instead:

- A single Gemini API key (owned by Teachy) will be stored in server environment variables
- All AI requests will be proxied through the backend API
- Users will never see or enter an API key
- This enables usage tracking, rate limiting, and cost management
- The API key must never be exposed to the frontend

### Performance Requirements

- Page load: <2 seconds
- API response: <500ms standard requests
- AI generation: <10 seconds
- Animation frame rate: 60fps
- Uptime: 99.5%

### Security Requirements

- Passwords hashed, never plain text
- Sessions use secure tokens with expiry
- Failed login attempts rate limited
- All API endpoints authenticated (except public)
- User data isolated (users only access own data)
- All transmission over HTTPS
- API keys never exposed to clients

### Rate Limits by Tier

| Endpoint | Free | Pro |
|----------|------|-----|
| AI generation | 20/hour | 100/hour |
| General API | 100/15min | 500/15min |
| Auth | 5/minute | 5/minute |

---

## Data Requirements

### User Data

**Profile:** Email, display name, avatar, created/active dates

**Preferences:** Communication tone, language variant, learning style, purpose, daily commitment level, preferred time/days, email settings

**Subscription:** Tier, status, payment processor IDs, period dates

**Usage:** Sessions this month, questions this month, reset date

### Session Data

**Video:** YouTube ID, title, URL, channel name/ID, duration, thumbnail

**Session:** Status, transcript, timestamps, time spent

**Performance:** Questions generated/answered/correct, accuracy

### Topic Data

**Topic:** Name, description, category

**Questions:** Question text, correct answer, user answer, correctness, timestamps

**Mastery:** Level (introduced/developing/familiar/mastered), review dates, count, ease factor

### Learning Model Data

**Patterns:** Optimal time, session duration, difficulty level, pacing, device

**Performance by Category:** Accuracy, session count, last session date

**Engagement:** Sessions per week, completion rate, return rate, consistency

### Relationship Data

**Followed Channels:** Channel info, sessions completed, last session

**Goals:** Title, type, target, current value, deadline, status

**Daily Records:** Date, commitment met, questions answered, time spent

### Email Prompts

**Prompt:** Topic, question, correct answer, sent timestamp

**Response:** Opened/replied timestamps, user response, correctness

---

# Part 3: Feature Specifications

## Feature Overview

| ID | Feature | Priority | Tier | Purpose |
|----|---------|----------|------|---------|
| F01 | Personalised Onboarding | P0 | All | Capture preferences, drive first session |
| F02 | Channel Following | P1 | All | Content discovery, return visits |
| F03 | Intelligent Learning System | P1 | All | Automatic adaptation to user |
| F04 | Daily Commitment | P0 | All | Habit formation without gamification |
| F05 | Progress Dashboard | P0 | All | Meaningful progress visibility |
| F07 | Tutor Personalities | P1 | Pro+ | Communication style personalisation |
| F08 | Knowledge Map | P2 | Pro+ | Visual progress representation |
| F09 | Code Editor | P2 | Pro+ | Active practice for programming |
| F10 | Timed Sessions | P2 | Pro+ | Exam preparation |
| F11 | Spaced Repetition | P1 | Pro+ | Long-term retention |
| F12 | Session Summary | P0 | All | Closure and next steps |
| F13 | Learning Goals | P2 | Pro+ | Purpose and direction |
| F14 | Micro-interactions | P0 | All | Premium feel throughout |
| F15 | Source Attribution | P0 | All | Transparency and trust |
| F16 | Email Prompts | P1 | Pro+ | Frictionless reinforcement |

---

## P0 Features (Launch Required)

### F01: Personalised Onboarding Journey

#### What It Does

Interactive setup flow that captures preferences and leads directly into first session. Not a settings form - a conversation that personalises the entire experience.

**Captures:**
- Learning purpose (why they're using Teachy)
- Learning style (quick/thorough/challenging)
- Tutor personality (Professor/Coach/Direct/Creative)
- Language variant (British/American/Australian)
- Daily commitment level (5/15/30/45+ minutes)
- Preferred learning time and days

**Ends with:** User pasting first YouTube URL and answering first question.

#### Why It Matters

- First impressions determine retention
- Personalisation requires this data upfront
- Users accept friction if it creates visible value
- Completing first session is critical to retention

#### User Journey

1. Complete signup → Welcome screen
2. 5 screens with single questions each (~90 seconds total)
3. Summary with option to adjust
4. Paste YouTube URL prompt
5. First question appears → Onboarding complete

#### Success Criteria

| Metric | Target |
|--------|--------|
| Onboarding completion | >85% |
| Time to complete | <90 seconds |
| First session start rate | >80% |
| First session completion | >70% |
| Time to first value | <3 minutes |
| First-day return rate | >40% |

#### Key Considerations

- Each screen has one clear question
- Progress indicator visible
- Back button allows changes
- Mobile experience equally smooth
- Personality preview shows actual communication style
- If user abandons and returns, continue where they left off

---

### F04: Daily Learning Commitment

#### What It Does

Users set personal daily commitment. System tracks whether met each day. Displays consistency over time. **Not gamified streaks** - professional habit tracking.

**Commitment Levels:**
- Light: ~5 minutes
- Regular: ~15 minutes
- Dedicated: ~30 minutes
- Intensive: ~45+ minutes

**Also sets:** Preferred time, learning days, reminder preferences

**Flexibility:** Can adjust anytime, "busy week" mode, vacation mode, no penalties.

#### Why It Matters

- Habits drive retention
- Professional framing respects users ("you missed 2 days" vs "you BROKE your streak!")
- Flexibility prevents abandonment when life happens
- Self-set goals create personal accountability

#### User Journey

**Daily:** Open app → See today's commitment → Complete learning → See "Today complete"

**Weekly:** View calendar of completed/missed days → See "18 of 21 days (86%)"

**Adjusting:** Settings → Change level instantly → No penalty or acknowledgment

#### Success Criteria

| Metric | Target |
|--------|--------|
| Commitment set rate | >80% |
| Daily achievement rate | >50% |
| Weekly consistency (4+ days) | >60% |
| Reminder engagement | >30% |
| 30-day retention | >40% |

#### Key Considerations

- What counts as "meeting commitment"? (Time? Questions? Sessions?)
- Timezone handling for "today" reset
- Calendar visualisation should be simple, not complex heat maps
- Missed days neutral colour, not alarming
- Never use words: "streak," "broke," "lost," "failed"
- Celebrate consistency without punishing inconsistency

---

### F05: Progress Tracking Dashboard

#### What It Does

Professional dashboard showing learning journey through meaningful metrics - not points, but genuine measures of growth.

**Displays:**
- Summary: Sessions, time invested, topics, questions, accuracy
- Progress over time: Weekly/monthly charts, trends, comparisons
- Topic breakdown: Performance by area, strengths, improvement areas
- Insights (Pro): Behavioural patterns, personalised recommendations

**Export (Pro):** PDF or markdown for professional records

#### Why It Matters

- Progress visibility motivates continued effort
- Meaningful metrics respect intelligence
- Self-assessment drives improvement
- Professional evidence has external value (LinkedIn, reviews)

#### User Journey

**New user:** Empty dashboard with clear CTA to start first session

**After sessions:** Metrics populate, charts show activity, insights emerge

**Export:** Click export → Choose format → Download/email

#### Success Criteria

| Metric | Target |
|--------|--------|
| Dashboard view rate (weekly) | >50% |
| Time on dashboard | >30 seconds |
| Insight engagement | >30% |
| Export rate (Pro) | >10% |
| Sessions started from dashboard | >20% |

#### Key Considerations

- Empty states must not look broken
- Charts must be mobile-friendly
- Free vs Pro: What exactly is "basic" vs "full"?
- Performance with many sessions - consider caching
- Default time period: 7 days or 30 days?

---

### F12: Session Summary and Insights

#### What It Does

After each session, professional summary of learning, performance, and next steps.

**Includes:**
- Performance: Questions correct/total, accuracy, time spent
- Topics covered with breakdown
- Key takeaways: AI-generated 3-5 bullet points
- Strengths and areas for development
- Recommended next steps
- Export options (Pro)

**Also:** Weekly summary email

#### Why It Matters

- Closure creates satisfaction
- Reflection deepens learning
- Direction maintains momentum
- Exportable summaries extend value

#### User Journey

1. Answer final question → Completion animation
2. Summary appears automatically
3. Review performance → See takeaways → See recommendations
4. Act on recommendation OR start another session OR export

#### Success Criteria

| Metric | Target |
|--------|--------|
| Summary view rate | >90% |
| Summary scroll rate | >60% |
| Recommendation action rate | >30% |
| Export rate (Pro) | >15% |
| Weekly email open rate | >50% |

#### Key Considerations

- AI-generated takeaways must feel valuable, not generic
- Frame low scores without discouraging
- What if user closes before summary? (Accessible from library)
- PDF export should be professionally formatted

---

### F14: Premium Micro-interactions

#### What It Does

Polished animations throughout that provide feedback, guide attention, and create premium feel.

**Categories:**
- Feedback: Button presses, correct/incorrect answers, loading
- Transitions: Page changes, element enter/exit, modals
- Progress: Bar fills, number counters, completion states
- Interactive: Hover states, card lifts, focus indicators
- Attention: New elements, notifications, tooltips

#### Why It Matters

- Polish differentiates from utilitarian competitors
- Feedback improves usability
- Emotional impact drives continued use
- Professional aesthetic requires attention to detail

#### Design Principles

| Aspect | Guideline |
|--------|-----------|
| Timing | Short: 0.2-0.3s, Medium: 0.4-0.5s, Page: 0.6-0.8s, Max: 1s |
| Easing | Natural deceleration, never linear, never bouncy |
| Performance | GPU-accelerated properties only, test on slower devices |
| Accessibility | Respect prefers-reduced-motion, provide static alternatives |

#### Success Criteria

| Metric | Target |
|--------|--------|
| Lighthouse performance | >90 |
| Animation frame rate | 60fps |
| Reduced motion support | 100% |
| User perception | "Polished/Professional" |

#### Key Considerations

- Animation library choice affects bundle size
- Animations should be part of component library
- Consistent timing/easing across all components
- Manual QA required for animation testing

---

### F15: Knowledge Base with Source Attribution

#### What It Does

Shows exactly where information comes from when AI generates questions. Sources displayed in collapsible panel during sessions and in summaries.

**For each source:**
- Type (Documentation, Article, Repository, Video Transcript, Academic)
- Title and URL
- Brief description of what was used
- Access timestamp

#### Why It Matters

- Transparency builds trust (especially important with AI)
- Sources enable deeper learning
- Quality signals matter (official docs vs random blog)
- Models educational integrity

#### User Journey

1. During session: See "Sources: React Docs, Kent C. Dodds Blog"
2. Tap to expand → Full details with links
3. Click through to original source
4. In summary: Complete source list, exportable

#### Success Criteria

| Metric | Target |
|--------|--------|
| Source panel view rate | >40% |
| Source click-through rate | >15% |
| Trust rating | >4.5/5 |

#### Key Considerations

- How to capture which sources AI actually used?
- How to verify AI isn't hallucinating sources?
- Handle outdated/unavailable sources gracefully
- Sources visible but not intrusive

---

## P1 Features (Month 1)

### F02: Channel Following and Video Discovery

#### What It Does

Users follow favourite YouTube channels. App tracks which channels they learn from and surfaces relevant content.

**Features:**
- Follow prompt after session completion
- Search to find channels
- View followed channels with stats
- "Your Feed" with new content from followed channels

#### Why It Matters

- Reduces friction for returning (no need to find videos)
- Creates personalised discovery
- "New from your channels" drives return visits
- Following creates investment/switching costs

#### User Journey

1. Complete session → "Follow [Channel]?" → Tap Follow
2. Browse followed channels with session counts
3. See feed with new/unwatched videos
4. Start session directly from feed

#### Success Criteria

| Metric | Target |
|--------|--------|
| Follow acceptance rate | >40% |
| Channels per user (30-day) | >5 |
| Feed engagement | >60% |
| Sessions from feed | >20% |

#### Key Considerations

- Where does channel data come from? (Extracted from video vs YouTube API)
- "New videos" detection may be limited without YouTube API
- Consider "videos you haven't seen" vs "new uploads"
- Performance with many followed channels

---

### F03: Intelligent User Learning System

#### What It Does

Builds understanding of each user by observing behaviour. Model informs personalisation across entire app.

**Observed Signals:**
- Time of day patterns
- Session duration preferences
- Question pacing
- Difficulty sweet spot (70-80% accuracy zone)
- Topic performance
- Device preferences
- Completion patterns

**Adaptive Behaviours:**
- Question difficulty calibration
- Session recommendations
- Review timing
- Notification timing
- Content suggestions

**User Visibility:** Can see what system learned, correct/override, toggle signals, reset model

#### Why It Matters

- Personalisation is our differentiator
- Better outcomes drive retention
- Invisible optimisation feels magical
- Data moat (personalisation doesn't transfer to competitors)

#### User Journey

**Building:** First 5-10 sessions, system observes silently

**Experiencing:** Questions feel right difficulty, recommendations feel relevant

**Viewing:** Settings/Insights shows "Based on your history: You learn best in evenings, 75% difficulty sweet spot"

**Controlling:** Toggle signals, reset entirely, export data

#### Success Criteria

| Metric | Target |
|--------|--------|
| Model confidence (10 sessions) | >80% |
| Difficulty calibration accuracy | Within 5% of 70-80% target |
| Prediction accuracy | >70% |
| Opt-out rate | <5% |

#### Key Considerations

- How sophisticated does model need to be? (Heuristics vs ML)
- Cold-start problem handling
- Clear privacy explanation and controls
- GDPR compliance for data collection

---

### F07: Tutor Personalities and AI Behaviour

#### What It Does

Users choose AI communication style. Choice affects every AI interaction - questions, feedback, explanations.

**Personalities:**

| Personality | Style | Example |
|-------------|-------|---------|
| Professor | Formal, thorough, academic | "It is worth noting that this concept underpins..." |
| Coach | Encouraging, supportive, warm | "Great effort on that one. You've got the core idea..." |
| Direct | Concise, no-nonsense | "Incorrect. The key difference is X." |
| Creative | Analogies, metaphors, storytelling | "Think of it like a library where books reorganise..." |

#### Why It Matters

- Different people learn differently
- Personality creates relationship with AI
- Differentiation through humanisation
- Most visible form of personalisation

#### User Journey

1. Onboarding: See options with examples → Select one
2. All AI interactions use that style consistently
3. Settings: Can change anytime, preview before confirming

#### Success Criteria

| Metric | Target |
|--------|--------|
| Selection rate | >80% |
| Switch rate | 15-25% |
| Consistency rating | >4/5 |
| Satisfaction by personality | >4.5/5 |

#### Key Considerations

- AI prompt engineering for consistent personality
- Free tier gets default (Coach) only
- Personality works with all language variants
- Personality is style, not content limitation

---

### F11: Smart Review and Spaced Repetition

#### What It Does

Automatically schedules reviews at optimal intervals before user would forget. Transforms short-term into long-term retention.

**How It Works:**
1. Complete session → Topics added to review queue
2. System calculates forgetting points
3. Notification when review due
4. Quick review (5-10 questions, <5 min)
5. Performance determines next interval (1d→3d→1w→2w→1m...)

**Controls:** Maximum daily reviews, preferred times, vacation mode, priority settings

#### Why It Matters

- Retention is core promise
- Long-term value justifies subscription
- "Reviews due" drives daily return visits
- Competitive moat (learning history doesn't transfer)

#### User Journey

1. Complete session → "Added to review schedule"
2. Get notification → "3 topics ready for review"
3. Quick review → "Retention 72%→85%, next review in 1 week"
4. View all topics with mastery levels and next review dates

#### Success Criteria

| Metric | Target |
|--------|--------|
| Review completion rate | >60% |
| Retention improvement | >40% |
| Mastery progression | >25% |
| Review session length | <5 min |

#### Key Considerations

- Algorithm choice (SM-2 or variation)
- Should review questions come from original session or be newly generated?
- Notification strategy without annoying
- What makes a topic "mastered"?

---

### F16: Passive Learning Prompts via Email

#### What It Does

Periodically emails one question from learned topics. User replies with answer - no login required. System evaluates and sends feedback.

**Email Contains:** One question, topic name, reply instruction, skip option

**Frequency:** 2-3 times per week (configurable), never daily

**Reply Handling:** Parse reply → AI evaluate → Feedback email within seconds → Log to account

#### Why It Matters

- Reaches users outside the app
- Zero friction (replying is easier than opening app)
- Brief engagements strengthen memory
- Re-engagement mechanism for drifted users
- Counts toward daily commitment

#### User Journey

1. Email arrives: "Quick question: Marketing Fundamentals"
2. Reply with answer → Send
3. Within 30 seconds: Feedback email (correct/incorrect, explanation)
4. Later in app: See email answers logged, counts toward commitment

#### Success Criteria

| Metric | Target |
|--------|--------|
| Email open rate | >40% |
| Reply rate | >20% |
| Accuracy on email questions | >60% |
| Retention impact | >15% |
| Unsubscribe rate | <2% |

#### Key Considerations

- Email deliverability (SPF, DKIM, DMARC)
- Reply parsing with various email client formats
- Quick AI evaluation response required
- Match user by email address, handle edge cases

---

## P2 Features (Month 2)

### F08: Knowledge Map and Progress Visualisation

#### What It Does

Visual representation of everything learned. Topics as nodes, connections between related topics, nodes grow with mastery.

**Mastery Visualised:**
- Unexplored: Faded, small
- Introduced: Small
- Developing: Medium
- Familiar: Larger
- Mastered: Full size, bright

**Interactions:** Zoom/pan, tap for details, start review from node

#### Why It Matters

- Visualises invisible progress
- Reveals gaps and opportunities
- Shareable achievement (word-of-mouth)
- Justifies subscription investment

#### Success Criteria

| Metric | Target |
|--------|--------|
| Map view rate (weekly) | >40% |
| Time on map | >45 seconds |
| Map-driven sessions | >15% |
| Social shares | >5% |

---

### F09: Interactive Code Editor

#### What It Does

When coding content detected, offers integrated editor alongside session. Write, run, and experiment with code while learning.

**Supports:** JavaScript (browser), Python (WebAssembly), HTML/CSS (preview)

**Features:** Syntax highlighting, language detection, run in browser, save snippets

**Integration:** "Try it yourself" prompts, code-based questions evaluated

#### Why It Matters

- Coding requires practice, not just watching
- Differentiates for Skill Builder segment
- Retains users in app (vs switching to VS Code)
- Demonstrates sophistication

#### Success Criteria

| Metric | Target |
|--------|--------|
| Editor activation | >60% |
| Code execution rate | >70% |
| Retention improvement | >25% |

---

### F10: Timed Practice Sessions

#### What It Does

Optional timed sessions for testing under pressure. Professional skill-building, not gamified speed challenges.

**Types:**
- Rapid Review: 10 questions, 30 sec each
- Focused Practice: 15-20 questions, 15 min, single topic
- Comprehensive: 30 questions, 30 min, all topics

**Features:** Clean timer, progress indicator, skip/return, comparison to previous

#### Why It Matters

- Serves exam prep segment specifically
- Builds exam confidence
- Reveals true recall (vs unlimited thinking time)
- Adds variety

#### Success Criteria

| Metric | Target |
|--------|--------|
| Participation | >25% |
| Completion rate | >80% |
| Improvement rate | >60% |

---

### F13: Custom Learning Goals

#### What It Does

Users set personalised goals with targets and deadlines. Track progress with milestones.

**Types:**
- Time-based: "30 min daily", "10 hours this month"
- Topic-based: "10 sessions on Data Science", "80% accuracy in Marketing"
- Outcome-based: "Prepare for AWS cert by March"

**Features:** Progress visualisation, milestone acknowledgments, reminders, suggestions

#### Why It Matters

- Purpose drives engagement
- Self-set goals create accountability
- Visible progress is satisfying
- Goal completion creates celebration moments

#### Success Criteria

| Metric | Target |
|--------|--------|
| Goal set rate | >40% |
| Completion rate | >50% |
| Retention impact | >25% |

---

# Part 4: Delivery

## Implementation Phases

### Phase 0: Foundation (Weeks 1-3)

**Objective:** Technical infrastructure

**Deliver:**
- Authentication (signup, login, logout, password reset)
- Database schema
- Payment integration (checkout, webhooks, portal)
- AI service proxy
- Rate limiting
- CI/CD pipeline

**Done when:** Can create account, process payment, generate questions through proxy

### Phase 1: Launch (Weeks 4-6)

**Objective:** MVP for real users

**Deliver:**
- F01: Onboarding
- F04: Daily Commitment
- F05: Progress Dashboard
- F12: Session Summary
- F14: Micro-interactions
- F15: Source Attribution
- Migration from v1 localStorage

**Done when:** New users complete onboarding, sessions persist across devices, animations polished, tiers enforced

### Phase 2: Retention (Weeks 7-10)

**Objective:** Features that drive return visits

**Deliver:**
- F02: Channel Following
- F03: Intelligent Learning
- F07: Tutor Personalities
- F11: Spaced Repetition
- F16: Email Prompts

**Done when:** Channels followable, app adapts to patterns, personalities consistent, reviews scheduling, emails processing replies

### Phase 3: Depth (Weeks 11-14)

**Objective:** Power user features

**Deliver:**
- F08: Knowledge Map
- F09: Code Editor
- F10: Timed Sessions
- F13: Learning Goals

**Done when:** Map renders correctly, code runs in browser, timers work, goals trackable

---

## Launch Checklist

### Technical

- [ ] Production database secured and backed up
- [ ] API deployed with monitoring
- [ ] Frontend deployed with CDN
- [ ] SSL certificates active
- [ ] Error tracking configured

### Security

- [ ] Authentication working
- [ ] Rate limiting active
- [ ] Data isolation tested
- [ ] Webhooks verified

### Payments

- [ ] Products/prices created
- [ ] Webhooks tested
- [ ] Customer portal working

### Quality

- [ ] Tests passing
- [ ] Mobile tested
- [ ] Performance tested
- [ ] Animations respect reduced motion

### Legal

- [ ] Terms of service
- [ ] Privacy policy
- [ ] Cookie policy (if required)

### Launch

- [ ] Smoke tests passed
- [ ] Team available for support
- [ ] Rollback plan documented

---

## Appendix: Data Relationships

### User → Has Many
- Sessions
- Topics (through Sessions)
- Followed Channels
- Learning Goals
- Daily Learning Records
- Email Prompts

### Session → Has Many
- Topics
- Knowledge Sources

### Topic → Has
- Questions (embedded or related)
- Mastery tracking data
- Review schedule data

---

*End of Document*

**Version:** 2.2 | **Features:** 15 | **P0:** 6 | **P1:** 5 | **P2:** 4

Questions should be directed to product management.