# Phase 9 Tasks: Lesson UI Restructure & Topic-Based Questions

<!--
=============================================================================
TASK LIST - LESSON UI RESTRUCTURE & TOPIC-BASED QUESTIONS
=============================================================================

PURPOSE:
This document breaks the implementation plan into granular, executable tasks.
It is created by an agent and requires USER APPROVAL before execution begins.

WORKFLOW POSITION:
This file is Step 3 of 4 in the phase workflow:
  1. FEEDBACK → User writes
  2. IMPLEMENTATION PLAN → Agent creates, user approves
  3. TASKS (this file) → Agent creates, user approves
  4. SESSION NOTES → Agent updates during execution

=============================================================================
-->

## User Preferences

- **Terminology:** "Session" → "Lesson" throughout all UI text
- **Questions per topic:** 2-3 default, 4-5 max when content depth justifies
- **Save button text:** "Save Lesson" (confirm exact wording during implementation)
- **Icon source:** Use existing icon library (Lucide/Heroicons) for topic icons
- **Progress state:** Store in session object, persist to database

---

## Phase 9.1: Terminology & Data Foundation - PENDING

### Terminology Updates
- [ ] Search and replace "session" → "lesson" in user-facing UI text
  - Search pattern: case-insensitive "session" in JSX/TSX files
  - Preserve: variable names, type names, store names (internal code)
  - Update: button labels, page titles, headings, toast messages
- [ ] Update page titles and routes if needed
  - Check `src/pages/` for session-related page names
  - Update document titles
- [ ] Update navigation sidebar labels
  - "Timed Sessions" → "Timed Lessons" (if applicable)
- [ ] Update toast/notification messages referencing sessions

### Type Definitions
- [ ] Create `LessonTopic` interface in `src/types/index.ts`
  ```typescript
  interface LessonTopic {
    id: string;
    title: string;
    category: string;
    icon: string;
    summary: string;
    startTimestamp: number;
    endTimestamp: number;
    questionIds: string[];
  }
  ```
- [ ] Create `SessionProgress` interface in `src/types/index.ts`
  ```typescript
  interface SessionProgress {
    currentTopicIndex: number;
    currentQuestionIndex: number;
    answeredQuestions: string[];
    isPaused: boolean;
    pausedAt?: number;
  }
  ```
- [ ] Update `Session` interface in `src/types/index.ts`
  - Add `topics: LessonTopic[]` field
  - Add `progress: SessionProgress` field

### Topic Generation Updates
- [ ] Update `generateTopicsFromVideo()` in `src/services/gemini.ts`
  - Modify prompt to generate topics with:
    - `category` (infer from content: Coding, Business, Wellness, etc.)
    - `icon` identifier (suggest from predefined set)
    - `summary` (2-3 sentences, no answer spoilers)
    - `startTimestamp` and `endTimestamp`
  - Group questions: 2-3 default, 4-5 max per topic
- [ ] Update topic generation prompt to explicitly forbid answer hints in summary
- [ ] Create `TOPIC_CATEGORIES` constant with valid category values
- [ ] Create `TOPIC_ICONS` mapping from category to icon identifier

### Session Store Updates
- [ ] Update session creation in `src/stores/sessionStore.ts`
  - Initialize `topics` array from generated topics
  - Initialize `progress` with default values:
    - `currentTopicIndex: 0`
    - `currentQuestionIndex: 0`
    - `answeredQuestions: []`
    - `isPaused: false`
- [ ] Create `updateSessionProgress()` action in sessionStore
- [ ] Create `pauseSession()` action in sessionStore
- [ ] Create `resumeSession()` action in sessionStore

---

## Phase 9.2: Lesson Top Bar & Progress - PENDING

### LessonTopBar Component
- [ ] Create `src/components/lesson/LessonTopBar.tsx`
  - Props: `topicTitle`, `topicNumber`, `totalTopics`, `videoTitle`, `progress`, `onBack`, `onToggleResources`
  - Fixed position at top, white background
  - Use flexbox for horizontal layout
- [ ] Implement BackButton section
  - Left arrow icon (← or ChevronLeft)
  - On click: call `onBack` prop
  - Show confirmation if mid-lesson (unsaved progress)
- [ ] Implement TopicTitle section
  - Format: "Topic {n}: {title}"
  - Truncate long titles with ellipsis
- [ ] Implement VideoTitle section
  - Clock icon + video title
  - Subtle/muted text color
  - Separator (|) between topic and video title

### Progress Bar
- [ ] Create `src/components/lesson/LessonProgressBar.tsx`
  - Props: `current`, `total`, `animated`
  - Calculate percentage: `(current / total) * 100`
  - CSS transition for smooth animation on value change
  - Yellow/gold fill color per design
- [ ] Add animation on progress change
  - Use CSS `transition: width 0.3s ease-out`
  - Trigger re-render when progress updates

### Topic Counter & Resources Button
- [ ] Implement TopicCounter in LessonTopBar
  - Format: "Topic {current}/{total}"
  - Right-aligned before Resources button
- [ ] Create ResourcesButton component
  - Yellow background, white text
  - Icon + "Resources" text
  - On click: toggle resources panel

### Styling
- [ ] Style LessonTopBar with neobrutalism design
  - White background
  - Subtle bottom border (1-2px, gray)
  - Appropriate padding/spacing
  - Fixed position, full width
  - z-index above content
- [ ] Ensure responsive behavior
  - Stack elements on mobile if needed
  - Hide video title on very small screens

---

## Phase 9.3: Current Context Card (Topic Header) - PENDING

### CurrentContextCard Component
- [ ] Create `src/components/lesson/CurrentContextCard.tsx`
  - Props: `topic: LessonTopic`, `videoUrl`, `onEasier`, `onHarder`
  - Card container with relative positioning
- [ ] Implement CategoryBadge
  - Position: absolute, top: -50% of badge height
  - Yellow background, dark text
  - Text: category name (e.g., "CURRENT CONTEXT" or actual category)
  - Rounded corners, padding

### Topic Header Content
- [ ] Implement TopicIcon section
  - Left-aligned icon based on `topic.icon`
  - Create icon mapping function `getTopicIcon(iconId: string)`
  - Use Lucide icons or similar
- [ ] Implement TopicTitle
  - Heading element (h2 or h3)
  - Bold, larger font
- [ ] Implement TopicSummary
  - Paragraph element
  - 2-3 sentences max
  - Muted text color

### Timestamp Link
- [ ] Implement TimestampLink component
  - Format: "Watch segment ({startTime} - {endTime})"
  - Yellow/orange text color
  - Clickable - opens video at timestamp
  - Use `generateYouTubeTimestampUrl()` or similar
- [ ] Format timestamps as MM:SS
  - Create `formatTimestamp(seconds: number): string` helper

### Difficulty Buttons
- [ ] Implement Easier/Harder buttons
  - Position: right side of card
  - Outline/secondary button style
  - On click: adjust difficulty for next questions
- [ ] Connect to difficulty adjustment logic (existing or new)

### Styling
- [ ] Style CurrentContextCard
  - White background, border
  - Padding, margin-top to account for badge overlap
  - Shadow optional
- [ ] Ensure badge overflow is visible (no `overflow: hidden` on parent)

---

## Phase 9.4: Question Card Updates - PENDING

### Question Display Updates
- [ ] Locate existing question display component
  - Check `src/components/` for question-related files
  - Identify component that renders question during session
- [ ] Add QuestionBadge to question display
  - Format: "Question {n}" in badge/pill style
  - Yellow background
  - Position: top of question card
- [ ] Add QuestionTypeLabel next to badge
  - Text: question type (e.g., "MULTIPLE CHOICE", "FREE RESPONSE")
  - Uppercase, smaller font, muted color

### Remove Source Context
- [ ] Remove source context display from below questions
  - Locate `QuestionSourceContext` component usage
  - Remove or hide from question display
  - Keep component file (may be used elsewhere)

### Question Numbering
- [ ] Update question numbering to be within-topic
  - Current question index within current topic
  - Not global question number across all topics
- [ ] Update any "Question X of Y" displays
  - X = position within topic
  - Y = total questions in current topic

### Answer Input Styling
- [ ] Ensure answer input matches reference design
  - Text area or input field
  - Placeholder text: "Type your answer here..."
  - Hint text: "Press Shift + Enter for new line"

---

## Phase 9.5: Resources Panel - PENDING

### ResourcesPanel Component
- [ ] Create `src/components/lesson/ResourcesPanel.tsx`
  - Props: `isOpen`, `onClose`, `transcript`, `resources`, `currentTimestamp`
  - Position: fixed right side, full height
  - Slide-in animation from right
  - Width: ~350-400px
- [ ] Implement panel open/close animation
  - CSS transform: `translateX(100%)` when closed
  - CSS transition for smooth slide
- [ ] Add close button (X) in panel header
- [ ] Add click-outside-to-close behavior

### TranscriptSection
- [ ] Create `src/components/lesson/TranscriptSection.tsx`
  - Props: `segments`, `currentChapter`, `onTimestampClick`
  - Header: "Full Transcript" with icon
- [ ] Implement ChapterTitle display
  - Show current chapter/topic title above transcript
  - Update when transcript scrolls to new chapter
- [ ] Implement TimestampedEntries
  - List of transcript segments
  - Each entry: timestamp (clickable, yellow) + text
  - Format timestamp as MM:SS
  - On timestamp click: seek video to that time
- [ ] Implement auto-scroll to current topic
  - Scroll transcript to relevant section when topic changes
  - Highlight current segment if possible

### LessonResourcesSection
- [ ] Create `src/components/lesson/LessonResourcesSection.tsx`
  - Props: `resources`, `onResourceClick`, `onResourceExpand`
  - Header: "Lesson Resources" with count badge (e.g., "3 Refs")
- [ ] Create ResourceCard component
  - Icon by type (PDF, link/external, code/GitHub)
  - Title text
  - Brief description (1 line)
  - Expandable on click
- [ ] Implement resource type icons
  - PDF: FileText or similar
  - Link: ExternalLink
  - GitHub: Code or GitHub icon
  - Article: FileText or BookOpen

### Resource Expansion
- [ ] Implement expand/collapse animation for ResourceCard
  - Collapsed: icon + title + description
  - Expanded: full content view
  - Animate height transition
- [ ] Add minimize button to expanded view
- [ ] Implement maximize to overlay functionality
  - On maximize: resource fills dashboard as overlay
  - Add backdrop/overlay behind
  - Add close button to return to normal view

### Panel Styling
- [ ] Style ResourcesPanel with neobrutalism design
  - White background
  - Left border (shadow or line)
  - Sections separated by dividers
- [ ] Ensure scrollable content within panel
- [ ] Add proper z-index layering

---

## Phase 9.6: Bottom Bar & Pause/Continue - PENDING

### Bottom Bar Updates
- [ ] Locate existing bottom bar component
  - Check `src/components/` for session action bar
  - Identify "End Session Early" and "Get Help" buttons
- [ ] Remove "Get Help" button entirely
- [ ] Rename "End Session Early" to "Save Lesson"
  - Update button text
  - Keep or update icon (save icon suggested)
- [ ] Apply white button styling to "Save Lesson"
  - White background, dark text/border
  - Or outline style per design

### Bottom Bar Layout
- [ ] Ensure correct button positioning
  - Left: "Save Lesson" button
  - Right: "Submit Answer" + "Skip" buttons
- [ ] Style buttons per reference design
  - "Submit Answer": yellow/primary, with arrow icon
  - "Skip": outline/secondary style

### Pause Functionality
- [ ] Implement `pauseLesson()` function
  - Save current progress to session:
    - `currentTopicIndex`
    - `currentQuestionIndex`
    - `answeredQuestions`
  - Set `isPaused: true`
  - Set `pausedAt: Date.now()`
  - Navigate to lesson overview or library
- [ ] Connect "Save Lesson" button to `pauseLesson()`
- [ ] Show confirmation toast: "Lesson saved. You can continue later."

### Continue Functionality
- [ ] Update Single Lesson Page (session overview)
  - Check if session has `isPaused: true`
  - Show "Continue" button instead of "Start"
  - Show progress indicator (e.g., "3 of 10 questions completed")
- [ ] Implement `resumeLesson()` function
  - Load session with saved progress
  - Navigate to question at saved position
  - Set `isPaused: false`
- [ ] Ensure exact position restoration
  - Correct topic
  - Correct question within topic

### Visual Indicators
- [ ] Add paused indicator to lesson cards in library
  - Badge or icon showing "In Progress" or "Paused"
  - Show progress percentage
- [ ] Style continue button distinctly
  - Potentially different color or icon (Play/arrow)

---

## Phase 9.7: Integration & Polish - PENDING

### Wire Up Components
- [ ] Integrate LessonTopBar into lesson container
- [ ] Integrate CurrentContextCard above question card
- [ ] Integrate ResourcesPanel with toggle from top bar
- [ ] Integrate updated bottom bar
- [ ] Pass correct props through component tree

### State Management
- [ ] Ensure progress updates flow correctly
  - Answering question updates `answeredQuestions`
  - Moving to next question updates indices
  - Progress bar reflects changes
- [ ] Handle topic transitions
  - When all questions in topic complete, advance to next topic
  - Update `currentTopicIndex`
  - Reset `currentQuestionIndex` to 0

### Accessibility Audit
- [ ] Verify color contrast meets WCAG standards
  - Yellow on white (may need adjustment)
  - Text on colored backgrounds
- [ ] Ensure focus states are visible
  - All interactive elements have visible focus rings
  - Tab order is logical
- [ ] Add keyboard navigation
  - Resources panel can be closed with Escape
  - Tab through transcript timestamps
- [ ] Add ARIA labels
  - Progress bar: `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
  - Resources panel: `role="dialog"` or `role="complementary"`
  - Timestamp links: `aria-label` with time description
- [ ] Test with screen reader
  - Navigate through lesson top bar
  - Interact with resources panel
  - Verify question reading

### Animation Polish
- [ ] Verify progress bar animation is smooth
- [ ] Verify resources panel slide animation is smooth
- [ ] Verify resource card expand/collapse is smooth
- [ ] Check `prefers-reduced-motion` - disable/reduce animations

### Final Testing
- [ ] Dev server runs without errors
- [ ] Create new lesson and verify:
  - [ ] Questions are grouped into topics
  - [ ] Top bar displays correctly with all elements
  - [ ] Progress bar updates and animates
  - [ ] Current context card shows topic info
  - [ ] Resources panel opens/closes
  - [ ] Transcript displays with timestamps
  - [ ] Resources display with expansion
  - [ ] Bottom bar shows Save Lesson, Submit, Skip
- [ ] Test pause/continue flow:
  - [ ] Pause mid-lesson
  - [ ] Navigate away
  - [ ] Return to lesson page
  - [ ] Continue button appears
  - [ ] Resume at exact position
- [ ] Verify terminology changes:
  - [ ] No "session" in user-facing text
  - [ ] All references show "Lesson"
- [ ] No new console errors or warnings
- [ ] Test on different screen sizes

---

## Reference Tables

### Topic Categories

| Category | Icon Suggestion | Use Case |
|----------|-----------------|----------|
| Coding | `<Code />` | Programming, development topics |
| Business | `<Briefcase />` | Business, management, strategy |
| Wellness | `<Heart />` | Health, fitness, mental health |
| Education | `<GraduationCap />` | Learning, academic topics |
| Design | `<Palette />` | UI/UX, graphic design |
| Finance | `<DollarSign />` | Money, investing, economics |
| Science | `<Beaker />` | Scientific topics |
| General | `<Lightbulb />` | Default/catch-all |

### Component File Locations

| Component | Path | Status |
|-----------|------|--------|
| LessonTopBar | `src/components/lesson/LessonTopBar.tsx` | NEW |
| LessonProgressBar | `src/components/lesson/LessonProgressBar.tsx` | NEW |
| CurrentContextCard | `src/components/lesson/CurrentContextCard.tsx` | NEW |
| CategoryBadge | `src/components/lesson/CategoryBadge.tsx` | NEW |
| ResourcesPanel | `src/components/lesson/ResourcesPanel.tsx` | NEW |
| TranscriptSection | `src/components/lesson/TranscriptSection.tsx` | NEW |
| LessonResourcesSection | `src/components/lesson/LessonResourcesSection.tsx` | NEW |
| ResourceCard | `src/components/lesson/ResourceCard.tsx` | NEW |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | Add LessonTopic, SessionProgress types |
| `src/services/gemini.ts` | Update topic generation for new fields |
| `src/stores/sessionStore.ts` | Progress tracking, pause/resume actions |
| `src/components/lesson/*.tsx` | NEW: All lesson UI components |
| `src/pages/` | Session overview page updates |
| Various UI files | Terminology updates (session → lesson) |

---

## Verification Checklist

### Acceptance Criteria from Feedback

**Terminology & Pause/Continue**
- [ ] All UI references to "session" updated to "Lesson"
- [ ] Users can pause a lesson and see progress saved
- [ ] Single lesson page shows "Continue" button for incomplete lessons
- [ ] Resuming a lesson returns user to exact previous position

**Topic-Based Question Structure**
- [ ] Questions are grouped into topics (2-5 questions per topic)
- [ ] Topics align with video chapters/timestamps
- [ ] Question generation respects the 2-3 default, 4-5 max guideline

**Lesson Container Top Bar**
- [ ] Fixed top bar displays during lessons with white background
- [ ] Top bar shows question number
- [ ] Top bar shows current topic/section title
- [ ] Progress bar with animated transitions between questions
- [ ] Resources button opens Lesson Resources Panel

**Topic Header Section**
- [ ] Category badge displayed at top of question container (half-overlapping)
- [ ] Topic icon, title, and summary displayed
- [ ] Summary does not reveal answer content
- [ ] Timestamp links navigate to correct video position

**Question Pages**
- [ ] Topic headers match video chapter structure
- [ ] Source context removed from beneath questions

**Lesson Resources Panel**
- [ ] Panel shows timestamped transcript with chapter titles
- [ ] Resources can expand with animation
- [ ] Expanded resources show minimize and maximize options
- [ ] Maximize fills dashboard as overlay

**Bottom Bar**
- [ ] "Get Help" button removed
- [ ] "End Session Early" renamed to "Save Lesson"
- [ ] White button styling applied per design
- [ ] Overall styling matches provided design

### Final Checks

- [ ] All sub-phase sections marked COMPLETE
- [ ] Dev server runs and all pages load
- [ ] New features work as specified
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
| `phase-9-feedback.md` | Source requirements | Complete |
| `phase-9-implementation-plan.md` | Implementation strategy | Complete |
| `uploads/Frame.png` | Visual reference design | Reference |
| `SESSION-NOTES.md` | Progress documentation | Pending |
