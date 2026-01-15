# Phase 7 Feedback - Session Experience & Question Quality Overhaul

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

=============================================================================
-->

**Overview**
This phase addresses critical issues with the learning session experience discovered during user testing. The core problems are: (1) the question/answer flow doesn't support learning effectively, (2) questions are generic and repetitive rather than contextual, and (3) the feedback system doesn't properly validate understanding or provide helpful guidance. The goal is to transform sessions from a "test" feel to a genuine learning experience.

**Priority:** High
**Dependencies:**
- Transcript data with timestamps must be available for context extraction
- Knowledge base generated during video upload must be accessible
- Question generation system needs to be refactored

---

## Feedback

### F1: Code Example Section - Conditional Display

**Current Behavior:** The Code Example section appears for all questions regardless of content type.

**Desired Behavior:** The Code Example section should ONLY appear when the question involves code. When displayed, it should be an interactive space where users can edit/fix code and submit their solution as the answer.

**Example Use Case:** Question asks "Can you fix this function?" → Code editor appears with broken code → User fixes it and submits → System evaluates the code solution.

---

### F2: Get Help Button - Contextual Transcript Assistance

**Current Behavior:** There is a "Get Help" button but it doesn't provide contextual assistance related to the specific question.

**Desired Behavior:** The "Get Help" button should extract and display relevant information from the video transcript that relates to the question's topic and timestamp. This helps users who can't remember specific details without having to re-watch the entire video.

**Key Principle:** The platform's purpose is to help users LEARN, not to test them. The help system should make it easy to access the information they need.

**Implementation Notes:**
- Extract transcript segments relevant to the question's timestamp/topic
- Display in an expandable panel or modal
- Consider showing the specific video timestamp so users can optionally re-watch that section

---

### F3: Answer Feedback Timing

**Current Behavior:** Feedback comes after the user submits their answer, possibly with a delay or in a separate step.

**Desired Behavior:** When a user submits an answer, the result should appear IMMEDIATELY. No separate "feedback" step - the validation and explanation should be part of the answer submission response.

---

### F4: Answer Validation & Explanation System

**Current Behavior:** The response to user answers seems incorrect or inconsistent. There's no clear validation of whether the user understood correctly.

**Desired Behavior:** Implement a three-tier evaluation system:

| Result | Display | Explanation |
|--------|---------|-------------|
| **PASS** | Green indicator | Confirm the answer was correct AND explain WHY it was correct (reinforces learning) |
| **FAIL** | Red indicator | Clearly state the answer was incorrect AND explain the correct answer with context from the knowledge base |
| **NEUTRAL** | Yellow/Gray indicator | For ambiguous answers that show partial understanding - acknowledge what was right and clarify what was missed |

**Key Principle:** Validation should be based on the knowledge base created when the video was uploaded, ensuring consistent and accurate evaluation.

---

### F5: Topic Summary Placement & Display

**Current Behavior:** The topic summary appears AFTER the question is answered.

**Desired Behavior:** The topic summary should be available WITH the question from the start, but hidden by default. Users can click to expand/reveal it using a smooth animation (framer-motion style). This gives users context before answering if they need it.

**Layout:**
```
[Topic Title]
[Click to show summary ▼]  ← Expandable, animates open
[Question text here...]
```

---

### F6: Video Timestamp Reference for Questions

**Current Behavior:** Questions don't indicate where in the video the content relates to.

**Desired Behavior:** Each question should display the relevant video section/timestamp so users know exactly where to look if they need to re-watch.

**Display Options:**
- "This question relates to: 12:34 - 15:20" (specific timestamp range)
- "This question relates to: Introduction section" (named section)
- "This question covers: Full video" (when applicable)

**Benefit:** Users can quickly jump to the relevant part of the video if they need a refresher.

---

### F7: Session Complete Screen Styling

**Current Behavior:** The "Session Complete" title uses colored text on a colored background (green-on-green), making it hard to read.

**Desired Behavior:** The session complete title should be BLACK text for proper contrast and readability. The celebratory styling can remain on other elements, just not the title text.

---

### F8: End-of-Session Score Breakdown

**Current Behavior:** Shows completion percentage (e.g., "100% complete") but no breakdown of performance.

**Desired Behavior:** In addition to completion percentage, show:
- Number of questions PASSED (understood correctly)
- Number of questions FAILED (incorrect understanding)
- Number of questions NEUTRAL (partial understanding)

**Example Display:**
```
Session Complete! 100% Completed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 5 Passed  ✗ 2 Failed  ○ 1 Neutral
```

**Key Principle:** This is for the USER's self-assessment, not a grade. It helps them identify areas to review.

---

### F9: Topic Preview with Question Expansion

**Current Behavior:** When creating a new session, users see topics but cannot preview the questions within each topic.

**Desired Behavior:** Users should be able to click on any topic to expand it and see the questions that will be asked. This should use a smooth expand/collapse animation.

**Benefit:** Users can prepare mentally and know what to expect before starting the session.

---

### F10: Question Variety & Quality (CRITICAL)

**Current Behavior:**
- Questions are repetitive - often starting with "What do you think the main purpose or message is?"
- Questions follow the same pattern throughout the session
- Questions feel generic rather than tailored to the specific content
- No real thought process behind question generation

**Desired Behavior:**
- Questions should be VARIED in structure and approach
- Questions should be CONTEXTUAL - directly related to specific content in the video
- Questions should be PERSONALIZED - feel like they were crafted specifically for this session
- Question types should include:
  - Comprehension questions (what happened?)
  - Application questions (how would you use this?)
  - Analysis questions (why did this work?)
  - Synthesis questions (how does this connect to...?)
  - Evaluation questions (what do you think about...?)

**Root Cause:** The question generation system appears to use generic templates rather than deeply analyzing the video content to generate meaningful, contextual questions.

**Required Changes:**
1. Question generation must analyze the ACTUAL content, not just use templates
2. Each question should reference specific details from the video
3. Question difficulty and type should vary throughout the session
4. Avoid repetitive phrasing - each question should feel unique

---

## Acceptance Criteria

- [ ] Code Example section only appears for code-related questions
- [ ] Get Help button displays relevant transcript content based on question timestamp
- [ ] Answer results appear immediately upon submission (no delay)
- [ ] Three-tier evaluation system (Pass/Fail/Neutral) is implemented with explanations
- [ ] Topic summary is expandable and appears WITH the question, not after
- [ ] Each question displays its related video timestamp/section
- [ ] Session Complete title is black text (readable)
- [ ] End-of-session shows Pass/Fail/Neutral breakdown alongside completion percentage
- [ ] Topics are expandable to preview questions before starting
- [ ] Questions are varied, contextual, and not repetitive
- [ ] Question generation produces unique, content-specific questions (not generic templates)
- [ ] At least 5 different question types/structures are used per session

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | Workflow guide - read this first | Reference |
| `phase-7-implementation-plan.md` | Implementation strategy | Pending |
| `phase-7-tasks.md` | Granular task tracking | Pending |
| `SESSION-NOTES.md` | Progress documentation | Pending |

---

## Notes

- The overarching theme of this phase is shifting from a "test" mentality to a "learning" mentality
- The question quality issue (F10) is the most critical and complex item - it may require significant refactoring of the question generation system
- Consider whether the knowledge base structure needs enhancement to support better question generation
- The transcript timestamp extraction (F2, F6) depends on how transcript data is currently stored - may need investigation
