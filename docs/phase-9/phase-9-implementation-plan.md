# Phase 9 Implementation Plan: Lesson UI Restructure & Topic-Based Questions

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

=============================================================================
-->

## 1. Vision & Philosophy

**Goal:** Transform the flat question-list experience into a structured, topic-driven lesson interface with persistent navigation, resources panel, and pause/continue capability.

This phase addresses the need for context during learning. Currently, questions appear without connection to the video's structure. By grouping questions into topics that align with video chapters, adding a persistent top bar with progress tracking, and providing a resources panel with transcripts and reference materials, we create a more navigable and interruptible learning experience. Users can pause mid-lesson, see exactly where they are, and access supporting materials without leaving the question view.

### Guiding Principles

1. **Topic-First Organization:** Questions belong to topics, topics belong to lessons. This hierarchy should be visible and navigable at all times.

2. **Context Without Spoilers:** Topic headers provide orientation (icon, title, summary, timestamps) but never reveal answer content.

3. **Quick Sessions:** Default to 2-3 questions per topic. More questions only when content depth justifies it. Brevity over completeness.

4. **Interruptible by Design:** Users should be able to pause at any point and resume exactly where they left off. Progress is never lost.

5. **Resources on Demand:** Transcripts and resources are available but not intrusive. One click to access, one click to dismiss.

---

## 2. Technical Specifications

### A. UI Layout Structure (Reference: Frame.png)

| Region | Position | Content |
|:-------|:---------|:--------|
| Top Bar | Fixed top, full width | Back arrow, Topic title, Video title, Progress bar, Topic counter (X/Y), Resources button |
| Main Content | Center, scrollable | Current Context card (topic header) + Question card |
| Resources Panel | Right side, slide-in | Full Transcript section + Lesson Resources section |
| Bottom Bar | Fixed bottom | Save Lesson button (left), Submit Answer + Skip buttons (right) |

### B. Data Model Extensions

```typescript
// Topic grouping for questions
interface LessonTopic {
  id: string;
  title: string;                    // e.g., "User Auth & Files"
  category: string;                 // e.g., "Coding", "Business", "Wellness"
  icon: string;                     // Icon identifier for topic
  summary: string;                  // Brief description (no answer spoilers)
  startTimestamp: number;           // Seconds into video
  endTimestamp: number;             // End of topic segment
  questionIds: string[];            // Questions in this topic (2-5)
}

// Extended session for pause/continue
interface SessionProgress {
  currentTopicIndex: number;        // Which topic user is on
  currentQuestionIndex: number;     // Which question within topic
  answeredQuestions: string[];      // Question IDs already answered
  isPaused: boolean;                // Whether session was paused
  pausedAt?: number;                // Timestamp when paused
}

// Session extension
interface Session {
  // ... existing fields
  topics: LessonTopic[];            // Ordered list of topics
  progress: SessionProgress;        // Current progress state
}
```

### C. Component Hierarchy

```
LessonContainer
├── LessonTopBar
│   ├── BackButton
│   ├── TopicTitle
│   ├── VideoTitle
│   ├── ProgressBar (animated)
│   ├── TopicCounter
│   └── ResourcesButton
├── LessonMainContent
│   ├── CurrentContextCard
│   │   ├── CategoryBadge (overlapping)
│   │   ├── TopicIcon
│   │   ├── TopicTitle
│   │   ├── TopicSummary
│   │   ├── TimestampLink
│   │   └── DifficultyButtons (Easier/Harder)
│   └── QuestionCard
│       ├── QuestionBadge + TypeLabel
│       ├── QuestionText
│       └── AnswerInput
├── ResourcesPanel (slide-in)
│   ├── TranscriptSection
│   │   ├── ChapterTitle
│   │   └── TimestampedEntries
│   └── LessonResourcesSection
│       └── ResourceCards
└── LessonBottomBar
    ├── SaveLessonButton
    ├── SubmitAnswerButton
    └── SkipButton
```

### D. Terminology Mapping

| Old Term | New Term | Scope |
|:---------|:---------|:------|
| Session | Lesson | All UI text, button labels, page titles |
| End Session Early | Save Lesson | Bottom bar button |
| Single Session Page | Single Lesson Page | Page component names |

---

## 3. Component/Feature Breakdown

### A. Lesson Top Bar

* **Structure:** Fixed position header with flexbox layout. White background, subtle bottom border.
* **Elements (left to right):**
  - Back arrow (returns to lesson overview)
  - Topic title (e.g., "Topic 1: User Auth & Files")
  - Divider
  - Video title with clock icon
  - Progress bar (fills based on questions answered across all topics)
  - Topic counter (e.g., "Topic 3/5")
  - Resources button (yellow, opens panel)
* **Behavior:**
  - Progress bar animates smoothly when advancing questions
  - Resources button toggles panel open/closed
  - Back arrow prompts to save progress if mid-lesson

### B. Current Context Card (Topic Header)

* **Structure:** Card with category badge overlapping top edge (half in, half out)
* **Elements:**
  - Category badge (yellow background, positioned -50% above card top)
  - Topic icon (left side, represents subject matter)
  - Topic title (heading)
  - Topic summary (1-2 sentences, no answer spoilers)
  - Timestamp link (yellow text: "Watch segment (31:00 - 35:00)")
  - Easier/Harder buttons (right side, outline style)
* **Behavior:**
  - Timestamp link opens video at that position
  - Easier/Harder adjust question difficulty for subsequent questions
  - Summary is AI-generated but validated to not contain answer hints

### C. Question Card

* **Structure:** Card below context card with question content
* **Elements:**
  - Question badge (e.g., "Question 5") + type label (e.g., "MULTIPLE CHOICE")
  - Question text
  - Answer input area (textarea or multiple choice options)
  - Input hint ("Press Shift + Enter for new line")
* **Behavior:**
  - Source context that was previously below question is REMOVED (per feedback)
  - Question badge shows position within current topic

### D. Resources Panel

* **Structure:** Right-side panel that slides in when Resources button clicked
* **Sections:**
  1. **Full Transcript:**
     - Chapter title header showing current chapter
     - Timestamped entries (clickable timestamps in yellow/orange)
     - Entries show transcript text with timestamp prefix
     - Auto-scrolls to current topic's section
  2. **Lesson Resources:**
     - Header with count badge (e.g., "3 Refs")
     - Resource cards with icon, title, description
     - Icons by type (PDF, link, code/GitHub)
     - Click to expand or open in new tab
* **Interaction:**
  - Click resource to expand inline (animated)
  - Expanded view has minimize and maximize options
  - Maximize fills dashboard as overlay
  - Close panel via X or clicking outside

### E. Lesson Bottom Bar

* **Structure:** Fixed bottom bar with actions
* **Elements (per reference design):**
  - Left: "Save Lesson" button (yellow, with icon) - renamed from "End Session Early"
  - Right: "Submit Answer" button (yellow, primary) + "Skip" button (outline)
* **Removed:** "Get Help" button entirely removed
* **Styling:** White button style for Save Lesson per feedback

### F. Pause/Continue Functionality

* **Structure:** Progress state stored in session record
* **Behavior:**
  - Clicking "Save Lesson" saves current position (topic index, question index, answered questions)
  - Session marked as `isPaused: true`
  - Single Lesson Page shows "Continue" button for paused sessions
  - Resuming restores exact position
* **Visual:** Paused sessions show progress indicator on lesson card

---

## 4. Implementation Phases

### Phase 9.1: Terminology & Data Foundation
- [ ] Update all UI text from "Session" to "Lesson" throughout the application
- [ ] Add `LessonTopic` type definition with id, title, category, icon, summary, timestamps, questionIds
- [ ] Add `SessionProgress` type for tracking current position
- [ ] Extend Session type with `topics` array and `progress` object
- [ ] Update question generation to group questions into topics (2-5 per topic)
- [ ] Update topic generation to include category, icon identifier, and timestamp range

### Phase 9.2: Lesson Top Bar & Progress
- [ ] Create `LessonTopBar` component with all elements
- [ ] Implement back navigation with save prompt
- [ ] Create animated `ProgressBar` component
- [ ] Add topic counter display
- [ ] Create `ResourcesButton` component (toggles panel)
- [ ] Style top bar with white background per reference

### Phase 9.3: Current Context Card (Topic Header)
- [ ] Create `CurrentContextCard` component
- [ ] Implement overlapping `CategoryBadge` positioning (CSS)
- [ ] Add topic icon display system
- [ ] Create timestamp link that opens video at position
- [ ] Implement Easier/Harder difficulty buttons
- [ ] Ensure topic summary generation excludes answer content

### Phase 9.4: Question Card Updates
- [ ] Update question display with badge and type label
- [ ] Remove source context from below questions
- [ ] Ensure question numbering is within-topic (not global)
- [ ] Match styling to reference design

### Phase 9.5: Resources Panel
- [ ] Create slide-in `ResourcesPanel` component
- [ ] Implement `TranscriptSection` with chapter titles
- [ ] Create clickable timestamp entries
- [ ] Implement `LessonResourcesSection` with resource cards
- [ ] Add expand/collapse animation for resources
- [ ] Implement maximize to overlay functionality
- [ ] Add panel open/close animations

### Phase 9.6: Bottom Bar & Pause/Continue
- [ ] Update bottom bar: remove "Get Help", rename to "Save Lesson"
- [ ] Apply white button styling per design
- [ ] Implement pause functionality (save progress state)
- [ ] Update Single Lesson Page with "Continue" button for paused lessons
- [ ] Implement resume logic (restore exact position)
- [ ] Add visual indicator for paused lessons in library/list views

---

## 5. Success Metrics

- **Terminology:** 100% of user-facing "session" references changed to "Lesson"
- **Topic Grouping:** All lessons have questions organized into topics with 2-5 questions each
- **Navigation Visibility:** Top bar visible at all times during lesson with accurate progress
- **Pause/Continue:** Users can pause and resume lessons at exact same position
- **Resources Access:** Resources panel opens/closes smoothly, transcript is navigable by chapter
- **Bottom Bar:** "Get Help" removed, "Save Lesson" button functional with white styling

---

## 6. Feedback Coverage

| Feedback Item | Addressed In |
|---------------|--------------|
| Multiple topics within lesson | Phase 9.1 |
| 2-5 questions per topic | Phase 9.1 |
| Update "session" to "Lesson" | Phase 9.1 |
| Pause/continue lesson | Phase 9.6 |
| "Continue" button on lesson page | Phase 9.6 |
| Top bar with question number | Phase 9.2 |
| Top bar with topic/section title | Phase 9.2 |
| Progress bar with animation | Phase 9.2 |
| White background top bar | Phase 9.2 |
| Resources button opens panel | Phase 9.2, 9.5 |
| Category badge (half overlapping) | Phase 9.3 |
| Topic icon, title, summary | Phase 9.3 |
| Summary without answer spoilers | Phase 9.3 |
| Timestamp links to video | Phase 9.3 |
| Headers match video chapters | Phase 9.1, 9.3 |
| Remove source context under question | Phase 9.4 |
| Timestamped transcripts in panel | Phase 9.5 |
| Chapter titles in transcript | Phase 9.5 |
| Resource expansion animation | Phase 9.5 |
| Resource minimize/maximize | Phase 9.5 |
| Remove "Get Help" button | Phase 9.6 |
| Rename to "Save Lesson" | Phase 9.6 |
| White button styling | Phase 9.6 |

---

## 7. Design Reference Notes

The reference design (Frame.png) shows:

- **Color scheme:** Yellow accent (#FCD34D or similar), white backgrounds, dark text
- **Top bar:** Clean horizontal layout with clear visual separation between elements
- **Category badge:** "CURRENT CONTEXT" in yellow, positioned to overlap card edge
- **Transcript timestamps:** Yellow/orange color, clickable
- **Resource cards:** Contained in bordered cards with icon, title, description
- **Bottom bar:** Yellow primary buttons, outline secondary buttons

These visual patterns should be followed during implementation to maintain consistency with the target design.

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | Workflow guide | Reference |
| `phase-9-feedback.md` | Source requirements | Complete |
| `uploads/Frame.png` | Visual reference design | Reference |
| `phase-9-tasks.md` | Granular task tracking | Pending |
| `SESSION-NOTES.md` | Progress documentation | Pending |
