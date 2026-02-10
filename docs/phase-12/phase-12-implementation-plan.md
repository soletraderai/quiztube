# Phase 12 Implementation Plan: Learning System Architecture

<!--
=============================================================================
IMPLEMENTATION PLAN TEMPLATE - INSTRUCTIONS FOR AGENTS
=============================================================================

PURPOSE:
This document translates user feedback into a strategic implementation approach.
It is created by an agent and requires USER APPROVAL before proceeding.

WORKFLOW POSITION:
This file is Step 2 of 4 in the phase workflow:
  1. FEEDBACK → User writes (INPUT for this document)
  2. IMPLEMENTATION PLAN (this file) → Agent creates, user approves
  3. TASKS → Agent creates from this plan, user approves
  4. SESSION NOTES → Agent updates during execution

See README.md for the complete workflow documentation.

AGENT INSTRUCTIONS:

Before writing this plan:
1. Read `phase-12-feedback.md` thoroughly - understand ALL feedback items
2. Read `README.md` to understand the workflow
3. Analyze the codebase to understand current implementation
4. Identify patterns, conventions, and constraints

When writing this plan:
1. Address EVERY item from the feedback file
2. Be specific about the approach - vague plans lead to vague results
3. Define rules/guidelines that maintain consistency
4. Break implementation into logical sub-phases (completable in 1-2 sessions each)
5. Include measurable success metrics

After writing:
1. Present the plan to the user for approval
2. DO NOT proceed to task creation until user approves
3. Be prepared to revise based on user feedback

WHAT HAPPENS NEXT:
Once this plan is approved, another agent will:
1. Review this implementation plan
2. Create granular tasks in `phase-12-tasks.md`
3. Present tasks for user approval before execution begins

=============================================================================
-->

## 1. Vision & Philosophy

**Goal:** Evolve QuizTube from its current Session-based model into a structured Lesson-based learning system with six core data components, a 7-step processing pipeline, and transparent AI decision-making.

A **Lesson** represents a complete learning unit derived from a YouTube video. This phase aligns the codebase with the learning overview specification (v1.2) — standardizing terminology, adding structured chapters, introducing external source detection, and recording how Gemini builds each lesson. The result is a more transparent, verifiable, and pedagogically sound system.

### Guiding Principles

1. **Spec Is Truth:** Every interface name, field name, and data structure must match `learning-overview.md` v1.2 exactly. No creative liberties with the spec.
2. **Evolve, Don't Rebuild:** The existing codebase already implements ~70% of the pipeline. Rename, reshape, and extend — don't rewrite from scratch.
3. **Zero Regression:** Every existing feature (pause/resume, code challenges, dig deeper, timed sessions, cloud sync) must continue working after the migration.
4. **Transparency First:** Users should be able to trace any question back to its source material. The processing log, transcript viewer, and external sources all serve this goal.
5. **Incremental Delivery:** Each sub-phase must leave the app in a working state. No "big bang" switch — the migration happens in layers.

---

## 2. User Journeys

These five journeys describe the end-to-end experience the Learning System should deliver. They are the north star for implementation decisions.

### Journey 1: Creating a Lesson from a YouTube URL

> **As a learner, I paste a YouTube URL and QuizTube builds a structured lesson from it.**

1. User pastes a YouTube URL on the home page
2. The system shows a real-time processing indicator with 7 clear stages:
   - "Fetching video metadata..." → `Lesson.video` populated
   - "Extracting transcript..." → `Lesson.transcript` + `Lesson.chapters` populated
   - "Detecting external sources..." → URLs found in transcript and description
   - "Extracting source summaries..." → `Lesson.externalSources` populated
   - "Analyzing content..." → `Lesson.contentAnalysis` populated
   - "Generating topics & questions..." → `Lesson.topics` populated
   - "Saving processing log..." → `Lesson.processingLog` populated
3. Each stage completes visually (checkmark, progress bar advances)
4. On completion, user lands on the **Lesson Overview** page
5. They see: video thumbnail, title, channel, duration, chapter count, topic count, question count
6. External sources are listed with type badges (GitHub, docs, article, etc.)
7. User clicks "Start Learning" to begin

**What changes from current:** Steps 3-4 (source detection/extraction) are new. Step 7 (processing log) is new. Processing indicator shows 7 stages instead of the current 4. Chapter structure replaces flat transcript segments.

### Journey 2: Learning Through a Lesson

> **As a learner, I work through topics and questions with chapter-aware context.**

1. User starts a lesson and sees the first topic with its chapter context
2. Each question shows:
   - The question text and type badge
   - A "View Source" link to the relevant chapter/timestamp in the transcript
   - Related external sources (if the question draws from them)
3. User submits an answer
4. Evaluation returns one of three results:
   - **Pass** — positive reinforcement, key points they hit
   - **Fail** — explanation of the misconception, key points missed
   - **Neutral** — clarification offered for partial understanding
5. Score updates: `questionsAnswered`, `questionsPassed`/`Failed`/`Neutral`, `topicsCompleted`/`Skipped`
6. User can pause at any point — progress is saved and resumable
7. After all topics, user proceeds to completion

**What changes from current:** Questions can reference external sources. Chapter-based context replaces segment-based context. Score uses `LessonScore` interface. Terminology throughout says "Lesson" not "Session".

### Journey 3: Verifying Source Material

> **As a learner, I want to verify that a question is grounded in the actual video content.**

1. During a question, user clicks "View Source"
2. A panel shows the relevant **chapter** with:
   - Chapter title and timestamp range
   - The transcript excerpt that the question is based on
   - A "Play" button to jump to that point in the YouTube video
3. User can expand to see the full chapter transcript
4. If the question references an external source, user can see:
   - Source title and type (GitHub repo, documentation, article)
   - AI-generated summary of why this source is relevant
   - Direct link to the original URL
5. User can browse all chapters via a collapsible chapter list
6. The full transcript is available on demand in a scrollable panel

**What changes from current:** Chapters replace flat segments as the navigation unit. External source context is new. Chapter list with timestamps is new.

### Journey 4: Completing and Rating a Lesson

> **As a learner, I finish a lesson and leave feedback on the experience.**

1. User completes the final topic
2. System shows the **Lesson Notes** page with:
   - Completion banner with accuracy breakdown (passed/failed/neutral)
   - Score summary using `LessonScore` fields
   - AI-generated key takeaways
   - Structured learning notes
   - All topics with Q&A review
3. A **rate this lesson** prompt appears:
   - 1-5 star rating
   - Optional text feedback field
4. User submits rating → stored as `Lesson.summary` (completedAt, userRating, feedback)
5. System shows recommendations for next lessons

**What changes from current:** Lesson Summary with rating is new. Terminology says "Lesson". Score breakdown uses `LessonScore` fields.

### Journey 5: Reviewing the Processing Log (Transparency)

> **As a user (or developer), I want to understand how Gemini built this lesson.**

1. From the Lesson Overview or Notes page, user accesses a "How this lesson was built" section
2. The processing log shows each of the 5 pipeline stages:
   - `transcript_fetch` — what was fetched, validation result
   - `url_detection` — which URLs were found, where (transcript vs. description)
   - `source_extraction` — which sources were summarized, any failures
   - `content_analysis` — complexity assessment, concepts identified, domain detected
   - `question_generation` — how many questions generated, validation results, any regenerations
3. Each stage shows: input summary, decision made, reasoning, output summary, success/failure
4. Failures are clearly marked with what went wrong
5. This serves both user transparency and developer debugging

**What changes from current:** Entirely new. Currently only `ProcessingState` exists (step name + progress %). This adds a full structured audit trail.

---

## 3. Technical Specifications

### A. Type System — Current → Target Mapping

| Current Type | Target Type | Change Required |
| :--- | :--- | :--- |
| `Session` | `Lesson` | Rename + add `chapters`, `externalSources`, `processingLog`, `summary` fields |
| `SessionScore` | `LessonScore` | Rename, verify fields match spec exactly |
| `SessionProgress` | `LessonProgress` | Rename |
| `VideoMetadata` | `VideoMetadata` | Keep as-is (already matches spec) |
| `ParsedTranscriptSegment` | `Chapter` | New interface — chapters replace segments as primary structure |
| `ScrapedResource` | `ExternalSource` | Replace with new interface matching spec |
| `ProcessingState` | `ProcessingLog` / `ProcessingStep` | New interfaces — structured audit trail replaces simple state |
| *(none)* | `LessonSummary` | New interface — user rating on completion |
| `ContentAnalysis` | `ContentAnalysis` | Keep as-is (already matches spec) |
| `EvaluationResult` | `EvaluationResult` | Keep as-is (pass/fail/neutral already matches) |

### B. New Interfaces (from learning-overview.md v1.2)

**Chapter** (replaces flat segments as primary transcript structure):
```typescript
interface Chapter {
  id: string;
  title: string;           // From YouTube chapters or AI-generated
  startTime: number;       // Seconds
  endTime: number;         // Seconds
  content: string;         // Transcript text for this chapter
  duration: number;        // Computed: endTime - startTime
}
```

**ExternalSource** (replaces ScrapedResource):
```typescript
interface ExternalSource {
  id: string;
  url: string;
  type: string;            // "github" | "documentation" | "platform" | "article" | "other"
  title: string;
  summary: string;         // AI-generated, 2-3 paragraphs max
  relevance: string;       // Why this source matters to the lesson
  extractedAt: string;     // ISO timestamp
}
```

**ProcessingLog / ProcessingStep** (new):
```typescript
interface ProcessingLog {
  lessonId: string;
  createdAt: string;
  steps: ProcessingStep[];
}

interface ProcessingStep {
  timestamp: string;
  stage: string;           // "transcript_fetch" | "url_detection" | "source_extraction" | "content_analysis" | "question_generation"
  input: string;
  decision: string;
  reasoning: string;
  output: string;
  success: boolean;
}
```

**LessonScore** (rename of SessionScore, verify fields):
```typescript
interface LessonScore {
  questionsAnswered: number;
  questionsPassed: number;
  questionsFailed: number;
  questionsNeutral: number;
  topicsCompleted: number;
  topicsSkipped: number;
}
```

**LessonSummary** (new):
```typescript
interface LessonSummary {
  completedAt: string;     // ISO timestamp
  userRating: number;      // 1-5
  feedback?: string;       // Optional text
}
```

### C. Pipeline Architecture

The 7-step pipeline already has 4 steps implemented. The plan adds steps 3-4 (external sources) and step 7 (processing log), plus wraps everything in a proper orchestrator.

| Step | Status | Current Location | Plan |
| :--- | :--- | :--- | :--- |
| 1. Extract Video Metadata | Exists | `server.js` GET `/api/video/:id` | Keep, map output to `Lesson.video` |
| 2. Fetch Transcript + Chapters | Partial | `server.js` GET `/api/transcript/:id` + `transcript.ts` | Add chapter extraction/generation from segments |
| 3. Detect External Sources | **New** | — | Add URL detection in transcript text + video description |
| 4. Extract Source Summaries | **New** | — | Add Gemini-powered summarization of detected URLs |
| 5. Content Analysis | Exists | `gemini.ts` `analyzeTranscriptContent()` | Keep, map to `Lesson.contentAnalysis` |
| 6. Generate Topics & Questions | Exists | `gemini.ts` `generateTopicsFromVideo()` | Keep, feed external sources as additional context |
| 7. Save Processing Log | **New** | — | Collect `ProcessingStep[]` during pipeline, save as `Lesson.processingLog` |

### D. Rename Strategy

The Session → Lesson rename touches many files. To avoid a broken intermediate state:

1. **Types first** — Add `Lesson` type as alias for `Session`, then migrate consumers
2. **Store** — Rename `sessionStore` → `lessonStore`, update all imports
3. **API routes** — Add `/api/lessons` routes alongside `/api/sessions` (backward compat), then migrate
4. **Components** — Rename component files and internal references
5. **Database** — Prisma migration to rename Session table → Lesson table
6. **Final cleanup** — Remove old `Session` type alias and any remaining references

---

## 4. Component/Feature Breakdown

### A. Chapter Extraction Service

* **Structure:** New function `extractChapters()` in `transcript.ts`
* **Behavior:** Takes YouTube chapter markers (if available) + transcript segments → produces `Chapter[]`. If YouTube provides no chapters, generates logical chapters from content analysis sections or falls back to time-based chunking (e.g., every 5 minutes).
* **Integration:** Called during pipeline step 2, output stored as `Lesson.chapters`

### B. External Source Detection & Extraction

* **Structure:** New service `src/services/externalSources.ts` with two functions:
  - `detectSources(transcript: string, videoDescription: string)` → URL list
  - `extractSourceSummaries(urls: string[])` → `ExternalSource[]`
* **Behavior:** Step 3 scans transcript text and video description for URLs using regex + platform name detection. Step 4 fetches each URL, sends content to Gemini for summarization, returns `ExternalSource[]` with type classification.
* **Integration:** New proxy endpoint `POST /api/ai/summarize-source` for server-side fetching. Results stored as `Lesson.externalSources`.

### C. Processing Log Collector

* **Structure:** New utility `src/services/processingLog.ts` with a `PipelineLogger` class
* **Behavior:** Created at pipeline start. Each step calls `logger.logStep(stage, input, decision, reasoning, output, success)`. On pipeline completion, `logger.finalize()` returns the full `ProcessingLog`.
* **Integration:** Passed through the pipeline orchestrator. Stored as `Lesson.processingLog`.

### D. Lesson Summary & Rating

* **Structure:** New UI component for the rating prompt + backend storage
* **Behavior:** After lesson completion, a modal/section appears with 1-5 star rating and optional text feedback. Submitting saves `LessonSummary` to `Lesson.summary`.
* **Integration:** Triggered from the Lesson Notes page. Stored in Supabase via API.

### E. Pipeline Orchestrator

* **Structure:** New function `createLessonFromVideo(url: string)` that coordinates all 7 steps
* **Behavior:** Currently the pipeline is orchestrated ad-hoc in frontend components. This consolidates it into a single function that runs all steps in sequence, updates processing state for the UI, collects processing log entries, and returns the complete `Lesson` object.
* **Integration:** Replaces the scattered pipeline logic. Called from the home page URL submission flow.

---

## 5. Implementation Phases

### Phase 12.1: Type System & Rename Foundation
- [ ] Add all new interfaces to `src/types/index.ts`: `Chapter`, `ExternalSource`, `ProcessingLog`, `ProcessingStep`, `LessonScore`, `LessonSummary`
- [ ] Create `Lesson` type (initially as alias/extension of `Session` for safe migration)
- [ ] Rename `SessionScore` → `LessonScore`, `SessionProgress` → `LessonProgress`
- [ ] Update `src/stores/sessionStore.ts` → `src/stores/lessonStore.ts` with renamed exports
- [ ] Update all store imports across components
- [ ] Update Prisma schema: rename Session model → Lesson, add new fields for chapters, externalSources, processingLog, summary
- [ ] Run database migration
- [ ] Verify app compiles and all existing features still work

### Phase 12.2: Chapter Structure & Transcript Enhancement
- [ ] Implement `extractChapters()` in `transcript.ts` — convert segments to `Chapter[]` using YouTube chapter markers or AI-generated boundaries
- [ ] Update proxy server to return chapter markers from YouTube when available
- [ ] Store chapters as `Lesson.chapters` alongside the flat transcript
- [ ] Update question source context to reference chapters instead of segments
- [ ] Add chapter list UI component (collapsible, with timestamps)
- [ ] Add chapter-based transcript viewer panel

### Phase 12.3: External Sources Pipeline (Steps 3-4)
- [ ] Create `src/services/externalSources.ts` with `detectSources()` and `extractSourceSummaries()`
- [ ] Add URL detection regex for common platforms (GitHub, docs sites, etc.)
- [ ] Add proxy endpoint `POST /api/ai/summarize-source` for server-side URL fetching + Gemini summarization
- [ ] Integrate into pipeline between transcript fetch and content analysis
- [ ] Store results as `Lesson.externalSources`
- [ ] Pass external sources as context to content analysis and question generation
- [ ] Display external sources in Lesson Overview with type badges

### Phase 12.4: Processing Log & Lesson Summary
- [ ] Create `src/services/processingLog.ts` with `PipelineLogger` class
- [ ] Integrate logger into all 7 pipeline steps
- [ ] Store `ProcessingLog` as `Lesson.processingLog`
- [ ] Add "How this lesson was built" section to Lesson Overview/Notes
- [ ] Implement Lesson Summary UI: star rating (1-5) + optional text feedback
- [ ] Store `LessonSummary` as `Lesson.summary` on completion
- [ ] Add API endpoint for saving lesson summary

### Phase 12.5: Pipeline Orchestrator & Integration
- [ ] Create `createLessonFromVideo()` orchestrator function that runs all 7 steps
- [ ] Update processing state indicator to show 7 stages
- [ ] Replace scattered pipeline logic in frontend with orchestrator calls
- [ ] Update backend API routes: add `/api/lessons` endpoints
- [ ] End-to-end testing: URL → full Lesson with all 6 components populated
- [ ] Final Session → Lesson rename cleanup (remove old aliases, update remaining references)
- [ ] Accessibility audit on new components
- [ ] Verify no regressions in: pause/resume, code challenges, dig deeper, timed sessions, cloud sync

---

## 6. Success Metrics

- **Type alignment:** All 6 Lesson component interfaces exist and match `learning-overview.md` v1.2 field-for-field
- **Pipeline completeness:** Creating a lesson from a YouTube URL populates all fields: `video`, `transcript`, `chapters`, `externalSources`, `contentAnalysis`, `topics`, `processingLog`
- **Terminology migration:** Zero remaining references to "Session" in types, stores, or user-facing UI (except backward-compat DB migration code)
- **Source transparency:** Every question can be traced back to its source chapter and timestamp; external sources are visible and linked
- **Zero regression:** All existing features (pause/resume, code challenges, dig deeper, difficulty calibration, cloud sync, timed sessions) continue working

---

## 7. Feedback Coverage

| Feedback Item | Addressed In |
|---------------|--------------|
| Terminology shift (Session → Lesson) | Phase 12.1 |
| Transcript with Chapter structure (1.1) | Phase 12.2 |
| Video Metadata (1.2) | Phase 12.1 (already exists, rename only) |
| Lesson Content / Content Analysis (1.3) | Phase 12.1 (already exists, rename only) |
| External Sources detection & extraction (1.4) | Phase 12.3 |
| Processing Log (1.5) | Phase 12.4 |
| Lesson Summary with rating (1.6) | Phase 12.4 |
| Three-tier question evaluation (Section 2) | Phase 12.1 (already exists, verify alignment) |
| Score tracking with LessonScore (Section 2) | Phase 12.1 |
| 7-step data processing pipeline (Section 4) | Phase 12.5 |
| User Learning Profile (Section 3) | Phase 12.1 (already exists, verify alignment) |
| UI: Lesson Overview with chapter list (Section 5) | Phase 12.2 |
| UI: Transcript access / View Source (Section 5) | Phase 12.2 |
| UI: Information hierarchy (Section 5) | Phase 12.2, 12.3 |
| Core principles (minimal, accurate, verifiable) | All phases |
| Open questions (language detection, diarization, etc.) | Deferred — not in scope |

---

## 8. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Session → Lesson rename breaks imports everywhere | High | Phase 12.1 uses type alias first, then incremental migration |
| Database migration loses existing session data | Critical | Write reversible Prisma migration, test on staging first |
| External source fetching hits rate limits / blocked URLs | Medium | Graceful failure per source — lesson still works without sources |
| Processing log bloats lesson object size | Low | Keep log summaries concise, store separately if needed |
| Chapter extraction produces poor boundaries | Medium | Fall back to time-based chunking, improve iteratively |

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | Workflow guide | Reference |
| `docs/learning-system/learning-overview.md` | Source specification (v1.2) | Reference |
| `phase-12-feedback.md` | Source requirements | Complete |
| `phase-12-tasks.md` | Granular task tracking | Pending |
| `SESSION-NOTES.md` | Progress documentation | Pending |
