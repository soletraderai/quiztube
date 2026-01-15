# Phase 7 Tasks: Session Experience & Question Quality Overhaul

## User Preferences

- **Animation Library:** Framer Motion (already in use)
- **Evaluation Tiers:** Pass (green), Fail (red), Neutral (yellow/amber)
- **Question Types:** Comprehension, Application, Analysis, Synthesis, Evaluation, Code-Based
- **Help Display:** Sliding panel with transcript excerpts (not modal)
- **Feedback Timing:** Immediate inline display, no separate phase transition

---

## Phase 7.1: Foundation & Data Model Updates - PENDING

### Type Definitions

- [ ] Add `EvaluationResult` type to `src/types/index.ts`
  ```typescript
  interface EvaluationResult {
    result: 'pass' | 'fail' | 'neutral';
    feedback: string;
    correctAnswer?: string;
    keyPointsHit: string[];
    keyPointsMissed: string[];
  }
  ```

- [ ] Add `QuestionType` enum to `src/types/index.ts`
  ```typescript
  type QuestionType = 'comprehension' | 'application' | 'analysis' | 'synthesis' | 'evaluation' | 'code';
  ```

- [ ] Add new fields to `Question` interface in `src/types/index.ts`
  - `questionType: QuestionType`
  - `isCodeQuestion: boolean`
  - `codeChallenge?: { template: string; language: string; }`
  - `timestampStart?: number` (seconds)
  - `timestampEnd?: number` (seconds)
  - `evaluationResult?: EvaluationResult`

- [ ] Add timestamp fields to `Topic` interface in `src/types/index.ts`
  - `timestampStart?: number`
  - `timestampEnd?: number`
  - `sectionName?: string`

- [ ] Extend `SessionScore` interface in `src/types/index.ts`
  - `questionsPassed: number`
  - `questionsFailed: number`
  - `questionsNeutral: number`

### Transcript Service

- [ ] Create new file `src/services/transcript.ts`

- [ ] Add `TranscriptSegment` interface
  ```typescript
  interface TranscriptSegment {
    text: string;
    startTime: number;
    endTime: number;
  }
  ```

- [ ] Implement `parseTranscriptWithTimestamps(rawTranscript: string): TranscriptSegment[]`
  - Parse YouTube transcript format (if timestamps exist)
  - Handle plain text transcripts (split into chunks)

- [ ] Implement `findRelevantSegments(segments: TranscriptSegment[], startTime: number, endTime: number, limit?: number): TranscriptSegment[]`
  - Filter segments within timestamp range
  - Return top N most relevant

- [ ] Implement `formatTimestamp(seconds: number): string`
  - Convert seconds to MM:SS or HH:MM:SS format

### Session Store Updates

- [ ] Update `sessionStore.ts` to initialize new score fields
  - Set `questionsPassed`, `questionsFailed`, `questionsNeutral` to 0

- [ ] Add helper function `updateEvaluationScore(sessionId: string, result: 'pass' | 'fail' | 'neutral')`

---

## Phase 7.2: Evaluation System Overhaul - PENDING

### AI Evaluation Prompt Updates

- [ ] Update evaluation prompt in `api/src/routes/ai.ts` at `/evaluate-answer` endpoint
  - Request structured JSON response with `result`, `feedback`, `keyPointsHit`, `keyPointsMissed`
  - Add clear criteria for pass/fail/neutral classification:
    - **Pass:** Core concept understood, key points addressed
    - **Fail:** Fundamental misunderstanding or incorrect answer
    - **Neutral:** Partial understanding, some points missed

- [ ] Update `evaluateAnswer()` in `src/services/gemini.ts`
  - Change return type from `string` to `EvaluationResult`
  - Parse JSON response from API
  - Add validation for required fields

- [ ] Update fallback evaluation in `generateFallbackFeedback()`
  - Return `EvaluationResult` structure
  - Use keyword matching to determine pass/fail/neutral

### Immediate Feedback Integration

- [ ] Refactor `ActiveSession.tsx` phase flow
  - Remove `SessionPhase` type's `'feedback'` value
  - Keep only `'question' | 'summary'` phases
  - Show feedback inline after answer submission

- [ ] Update `handleSubmitAnswer()` in `ActiveSession.tsx`
  - Store `EvaluationResult` instead of string feedback
  - Update `questionsPassed`/`questionsFailed`/`questionsNeutral` based on result
  - Remove `setPhase('feedback')` call

- [ ] Create inline feedback component section in question phase
  - Show immediately after answer textarea when feedback exists
  - Include result indicator (checkmark/X/question mark)
  - Display feedback text and key points

### Feedback Display Component

- [ ] Create `src/components/ui/EvaluationFeedback.tsx`
  - Props: `result: EvaluationResult`, `userAnswer: string`
  - Three visual variants based on `result.result`
  - Animate in with framer-motion slide-up

- [ ] Implement Pass state display
  - Green checkmark icon in circle
  - `bg-success/20` background
  - "Correct!" header with feedback text
  - Show `keyPointsHit` as bullet list

- [ ] Implement Fail state display
  - Red X icon in circle
  - `bg-error/20` background
  - "Not quite" header with feedback text
  - Show `correctAnswer` prominently
  - Show `keyPointsMissed` as "What to review" list

- [ ] Implement Neutral state display
  - Yellow question mark icon in circle
  - `bg-warning/20` background
  - "Partial understanding" header
  - Show both `keyPointsHit` and `keyPointsMissed`

- [ ] Add "Continue" button within feedback component
  - Replaces the separate feedback phase button
  - Moves to summary phase or next topic

---

## Phase 7.3: Question Generation Overhaul - PENDING

### Prompt Rewrite for Variety

- [ ] Rewrite `generateTopicsFromVideo()` prompt in `src/services/gemini.ts`
  - Require specific content references (not generic templates)
  - Mandate varied question types across session
  - Request timestamp ranges for each topic
  - Include examples of good vs. bad questions

- [ ] Add question type distribution requirements to prompt
  - At least 1 comprehension question
  - At least 1 application question
  - At least 1 analysis or synthesis question
  - Code questions only for programming content

- [ ] Add anti-repetition instructions
  - "Never start two questions with the same phrase"
  - "Each question must reference specific content from the transcript"
  - "Avoid generic questions like 'What is the main message?'"

### Timestamp Extraction

- [ ] Update topic generation to include timestamps
  - Extract `timestampStart` and `timestampEnd` for each topic
  - Generate `sectionName` based on transcript context
  - Handle videos without timestamp info (use estimated ranges)

- [ ] Update response parsing in `generateTopicsFromVideo()`
  - Parse timestamp fields from AI response
  - Validate timestamp ranges are within video duration
  - Fallback to evenly distributed ranges if parsing fails

### Question Type Classification

- [ ] Add `questionType` to generated questions
  - AI should classify each question during generation
  - Store in question object

- [ ] Add validation for question diversity
  - Check that session has at least 4 different question types
  - Log warning if diversity requirement not met

### Code Question Generation

- [ ] Update prompt for programming videos
  - Generate `isCodeQuestion: true` for code-related questions
  - Include `codeChallenge` with template code
  - Specify language for syntax highlighting

- [ ] Add code question validation
  - Ensure code template is syntactically valid
  - Verify language field is populated

---

## Phase 7.4: UI/UX Improvements - PENDING

### Conditional Code Editor (F1)

- [ ] Update code editor display logic in `ActiveSession.tsx`
  - Check `currentQuestion.isCodeQuestion` instead of `currentTopic.codeExample`
  - Only render `CodePlayground` when `isCodeQuestion === true`

- [ ] Handle code answer submission
  - When `isCodeQuestion`, use code editor content as answer
  - Store code in `userAnswer` field
  - Pass to evaluation with code context

- [ ] Update code editor section header
  - Change from "Code Example" to "Code Challenge" for interactive questions
  - Keep "Code Example" for read-only reference code

### Contextual Help Panel (F2)

- [ ] Update `HelpPanel.tsx` to accept transcript context
  - Props: `transcript: string`, `currentTimestamp: { start: number, end: number }`, `videoUrl: string`

- [ ] Add transcript excerpt display to help panel
  - Use `findRelevantSegments()` to get relevant text
  - Display 2-3 excerpts with timestamps
  - Format as blockquotes with timestamp badges

- [ ] Add "Jump to video" button
  - Generate YouTube URL with timestamp parameter
  - Open in new tab: `${videoUrl}&t=${seconds}s`

- [ ] Update `ActiveSession.tsx` help button
  - Pass current topic timestamp to help context
  - Pass session transcript and video URL

### Expandable Topic Summary (F5)

- [ ] Add collapsible summary section to question phase in `ActiveSession.tsx`
  - Position above the question text
  - Default to collapsed state
  - Toggle button: "Show topic context" / "Hide topic context"

- [ ] Implement expand/collapse animation
  - Use framer-motion `AnimatePresence` and `motion.div`
  - Animate height from 0 to auto
  - Fade in content during expansion

- [ ] Style summary section
  - Subtle background (`bg-surface/50`)
  - Left border accent
  - Smaller font size than question

### Video Timestamp Display (F6)

- [ ] Add timestamp badge component to question card
  - Display: "From video: MM:SS - MM:SS"
  - Or: "Topic: {sectionName}" if available
  - Position below topic title, above question

- [ ] Make timestamp clickable
  - Opens video at that timestamp in new tab
  - Cursor pointer and hover state

- [ ] Handle missing timestamps gracefully
  - Don't render badge if no timestamp data
  - Show "Full video" for topics spanning entire video

### Session Complete Styling (F7)

- [ ] Locate session complete screen in `SessionNotes.tsx`
  - Find "Session Complete" title element

- [ ] Update title text color
  - Change from colored text to `text-text` (black)
  - Keep celebratory icon colors

- [ ] Verify contrast ratio
  - Ensure WCAG AA compliance (4.5:1 minimum)

### Score Breakdown Display (F8)

- [ ] Add score breakdown section to `SessionNotes.tsx`
  - Display below completion percentage
  - Show: "X Passed | Y Failed | Z Partial"

- [ ] Create score stat badges
  - Pass badge: Green background, checkmark icon
  - Fail badge: Red background, X icon
  - Neutral badge: Yellow background, question mark icon

- [ ] Calculate totals from session data
  - Read from `session.score.questionsPassed/Failed/Neutral`
  - Fall back to 0 if fields missing (backwards compatibility)

### Topic Preview Expansion (F9)

- [ ] Add expand/collapse to topic cards in `SessionOverview.tsx`
  - Click topic header to expand
  - Show chevron icon indicating expandable state

- [ ] Display questions when expanded
  - Show question text only (no expected answers)
  - Number each question: "Q1:", "Q2:", etc.
  - Lighter text color for questions

- [ ] Animate expansion
  - Use framer-motion for smooth height transition
  - Rotate chevron icon on expand

- [ ] Add "Expand All" / "Collapse All" button
  - Position at top of topics list
  - Toggle all topics simultaneously

---

## Phase 7.5: Polish & Integration - PENDING

### End-to-End Testing

- [ ] Test complete session flow with new features
  - Create session from video
  - Verify questions have variety and timestamps
  - Submit answers and verify three-tier feedback
  - Check help panel shows relevant transcript
  - Complete session and verify score breakdown

- [ ] Test code question flow
  - Ensure code editor only appears for code questions
  - Verify code submission works as answer
  - Check evaluation handles code context

- [ ] Test edge cases
  - Video without transcript (fallback behavior)
  - API rate limiting (fallback feedback)
  - Very short videos (single topic)
  - Very long videos (many topics)

### Performance Optimization

- [ ] Profile transcript parsing performance
  - Ensure no lag when opening help panel
  - Cache parsed transcript segments

- [ ] Optimize animation performance
  - Test on lower-end devices
  - Reduce animation complexity if needed

### Mobile Responsiveness

- [ ] Verify question card layout on mobile
  - Timestamp badge wrapping
  - Code editor scrolling
  - Help panel as full-screen overlay

- [ ] Test touch interactions
  - Topic expansion via tap
  - Summary toggle via tap
  - Ensure touch targets are 44px minimum

### Accessibility Audit

- [ ] Verify color contrast for all states
  - Pass/Fail/Neutral badges meet WCAG AA
  - Session complete title readable

- [ ] Test keyboard navigation
  - Tab through all interactive elements
  - Enter/Space to expand topics
  - Focus visible on all elements

- [ ] Add ARIA labels
  - Expandable sections: `aria-expanded`
  - Result badges: `aria-label` for screen readers
  - Help panel: `aria-live` for updates

- [ ] Test with `prefers-reduced-motion`
  - Disable animations for users who prefer reduced motion
  - Ensure functionality works without animation

### Error Handling

- [ ] Handle transcript parsing errors
  - Log error and continue with empty segments
  - Show "Transcript unavailable" in help panel

- [ ] Handle evaluation API errors
  - Fall back to local evaluation
  - Show toast notification about fallback

- [ ] Handle missing timestamp data
  - Don't break rendering
  - Hide timestamp badge gracefully

---

## Reference Tables

### Evaluation Result Styling

| Result | Background | Text | Border | Icon |
|--------|------------|------|--------|------|
| Pass | `bg-success/20` | `text-success` | `border-success` | Checkmark |
| Fail | `bg-error/20` | `text-error` | `border-error` | X mark |
| Neutral | `bg-warning/20` | `text-warning` | `border-warning` | Question mark |

### Question Type Examples

| Type | Example Question Starter |
|------|-------------------------|
| Comprehension | "According to the video, what is..." |
| Application | "How would you apply this to..." |
| Analysis | "Why does the speaker recommend..." |
| Synthesis | "How does concept X connect to concept Y..." |
| Evaluation | "What are the pros and cons of..." |
| Code | "Fix the bug in this function..." |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | Add EvaluationResult, QuestionType, new fields |
| `src/services/transcript.ts` | NEW - Transcript parsing utilities |
| `src/services/gemini.ts` | Update question generation and evaluation |
| `src/pages/ActiveSession.tsx` | Major refactor - inline feedback, conditional code |
| `src/pages/SessionOverview.tsx` | Add topic expansion |
| `src/pages/SessionNotes.tsx` | Score breakdown, title color fix |
| `src/components/ui/EvaluationFeedback.tsx` | NEW - Three-tier feedback display |
| `src/components/ui/HelpPanel.tsx` | Add transcript excerpts |
| `src/stores/sessionStore.ts` | Add new score tracking |
| `api/src/routes/ai.ts` | Update evaluation endpoint response |

---

## Verification Checklist

- [ ] All sub-phase sections marked COMPLETE
- [ ] Dev server runs and all pages load
- [ ] Questions show variety (at least 4 types per session)
- [ ] Code editor only appears for code questions
- [ ] Help panel shows relevant transcript excerpts
- [ ] Feedback appears immediately (no extra click)
- [ ] Pass/Fail/Neutral states display correctly
- [ ] Topic summary is expandable before answering
- [ ] Timestamps display and link to video
- [ ] Session complete title is readable (black text)
- [ ] Score breakdown shows Pass/Fail/Neutral counts
- [ ] Topics can be expanded to preview questions
- [ ] No regressions in existing functionality
- [ ] Accessibility requirements met
- [ ] No new console errors or warnings
- [ ] Code committed with descriptive message
- [ ] SESSION-NOTES.md updated with final summary

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | Workflow guide | Reference |
| `phase-7-feedback.md` | Source requirements | Complete |
| `phase-7-implementation-plan.md` | Implementation strategy | Complete |
| `SESSION-NOTES.md` | Progress documentation | Pending |
