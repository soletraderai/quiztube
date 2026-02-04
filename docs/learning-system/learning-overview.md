# QuizTube Learning System Overview

> Single source of truth for the learning methodology, data structures, and user experience design.

**Date**: 04.02.2026
**Version**: 1.2
**Author**: Mare Pomana

---

## Document Structure

| Section | Topic | Description |
|---------|-------|-------------|
| 1 | Lesson Components | The six core data files (1.1–1.6) |
| 2 | Question Evaluation | Three-tier scoring system |
| 3 | User Learning Profile | Preferences and progress tracking |
| 4 | Data Flow | Processing pipeline diagram |
| 5 | UI Concepts | Initial design patterns |
| 6 | Open Questions | Future considerations |
| — | Changelog | Version history |

### Lesson Components (Section 1)

| Sub-section | Component | Description |
|-------------|-----------|-------------|
| 1.1 | Transcript | Source material with chapters |
| 1.2 | Video Metadata | YouTube video information |
| 1.3 | Lesson Content | AI-generated topics and questions |
| 1.4 | External Sources | Summaries from referenced URLs |
| 1.5 | Processing Log | Gemini's decision-making trail |
| 1.6 | Lesson Summary | User's completion rating |

---

## Core Principles

A **Lesson** represents a complete learning unit derived from a YouTube video. The goal is to provide the user with honest and transparent data about what has been extracted to generate the lesson.

**Key principles:**
- Data should be minimal but accurate
- Users can verify content against the original YouTube video
- The purpose is to teach — evaluation provides guidance, not judgment

---

## 1. Lesson Components

### 1.1 Transcript

The transcript is the foundational material from which all learning content is generated.

#### Extraction Method

We use an API service (likely Apify) to retrieve accurate transcript data. The extraction must include:
- Full transcript text
- Chapter markers (timestamps and titles from YouTube)
- Timing data for each text segment

#### Chapter Structure

Chapters are the primary organizational unit for transcript content. Each chapter contains:

```typescript
interface Chapter {
  id: string;              // Unique identifier
  title: string;           // Chapter title (from YouTube or AI-generated)
  startTime: number;       // Seconds into video
  endTime: number;         // Seconds into video
  content: string;         // Transcript text for this chapter
  duration: number;        // Computed: endTime - startTime
}
```

#### Storage

| Field | Type | Purpose |
|-------|------|---------|
| `Lesson.transcript` | string | Full plain text (for search, notes) |
| `Lesson.chapters` | Chapter[] | Structured content with timestamps |

#### User Verification

The transcript is accessible to users so they can verify accuracy against the YouTube video. This ensures transparency about the source material used to generate questions.

---

### 1.2 Video Metadata

Basic information about the YouTube video.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | YouTube video ID (extracted from URL) |
| `url` | string | Full YouTube URL |
| `title` | string | Video title |
| `channel` | string | Channel name |
| `channelId` | string | YouTube channel ID |
| `thumbnailUrl` | string | Video thumbnail image URL |
| `duration` | number | Video length in seconds |
| `publishDate` | string | ISO date when video was published |

**Storage**: `Lesson.video`

---

### 1.3 Lesson Content

AI-generated learning material derived from the transcript and external sources.

#### Content Analysis

Deep analysis performed by Gemini to understand the video content:

| Field | Type | Description |
|-------|------|-------------|
| `concepts` | ExtractedConcept[] | Key concepts with Bloom's taxonomy levels |
| `relationships` | ConceptRelationship[] | How concepts connect to each other |
| `chapters` | ContentChapter[] | Logical video chapters with complexity levels |
| `overallComplexity` | string | beginner / intermediate / advanced / mixed |
| `subjectDomain` | string | e.g., "Web Development", "Personal Finance" |
| `estimatedPrerequisites` | string[] | Prior knowledge needed |

**Storage**: `Lesson.contentAnalysis`

#### Generated Content

| Field | Description |
|-------|-------------|
| `topics` | Learning topics with questions, timestamps, categories |
| `structuredNotes` | AI-generated notes with sections and key points |

**Storage**: `Lesson.topics`, `Lesson.structuredNotes`

---

### 1.4 External Sources

Summaries of external content referenced in the video, used to provide additional context for lesson generation.

#### Source Detection

External sources are identified from:
1. **Transcript analysis** — URLs and platform names mentioned verbally
2. **Video description** — Links provided by the content creator

#### Source Types

Any platform or resource mentioned in the video:
- GitHub repositories
- Documentation sites
- Content creator's own website/blog
- Platforms discussed (e.g., investment platforms, tools, services)
- Referenced articles or papers

#### Storage Approach

**Summaries only** — to minimize storage overhead, we store:

```typescript
interface ExternalSource {
  id: string;
  url: string;              // Original URL
  type: string;             // "github" | "documentation" | "platform" | "article" | "other"
  title: string;            // Page/repo title
  summary: string;          // AI-generated summary (2-3 paragraphs max)
  relevance: string;        // Why this source matters to the lesson
  extractedAt: string;      // ISO timestamp
}
```

**Storage**: `Lesson.externalSources`

---

### 1.5 Processing Log

A structured record of Gemini's decision-making process when creating the lesson. This provides transparency for internal review.

#### Purpose

- Understand the AI's reasoning for lesson structure
- Debug issues with content extraction
- Review prompt effectiveness
- Identify improvement opportunities

#### Log Format (JSON)

```typescript
interface ProcessingLog {
  lessonId: string;
  createdAt: string;
  steps: ProcessingStep[];
}

interface ProcessingStep {
  timestamp: string;
  stage: string;           // "transcript_fetch" | "url_detection" | "source_extraction" | "content_analysis" | "question_generation"
  input: string;           // What was provided to this step
  decision: string;        // What Gemini decided to do
  reasoning: string;       // Why this decision was made
  output: string;          // What was produced
  success: boolean;
}
```

#### Example Steps

1. `transcript_fetch` — API called, transcript received, validation passed/failed
2. `url_detection` — URLs identified in transcript and description
3. `source_extraction` — External URLs scraped, summaries generated
4. `content_analysis` — Transcript reviewed, complexity assessed, chapters identified
5. `question_generation` — Questions created with reasoning for each

**Storage**: `Lesson.processingLog`

---

### 1.6 Lesson Summary

Created when the user completes the full lesson. A simple record of the user's experience.

| Field | Type | Description |
|-------|------|-------------|
| `completedAt` | string | ISO timestamp |
| `userRating` | number | User's rating of the lesson experience (1-5) |
| `feedback` | string? | Optional text feedback |

**Storage**: `Lesson.summary`

*Note: This is not a critical feature — purely for user reflection.*

---

## 2. Question Evaluation

The purpose of evaluation is to **guide learning**, not to grade the user. It doesn't matter whether they get questions right or wrong — the goal is to teach.

### Three-Tier System

| Result | Meaning | User Experience |
|--------|---------|-----------------|
| `pass` | Demonstrated understanding | Positive reinforcement, move forward |
| `fail` | Showed misconception | Explanation provided, opportunity to learn |
| `neutral` | Partial or unclear response | Clarification offered |

### Score Tracking

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

**Storage**: `Lesson.score`

---

## 3. User Learning Profile

*Note: This section is retained for reference but is not essential to the core lesson system.*

### Stored Preferences

| Setting | Options | Default |
|---------|---------|---------|
| `tutorPersonality` | PROFESSOR, COACH, DIRECT, CREATIVE | PROFESSOR |
| `learningStyle` | visual, reading, auditory, kinesthetic | reading |
| `languageVariant` | BRITISH, AMERICAN, AUSTRALIAN | AMERICAN |
| `dailyCommitment` | Minutes per day | 30 |
| `preferredTime` | Time of day (e.g., "09:00") | - |
| `learningDays` | Days of week | All |

### Progress Tracking

| Field | Purpose |
|-------|---------|
| `currentTopicIndex` | Resume position in topic sequence |
| `currentQuestionIndex` | Resume position within topic |
| `answeredQuestions` | Question IDs already completed |
| `isPaused` | Lesson pause state |
| `pausedAt` | Timestamp for calculating idle time |

---

## 4. Data Flow

```
YouTube URL
    │
    ▼
┌────────────────────┐
│ 1. Extract Video   │──────────────────► Lesson.video
│    Metadata        │
└────────────────────┘
    │
    ▼
┌────────────────────┐
│ 2. Fetch Transcript│──────────────────► Lesson.transcript
│    + Chapters      │                    Lesson.chapters
└────────────────────┘
    │
    ▼
┌────────────────────┐
│ 3. Detect External │
│    Sources (URLs)  │
└────────────────────┘
    │
    ▼
┌────────────────────┐
│ 4. Extract Source  │──────────────────► Lesson.externalSources
│    Summaries       │
└────────────────────┘
    │
    ▼
┌────────────────────┐
│ 5. Content         │──────────────────► Lesson.contentAnalysis
│    Analysis        │
└────────────────────┘
    │
    ▼
┌────────────────────┐
│ 6. Generate Topics │──────────────────► Lesson.topics[]
│    & Questions     │                        └── questions[]
└────────────────────┘
    │
    ▼
┌────────────────────┐
│ 7. Save Processing │──────────────────► Lesson.processingLog
│    Log             │
└────────────────────┘
```

---

## 5. UI Concepts (Initial)

*These are design concepts, not yet implemented.*

### Design Principles

1. **Progressive Disclosure** — Show essential info upfront, details on demand
2. **Contextual Relevance** — Present information when useful, not overwhelming
3. **User Control** — Let users choose their depth of engagement

### Lesson Overview

```
┌─────────────────────────────────────────────────────┐
│ ┌──────────┐                                        │
│ │ Thumbnail│  Video Title                           │
│ │          │  Channel Name                          │
│ └──────────┘  ⏱ 45:23  •  8 Topics  •  24 Questions │
│                                                     │
│  [Start Learning]                                   │
└─────────────────────────────────────────────────────┘
```

### Chapter List (Collapsed by Default)

```
┌─────────────────────────────────────────────────────┐
│ 💡 Understanding React Hooks              ▸  5:32   │
│ 🔧 Implementing useState                  ▸  8:15   │
│ ⚖️ useState vs useReducer                 ▸ 12:40   │
└─────────────────────────────────────────────────────┘
```

### Transcript Access

- Available via "View Source" button on questions
- Collapsible panel in help/reference mode
- Timestamp-linked snippets during answering

```
┌────────────────────────────────────────────────────┐
│ Question: What is the primary benefit of...        │
│                                                    │
│ ─────────────────────────────────────────          │
│ 📖 Source Context                    [5:32 - 5:48] │
│ "React hooks allow you to use state and other     │
│ React features without writing a class..."        │
│                                           [▶ Play] │
└────────────────────────────────────────────────────┘
```

### Information Hierarchy

| Priority | Info | Display Method |
|----------|------|----------------|
| **Always visible** | Title, thumbnail, duration | Main header |
| **On hover** | Channel, publish date | Tooltip |
| **On expand** | Chapter list with timestamps | Accordion |
| **On demand** | Full transcript, analysis | Modal/Panel |

---

## 6. Open Questions

- [ ] Transcript language detection and auto-translation metadata
- [ ] Speaker diarization for multi-speaker videos
- [ ] Offline storage strategy
- [ ] Compression/chunking for very long videos (2+ hours)
- [ ] Apify actor selection for transcript extraction

---

## Changelog

### v1.2 — 04.02.2026
**Major restructure for clarity and consistency**

- **Terminology**: Standardized on "Lesson" (replaced all `Session.*` references) and "Chapters" (removed "Segments")
- **Structure**: Reordered sections to match Key Lesson Files (1.1–1.6)
- **Added**: Document Structure table, Core Principles section
- **Added**: External Sources section (1.4) with source detection methods and `ExternalSource` interface
- **Added**: Processing Log section (1.5) with `ProcessingLog` and `ProcessingStep` interfaces
- **Simplified**: Lesson Summary (1.6) reduced to user rating on completion
- **Simplified**: Chapter interface — single clear structure replacing three-level segmentation
- **Moved**: Question Evaluation to dedicated Section 2, emphasizing guidance over grading
- **Updated**: Data Flow diagram to show all 7 processing steps with `Lesson.*` storage
- **Removed**: Feedback section (integrated into document)

### v1.1 — 04.02.2026
**Initial draft with core concepts**

- Defined lesson material storage (video metadata, transcript, content analysis)
- Outlined three-level transcript segmentation (Basic, Enhanced, Raw API)
- Added non-invasive UI presentation patterns
- Defined user learning profile and preferences
- Added score and analytics with three-tier evaluation
- Included data flow summary
- Listed open questions for future consideration

### v1.0 — (Initial)
**Document created**

- Established document as single source of truth for learning system
