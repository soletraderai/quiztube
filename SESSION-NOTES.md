# Session Notes

Cross-session documentation for tracking development progress with Claude Code.

---

## Test Accounts

| Type | Email | Password |
|------|-------|----------|
| PRO | `test-admin@teachy.local` | `TestAdmin123!` |
| FREE | `freetest.teachy@gmail.com` | `FreeTest123!` |

---

## Quick Reference

### Running the App
```bash
# Frontend (port 5173)
cd /Users/marepomana/Web/Teachy/generations/teachy
npm run dev

# Backend (port 3001) - requires Redis
cd /Users/marepomana/Web/Teachy/generations/teachy/api
npm run dev

# Start Redis
brew services start redis
```

### Key Files for Auth/Tier Issues
- `src/stores/authStore.ts` - Auth state management, tier fetching
- `src/components/ui/ProfileTicket.tsx` - Tier badge display
- `src/App.tsx` - AuthInitializer, hydration handling

---

## Sessions

### 2026-01-15: Pro Tier Display Fix (Phase 6)

**Problem:** Pro users showing as FREE despite database having correct tier=PRO. This was the 6th attempt to fix this issue.

**Root Cause:** 5 overlapping race conditions:
1. `isLoading: false` initial state
2. ProfileTicket defaults to 'Free'
3. Zustand persist hydrates stale data before fresh fetch
4. Backend failures silently default to FREE
5. AuthInitializer doesn't wait for hydration

**Fixes Applied:**
| Fix | File | Change |
|-----|------|--------|
| isLoading initial state | `authStore.ts:75` | Changed `false` → `true` |
| ProfileTicket default | `ProfileTicket.tsx:29` | Removed default, added loading state |
| Hydration tracking | `authStore.ts` | Added `hasHydrated` + `onRehydrateStorage` |
| AuthInitializer timing | `App.tsx` | Wait for hydration before init |
| Backend retry | `authStore.ts` | Added retry logic with tier preservation |

**Test Results:**
- [x] Login as test-admin@teachy.local - PASSED
- [x] Tier shows "PRO" immediately - PASSED
- [x] localStorage shows `tier: "PRO"` - PASSED
- [x] Sidebar ProfileTicket displays PRO badge - PASSED
- [x] Learning Insights shows PRO badge - PASSED
- [x] Page refresh preserves PRO tier - PASSED
- [x] FREE user login works correctly - PASSED

**Status:** RESOLVED

---

### 2026-01-20: Contextual Question Generation (Phase 8)

**Goal:** Implement contextual question generation with source quotes, timestamps, and external resource scraping.

**Changes Implemented:**

| Phase | Description | Status |
|-------|-------------|--------|
| 8.1 | Transcript Infrastructure | COMPLETE |
| 8.2 | External Resource Scraping | COMPLETE |
| 8.3 | Contextual Question Generation | COMPLETE |
| 8.4 | UI Updates & Evaluation | COMPLETE |

**New Files Created:**
- `src/services/resourceScraper.ts` - GitHub and web page scraping with AI summarization
- `src/components/ui/NoTranscriptWarning.tsx` - Warning for videos without transcripts
- `src/components/ui/QuestionSourceContext.tsx` - Displays source quote, timestamp, and related resources

**Key Changes:**

| File | Change |
|------|--------|
| `src/types/index.ts` | Added `EnhancedTranscriptSegment`, `ScrapedResource`, Question source fields |
| `src/services/transcript.ts` | Added segment ID generation, merging, topic linking, formatting for prompts |
| `src/services/session.ts` | Integrated enhanced transcript processing before topic generation |
| `src/services/gemini.ts` | Added `TopicGenerationOptions`, source context in prompts, question validation |
| `src/pages/ActiveSession.tsx` | Integrated `QuestionSourceContext` component |
| `src/pages/SessionOverview.tsx` | Integrated `NoTranscriptWarning` component |
| `src/pages/Settings.tsx` | Fixed userName persistence bug with useEffect sync |

**Features Delivered:**
- [x] Enhanced transcript segments with IDs, duration, speaker labels, topic linking
- [x] Short segment merging (< 5 seconds merged with adjacent)
- [x] GitHub README and repo metadata scraping
- [x] Web page content extraction and AI summarization
- [x] Rate limiting (5 GitHub repos, 10 total resources, 1s delay)
- [x] Source quote and timestamp on every question
- [x] Question validation (banned patterns: opinion, generic theme, yes/no)
- [x] Clickable timestamp badges linking to video position
- [x] "Learn More" section with related external resources
- [x] Answer evaluation references source context in feedback
- [x] Settings userName persistence fix

**Bug Fixes:**
- Fixed userName not persisting after page refresh (React useState captured initial empty value before Zustand rehydration)

**Status:** COMPLETE (pending manual testing)

---

### 2026-02-03: Smarter Question Generation (Phase 10)

**Goal:** Transform question generation from single-shot to a research-backed two-stage pipeline that separates content analysis from question generation.

**Changes Implemented:**

| Phase | Description | Status |
|-------|-------------|--------|
| 10.1 | Types & Content Analysis Engine | COMPLETE |
| 10.2 | Analysis-Aware Question Generation | COMPLETE |
| 10.3 | Pipeline Integration & Fallback | COMPLETE |
| 10.4 | Validation & Quality Assurance | PENDING |

**Key Changes:**

| File | Change |
|------|--------|
| `src/types/index.ts` | Added `BloomLevel`, `DOKLevel`, `ExtractedConcept`, `ConceptRelationship`, `ContentSection`, `ContentAnalysis` types; updated `Session` and `ProcessingState` |
| `src/services/gemini.ts` | Added `analyzeTranscriptContent()` (Stage 1), analysis-aware prompt (Stage 2) with cognitive distribution, updated `TopicGenerationOptions` |
| `src/services/session.ts` | Inserted Step 4.5 in `createSession()`, wired content analysis into pipeline, silent fallback on failure, adjusted progress percentages |

**Architecture:**
- **Stage 1:** `analyzeTranscriptContent()` — extracts 5-12 concepts with Bloom's/DOK mappings, relationships, misconceptions (temp=0.3, 12s timeout, 2 retries)
- **Stage 2:** Modified `generateTopicsFromVideo()` — uses structured `ContentAnalysis` JSON instead of raw transcript when available
- **Fallback:** Stage 1 failure silently falls back to existing single-stage generation; `RateLimitError` skips without retry
- **Cognitive distribution:** ~40% remember/understand, ~30% apply/analyze, ~20% evaluate/create, ~10% misconception-targeted

**Status:** IN PROGRESS (implementation complete, manual testing pending)

---

### 2026-02-04: Learning System Documentation (Phase 12)

**Goal:** Create comprehensive documentation for the lesson system architecture, establishing a single source of truth for data structures, terminology, and user experience design.

**Document Created:** `docs/learning-system/learning-overview.md`

**Key Decisions Made:**

| Decision | Resolution |
|----------|------------|
| Terminology | "Lesson" (not Session), "Chapters" (not Segments) |
| Transcript extraction | Apify (likely solution, not confirmed) |
| External sources | Summaries only (storage conscious) |
| Source detection | Transcript analysis + video description parsing |
| Processing log | Structured JSON format |
| Question evaluation | Three-tier (pass/fail/neutral) for guidance, not grading |
| Lesson summary | User rating on completion only (not critical) |

**Document Structure (v1.2):**

| Section | Content |
|---------|---------|
| 1. Lesson Components | Transcript, Video Metadata, Lesson Content, External Sources, Processing Log, Lesson Summary |
| 2. Question Evaluation | Three-tier system, score tracking |
| 3. User Learning Profile | Preferences, progress tracking (not essential) |
| 4. Data Flow | 7-step processing pipeline |
| 5. UI Concepts | Initial design patterns (not implemented) |
| 6. Open Questions | Future considerations |
| Changelog | Version history |

**Interfaces Defined:**
- `Chapter` — Transcript chapter with timestamps and content
- `ExternalSource` — Scraped URL summary with type and relevance
- `ProcessingLog` / `ProcessingStep` — Gemini decision trail
- `LessonScore` — Three-tier question tracking

**Status:** COMPLETE

---
