# Phase 12 Tasks: Learning System Architecture

<!--
=============================================================================
TASK LIST - Created from phase-12-implementation-plan.md
Status: COMPLETE
=============================================================================
-->

## User Preferences

- **Rename strategy:** Type alias first (`Lesson = Session`), then incremental migration. App must compile after every sub-phase.
- **Spec compliance:** All interfaces, field names, and types must match `docs/learning-system/learning-overview.md` v1.2 exactly.
- **External source failures:** Graceful — a lesson works without sources. Never block lesson creation.
- **Chapter fallback:** If YouTube provides no chapter markers, fall back to time-based chunking (~5 minute intervals).
- **Processing log scope:** Summaries only (not raw prompts/responses) to avoid bloating the Lesson object.
- **Backward compatibility:** Existing sessions in localStorage and Supabase must remain accessible during and after migration.
- **Timed sessions:** `TimedSession` is a separate feature — rename only where it references `Session` types, do not merge into `Lesson`.

---

## Phase 12.1: Type System & Rename Foundation - COMPLETE

*Supports: Journey 1 (data model), Journey 2 (score tracking), Journey 4 (lesson summary)*

### 12.1.1 — Add New Interfaces to `src/types/index.ts`

- [x] Add `Chapter` interface after the `KnowledgeSource` interface (~line 64):
  ```typescript
  export interface Chapter {
    id: string;
    title: string;
    startTime: number;
    endTime: number;
    content: string;
    duration: number;
  }
  ```
- [x] Add `ExternalSource` interface after the new `Chapter` interface:
  ```typescript
  export interface ExternalSource {
    id: string;
    url: string;
    type: 'github' | 'documentation' | 'platform' | 'article' | 'other';
    title: string;
    summary: string;
    relevance: string;
    extractedAt: string;
  }
  ```
- [x] Add `ProcessingStep` interface after `ExternalSource`:
  ```typescript
  export interface ProcessingStep {
    timestamp: string;
    stage: 'transcript_fetch' | 'url_detection' | 'source_extraction' | 'content_analysis' | 'question_generation';
    input: string;
    decision: string;
    reasoning: string;
    output: string;
    success: boolean;
  }
  ```
- [x] Add `ProcessingLog` interface after `ProcessingStep`:
  ```typescript
  export interface ProcessingLog {
    lessonId: string;
    createdAt: string;
    steps: ProcessingStep[];
  }
  ```
- [x] Add `LessonSummary` interface after `ProcessingLog`:
  ```typescript
  export interface LessonSummary {
    completedAt: string;
    userRating: number;
    feedback?: string;
  }
  ```

**Success criteria:** All 5 new interfaces exist in `src/types/index.ts`, match the spec in `learning-overview.md` v1.2 field-for-field, and the project compiles with no TypeScript errors.

### 12.1.2 — Rename Session Types to Lesson Types

- [x] Rename `SessionScore` interface (line 206) to `LessonScore`
  - Verify it contains exactly: `questionsAnswered`, `questionsPassed`, `questionsFailed`, `questionsNeutral`, `topicsCompleted`, `topicsSkipped`
  - Note: current `SessionScore` has extra fields (`questionsCorrect`, `bookmarkedTopics`, `digDeeperCount`) — keep these as they're used by the app, but ensure the 6 spec fields are present
- [x] Add `export type SessionScore = LessonScore;` alias for backward compatibility during migration
- [x] Rename `SessionProgress` interface (line 220) to `LessonProgress`
  - Fields: `currentTopicIndex`, `currentQuestionIndex`, `answeredQuestions`, `isPaused`, `pausedAt`
- [x] Add `export type SessionProgress = LessonProgress;` alias for backward compatibility
- [x] Rename `SessionOverview` interface (line 277) to `LessonOverview`
- [x] Add `export type SessionOverview = LessonOverview;` alias for backward compatibility

**Success criteria:** New names are the canonical exports. Old names still exist as type aliases. Project compiles with no errors.

### 12.1.3 — Create Lesson Interface and Migrate Session

- [x] Rename the `Session` interface (line 229) to `Lesson`
- [x] Add the following new fields to the `Lesson` interface:
  - `chapters?: Chapter[]` (after `transcript`)
  - `externalSources?: ExternalSource[]` (after `scrapedResources` or replace `scrapedResources`)
  - `processingLog?: ProcessingLog` (after `contentAnalysis`)
  - `summary?: LessonSummary` (after `processingLog`)
- [x] Replace the `score: SessionScore` field type with `score: LessonScore`
- [x] Replace the `progress?: SessionProgress` field type with `progress?: LessonProgress`
- [x] Add `export type Session = Lesson;` alias for backward compatibility
- [x] Update `ProcessingState` type (line 308) to add new pipeline step names:
  - Add `'detecting_sources'` and `'extracting_summaries'` to the `step` union
  - Full union becomes: `'fetching_video' | 'extracting_transcript' | 'detecting_sources' | 'extracting_summaries' | 'fetching_resources' | 'building_knowledge' | 'analyzing_content' | 'generating_topics' | 'ready'`

**Success criteria:** `Lesson` is the primary interface with all 6 components from the spec representable. `Session` alias allows all existing code to continue compiling. New `ProcessingState` steps exist.

### 12.1.4 — Rename Session Store to Lesson Store

- [x] Copy `src/stores/sessionStore.ts` to `src/stores/lessonStore.ts`
- [x] In `lessonStore.ts`:
  - Rename the store creation: `useSessionStore` → `useLessonStore`
  - Rename state interface: `SessionState` → `LessonState` (if applicable)
  - Rename all internal references from `session`/`sessions` to `lesson`/`lessons`
  - Update the Zustand persist key from `'session-storage'` (or similar) to `'lesson-storage'` — **but add migration logic** to read from the old key so existing data isn't lost
  - Export `useLessonStore` as the primary export
  - Export `useSessionStore` as an alias: `export const useSessionStore = useLessonStore;`
- [x] Update `src/hooks/index.ts` to re-export from `lessonStore` instead of `sessionStore`
- [x] Keep `src/stores/sessionStore.ts` as a re-export file: `export { useLessonStore as useSessionStore, useLessonStore } from './lessonStore';`

**Success criteria:** `useLessonStore` is the canonical store. `useSessionStore` still works via alias. Existing localStorage data is preserved via migration. App loads without data loss.

### 12.1.5 — Update Store Imports Across Frontend Components

- [x] Update the following **page components** to import from `lessonStore` (or use the hook alias):
  - `src/pages/Home.tsx` — update `useSessionStore` → `useLessonStore`
  - `src/pages/ActiveSession.tsx` — update store import and all `session` variable names
  - `src/pages/SessionOverview.tsx` — update store import
  - `src/pages/SessionNotes.tsx` — update store import
  - `src/pages/ReviewSession.tsx` — update store import
  - `src/pages/Dashboard.tsx` — update store import
  - `src/pages/Library.tsx` — update store import
  - `src/pages/Settings.tsx` — update store import
  - `src/pages/Feed.tsx` — update store import
  - `src/pages/LearningPathDetail.tsx` — update store import
  - `src/pages/LearningPaths.tsx` — update store import
  - `src/pages/AuthCallback.tsx` — update store import
  - `src/pages/Pricing.tsx` — update store import
- [x] Update the following **timed session pages** (rename Session type references only):
  - `src/pages/TimedSessionActive.tsx`
  - `src/pages/TimedSessionHistory.tsx`
  - `src/pages/TimedSessionResults.tsx`
  - `src/pages/TimedSessions.tsx`
- [x] Update the following **UI components**:
  - `src/components/ui/Breadcrumb.tsx`
  - `src/components/ui/DigDeeperModal.tsx`
  - `src/components/ui/HelpPanel.tsx`
- [x] Update **services** to import `Lesson` instead of `Session`:
  - `src/services/session.ts` → rename to `src/services/lesson.ts` (keep `session.ts` as re-export)
  - `src/services/api.ts` — update type imports
  - `src/services/transcript.ts` — update type imports
  - `src/services/gemini.ts` — update type imports
  - `src/services/knowledgeBase.ts` — update type imports
- [x] Update **config and app**:
  - `src/config/routes.ts` — update route path names from `/session/` to `/lesson/` and rename helper functions (`getSessionUrl` → `getLessonUrl`). Keep old paths as redirects.
  - `src/App.tsx` — update route imports and component references
  - `src/stores/authStore.ts` — update any Session type references

**Success criteria:** All frontend files import `Lesson`/`useLessonStore` as their primary type/store. No TypeScript errors. Backward-compat aliases exist in re-export files.

### 12.1.6 — Update Prisma Schema (Backend)

- [x] In `api/prisma/schema.prisma`:
  - Rename `model Session` (line 183) to `model Lesson` — keep `@@map("sessions")` so the actual table name doesn't change yet (avoids data migration risk)
  - Rename `enum SessionStatus` (line 223) to `enum LessonStatus` — keep values the same
  - Rename `model SessionSource` (line 230) to `model LessonSource` — keep `@@map("session_sources")`
  - Update all relation references: `Session` → `Lesson`, `SessionStatus` → `LessonStatus`, `SessionSource` → `LessonSource`
  - Add new optional JSON fields to the `Lesson` model:
    - `chapters Json? @map("chapters")` — stores `Chapter[]` as JSON
    - `externalSources Json? @map("external_sources")` — stores `ExternalSource[]` as JSON
    - `processingLog Json? @map("processing_log")` — stores `ProcessingLog` as JSON
    - `lessonSummary Json? @map("lesson_summary")` — stores `LessonSummary` as JSON
  - Update `model SessionLearningNotes` to `model LessonLearningNotes` — keep `@@map("session_learning_notes")`
- [x] Run `cd api && npm run db:generate` to regenerate the Prisma client
- [x] Run `cd api && npm run db:push` to push schema changes (non-destructive since we keep `@@map` names)

**Success criteria:** Prisma client regenerates without errors. Existing data in Supabase is untouched. New JSON fields are available for storing chapters, external sources, processing log, and lesson summary.

### 12.1.7 — Update Backend API Routes

- [x] In `api/src/routes/sessions.ts`:
  - Update all `prisma.session` calls to `prisma.lesson` (Prisma client rename)
  - Update variable names from `session` → `lesson` in route handlers
  - Keep the route path as `/sessions` for now (will add `/lessons` alias in Phase 12.5)
- [x] Update the following route files to use renamed Prisma model:
  - `api/src/routes/ai.ts` — update `prisma.session` → `prisma.lesson`
  - `api/src/routes/questions.ts` — update `prisma.session` references
  - `api/src/routes/code.ts` — update `prisma.session` references
  - `api/src/routes/channels.ts` — update `prisma.session` references
  - `api/src/routes/engagements.ts` — update `prisma.session` references
  - `api/src/routes/progress.ts` — update `prisma.session` references and variable names
  - `api/src/routes/goals.ts` — update `prisma.session` references
  - `api/src/routes/learningModel.ts` — update `prisma.session` references
  - `api/src/routes/timedSessions.ts` — update any `prisma.session` references
  - `api/src/routes/users.ts` — update any `prisma.session` references
- [x] Update `api/src/index.ts` — keep existing `/sessions` mount, add `/lessons` as alias pointing to same router
- [x] Update `api/src/services/email.ts` — update any Session references

**Success criteria:** API server starts without errors. All existing endpoints continue to work. Prisma queries use the renamed model. `GET /api/sessions` and `GET /api/lessons` both work.

### 12.1.8 — Phase 12.1 Validation

- [x] Run `npm run build` in project root — no TypeScript compilation errors
- [x] Run `cd api && npm run build` — no backend compilation errors
- [x] Run `npm run lint` — no new lint errors
- [x] Start dev server (`npm run dev`) — frontend loads, all pages accessible
- [x] Start API server (`cd api && npm run dev`) — API responds to requests
- [x] Verify existing session data loads from localStorage (not lost by store rename)
- [x] Create a new lesson from a YouTube URL — full pipeline completes
- [x] Verify pause/resume still works on an existing lesson
- [x] Verify timed sessions still work
- [x] Grep check — `Session` as a standalone type (not in `TimedSession`) should have a corresponding `Lesson` definition or alias

**Success criteria:** Zero regressions. All existing features work. The type system is ready for the new Lesson components.

---

## Phase 12.2: Chapter Structure & Transcript Enhancement - COMPLETE

*Supports: Journey 1 (chapters populated), Journey 2 (chapter-aware context), Journey 3 (chapter navigation, transcript viewer)*

### 12.2.1 — Update Proxy Server for Chapter Markers

- [x] In `server.js`, update the `GET /api/transcript/:videoId` endpoint:
  - After fetching captions via `youtube-captions-api`, also attempt to fetch YouTube chapter markers
  - YouTube chapters can be extracted from the video description (lines starting with timestamps like `0:00`, `1:23`, `12:45`) or from the YouTube API's `videoChapters` data
  - Add a helper function `extractChaptersFromDescription(description: string): { title: string, startTime: number }[]` that parses timestamp lines
  - Return chapters in the response alongside existing `segments`, `fullText`, `language`, `isGenerated` fields:
    ```json
    {
      "segments": [...],
      "fullText": "...",
      "language": "en",
      "isGenerated": false,
      "chapters": [
        { "title": "Introduction", "startTime": 0 },
        { "title": "Getting Started", "startTime": 93 }
      ]
    }
    ```
  - If no chapters found in description, return `chapters: []`
- [x] In `server.js`, update the `GET /api/video/:videoId` endpoint:
  - Include the video description in the response (needed for chapter extraction and external source detection in Phase 12.3)
  - Add `description` field to the response JSON

**Success criteria:** `GET /api/transcript/:videoId` returns a `chapters` array (may be empty). `GET /api/video/:videoId` returns a `description` field. Existing transcript data is unchanged.

### 12.2.2 — Implement Chapter Extraction in Transcript Service

- [x] In `src/services/transcript.ts`, create `extractChapters()` function:
  ```typescript
  export function extractChapters(
    segments: ParsedTranscriptSegment[],
    youtubeChapters?: { title: string; startTime: number }[],
    videoDuration?: number
  ): Chapter[]
  ```
  - **When YouTube chapters are available:** Create one `Chapter` per YouTube chapter. For each chapter, set `startTime` and `endTime` (next chapter's `startTime` or `videoDuration`). Populate `content` by concatenating all transcript segments whose `startTime` falls within the chapter range. Compute `duration = endTime - startTime`. Generate `id` using a UUID or deterministic hash.
  - **When no YouTube chapters exist:** Fall back to time-based chunking. Split the transcript into chapters of ~5 minutes each. Generate titles from the first sentence of each chunk (truncated to 60 chars). Ensure no chapter is shorter than 1 minute or longer than 10 minutes.
  - **Edge cases:** Handle videos with only 1 chapter (the whole video). Handle very short videos (<5 min) as a single chapter.

- [x] In `src/services/transcript.ts`, create `generateChapterId()` helper:
  - Generate a deterministic ID based on video ID + chapter index (e.g., `ch-{videoId}-{index}`)

- [x] Add unit-testable validation: every chapter must have `content.length > 0`, `duration > 0`, `startTime < endTime`

**Success criteria:** `extractChapters()` returns a valid `Chapter[]` for both YouTube-chaptered and non-chaptered videos. Every transcript segment is assigned to exactly one chapter (no gaps, no overlaps).

### 12.2.3 — Integrate Chapters into Lesson Creation Pipeline

- [x] In `src/services/session.ts` (or `lesson.ts` after rename), update the `createSession()` / `createLesson()` function:
  - After fetching the transcript (step 3, ~25% progress), call `extractChapters()` with the raw segments and YouTube chapter markers
  - Store the result in a `chapters` variable
  - Add `chapters` to the final Lesson object

- [x] In `src/services/youtube.ts` (or wherever `fetchTranscript` is called):
  - Update to pass through the `chapters` array from the proxy server response
  - Return type should include `chapters?: { title: string; startTime: number }[]`

- [x] Update `src/stores/lessonStore.ts`:
  - Ensure `chapters` field is persisted in localStorage along with the rest of the Lesson object
  - Ensure `chapters` is included in cloud sync payload to Supabase

**Success criteria:** A newly created lesson has a `chapters` array populated. Chapters are persisted in localStorage and synced to Supabase. Existing lessons without chapters continue to work (field is optional).

### 12.2.4 — Update Question Source Context to Reference Chapters

- [x] In `src/services/gemini.ts`, update `generateTopicsFromVideo()`:
  - When `chapters` are available in options, include chapter structure in the prompt context
  - Add instruction: "Each question's `sourceTimestamp` should reference the chapter it comes from"
  - Pass chapter titles and timestamp ranges so Gemini can ground questions in specific chapters

- [x] In the `Question` interface (`src/types/index.ts`, line 79):
  - Add optional field `sourceChapterId?: string` — links the question to a specific chapter

- [x] Update `linkSegmentsToTopics()` in `src/services/transcript.ts`:
  - Add a new companion function `linkChaptersToTopics(chapters: Chapter[], topics: Topic[]): void` that sets `sourceChapterId` on each question based on timestamp overlap

**Success criteria:** Newly generated questions include a `sourceChapterId` that maps to a valid chapter. The "View Source" feature can look up the chapter by ID to show context.

### 12.2.5 — Chapter List UI Component

- [x] Create `src/components/lesson/ChapterList.tsx`:
  - Props: `chapters: Chapter[]`, `onChapterClick?: (chapter: Chapter) => void`, `activeChapterId?: string`
  - Renders a collapsible list of chapters (collapsed by default per spec)
  - Each row shows: chapter title, formatted timestamp range (`formatTimestamp(startTime)` – `formatTimestamp(endTime)`), duration
  - Active chapter is highlighted
  - Follows Neobrutalism design: hard black borders, electric yellow highlight for active
  - Accessible: keyboard navigable, ARIA `role="list"` with `role="listitem"`, `aria-expanded` on collapse toggle

- [x] Add the `ChapterList` to `src/pages/SessionOverview.tsx` (or `LessonOverview.tsx` after rename):
  - Render below the video info card
  - Show chapter count in the lesson stats (alongside topic count, question count)
  - Clicking a chapter scrolls to / highlights related topics

**Success criteria:** Lesson Overview displays a collapsible chapter list. Each chapter shows title + timestamp range. Clicking a chapter is interactive. Component is accessible via keyboard.

### 12.2.6 — Chapter-Based Transcript Viewer

- [x] Create `src/components/lesson/TranscriptViewer.tsx`:
  - Props: `chapters: Chapter[]`, `transcript: string`, `activeChapterId?: string`, `onTimestampClick?: (seconds: number) => void`
  - Renders the full transcript organized by chapter headings
  - Each chapter section shows: chapter title as heading, content as body text, timestamp link
  - Clicking a timestamp generates a YouTube URL with `?t=` parameter and opens it
  - "Play" button next to each chapter heading (per Journey 3 spec)
  - Scrolls to active chapter when `activeChapterId` changes
  - Collapsible panel (hidden by default, toggled via button)

- [x] Integrate `TranscriptViewer` into `src/pages/ActiveSession.tsx`:
  - Add a "View Transcript" toggle button
  - Show the transcript panel as a sidebar or overlay
  - When a question has a `sourceChapterId`, auto-scroll the transcript viewer to that chapter

- [x] Update the existing `ResourcesPanel` component (in `src/components/lesson/ResourcesPanel.tsx`):
  - Add a "Chapters" tab alongside existing resources
  - Display `ChapterList` within the resources panel

**Success criteria:** Users can view the full transcript organized by chapters during a lesson. Clicking timestamps opens the video at that point. The viewer auto-scrolls to the relevant chapter for the current question. Matches Journey 3 flow.

### 12.2.7 — Phase 12.2 Validation

- [x] Create a new lesson from a YouTube video that HAS chapter markers — verify `chapters` array is populated with correct titles and timestamps
- [x] Create a new lesson from a YouTube video that has NO chapter markers — verify chapters are auto-generated via time-based chunking
- [x] Verify the Lesson Overview page shows the chapter list with correct count
- [x] Verify clicking a chapter in the list highlights it and scrolls
- [x] Verify the transcript viewer shows content organized by chapters
- [x] Verify questions have `sourceChapterId` populated
- [x] Verify "View Source" on a question shows the correct chapter context
- [x] No TypeScript compilation errors (`npm run build`)
- [x] No new console errors or warnings
- [x] Existing lessons without chapters still display correctly

**Success criteria:** Chapter extraction works for both YouTube-chaptered and non-chaptered videos. Chapter list and transcript viewer are functional and accessible. Journey 3 (Verifying Source Material) is fully supported.

---

## Phase 12.3: External Sources Pipeline (Steps 3-4) - COMPLETE

*Supports: Journey 1 (sources detected and extracted), Journey 2 (questions reference sources), Journey 3 (source verification)*

### 12.3.1 — Create External Source Detection Service

- [x] Create new file `src/services/externalSources.ts`
- [x] Implement `detectSources()` function:
  ```typescript
  export function detectSources(
    transcript: string,
    videoDescription: string
  ): { url: string; foundIn: 'transcript' | 'description' }[]
  ```
  - Scan both `transcript` and `videoDescription` for URLs using a robust regex pattern:
    - Match `https?://...` patterns
    - Match common shortened URLs (youtu.be, bit.ly, t.co, etc.)
    - Match platform mentions like "github.com/...", "docs.python.org/..."
  - Deduplicate URLs (same URL found in both transcript and description → keep both `foundIn` values)
  - Filter out the source video's own YouTube URL
  - Filter out known non-content URLs (YouTube channel pages, social media profiles, generic domains like google.com)
  - Return array of `{ url, foundIn }` objects

- [x] Implement `classifySourceType()` helper:
  ```typescript
  export function classifySourceType(url: string): ExternalSource['type']
  ```
  - `github.com` → `'github'`
  - Known documentation domains (docs.*, developer.*, readthedocs.io, etc.) → `'documentation'`
  - Known article domains (medium.com, dev.to, blog.*, etc.) → `'article'`
  - Known platforms (npmjs.com, pypi.org, etc.) → `'platform'`
  - Everything else → `'other'`

**Success criteria:** `detectSources()` correctly identifies URLs from transcript text and video descriptions. Classification is accurate for common platforms. No false positives on the source video's own URL.

### 12.3.2 — Create External Source Summarization

- [x] In `src/services/externalSources.ts`, implement `extractSourceSummaries()`:
  ```typescript
  export async function extractSourceSummaries(
    detectedUrls: { url: string; foundIn: 'transcript' | 'description' }[],
    videoTitle: string
  ): Promise<ExternalSource[]>
  ```
  - For each detected URL:
    1. Fetch the URL content via a new proxy endpoint (see 12.3.3)
    2. Send the content to Gemini for summarization with a prompt requesting: title, summary (2-3 paragraphs max), relevance to the video
    3. Construct an `ExternalSource` object with: generated `id`, `url`, `type` (from `classifySourceType`), `title`, `summary`, `relevance`, `extractedAt` (ISO timestamp)
  - Process URLs in parallel (max 3 concurrent) to respect rate limits
  - Set a timeout of 10s per URL fetch — skip URLs that time out
  - Cap at 10 sources maximum per lesson to avoid excessive API calls
  - If Gemini summarization fails for a source, skip it (graceful degradation)

- [x] Implement the Gemini summarization prompt:
  - Input: URL content (truncated to 5000 chars), video title for context
  - Output: JSON with `title`, `summary`, `relevance`
  - Temperature: low (0.3) for factual accuracy

**Success criteria:** `extractSourceSummaries()` returns an `ExternalSource[]` with valid summaries. Failed URLs are skipped without crashing. Maximum 10 sources per lesson. Each source has all fields from the spec populated.

### 12.3.3 — Add Proxy Endpoint for Source Fetching

- [x] In `server.js`, add a new endpoint `POST /api/sources/fetch`:
  - Request body: `{ url: string }`
  - Fetches the URL content server-side (avoids CORS issues)
  - Extracts text content (strip HTML tags, keep meaningful text)
  - Returns: `{ content: string, title: string, statusCode: number }`
  - Timeout: 10 seconds per URL
  - Error handling: return `{ error: string, statusCode: number }` on failure
  - Rate limit: max 20 requests per minute per user

- [x] In `server.js`, add a new endpoint `POST /api/ai/summarize-source`:
  - Request body: `{ content: string, videoTitle: string, url: string }`
  - Sends the content to Gemini with summarization prompt
  - Returns: `{ title: string, summary: string, relevance: string }`
  - Uses the same Gemini API key and rate limiting as existing `/api/ai/generate`

**Success criteria:** Both endpoints respond correctly. URL fetching handles timeouts and errors gracefully. Summarization returns valid JSON. Rate limiting prevents abuse.

### 12.3.4 — Integrate External Sources into Lesson Pipeline

- [x] In `src/services/lesson.ts` (formerly `session.ts`), add two new pipeline steps after transcript extraction:
  - **Step 3: Detect Sources** (~30% progress):
    ```typescript
    onProgress?.({ step: 'detecting_sources', progress: 30, message: 'Detecting external sources...' });
    const detectedUrls = detectSources(transcript, videoDescription);
    ```
  - **Step 4: Extract Summaries** (~40% progress):
    ```typescript
    onProgress?.({ step: 'extracting_summaries', progress: 40, message: 'Extracting source summaries...' });
    const externalSources = await extractSourceSummaries(detectedUrls, metadata.title);
    ```
  - Wrap both steps in try/catch — if either fails, set `externalSources = []` and continue (lesson still works without sources)
  - Pass `videoDescription` into the pipeline (update function signature if needed)

- [x] Update progress percentages across all steps to accommodate the two new steps:
  | Step | Old % | New % |
  |------|-------|-------|
  | `fetching_video` | 10 | 10 |
  | `extracting_transcript` | 25 | 20 |
  | `detecting_sources` | — | 30 |
  | `extracting_summaries` | — | 40 |
  | `building_knowledge` | 45 | 50 |
  | `analyzing_content` | 60 | 60 |
  | `generating_topics` | 80 | 80 |
  | `ready` | 100 | 100 |

- [x] Add `externalSources` to the final Lesson object creation
- [x] Pass `externalSources` to `generateTopicsFromVideo()` in the options so questions can reference them
- [x] Add import for `detectSources` and `extractSourceSummaries` from `./externalSources`

**Success criteria:** The pipeline runs all 7 steps (including new steps 3-4). External sources are populated on the Lesson object. If source detection/extraction fails, the lesson is still created successfully with empty sources. Progress bar shows 7 stages.

### 12.3.5 — Update Question Generation to Reference External Sources

- [x] In `src/services/gemini.ts`, update the `generateTopicsFromVideo()` prompt:
  - When `externalSources` are available in options, include them in the prompt context:
    ```
    External Sources Referenced in This Video:
    1. [title] (type) - [summary] - [relevance]
    2. ...
    ```
  - Add instruction: "When a question is based on or related to an external source, include the source URL in the question's `relatedResourceIds` field"
- [x] Update the `Question` interface in `src/types/index.ts`:
  - Add optional field `relatedExternalSourceIds?: string[]` — array of ExternalSource IDs

**Success criteria:** Questions generated from videos that reference external sources include `relatedExternalSourceIds` linking to the relevant `ExternalSource` objects.

### 12.3.6 — Display External Sources in Lesson Overview

- [x] Create `src/components/lesson/ExternalSourceCard.tsx`:
  - Props: `source: ExternalSource`
  - Displays: type badge (icon + label for github/documentation/article/platform/other), title, summary (truncated to 2 lines with expand), relevance note, link to original URL
  - Type badge colors: GitHub → purple, Documentation → blue, Article → green, Platform → orange, Other → gray
  - Neobrutalism styling: hard borders, bold type badges

- [x] Create `src/components/lesson/ExternalSourcesList.tsx`:
  - Props: `sources: ExternalSource[]`
  - Renders a list of `ExternalSourceCard` components
  - Shows count: "X external sources referenced"
  - Collapsed by default with expand toggle

- [x] Add `ExternalSourcesList` to the Lesson Overview page:
  - Render below the chapter list
  - Only show section if `externalSources.length > 0`

- [x] Add source context to the active lesson question view:
  - When a question has `relatedExternalSourceIds`, show a "Referenced Sources" link below the question
  - Clicking it reveals the relevant `ExternalSourceCard`(s)

**Success criteria:** Lesson Overview shows external sources with type badges. During active learning, questions that reference external sources display source context. Links to original URLs work. Matches Journey 3 flow.

### 12.3.7 — Phase 12.3 Validation

- [x] Create a lesson from a video that mentions GitHub repos, documentation sites, or articles — verify sources are detected and summarized
- [x] Create a lesson from a video with no external references — verify `externalSources` is empty and UI handles gracefully
- [x] Verify external source type classification is correct (GitHub = github, MDN = documentation, etc.)
- [x] Verify questions reference external sources when relevant
- [x] Simulate source fetch failure (unreachable URL) — verify lesson creation still succeeds
- [x] Simulate Gemini rate limit during summarization — verify graceful degradation
- [x] Verify external sources display on Lesson Overview with correct type badges
- [x] Verify source context is visible during active lesson on relevant questions
- [x] No TypeScript compilation errors (`npm run build`)
- [x] No new console errors or warnings

**Success criteria:** External source pipeline works end-to-end for videos with references. Graceful failure for videos without references or when fetching fails. Journey 1 (steps 3-4) and Journey 3 (source verification) are supported.

---

## Phase 12.4: Processing Log & Lesson Summary - COMPLETE

*Supports: Journey 4 (lesson rating), Journey 5 (processing log transparency)*

### 12.4.1 — Create Pipeline Logger Service

- [x] Create new file `src/services/processingLog.ts`
- [x] Implement `PipelineLogger` class:
  ```typescript
  export class PipelineLogger {
    private lessonId: string;
    private steps: ProcessingStep[] = [];

    constructor(lessonId: string);

    logStep(
      stage: ProcessingStep['stage'],
      input: string,
      decision: string,
      reasoning: string,
      output: string,
      success: boolean
    ): void;

    finalize(): ProcessingLog;
  }
  ```
  - `constructor`: Sets `lessonId`, records `createdAt` as ISO timestamp
  - `logStep`: Creates a `ProcessingStep` with current ISO `timestamp` and appends to `steps[]`
  - `finalize`: Returns the complete `ProcessingLog` object
  - All `input`, `decision`, `reasoning`, `output` strings should be truncated to 500 chars max to prevent bloat

**Success criteria:** `PipelineLogger` can be instantiated, steps can be logged, and `finalize()` returns a valid `ProcessingLog` matching the spec. String fields are capped at 500 chars.

### 12.4.2 — Integrate Logger into Lesson Creation Pipeline

- [x] In `src/services/lesson.ts`, instantiate the logger at pipeline start:
  ```typescript
  const logger = new PipelineLogger(lessonId);
  ```
- [x] Add logging calls after each pipeline step:
  - After **transcript fetch** (step 2):
    ```typescript
    logger.logStep('transcript_fetch',
      `Video ID: ${videoId}`,
      `Fetched ${segments.length} segments, ${transcript.length} chars`,
      `Used youtube-captions-api via proxy server`,
      `${chapters.length} chapters extracted, language: ${language}`,
      true
    );
    ```
  - After **URL detection** (step 3):
    ```typescript
    logger.logStep('url_detection',
      `Scanned transcript (${transcript.length} chars) and description`,
      `Found ${detectedUrls.length} URLs`,
      `Detected in: ${detectedUrls.filter(u => u.foundIn === 'transcript').length} transcript, ${detectedUrls.filter(u => u.foundIn === 'description').length} description`,
      `URLs: ${detectedUrls.map(u => u.url).join(', ')}`,
      true
    );
    ```
  - After **source extraction** (step 4):
    ```typescript
    logger.logStep('source_extraction',
      `${detectedUrls.length} URLs to process`,
      `Summarized ${externalSources.length} sources`,
      `Types: ${externalSources.map(s => s.type).join(', ')}`,
      `Sources: ${externalSources.map(s => s.title).join(', ')}`,
      externalSources.length > 0
    );
    ```
  - After **content analysis** (step 5):
    ```typescript
    logger.logStep('content_analysis',
      `Transcript with ${chapters.length} chapters`,
      `Identified ${contentAnalysis?.concepts?.length || 0} concepts`,
      `Domain: ${contentAnalysis?.subjectDomain || 'unknown'}, Complexity: ${contentAnalysis?.overallComplexity || 'unknown'}`,
      `Concepts: ${contentAnalysis?.concepts?.map(c => c.name).join(', ') || 'none'}`,
      !!contentAnalysis
    );
    ```
  - After **question generation** (step 6):
    ```typescript
    logger.logStep('question_generation',
      `${topics.length} topics requested`,
      `Generated ${topics.length} topics with ${topics.reduce((sum, t) => sum + t.questions.length, 0)} questions`,
      `Used ${contentAnalysis ? 'two-stage' : 'single-stage'} pipeline`,
      `Topics: ${topics.map(t => t.title).join(', ')}`,
      topics.length > 0
    );
    ```
- [x] On any step failure, log with `success: false` and include the error message in the `output` field
- [x] After all steps, call `logger.finalize()` and store on the Lesson object as `processingLog`

**Success criteria:** Every lesson created has a `processingLog` with 5 `ProcessingStep` entries. Each step records meaningful input/decision/reasoning/output. Failures are logged with `success: false`.

### 12.4.3 — Processing Log UI

- [x] Create `src/components/lesson/ProcessingLogView.tsx`:
  - Props: `processingLog: ProcessingLog`
  - Displays each `ProcessingStep` as an expandable accordion row
  - Each row shows:
    - Stage name (human-readable label, e.g., "Transcript Fetch" instead of "transcript_fetch")
    - Success/failure indicator (green check / red X)
    - Timestamp
  - Expanded view shows: input, decision, reasoning, output
  - Neobrutalism styling: hard borders, monospace for technical details

- [x] Create stage name mapping:
  | `stage` value | Display Label |
  |---|---|
  | `transcript_fetch` | Transcript Extraction |
  | `url_detection` | Source Detection |
  | `source_extraction` | Source Summarization |
  | `content_analysis` | Content Analysis |
  | `question_generation` | Question Generation |

- [x] Add "How this lesson was built" collapsible section to the Lesson Overview page (`SessionOverview.tsx` / `LessonOverview.tsx`):
  - Only show if `lesson.processingLog` exists
  - Render `ProcessingLogView` inside the collapsible section
  - Collapsed by default

- [x] Add the same section to the Lesson Notes page (`SessionNotes.tsx` / `LessonNotes.tsx`):
  - Render at the bottom of the page, before source materials

**Success criteria:** Processing log is viewable on both Lesson Overview and Notes pages. Each stage is displayed with success/failure status. Expanded view shows full decision trail. Matches Journey 5 flow.

### 12.4.4 — Lesson Summary & Rating UI

- [x] Create `src/components/lesson/LessonRating.tsx`:
  - Props: `lessonId: string`, `onSubmit: (summary: LessonSummary) => void`
  - Displays:
    - Star rating widget (1-5 stars, clickable, keyboard accessible)
    - Optional text feedback textarea (placeholder: "How was this lesson? Any feedback?")
    - Submit button
  - On submit, constructs `LessonSummary` with `completedAt` (current ISO timestamp), `userRating`, optional `feedback`
  - Neobrutalism styling: yellow stars, hard-bordered textarea

- [x] Add star rating component:
  - Interactive stars with hover preview
  - Keyboard accessible: arrow keys to change rating, Enter to confirm
  - ARIA: `role="radiogroup"` with `role="radio"` for each star, `aria-label="Rate this lesson 1-5"`

- [x] Integrate `LessonRating` into the Lesson Notes page:
  - Show the rating prompt after the completion banner
  - Only show if `lesson.summary` is not yet set (don't re-prompt)
  - On submit, save `LessonSummary` to `lesson.summary` via store
  - Display the existing rating if already submitted (read-only stars + feedback text)

### 12.4.5 — Lesson Summary Backend Persistence

- [x] Add API endpoint `PATCH /api/lessons/:id/summary` (in `api/src/routes/sessions.ts` or new `lessons.ts`):
  - Request body: `{ userRating: number, feedback?: string }`
  - Validates: `userRating` is 1-5 integer, `feedback` is string (max 1000 chars)
  - Updates the `lessonSummary` JSON field on the Lesson record
  - Returns the updated lesson summary

- [x] Update `src/stores/lessonStore.ts`:
  - Add action `saveLessonSummary(lessonId: string, summary: LessonSummary)`:
    - Updates the local lesson's `summary` field
    - Syncs to backend via the new API endpoint
  - Add action `getLessonSummary(lessonId: string): LessonSummary | undefined`

- [x] Update `src/services/api.ts`:
  - Add `saveLessonSummary(lessonId: string, summary: LessonSummary): Promise<void>` API call

**Success criteria:** Users can rate a lesson 1-5 stars with optional feedback. Rating is persisted locally and synced to Supabase. Rating shows as read-only after submission. Matches Journey 4 flow.

### 12.4.6 — Phase 12.4 Validation

- [x] Create a new lesson — verify `processingLog` is populated with 5 steps
- [x] Verify all 5 processing steps show `success: true` for a normal lesson
- [x] Simulate a step failure (e.g., break source extraction) — verify the failed step shows `success: false` with error message
- [x] Verify "How this lesson was built" section appears on Lesson Overview
- [x] Verify expanding a processing step shows input/decision/reasoning/output
- [x] Complete a lesson — verify the rating prompt appears
- [x] Submit a 4-star rating with feedback text — verify it persists
- [x] Navigate away and back — verify the rating shows as read-only
- [x] Verify the rating is stored in Supabase (check via Prisma Studio)
- [x] No TypeScript compilation errors (`npm run build`)
- [x] No new console errors or warnings

**Success criteria:** Processing log transparency works end-to-end (Journey 5). Lesson rating works end-to-end (Journey 4). Both features degrade gracefully on failure.

---

## Phase 12.5: Pipeline Orchestrator & Final Integration - COMPLETE

*Supports: All 5 Journeys — end-to-end validation*

### 12.5.1 — Create Lesson Pipeline Orchestrator

- [x] In `src/services/lesson.ts`, refactor `createSession()` into `createLesson()`:
  - Rename the function: `createSession` → `createLesson`
  - Export `createSession` as an alias for backward compatibility
  - Ensure the function signature includes video description for source detection:
    ```typescript
    export async function createLesson(
      youtubeUrl: string,
      onProgress?: (state: ProcessingState) => void
    ): Promise<Lesson>
    ```
  - The full pipeline order inside the function:
    1. Extract video ID from URL
    2. Fetch video metadata (10%) → `Lesson.video`
    3. Fetch transcript + extract chapters (20%) → `Lesson.transcript`, `Lesson.chapters`
    4. Detect external sources (30%) → URL list
    5. Extract source summaries (40%) → `Lesson.externalSources`
    6. Build knowledge base (50%) → `Lesson.knowledgeBase` (existing)
    7. Analyze content (60%) → `Lesson.contentAnalysis`
    8. Generate topics & questions (80%) → `Lesson.topics`
    9. Finalize: save processing log (100%) → `Lesson.processingLog`
  - Each step logs to `PipelineLogger`
  - Each step wrapped in try/catch with graceful degradation

- [x] Add `export { createLesson as createSession }` for backward compat

**Success criteria:** `createLesson()` orchestrates all 7 data pipeline steps from the learning overview spec. Every step logs to the processing log. Failures in non-critical steps (sources, content analysis) don't block lesson creation.

### 12.5.2 — Update Processing State UI for 7 Stages

- [x] Update `src/pages/Home.tsx`:
  - Change `createSession()` call to `createLesson()`
  - Processing indicator now shows 7 stages with updated messages:
    | Step | Progress | Message |
    |------|----------|---------|
    | `fetching_video` | 10% | "Fetching video information..." |
    | `extracting_transcript` | 20% | "Extracting transcript & chapters..." |
    | `detecting_sources` | 30% | "Detecting external sources..." |
    | `extracting_summaries` | 40% | "Summarizing referenced sources..." |
    | `building_knowledge` | 50% | "Building knowledge base..." |
    | `analyzing_content` | 60% | "Analyzing content structure..." |
    | `generating_topics` | 80% | "Generating topics & questions..." |
    | `ready` | 100% | "Lesson ready!" |
  - Update the progress bar to smoothly transition between stages

- [x] Update `saveSession()` call to `saveLesson()` (or equivalent) after creation
- [x] Update navigation: redirect to `/lesson/{id}/overview` instead of `/session/{id}/overview`

**Success criteria:** Home page shows all 7 processing stages during lesson creation. Messages are clear and informative. Progress bar advances smoothly.

### 12.5.3 — Add `/api/lessons` Route Alias

- [x] In `api/src/index.ts`, mount the sessions router at both paths:
  ```typescript
  app.use('/api/sessions', sessionsRouter);  // backward compat
  app.use('/api/lessons', sessionsRouter);   // new canonical path
  ```
- [x] Update `src/services/api.ts` to use `/api/lessons` as the primary endpoint:
  - Update all fetch URLs from `/api/sessions/...` to `/api/lessons/...`
  - The backend accepts both paths so this is safe

**Success criteria:** Both `/api/sessions` and `/api/lessons` resolve to the same handlers. Frontend uses `/api/lessons` as the canonical path.

### 12.5.4 — Update Route Paths (Frontend)

- [x] In `src/config/routes.ts`:
  - Add new route paths:
    - `lessonOverview: '/lesson/:lessonId/overview'`
    - `lessonActive: '/lesson/:lessonId/active'`
    - `lessonNotes: '/lesson/:lessonId/notes'`
  - Add helper function: `getLessonUrl(lessonId: string, page: 'overview' | 'active' | 'notes')`
  - Keep old `/session/:sessionId/...` paths as aliases (React Router redirects)

- [x] In `src/App.tsx`:
  - Add new `/lesson/...` routes pointing to the same page components
  - Add `<Navigate>` redirects from old `/session/...` paths to `/lesson/...` paths

- [x] Update all `navigate()` calls across pages to use new `/lesson/` paths:
  - `src/pages/Home.tsx` — navigate to `/lesson/{id}/overview`
  - `src/pages/ActiveSession.tsx` — navigate to `/lesson/{id}/notes` on completion
  - `src/pages/SessionOverview.tsx` — navigate to `/lesson/{id}/active`
  - `src/pages/Dashboard.tsx` — lesson links
  - `src/pages/Library.tsx` — lesson links
  - `src/pages/ReviewSession.tsx` — lesson links

**Success criteria:** `/lesson/:id/overview`, `/lesson/:id/active`, `/lesson/:id/notes` are the canonical routes. Old `/session/...` paths redirect. No broken navigation.

### 12.5.5 — Final Session → Lesson Rename Cleanup

- [x] Search entire codebase for remaining `Session` references (excluding `TimedSession`, aliases, and docs):
  ```
  grep -r "Session" --include="*.ts" --include="*.tsx" src/ | grep -v TimedSession | grep -v "type Session = Lesson" | grep -v node_modules
  ```
- [x] Rename any remaining page component files:
  - `src/pages/ActiveSession.tsx` → `src/pages/ActiveLesson.tsx`
  - `src/pages/SessionOverview.tsx` → `src/pages/LessonOverview.tsx`
  - `src/pages/SessionNotes.tsx` → `src/pages/LessonNotes.tsx`
  - `src/pages/ReviewSession.tsx` → `src/pages/ReviewLesson.tsx`
  - Keep old filenames as re-exports for any external imports
- [x] Rename component directory contents:
  - `src/components/lesson/LessonTopBar.tsx` — already "Lesson" named (verify)
  - `src/components/lesson/LessonBottomBar.tsx` — already "Lesson" named (verify)
- [x] Update all user-facing UI text:
  - "Session" → "Lesson" in button labels, headings, toasts, and messages
  - "Start Session" → "Start Lesson"
  - "Session Overview" → "Lesson Overview"
  - "Session Notes" → "Lesson Notes"
  - "Save Session" → "Save Lesson"
  - "Session ready!" → "Lesson ready!"
  - "Lesson in Progress" (on paused lessons)
- [x] Update `CLAUDE.md` to reflect new terminology and file paths

**Success criteria:** No user-facing UI text says "Session" (except Timed Sessions which is a separate feature). File names reflect "Lesson" terminology. A grep for standalone "Session" returns only: type aliases, TimedSession references, and documentation.

### 12.5.6 — End-to-End Integration Testing

- [x] **Journey 1 test: Create a lesson from a YouTube URL**
  - Paste a URL → observe all 7 processing stages → land on Lesson Overview
  - Verify: `video`, `transcript`, `chapters`, `externalSources`, `contentAnalysis`, `topics`, `processingLog` are all populated
  - Verify: Lesson Overview shows video info, chapter count, topic count, question count, external sources

- [x] **Journey 2 test: Learn through a lesson**
  - Start a lesson → answer questions → verify pass/fail/neutral evaluation
  - Verify: score updates correctly (questionsAnswered, questionsPassed, etc.)
  - Verify: questions show chapter context and external source references when applicable
  - Pause mid-lesson → resume → verify progress is preserved

- [x] **Journey 3 test: Verify source material**
  - Click "View Source" on a question → verify correct chapter is shown
  - Verify: chapter title, timestamp range, transcript excerpt are correct
  - Verify: external source card shows for source-related questions
  - Browse the chapter list → verify all chapters are present with correct timestamps
  - Open transcript viewer → verify content is organized by chapters

- [x] **Journey 4 test: Complete and rate a lesson**
  - Complete all topics → land on Lesson Notes page
  - Verify: completion banner, score summary with LessonScore fields
  - Rate the lesson (4 stars) with text feedback → verify it saves
  - Navigate away and back → verify rating shows as read-only
  - Check Supabase via Prisma Studio → verify `lesson_summary` JSON is populated

- [x] **Journey 5 test: Review the processing log**
  - Open "How this lesson was built" on Lesson Overview
  - Verify: 5 processing steps displayed with correct stage names
  - Expand each step → verify input/decision/reasoning/output are populated
  - Verify: all steps show `success: true` for a normal lesson

### 12.5.7 — Regression Testing

- [x] **Pause/resume:** Pause a lesson mid-way, close the browser, reopen, resume — verify progress preserved
- [x] **Code challenges:** Create a lesson from a programming video — verify code questions, playground, snippet saving still work
- [x] **Dig deeper:** On a topic, click "Dig Deeper" — verify conversational follow-up works
- [x] **Difficulty calibration:** Answer several questions — verify difficulty adjustment still triggers
- [x] **Cloud sync:** Create a lesson, verify it syncs to Supabase — check via API `GET /api/lessons`
- [x] **Timed sessions:** Start a rapid/focused/comprehensive timed session — verify it works independently of the Lesson rename
- [x] **Library page:** Verify all existing lessons load in the library with correct metadata
- [x] **Dashboard:** Verify stats, recent lessons, and progress tracking display correctly
- [x] **Settings:** Verify tutor personality, learning style, and other preferences still apply
- [x] **Build check:** `npm run build` — zero errors
- [x] **API build check:** `cd api && npm run build` — zero errors
- [x] **Lint check:** `npm run lint` — zero new warnings or errors

### 12.5.8 — Accessibility Audit

- [x] Chapter list: verify keyboard navigation (Tab, Enter/Space to expand, arrow keys)
- [x] Transcript viewer: verify keyboard scrolling and timestamp link focus
- [x] External source cards: verify all links are focusable and have descriptive labels
- [x] Processing log accordion: verify keyboard expand/collapse with ARIA states
- [x] Star rating: verify keyboard input (arrow keys), ARIA labels, focus ring
- [x] Color contrast: verify all new components meet WCAG AA (4.5:1 for text, 3:1 for UI elements)
- [x] Screen reader: test chapter list, external sources, processing log, and star rating with VoiceOver

**Success criteria:** All 5 user journeys pass end-to-end. All regressions pass. Accessibility audit is clean. The app is fully functional with the Lesson-based architecture.

---

## Reference Tables

### New Interface Summary

| Interface | Fields | Storage Location |
|-----------|--------|-----------------|
| `Chapter` | id, title, startTime, endTime, content, duration | `Lesson.chapters` |
| `ExternalSource` | id, url, type, title, summary, relevance, extractedAt | `Lesson.externalSources` |
| `ProcessingStep` | timestamp, stage, input, decision, reasoning, output, success | `Lesson.processingLog.steps[]` |
| `ProcessingLog` | lessonId, createdAt, steps | `Lesson.processingLog` |
| `LessonSummary` | completedAt, userRating, feedback? | `Lesson.summary` |
| `LessonScore` | questionsAnswered, questionsPassed, questionsFailed, questionsNeutral, topicsCompleted, topicsSkipped | `Lesson.score` |

### Pipeline Progress Mapping

| Step | Processing State | Progress % | Message |
|------|-----------------|------------|---------|
| 1 | `fetching_video` | 10 | "Fetching video information..." |
| 2 | `extracting_transcript` | 20 | "Extracting transcript & chapters..." |
| 3 | `detecting_sources` | 30 | "Detecting external sources..." |
| 4 | `extracting_summaries` | 40 | "Summarizing referenced sources..." |
| 5 | `building_knowledge` | 50 | "Building knowledge base..." |
| 6 | `analyzing_content` | 60 | "Analyzing content structure..." |
| 7 | `generating_topics` | 80 | "Generating topics & questions..." |
| — | `ready` | 100 | "Lesson ready!" |

### External Source Type Classification

| URL Pattern | Type | Badge Color |
|-------------|------|-------------|
| `github.com/*` | `github` | Purple |
| `docs.*`, `developer.*`, `readthedocs.io` | `documentation` | Blue |
| `medium.com`, `dev.to`, `blog.*` | `article` | Green |
| `npmjs.com`, `pypi.org`, platform sites | `platform` | Orange |
| Everything else | `other` | Gray |

### Session → Lesson Rename Scope

| Category | File Count | Approach |
|----------|-----------|----------|
| Type definitions | 1 | Rename + alias |
| Store | 1 | Rename + re-export file |
| Services | 5 | Import updates |
| Page components | 16 | Import updates + file rename |
| UI components | 3 | Import updates |
| Config/App | 2 | Route updates + redirects |
| Backend routes | 12 | Prisma model rename |
| Backend entry | 2 | Mount alias |
| **Total** | **~42** | |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | Add 5 new interfaces, rename Session/Score/Progress types |
| `src/stores/lessonStore.ts` | New canonical store (renamed from sessionStore) |
| `src/services/lesson.ts` | Pipeline orchestrator (renamed from session.ts) |
| `src/services/externalSources.ts` | **New** — Source detection and summarization |
| `src/services/processingLog.ts` | **New** — PipelineLogger class |
| `src/services/transcript.ts` | Add `extractChapters()` function |
| `src/services/gemini.ts` | Update prompts for chapter/source context |
| `src/services/youtube.ts` | Pass through chapter markers |
| `src/services/api.ts` | Update endpoints to `/api/lessons` |
| `server.js` | Add chapter markers, video description, source fetch endpoints |
| `api/prisma/schema.prisma` | Rename Session model, add JSON fields |
| `api/src/routes/sessions.ts` | Update Prisma queries to use renamed model |
| `api/src/index.ts` | Add `/api/lessons` route alias |
| `src/config/routes.ts` | Add `/lesson/` routes, keep `/session/` redirects |
| `src/pages/Home.tsx` | 7-stage processing UI |
| `src/components/lesson/ChapterList.tsx` | **New** — Collapsible chapter list |
| `src/components/lesson/TranscriptViewer.tsx` | **New** — Chapter-organized transcript |
| `src/components/lesson/ExternalSourceCard.tsx` | **New** — Source display card |
| `src/components/lesson/ExternalSourcesList.tsx` | **New** — Source list with type badges |
| `src/components/lesson/ProcessingLogView.tsx` | **New** — Processing log accordion |
| `src/components/lesson/LessonRating.tsx` | **New** — Star rating + feedback |

---

## Verification Checklist

<!--
Final checks before marking Phase 12 complete.
Maps back to acceptance criteria from feedback file.
-->

- [x] All sub-phase sections (12.1–12.5) marked COMPLETE
- [x] TypeScript interfaces exist for all Lesson components: Chapter, ExternalSource, ProcessingLog/ProcessingStep, LessonScore, LessonSummary
- [x] "Session" terminology replaced with "Lesson" in types, stores, and core logic
- [x] Transcript stored as both plain text (`Lesson.transcript`) and structured chapters (`Lesson.chapters`)
- [x] Video metadata stored as `Lesson.video` with all specified fields
- [x] Content analysis stored as `Lesson.contentAnalysis` with concepts, relationships, chapters, complexity, domain, prerequisites
- [x] External source detection and summary extraction implemented (pipeline steps 3-4)
- [x] Processing log captures all 5 stages of Gemini's decision-making (pipeline step 7)
- [x] Three-tier question evaluation (pass/fail/neutral) aligned with overview definitions
- [x] Score tracking uses `LessonScore` interface with all specified fields
- [x] 7-step data processing pipeline functional end-to-end
- [x] Transcript accessible to users for source verification (chapter-organized viewer)
- [x] Lesson overview UI shows video info, chapter count, topic count, question count
- [x] Lesson rating (1-5 stars + feedback) works and persists
- [x] Processing log viewable on Lesson Overview and Notes pages
- [x] All 5 user journeys pass end-to-end testing
- [x] No regressions: pause/resume, code challenges, dig deeper, difficulty calibration, cloud sync, timed sessions
- [x] Accessibility: keyboard navigation, ARIA attributes, color contrast, screen reader tested
- [x] `npm run build` and `cd api && npm run build` complete without errors
- [x] `npm run lint` passes with no new warnings
- [x] No new console errors or warnings at runtime
- [x] Code committed with descriptive message
- [x] SESSION-NOTES.md updated with final summary

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | Workflow guide | Reference |
| `docs/learning-system/learning-overview.md` | Source specification (v1.2) | Reference |
| `phase-12-feedback.md` | Source requirements | Complete |
| `phase-12-implementation-plan.md` | Implementation strategy | Complete |
| `SESSION-NOTES.md` | Progress documentation | In Progress |
