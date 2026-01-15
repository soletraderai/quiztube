# Phase Development Workflow

This directory serves as a template for all future phase development. Copy this entire folder when starting a new phase and rename it to match your phase number (e.g., `phase-8`).

---

## Overview

Each phase follows a structured 4-step workflow that ensures clarity, accountability, and documentation throughout the development process. This system uses four core files that build upon each other sequentially.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PHASE WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   1. FEEDBACK          2. IMPLEMENTATION       3. TASKS             │
│   ───────────────►    ───────────────────►   ──────────────►       │
│   (User provides)     (Agent creates)        (Agent creates)        │
│                       (User approves)        (User approves)        │
│                                                                     │
│                              │                                      │
│                              ▼                                      │
│                       4. SESSION NOTES                              │
│                       (Updated continuously)                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files & Their Purpose

### 1. `phase-#-feedback.md` - Feedback Collection

**Who writes it:** User (Product Owner)
**When:** After reviewing current or previous phase work

This is the starting point for every phase. The user documents:
- Issues observed during testing
- Feature requests and enhancements
- Bugs or unexpected behaviors
- UX/UI improvements needed
- Technical debt to address

**Format:** Raw feedback items organized by category (e.g., Dashboard, Session, Navigation). Each item should describe the current behavior and desired outcome.

**Next step:** An agent reviews this file and creates the implementation plan.

---

### 2. `phase-#-implementation-plan.md` - Implementation Strategy

**Who writes it:** Agent (Planning Agent)
**When:** After reviewing feedback.md
**Requires:** User approval before proceeding

The implementation plan translates feedback into a strategic approach:
- **Vision & Philosophy:** The overarching goal and guiding principles
- **Design System/Specs:** Technical specifications, patterns, and standards
- **Component Breakdown:** What will be built or modified
- **Implementation Checklist:** High-level phases of work
- **Success Metrics:** How we measure completion

**Instructions for Planning Agent:**
1. Read `phase-#-feedback.md` thoroughly
2. Analyze the codebase to understand current implementation
3. Design an approach that addresses all feedback items
4. Structure the plan into logical sub-phases
5. Define clear success criteria
6. Present to user for approval

**Next step:** Once approved, another agent creates the detailed task list.

---

### 3. `phase-#-tasks.md` - Actionable Task List

**Who writes it:** Agent (Task Planning Agent)
**When:** After implementation plan is approved
**Requires:** User approval before execution begins

The task list breaks the implementation plan into granular, executable tasks:
- Checkbox items for each discrete action
- Grouped by sub-phase (e.g., Phase 8.1, 8.2, 8.3)
- Includes specific file paths and technical details
- Reference tables for values, colors, configurations
- Verification checklist for final testing

**Instructions for Task Planning Agent:**
1. Read `phase-#-implementation-plan.md` thoroughly
2. Break each implementation checkpoint into atomic tasks
3. Ensure tasks are specific and actionable (include file names, line numbers where relevant)
4. Add reference tables for any values that will be reused
5. Include accessibility and testing tasks
6. Present to user for approval

**Task Format Guidelines:**
- Start with action verbs: Add, Create, Update, Remove, Refactor, Test
- Be specific: "Add retry logic to `fetchUser()` in `authStore.ts`" not "Fix fetching"
- Use checkboxes: `- [ ]` for pending, `- [x]` for complete
- Mark sub-phase status: "IN PROGRESS" or "COMPLETE"

**Next step:** Execution begins, with session notes updated throughout.

---

### 4. `SESSION-NOTES.md` - Progress Documentation

**Who writes it:** Agent (Implementing Agent)
**When:** Continuously during implementation

Session notes are the living record of development progress:
- **Key Findings:** What was discovered during investigation
- **Root Causes:** Why issues occurred (for bug fixes)
- **Fixes Applied:** Specific changes made with file paths and line numbers
- **Testing Results:** What was tested and the outcomes
- **Summary:** Final status and verification

**Instructions for Implementing Agent:**
1. Update session notes IN REAL-TIME as you work
2. Document findings before making changes
3. Record each fix with specific file paths and line numbers
4. Test changes and document results (PASSED/FAILED)
5. Update summary when work completes or session ends

**Why Session Notes Matter:**
- Enables seamless handoff between sessions/agents
- Prevents re-investigating the same issues
- Provides audit trail of all changes
- Documents the "why" behind decisions

---

## Complete Workflow

### Step 1: Feedback Collection
```
User reviews application → Documents issues/requests in phase-#-feedback.md
```

### Step 2: Implementation Planning
```
Agent reads feedback.md → Creates phase-#-implementation-plan.md → User approves
```

### Step 3: Task Breakdown
```
Agent reads implementation-plan.md → Creates phase-#-tasks.md → User approves
```

### Step 4: Execution & Documentation
```
Agent executes tasks → Updates SESSION-NOTES.md after each sub-phase
→ Marks tasks complete in phase-#-tasks.md
→ Repeats until all tasks complete
```

### Step 5: Phase Completion
```
All tasks complete → Final verification checklist passed
→ Session notes summarize outcomes → Phase marked COMPLETE
```

---

## Starting a New Phase

1. **Copy** this entire `phase-#` directory
2. **Rename** the folder to your phase number (e.g., `phase-8`)
3. **Rename** all files to match:
   - `phase-8-feedback.md`
   - `phase-8-implementation-plan.md`
   - `phase-8-tasks.md`
   - `SESSION-NOTES.md` (name stays the same)
4. **Clear** the placeholder content in each file
5. **Begin** with the feedback file

---

## Agent Instructions Summary

| Role | Input | Output | Approval Required |
|------|-------|--------|-------------------|
| Planning Agent | `feedback.md` | `implementation-plan.md` | Yes - before tasks |
| Task Agent | `implementation-plan.md` | `tasks.md` | Yes - before execution |
| Implementing Agent | `tasks.md` | Code changes + `SESSION-NOTES.md` | No - execute per approved tasks |

---

## Best Practices

### For Users
- Be specific in feedback - describe current vs. desired behavior
- Review implementation plans carefully before approval
- Validate task lists cover all feedback items

### For Agents
- Always read this README before working on a phase
- Never skip the approval step - wait for user confirmation
- Update session notes in real-time, not at the end
- Mark tasks complete immediately after finishing (don't batch)
- If blocked or uncertain, document in session notes and ask

### For Everyone
- Each file builds on the previous - don't skip steps
- Documentation is not optional - it enables continuity
- Small, focused phases are better than large, complex ones
