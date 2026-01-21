# Phase 8 Test Checklist

**Phase:** Contextual Question Generation
**Tester:** _______________
**Date:** _______________

---

## Automated Verification Summary (2026-01-21)

The following items were verified programmatically via code analysis:

| Category | Verification | Status |
|----------|--------------|--------|
| Build | TypeScript compilation (`tsc -b`) | PASSED |
| Build | Vite production build | PASSED (601 modules) |
| Files | `resourceScraper.ts` exists | VERIFIED |
| Files | `QuestionSourceContext.tsx` exists | VERIFIED |
| Files | `NoTranscriptWarning.tsx` exists | VERIFIED |
| Types | `EnhancedTranscriptSegment` defined | VERIFIED |
| Types | `ScrapedResource` defined | VERIFIED |
| Types | `sourceQuote`/`sourceTimestamp` on Question | VERIFIED |
| Functions | `mergeShortSegments()` implemented | VERIFIED |
| Functions | `linkSegmentsToTopics()` implemented | VERIFIED |
| Functions | `scrapeGitHubRepo()` implemented | VERIFIED |
| Functions | `scrapeWebPage()` implemented | VERIFIED |
| Functions | `validateQuestion()` implemented | VERIFIED |
| Integration | QuestionSourceContext in ActiveSession | VERIFIED |
| Integration | NoTranscriptWarning in SessionOverview | VERIFIED |
| Integration | userName fix in Settings.tsx | VERIFIED |
| Accessibility | aria-expanded on QuestionSourceContext | VERIFIED |
| Accessibility | role="alert" on NoTranscriptWarning | VERIFIED |
| Accessibility | aria-live="polite" on NoTranscriptWarning | VERIFIED |

---

## Pre-Test Setup

- [x] Dev server compiles without errors (verified via `npm run build`)
- [x] Dev server running (`http://localhost:5173/` - Vite v6.4.1 ready)
- [x] API server running (`http://localhost:3001` - responding to requests)
- [x] **Transcript proxy running** (`node server.js` → `http://localhost:3002` - REQUIRED for transcripts!)
- [x] Redis running (`brew services list` shows started)
- [x] Logged in with PRO account (`test-admin@teachy.local` / `TestAdmin123!`)
- [x] Have a YouTube video URL ready that has a transcript
- [x] Have a YouTube video URL ready that does NOT have a transcript (for testing warning)

**IMPORTANT:** The transcript proxy (`server.js`) must be running on port 3002 for transcript extraction to work. Without it, sessions will be created without transcripts (degraded mode).

**Recommended Test Videos:**
- With transcript: Any popular tech tutorial (e.g., Fireship, Traversy Media)
- Without transcript: Live streams or very new videos often lack transcripts

---

## Core Functionality Tests

### Server Health

- [x] Dev server compiles without errors (build succeeded, 601 modules)
- [ ] All pages load without errors
- [ ] No new console errors or warnings
- [ ] No regressions in existing functionality (login, navigation, etc.)

---

## Phase 8.1: Transcript Infrastructure

### Code Verification (Automated)

- [x] `generateSegmentId()` function exists in `transcript.ts:243`
- [x] `mergeShortSegments()` function exists in `transcript.ts:272`
- [x] `linkSegmentsToTopics()` function exists in `transcript.ts:327`
- [x] `EnhancedTranscriptSegment` type extends `ParsedTranscriptSegment` in `types/index.ts:220`
- [x] `NoTranscriptWarning` component exists with proper accessibility attributes

### Transcript Segment Processing (Manual)

- [x] Create a new session with a YouTube video that has a transcript
- [x] Verify transcript segments are stored on the session (check browser DevTools -> Network -> session response)
- [x] Verify segments have required fields:
  - [ ] `id` (unique string)
  - [ ] `startTime` (number)
  - [ ] `endTime` (number)
  - [ ] `text` (string)
  - [ ] `duration` (computed number)

### Short Segment Merging (Manual)

- [-] Verify short segments (< 5 seconds) are merged with adjacent segments
-- Unsure as to what this test requires?
- [-] Verify merged segments maintain correct timing (startTime/endTime)
-- Unsure as to what this test requires?
- [-] Verify merged text is concatenated with space separator
-- Unsure as to what this test requires?

### No Transcript Warning (Manual)

- [x] Create a session with a video that has NO transcript
- [x] Verify `NoTranscriptWarning` component displays
- [x] Verify warning explains limited question quality
- [x] Verify warning has yellow neobrutalism styling (bg-eg-lemon)
- [x] Verify session still creates successfully (degraded mode)
- [x] Verify questions are still generated from title/description

---

## Phase 8.2: External Resource Scraping

### Code Verification (Automated)

- [x] `scrapeGitHubRepo()` function exists in `resourceScraper.ts:79`
- [x] `scrapeWebPage()` function exists in `resourceScraper.ts:172`
- [x] `scrapeResourcesFromTranscript()` function exists in `resourceScraper.ts:309`
- [x] `ScrapedResource` type defined with `sourceUrl`, `title`, `overview`, `rawContent` fields

### GitHub Scraping (Manual)

- [ ] Use a video that mentions a GitHub repository
- [ ] Verify GitHub repo is detected and scraped
- [ ] Verify scraped data includes:
  - [ ] `sourceUrl` (original GitHub URL)
  - [ ] `title` (repo name)
  - [ ] `overview` (AI-summarized)
  - [ ] `rawContent` (README excerpt, max 2000 chars)
- [ ] Verify repo metadata captured (stars, language, description)

### Web Page Scraping (Manual)

- [ ] Use a video that mentions documentation or article URLs
- [ ] Verify web pages are detected and scraped
- [ ] Verify page title is extracted
- [ ] Verify main content is extracted (limited to 2000 chars)
- [ ] Verify AI summarization is applied

### Rate Limiting (Manual)

- [ ] Verify max 5 GitHub repos are scraped per session
- [ ] Verify max 10 total resources are scraped per session
- [ ] Verify no blocking occurs if scraping fails (graceful degradation)

### Error Handling (Manual)

- [ ] Verify failed scrapes don't block session creation
- [ ] Verify partial results are still saved
- [ ] Verify timeout handling (5 seconds per resource)

---

## Phase 8.3: Contextual Question Generation

### Code Verification (Automated)

- [x] `validateQuestion()` function exists in `gemini.ts:816`
- [x] Question prompt template requires `sourceQuote` and `sourceTimestamp`
- [x] Question types defined in prompt with distribution requirements
- [x] Banned patterns check implemented (opinion/feeling, generic theme, yes/no)

### Question Source Fields (Manual)

- [ ] Verify generated questions include `sourceQuote` field
- [ ] Verify generated questions include `sourceTimestamp` field
- [ ] Verify `sourceTimestamp` is a valid number (seconds)
- [ ] Verify `sourceQuote` is a non-empty string from the transcript

### Question Validation - Banned Patterns (Manual)

Test that the following question types are NOT generated:

- [ ] No "How do you feel about..." questions (opinion/feeling)
- [ ] No generic "What is the main theme?" questions
- [ ] No "How would you apply this in your life?" questions
- [ ] No simple yes/no questions without follow-up

### Question Type Distribution (Manual)

Verify approximate distribution (check 10+ questions):

| Type | Target % | Observed |
|------|----------|----------|
| Comprehension | ~40% | ___% |
| Analysis | ~20% | ___% |
| Application | ~15% | ___% |
| Cause-Effect | ~15% | ___% |
| Comparison | ~10% | ___% |

### Questions Reference Scraped Resources (Manual)

- [ ] If scraped resources exist, some questions reference them
- [ ] Questions include `relatedResourceIds` where applicable

---

## Phase 8.4: UI Updates & Evaluation

### Code Verification (Automated)

- [x] `QuestionSourceContext` component exists with proper structure
- [x] Component imported and used in `ActiveSession.tsx:13,722`
- [x] Component has `aria-expanded` and `aria-controls` attributes
- [x] Timestamp link uses `target="_blank" rel="noopener noreferrer"`
- [x] "Learn More" section renders related resources with `sourceUrl` links
- [x] Evaluation prompt includes `sourceQuote` context in `gemini.ts:1186`

### QuestionSourceContext Component (Manual)

- [ ] Source context displays above each question
- [ ] Source quote shown in italics with quotation marks
- [ ] Timestamp badge displays formatted time (MM:SS)
- [ ] Attribution shows "From video" or resource title

### Timestamp Interaction (Manual)

- [ ] Timestamp badge is clickable (shows pointer cursor)
- [ ] Clicking timestamp opens YouTube at correct time
- [ ] Timestamp has visible hover state
- [ ] Timestamp has proper focus state (keyboard navigation)

### Learn More Section (Manual)

- [ ] "Learn More" section displays when related resources exist
- [ ] Each resource shows title and type icon
- [ ] Resource links open in new tab
- [ ] Links go to original `sourceUrl` (attribution preserved)

### Answer Evaluation Updates (Manual)

- [ ] Submit an incorrect answer
- [ ] Verify feedback references the source quote
- [ ] Verify feedback mentions the timestamp (e.g., "Based on the quote at 2:45...")
- [ ] Verify "Review at [timestamp]" link appears for incorrect answers
- [ ] Verify related resources are suggested in feedback

### Accessibility (Automated + Manual)

- [x] `aria-expanded` attribute on QuestionSourceContext toggle
- [x] `aria-controls` linking button to content
- [x] `role="alert"` on NoTranscriptWarning
- [x] `aria-live="polite"` on NoTranscriptWarning
- [x] `aria-label="Dismiss warning"` on dismiss button
- [ ] Color contrast meets WCAG AA standards (manual visual check)
- [ ] Clickable timestamps are keyboard accessible (Tab -> Enter)
- [ ] "Learn More" links are keyboard accessible
- [ ] Screen reader announces source context appropriately

---

## Settings Bug Fix

### Code Verification (Automated)

- [x] useEffect sync implemented in `Settings.tsx:197-208`
- [x] Fix syncs from `settings.userName` when `formData.userName` is empty

### userName Persistence (Manual)

- [ ] Go to Settings page
- [ ] Change "Your Name" to a new value
- [ ] Verify name updates in the UI
- [ ] Refresh the page
- [ ] Verify name persists after refresh
- [ ] Log out and log back in
- [ ] Verify name still persists

---

## Integration Tests

### Full Session Flow (Manual)

1. [ ] Create new session with a YouTube video that has transcript and external URLs
2. [ ] Verify processing steps show:
   - [ ] "Extracting transcript..."
   - [ ] "Fetching resources..."
   - [ ] "Generating topics..."
3. [ ] Navigate to Session Overview
4. [ ] Verify topics are generated with questions
5. [ ] Start learning session
6. [ ] Verify first question shows source context
7. [ ] Verify timestamp is clickable
8. [ ] Answer question incorrectly
9. [ ] Verify feedback references source
10. [ ] Answer question correctly
11. [ ] Verify progress tracking works
12. [ ] Complete session

### Degraded Mode - No Transcript (Manual)

1. [ ] Create session with video that has NO transcript
2. [ ] Verify warning displays on Session Overview
3. [ ] Verify questions are still generated (from title/description)
4. [ ] Verify session is still usable

---

## Issues Found

| Issue | Severity | Steps to Reproduce | Notes |
|-------|----------|-------------------|-------|
| | | | |
| | | | |
| | | | |

**Severity Levels:**
- **Critical:** Blocks core functionality
- **High:** Feature doesn't work as specified
- **Medium:** Works but with issues
- **Low:** Minor UI/UX issues

---

## Console Errors Check

List any new console errors or warnings observed during testing:

| Error/Warning | Page | Frequency |
|---------------|------|-----------|
| | | |
| | | |

**Build Warnings (non-blocking):**
- Chunk size warning: index.js is 1,019.86 kB (recommend code splitting)
- Dynamic import warning: sessionStore.ts mixed static/dynamic imports

---

## Sign-Off

### Automated Verification
- [x] TypeScript compilation passed
- [x] Vite build passed
- [x] All new files exist
- [x] All new types defined
- [x] All new functions implemented
- [x] Component integrations verified
- [x] Basic accessibility attributes present

### Manual Testing
- [ ] All Phase 8.1 tests passed
- [ ] All Phase 8.2 tests passed
- [ ] All Phase 8.3 tests passed
- [ ] All Phase 8.4 tests passed
- [ ] Settings bug fix verified
- [ ] Integration tests passed
- [ ] No critical/high severity issues remain
- [ ] Issues documented and tracked
- [ ] Ready for production

**Tester Signature:** _______________
**Date Completed:** _______________

---

## Notes

_Add any additional observations, edge cases discovered, or recommendations here:_

