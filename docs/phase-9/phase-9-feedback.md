# Phase 9 Feedback - Lesson UI Restructure & Topic-Based Questions

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
3. Create the implementation plan (phase-9-implementation-plan.md)
4. Present the plan for your approval

=============================================================================
-->

**Overview**
This phase restructures the lesson experience around topic-based question groupings and improves the overall lesson UI. Currently, questions are presented as a flat list without context. This phase introduces multiple topics within each lesson (aligned with video chapters/timestamps), each with 2-5 focused questions. It also adds the ability to pause/continue lessons, improves the lesson container with a top navigation bar and resources panel, and refines the question display with category badges and topic context. Success means a more structured, navigable learning experience that keeps sessions quick and focused.

**Priority:** High (Core UX improvement)
**Dependencies:** Phase 8 contextual question generation, existing transcript/timestamp infrastructure

---

## Feedback

<!--
Organize feedback by category/area of the application.
Each item should describe the issue or requested change clearly.
Include current behavior vs. desired behavior where relevant.
-->

### Question Structure (Topic-Based Grouping)
- **Current behavior**: Questions are presented as a flat list without topical organization
- **Desired behavior**: Break questions into multiple topics within each lesson
- Each topic should have 2-5 questions:
  - Default to 2-3 questions per topic for quick, focused sessions
  - Only include 4-5 questions when the topic has significant depth and importance
  - Use judgment based on content richness - brevity is key
- Topics should align with video chapters/timestamps where available
- Keep total session time concise and direct

### Single Lesson Page (Terminology Update)
- **Current behavior**: UI uses "session" terminology throughout
- **Desired behavior**: Update all mentions of "session" to "Lesson" - this is how we refer to a session because each session is essentially just a lesson
- Implement pause/continue functionality:
  - Users should be able to pause a lesson mid-progress
  - When returning to an incomplete lesson, show a "Continue" button on the single lesson page
  - Resume exactly where they left off (same question, same progress)

### Lesson Container (Top Bar)
- **Current behavior**: No persistent top navigation during lessons
- **Desired behavior**: Add a fixed top bar with the following elements:
  - Question number indicator (e.g., "Question 2 of 5")
  - Current topic/section title
  - Progress bar (animated transitions when moving between questions)
  - Solid white background
  - Resources button (right-aligned) that opens the Lesson Resources Panel

### Lesson Question Top Section (Topic Header)
- **Current behavior**: Questions appear without topic context
- **Desired behavior**: Each topic section has a rich header with:
  - **Category badge**: Positioned at top of container (half overlapping, per design). Shows topic category (e.g., "Business", "Coding", "Wellness", etc.)
  - **Topic icon**: Visual representation of the topic subject
  - **Topic title**: Clear heading for the current topic
  - **Topic summary**: Brief description of what the topic covers
    - IMPORTANT: Summary must NOT reveal answer content - just contextual overview
  - **Timestamp links**:
    - Link to video timestamp where topic begins
    - Show start and end time for the topic segment
    - If topic covers entire video, link to video start

### Question Pages
- **Current behavior**: Headers/categories may not align with video chapters
- **Desired behavior**:
  - Topic headers and timestamps must match video chapter structure
  - Remove the source context display that currently sits underneath questions

### Lesson Resources Panel
- **Current behavior**: Resources panel not yet implemented
- **Desired behavior**: Side panel accessible via Resources button with:
  - **Timestamped transcripts**:
    - Show full transcript at the top of the panel
    - Display chapter titles when transcript moves to a new chapter section
  - **Resource expansion interaction**:
    - When a resource is clicked, animate the header to expand upward
    - Display full resource content (text-based overview/snapshot)
    - Provide two options:
      1. Minimize back to collapsed state
      2. Maximize to fill dashboard main container as overlay
    - Content should be generated summaries/overviews of each resource

### Lesson Question Page Bottom Bar
- **Current behavior**: Bottom bar has "Get Help" button and "End Session Early" with current styling
- **Desired behavior**:
  - Remove "Get Help" button entirely
  - Rename "End Session Early" to "Save Lesson" (or similar)
  - Apply white button styling per provided design
  - Match overall bottom bar styling to provided design reference

---

## Acceptance Criteria

<!--
Define what "done" looks like for this phase.
These should be testable/observable outcomes.
The implementing agent will verify these at phase completion.
-->

### Terminology & Pause/Continue
- [ ] All UI references to "session" updated to "Lesson"
- [ ] Users can pause a lesson and see progress saved
- [ ] Single lesson page shows "Continue" button for incomplete lessons
- [ ] Resuming a lesson returns user to exact previous position

### Topic-Based Question Structure
- [ ] Questions are grouped into topics (2-5 questions per topic)
- [ ] Topics align with video chapters/timestamps
- [ ] Question generation respects the 2-3 default, 4-5 max guideline

### Lesson Container Top Bar
- [ ] Fixed top bar displays during lessons with white background
- [ ] Top bar shows question number (e.g., "Question 2 of 5")
- [ ] Top bar shows current topic/section title
- [ ] Progress bar with animated transitions between questions
- [ ] Resources button opens Lesson Resources Panel

### Topic Header Section
- [ ] Category badge displayed at top of question container (half-overlapping)
- [ ] Topic icon, title, and summary displayed
- [ ] Summary does not reveal answer content
- [ ] Timestamp links navigate to correct video position

### Question Pages
- [ ] Topic headers match video chapter structure
- [ ] Source context removed from beneath questions

### Lesson Resources Panel
- [ ] Panel shows timestamped transcript with chapter titles
- [ ] Resources can expand with animation
- [ ] Expanded resources show minimize and maximize options
- [ ] Maximize fills dashboard as overlay

### Bottom Bar
- [ ] "Get Help" button removed
- [ ] "End Session Early" renamed to "Save Lesson"
- [ ] White button styling applied per design
- [ ] Overall styling matches provided design

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | Workflow guide - read this first | Reference |
| `phase-9-implementation-plan.md` | Implementation strategy | Pending |
| `phase-9-tasks.md` | Granular task tracking | Pending |
| `SESSION-NOTES.md` | Progress documentation | Pending |

---

## Notes

<!--
Additional context, decisions, or information relevant to this phase.
-->

### Design References
- Screenshots/mockups have been provided for bottom bar styling and category badge positioning
- Follow existing Teachy design system for consistency

### Technical Considerations
- Pause/continue functionality requires persisting lesson state (current question index, answers given)
- Topic grouping may require changes to question generation prompts
- Resources panel animations should use existing animation patterns in the codebase

### Open Questions
- Exact wording for "Save Lesson" button - confirm with stakeholder
- Icon library/source for topic icons - use existing icon set or add new?
