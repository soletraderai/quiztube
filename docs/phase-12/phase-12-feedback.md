# Phase 12 Feedback - Learning System Implementation

<!--
=============================================================================
FEEDBACK TEMPLATE - INSTRUCTIONS FOR USE
=============================================================================

PURPOSE:
This is the STARTING POINT for every phase. The user (Product Owner) documents
feedback, issues, and requirements here after reviewing the application.

WORKFLOW POSITION:
This file is Step 1 of 4 in the phase workflow:
  1. FEEDBACK (this file) → User writes
  2. IMPLEMENTATION PLAN → Agent creates from feedback, user approves
  3. TASKS → Agent creates from plan, user approves
  4. SESSION NOTES → Agent updates during execution

See README.md for the complete workflow documentation.

HOW TO USE THIS FILE:

1. OVERVIEW SECTION
   - Provide a brief summary of what this phase addresses
   - Set priority and note any dependencies

2. FEEDBACK SECTIONS
   - Organize feedback by category/area of the application
   - Each item should describe: current behavior vs. desired behavior
   - Be specific - vague feedback leads to misunderstandings

3. ACCEPTANCE CRITERIA
   - Define what "done" looks like
   - These become the validation checklist at phase end

WHAT HAPPENS NEXT:
Once feedback is complete, an agent will:
1. Review this file thoroughly
2. Analyze the codebase to understand current implementation
3. Create the implementation plan (phase-12-implementation-plan.md)
4. Present the plan for your approval

=============================================================================
-->

**Overview**
Implement the Learning System architecture as defined in `docs/learning-system/learning-overview.md` (v1.2). This phase transforms QuizTube from its current session-based model into a full **Lesson**-based learning system with six core data components, a 7-step processing pipeline, three-tier question evaluation, and initial UI concepts. The learning overview document is the single source of truth for all specifications below.

**Priority:** High
**Dependencies:** Phase 11 (rebrand to QuizTube) complete

---

## Feedback

<!--
Source: docs/learning-system/learning-overview.md v1.2 (04.02.2026)
Each section below maps to a section in the learning overview.
-->

### Lesson Data Model (Overview Sections 1.1–1.6)

- **Terminology shift**: The codebase currently uses "Session" throughout. The learning system standardizes on **"Lesson"** as the core unit. All types, stores, and references need to align with this terminology.
- **Transcript (1.1)**: A Lesson must store both `Lesson.transcript` (full plain text) and `Lesson.chapters` (structured `Chapter[]` with id, title, startTime, endTime, content, duration). Chapters are the primary organizational unit. Extraction via API service (likely Apify) must include full text, chapter markers, and timing data. Users must be able to view the transcript to verify accuracy against the source video.
- **Video Metadata (1.2)**: Store as `Lesson.video` with fields: id, url, title, channel, channelId, thumbnailUrl, duration, publishDate.
- **Lesson Content (1.3)**: Two parts — (a) `Lesson.contentAnalysis` containing concepts (with Bloom's taxonomy levels), relationships, chapters (with complexity levels), overallComplexity, subjectDomain, and estimatedPrerequisites; (b) `Lesson.topics` and `Lesson.structuredNotes` for generated learning content.
- **External Sources (1.4)**: New feature — detect URLs from transcript analysis and video description, then store summaries as `Lesson.externalSources` using the `ExternalSource` interface (id, url, type, title, summary, relevance, extractedAt). Source types: github, documentation, platform, article, other. Store summaries only to minimize storage overhead.
- **Processing Log (1.5)**: New feature — store a structured record of Gemini's decision-making as `Lesson.processingLog` using the `ProcessingLog`/`ProcessingStep` interfaces. Five stages: transcript_fetch, url_detection, source_extraction, content_analysis, question_generation. Each step records input, decision, reasoning, output, and success status. Purpose: transparency, debugging, prompt review.
- **Lesson Summary (1.6)**: Created on lesson completion — store as `Lesson.summary` with completedAt, userRating (1-5), and optional feedback text. Not critical, purely for user reflection.

### Question Evaluation (Overview Section 2)

- The purpose of evaluation is to **guide learning, not grade the user**. This philosophy must be reflected in all UI copy and feedback messaging.
- **Three-tier system**: pass (demonstrated understanding → positive reinforcement), fail (showed misconception → explanation provided), neutral (partial/unclear → clarification offered).
- **Score tracking**: `Lesson.score` using the `LessonScore` interface — questionsAnswered, questionsPassed, questionsFailed, questionsNeutral, topicsCompleted, topicsSkipped.
- Current implementation already has a three-tier system — ensure it aligns exactly with these definitions and the "Lesson" terminology.

### Data Processing Pipeline (Overview Section 4)

- Implement the 7-step pipeline from YouTube URL to completed Lesson:
  1. Extract Video Metadata → `Lesson.video`
  2. Fetch Transcript + Chapters → `Lesson.transcript`, `Lesson.chapters`
  3. Detect External Sources (URLs from transcript and description)
  4. Extract Source Summaries → `Lesson.externalSources`
  5. Content Analysis → `Lesson.contentAnalysis`
  6. Generate Topics & Questions → `Lesson.topics[]` with `questions[]`
  7. Save Processing Log → `Lesson.processingLog`
- Steps 3-4 (external sources) and step 7 (processing log) are new — the rest should align with existing functionality.

### User Learning Profile (Overview Section 3)

- Stored preferences: tutorPersonality (PROFESSOR/COACH/DIRECT/CREATIVE, default PROFESSOR), learningStyle (visual/reading/auditory/kinesthetic, default reading), languageVariant (BRITISH/AMERICAN/AUSTRALIAN, default AMERICAN), dailyCommitment (minutes, default 30), preferredTime, learningDays (default all).
- Progress tracking: currentTopicIndex, currentQuestionIndex, answeredQuestions, isPaused, pausedAt.
- Note from overview: this section is retained for reference but is not essential to the core lesson system. Existing implementation may already cover most of this — verify alignment.

### UI Concepts (Overview Section 5)

- **Design principles**: Progressive Disclosure (essential info upfront, details on demand), Contextual Relevance (present info when useful), User Control (let users choose depth of engagement).
- **Lesson Overview**: Show thumbnail, video title, channel name, duration, topic count, question count, with a "Start Learning" action.
- **Chapter List**: Collapsed by default, expandable, showing chapter titles with timestamps.
- **Transcript Access**: Available via "View Source" button on questions, collapsible panel in help/reference mode, timestamp-linked snippets during answering with play button.
- **Information hierarchy**: Always visible (title, thumbnail, duration) → On hover (channel, publish date) → On expand (chapter list) → On demand (full transcript, analysis).
- Note from overview: these are design concepts, not all need to be implemented in this phase.

### Core Principles

- Data should be minimal but accurate
- Users can verify content against the original YouTube video
- The purpose is to teach — evaluation provides guidance, not judgment

### Open Questions (Overview Section 6)

- Transcript language detection and auto-translation metadata
- Speaker diarization for multi-speaker videos
- Offline storage strategy
- Compression/chunking for very long videos (2+ hours)
- Apify actor selection for transcript extraction

---

## Acceptance Criteria

<!--
Define what "done" looks like for this phase.
These should be testable/observable outcomes.
The implementing agent will verify these at phase completion.
-->

- [ ] TypeScript interfaces exist for all Lesson components: Chapter, ExternalSource, ProcessingLog/ProcessingStep, LessonScore, LessonSummary
- [ ] "Session" terminology replaced with "Lesson" in types, stores, and core logic
- [ ] Transcript stored as both plain text (`Lesson.transcript`) and structured chapters (`Lesson.chapters`)
- [ ] Video metadata stored as `Lesson.video` with all specified fields
- [ ] Content analysis stored as `Lesson.contentAnalysis` with concepts, relationships, chapters, complexity, domain, prerequisites
- [ ] External source detection and summary extraction implemented (pipeline steps 3-4)
- [ ] Processing log captures all 5 stages of Gemini's decision-making (pipeline step 7)
- [ ] Three-tier question evaluation (pass/fail/neutral) aligned with overview definitions
- [ ] Score tracking uses `LessonScore` interface with all specified fields
- [ ] 7-step data processing pipeline functional end-to-end
- [ ] Transcript accessible to users for source verification
- [ ] Lesson overview UI shows video info, topic count, and question count
- [ ] No regressions in existing functionality

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | Workflow guide - read this first | Reference |
| `docs/learning-system/learning-overview.md` | Source specification (v1.2) | Reference |
| `phase-12-implementation-plan.md` | Implementation strategy | Pending |
| `phase-12-tasks.md` | Granular task tracking | Pending |
| `SESSION-NOTES.md` | Progress documentation | Pending |

---

## Notes

<!--
Additional context, decisions, or information relevant to this phase.
-->

- The learning overview (v1.2) is the single source of truth — all interfaces and field names should match exactly
- Some existing functionality (question evaluation, user preferences, content analysis) may already partially implement these specs — audit before rebuilding
- External Sources (1.4) and Processing Log (1.5) are entirely new features
- UI concepts section is aspirational — scope for this phase should be determined in the implementation plan
- The "Lesson" terminology replaces "Session" from previous phases — this is a significant refactoring concern
