# Phase 7 Implementation Plan: Session Experience & Question Quality Overhaul

## 1. Vision & Philosophy

**Goal:** Transform learning sessions from a "test" feel to a genuine learning experience with contextual help, immediate feedback, and varied high-quality questions.

This phase addresses core UX issues that break the learning flow. Currently, questions feel generic and repetitive, feedback doesn't validate understanding properly, and users lack access to helpful context when they need it. The result is an experience that tests rather than teaches. We're shifting to a system that supports active learning by providing contextual assistance, clear validation, and questions that genuinely probe understanding of the specific video content.

### Guiding Principles

1. **Learning Over Testing:** Every interaction should help users learn, not make them feel tested. Help should be readily accessible, not hidden.

2. **Immediate Gratification:** Feedback must appear instantly after submission. No delays, no extra steps, no context switching.

3. **Context is King:** Questions, help, and feedback should all reference specific content from the video. Generic responses break the learning contract.

4. **Clarity Through Contrast:** Pass/Fail/Neutral states must be visually distinct and accompanied by meaningful explanations that reinforce or correct understanding.

5. **Progressive Disclosure:** Show what's essential, hide what's supplementary (summaries, code examples, timestamps), but make everything easily accessible with smooth animations.

---

## 2. Technical Specifications

### A. Evaluation Result Types

| Result | UI Indicator | Background | Text Color | Icon | When Used |
|--------|--------------|------------|------------|------|-----------|
| **PASS** | Green badge | `bg-success/20` | `text-success` | Checkmark | Answer demonstrates correct understanding |
| **FAIL** | Red badge | `bg-error/20` | `text-error` | X mark | Answer is incorrect or shows misunderstanding |
| **NEUTRAL** | Yellow/Amber badge | `bg-warning/20` | `text-warning` | Question mark | Partial understanding or ambiguous answer |

### B. Answer Evaluation API Response

```typescript
interface EvaluationResult {
  result: 'pass' | 'fail' | 'neutral';
  feedback: string;           // Why they got it right/wrong/partial
  correctAnswer?: string;     // For fail/neutral - what they should know
  keyPointsHit: string[];     // What concepts they demonstrated
  keyPointsMissed: string[];  // What concepts they missed
}
```

### C. Transcript Segment Structure

```typescript
interface TranscriptSegment {
  text: string;
  startTime: number;    // Seconds from video start
  endTime: number;
  relevanceScore: number; // 0-1 relevance to current question
}
```

### D. Question Types (for F10 variety)

| Type | Purpose | Example Starter |
|------|---------|-----------------|
| **Comprehension** | Recall specific information | "What does the speaker say about..." |
| **Application** | Apply concept to scenario | "How would you use this concept to..." |
| **Analysis** | Break down and examine | "Why does this approach work for..." |
| **Synthesis** | Connect multiple concepts | "How does X relate to Y in..." |
| **Evaluation** | Judge or critique | "What are the strengths/weaknesses of..." |
| **Code-Based** | Fix/complete/explain code | "What's wrong with this code..." |

---

## 3. Component/Feature Breakdown

### A. Conditional Code Editor (F1)

**Current:** Code example section shows for all questions regardless of content type.

**Changes:**
- Add `isCodeQuestion: boolean` field to question type
- Add `codeChallenge?: { template: string; language: string; testCases?: string[] }` for interactive code questions
- Only render `CodePlayground` when `isCodeQuestion` is true
- For code challenges, user's code submission becomes the answer

**Files to Modify:**
- `src/types/index.ts` - Add question fields
- `src/pages/ActiveSession.tsx` - Conditional rendering
- `src/services/gemini.ts` - Generate code questions appropriately

### B. Contextual Help System (F2)

**Current:** "Get Help" button opens generic help panel.

**Changes:**
- Extract transcript segments relevant to current question timestamp
- Display in sliding panel with video timestamp links
- Show 2-3 most relevant transcript excerpts
- Include "Jump to [MM:SS] in video" button (opens video at timestamp)

**Files to Modify:**
- `src/services/transcript.ts` (new) - Transcript extraction utilities
- `src/components/ui/HelpPanel.tsx` - Enhanced panel with transcript content
- `src/pages/ActiveSession.tsx` - Pass question context to help system
- Question/Topic types to include `timestampStart` and `timestampEnd`

### C. Immediate Feedback Display (F3)

**Current:** Feedback appears after a separate phase transition.

**Changes:**
- Merge `question` and `feedback` phases into single flow
- After submit, show feedback inline below the answer
- Remove `handleContinueToSummary` intermediate step
- Animate feedback in with framer-motion slide-up

**Files to Modify:**
- `src/pages/ActiveSession.tsx` - Restructure phase flow

### D. Three-Tier Evaluation System (F4)

**Current:** Binary correct/incorrect detection via phrase matching.

**Changes:**
- Update AI prompt to return `pass`, `fail`, or `neutral` explicitly
- New `EvaluationResult` type with structured response
- Update `evaluateAnswer()` to return typed result
- Display appropriate visual indicator with explanation

**Files to Modify:**
- `api/src/routes/ai.ts` - Update evaluation endpoint
- `src/services/gemini.ts` - Parse structured response
- `src/pages/ActiveSession.tsx` - New feedback display component
- `src/types/index.ts` - Add evaluation types

### E. Expandable Topic Summary (F5)

**Current:** Summary appears after answering in separate phase.

**Changes:**
- Show collapsible summary section with question from the start
- Default collapsed with "Show topic summary" toggle
- Animate with framer-motion `AnimatePresence` and height transitions
- Move to before the question text in layout

**Files to Modify:**
- `src/pages/ActiveSession.tsx` - Add expandable section
- `src/components/ui/Accordion.tsx` (new or enhance existing)

### F. Timestamp Display (F6)

**Current:** No timestamp information shown with questions.

**Changes:**
- Display timestamp range or section name with each question
- Format: "From video: 12:34 - 15:20" or "From: Introduction"
- Clickable to open video at that timestamp
- Store `timestampStart`, `timestampEnd`, `sectionName` per topic/question

**Files to Modify:**
- `src/types/index.ts` - Add timestamp fields to Topic/Question
- `src/services/gemini.ts` - Extract timestamps during generation
- `src/pages/ActiveSession.tsx` - Display timestamp badge

### G. Session Complete Styling Fix (F7)

**Current:** Green text on green background in completion screen.

**Changes:**
- Change title text to black (`text-text`)
- Keep celebratory colors on badges/icons but not primary text

**Files to Modify:**
- `src/pages/SessionNotes.tsx` or equivalent completion screen

### H. Score Breakdown Display (F8)

**Current:** Shows only completion percentage.

**Changes:**
- Track `passed`, `failed`, `neutral` counts in session score
- Display breakdown: "5 Passed | 2 Failed | 1 Partial"
- Use color-coded badges for each count

**Files to Modify:**
- `src/types/index.ts` - Extend `SessionScore` type
- `src/stores/sessionStore.ts` - Track new metrics
- `src/pages/SessionNotes.tsx` - Display breakdown

### I. Topic Preview Expansion (F9)

**Current:** Topics visible but questions hidden before session start.

**Changes:**
- Add expand/collapse to topic cards in SessionOverview
- Show question text (not answers) when expanded
- Animate with framer-motion accordion style

**Files to Modify:**
- `src/pages/SessionOverview.tsx` - Add expansion logic
- `src/components/ui/TopicCard.tsx` (if exists) - Add expansion state

### J. Question Generation Overhaul (F10)

**Current:** Generic templates produce repetitive, non-contextual questions.

**Changes:**
- Rewrite question generation prompt to require:
  - Specific video content references
  - Varied question types (comprehension, application, analysis, etc.)
  - Unique phrasing per question
  - Timestamp anchoring
- Add question type field to track variety
- Validate that each session has diverse question types
- Include quality scoring in generation

**Files to Modify:**
- `src/services/gemini.ts` - Major prompt rewrite for `generateTopicsFromVideo()`
- `api/src/routes/ai.ts` - `/generate-questions` endpoint
- `src/types/index.ts` - Add `questionType` field

---

## 4. Implementation Phases

### Phase 7.1: Foundation & Data Model Updates
- [ ] Add new fields to TypeScript types (`isCodeQuestion`, `timestampStart`, `timestampEnd`, `sectionName`, `questionType`, `evaluationResult`)
- [ ] Extend `SessionScore` with `passed`, `failed`, `neutral` counts
- [ ] Create `TranscriptSegment` type and transcript utility service
- [ ] Update Prisma schema if needed for new fields
- [ ] Create `EvaluationResult` type with structured response format

### Phase 7.2: Evaluation System Overhaul
- [ ] Update AI evaluation prompt to return structured pass/fail/neutral result
- [ ] Modify `evaluateAnswer()` to parse and return `EvaluationResult`
- [ ] Update fallback feedback to produce structured result
- [ ] Create new feedback display component with three-tier visuals
- [ ] Integrate immediate feedback display (merge phases)

### Phase 7.3: Question Generation Overhaul (F10)
- [ ] Rewrite `generateTopicsFromVideo()` prompt for variety and context
- [ ] Add question type classification in prompt
- [ ] Include timestamp extraction in generation
- [ ] Add validation for question type diversity per session
- [ ] Test with multiple video types to ensure variety

### Phase 7.4: UI/UX Improvements
- [ ] Implement conditional code editor display (F1)
- [ ] Build contextual help panel with transcript segments (F2)
- [ ] Add expandable topic summary with animation (F5)
- [ ] Display video timestamps on questions (F6)
- [ ] Fix session complete screen styling (F7)
- [ ] Add score breakdown display (F8)
- [ ] Add topic preview expansion in session overview (F9)

### Phase 7.5: Polish & Integration
- [ ] End-to-end testing of full session flow
- [ ] Performance optimization for transcript extraction
- [ ] Mobile responsiveness verification
- [ ] Animation timing refinement
- [ ] Error handling for edge cases (no transcript, API failures)

---

## 5. Success Metrics

- **Immediate Feedback:** Feedback appears within 500ms of answer submission (no extra clicks)
- **Evaluation Accuracy:** Three-tier results (pass/fail/neutral) match answer quality 90%+ of the time
- **Question Variety:** Each session contains at least 4 different question types
- **Code Conditionality:** Code editor appears only for code-related questions (100% accuracy)
- **Help Relevance:** Transcript excerpts in help panel relate to current question topic
- **User Clarity:** Session complete screen passes WCAG color contrast requirements

---

## 6. Feedback Coverage

| Feedback Item | Description | Addressed In |
|---------------|-------------|--------------|
| F1 | Code Example conditional display | Phase 7.4 |
| F2 | Get Help with transcript context | Phase 7.4 |
| F3 | Immediate answer feedback | Phase 7.2 |
| F4 | Pass/Fail/Neutral evaluation | Phase 7.2 |
| F5 | Expandable topic summary | Phase 7.4 |
| F6 | Video timestamp display | Phase 7.3, 7.4 |
| F7 | Session complete styling | Phase 7.4 |
| F8 | Score breakdown | Phase 7.4 |
| F9 | Topic preview expansion | Phase 7.4 |
| F10 | Question variety & quality | Phase 7.3 |

---

## 7. Key File Reference

| File | Purpose |
|------|---------|
| `src/pages/ActiveSession.tsx` | Main session UI - phases, feedback, code display |
| `src/pages/SessionOverview.tsx` | Topic preview before starting |
| `src/pages/SessionNotes.tsx` | Completion screen with scores |
| `src/services/gemini.ts` | Question generation, answer evaluation |
| `src/types/index.ts` | Type definitions |
| `src/stores/sessionStore.ts` | Session state management |
| `api/src/routes/ai.ts` | AI evaluation endpoints |
| `src/components/ui/HelpPanel.tsx` | Help panel component |

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | Workflow guide | Reference |
| `phase-7-feedback.md` | Source requirements | Complete |
| `phase-7-tasks.md` | Granular task tracking | Pending |
| `SESSION-NOTES.md` | Progress documentation | Pending |
