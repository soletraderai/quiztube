# YouTube Learning Tool - Product Requirements Document

## Overview

A React-based interactive learning application that transforms passive YouTube video consumption into active, retention-focused learning sessions. The tool extracts video transcripts, builds enriched knowledge bases from referenced sources, and guides users through bite-sized Q&A sessions designed for kinesthetic learners.

---

## Problem Statement

Long-form YouTube content (30+ minutes) on technical topics like AI, SaaS, business, and finance is difficult to consume passively. Kinesthetic learners struggle to retain information from watching videos without active engagement. Current solutions (taking notes, rewatching) are time-consuming and still passive.

---

## Target User

- Kinesthetic learner who retains information through doing, not watching
- Works with AI, web development, SaaS startups, and tech businesses
- Consumes content on AI, SaaS, business, finance, and technology
- Needs quick, focused learning sessions (10-15 minutes) rather than deep-dive courses
- Values building a searchable personal knowledge base over time

---

## Core Value Proposition

Transform any YouTube video into an interactive tutorial that:
1. Tests understanding before revealing answers
2. Provides immediate feedback and tips
3. Builds a persistent, searchable library of learned content
4. Enriches video content with real source material (GitHub repos, documentation, articles)

---

## Design System

### Visual Style: Neobrutalism

- **Borders**: Hard black outlines (2-4px), no soft edges
- **Colors**: Solid, punchy accent colors (primary: electric yellow or cyan), high contrast
- **Shadows**: Offset box shadows that appear almost hand-drawn (4-8px solid black offset)
- **Typography**: Bold sans-serif for headings, monospace for code/technical content
- **Buttons**: Chunky, rectangular with hard shadows, obvious hover states
- **Cards**: Solid backgrounds, thick borders, no gradients or soft shadows
- **Overall**: Functional, bold, no-nonsense with personality

### Layout Principles

- Minimal and clean
- Clear visual hierarchy
- Generous whitespace
- Mobile-responsive

---

## User Flow

### 1. Initial Setup (Settings)

User configures:
- Name
- Gemini API key
- Language preference
- Any other personalization options

### 2. New Session Start

1. User pastes YouTube URL
2. System extracts:
   - Video transcript
   - Video title
   - Video thumbnail (stored with session)
   - Video metadata (duration, channel, publish date)
3. System analyzes transcript for:
   - Referenced links (GitHub repos, documentation, tools, articles)
   - Mentioned tools, frameworks, companies, concepts
4. System performs targeted web research:
   - Fetches GitHub READMEs for mentioned repos
   - Pulls relevant documentation snippets
   - Gathers context on mentioned tools/concepts
   - **Not aggressive** - focused on primary sources only, not rabbit holes
5. System builds mini knowledge base combining video content + enriched sources
6. System generates:
   - List of mini-topics (logical segments of the video)
   - Questions for each mini-topic (1-3 questions per topic)
   - Closing summaries for each mini-topic

### 3. Session Overview

Before starting, user sees:
- Video thumbnail and title
- List of topics to be covered
- Total number of topics
- Estimated number of questions (8-20 based on video length)
- Estimated session duration

User can proceed or adjust.

### 4. Learning Session Flow

For each mini-topic:

#### Step 1: Question Phase
- Display question(s) - user answers without seeing the summary first
- Questions test intuition/understanding before revealing content
- Variety of question types:
  - "Explain this concept"
  - "How would you apply this?"
  - "What's the difference between X and Y?"
  - "Why would you use this approach?"
  - Relevant to the specific content being learned

#### Step 2: Feedback Phase
- Evaluate user's answer using Gemini
- Provide conversational feedback (not just "correct/incorrect")
- Add quick tips or insights where relevant
- Reference enriched knowledge base for deeper context

#### Step 3: Summary Phase
- Display brief closing summary of the mini-topic (few sentences max, not a wall of text)
- This reveals the key concept after the user has attempted the question

#### Step 4: User Decision Point

User can:
- **Continue** → Move to next mini-topic
- **Dig Deeper** → Opens additional questions on this specific topic
- **Bookmark** → Mark topic for later review without drilling down now
- **Skip** → Skip to next topic (for content already known)

#### Dig Deeper Mode

When selected:
- User can converse with chatbot to understand better
- Ask follow-up questions like "Why would I do it this way? What's the benefit?"
- Option to generate a series of deeper questions on this topic
- Uses enriched knowledge base (GitHub docs, etc.) for more substantive questions
- Exit dig deeper to continue with main session

### 5. Progress Tracking

During session:
- Display "Topic X of Y" progress indicator
- Show question count within topic if multiple questions
- Visual progress bar

### 6. Difficulty Adjustment

At any point during questions:
- **"Easier"** button → Next question is simplified
- **"Harder"** button → Next question is more challenging
- Two options only, no complex adaptive algorithms

### 7. Session Completion

End of session displays:

#### Summary Score
- Topics completed vs skipped
- Questions answered
- Accuracy/understanding rating
- Topics bookmarked for review
- Topics where user chose to dig deeper

#### Full Session Notes
Saved artifact containing:
- Video thumbnail and title
- Video URL
- Session date/time
- Overview of topics covered
- For each mini-topic:
  - The questions asked
  - User's answers
  - Feedback given
  - Closing summary
  - Whether user dug deeper (and that conversation)
  - Whether bookmarked
- Source snippets with clickable links (the enriched research)
- Final score/stats

---

## Question Generation Rules

### Quantity
- **Short videos (< 15 min)**: ~5 questions
- **Medium videos (15-30 min)**: ~8-12 questions
- **Long videos (30-60 min)**: ~12-15 questions
- **Very long videos (60+ min)**: ~15-20 questions (max)

### Distribution
- Questions distributed across mini-topics (1-3 per topic)
- Some topics may have follow-up questions within them
- Not every topic needs multiple questions

### Style
- Conversational, not quiz-like
- Variety of formats (explain, apply, compare, justify)
- Relevant to actual content, not trivia
- Practitioner-level by default (user can adjust with easier/harder)

---

## Knowledge Base Enrichment

### What to Research
- GitHub repositories mentioned → Fetch README, basic repo info
- Documentation links → Pull relevant sections
- Tools/frameworks mentioned → Basic overview from official sources
- Companies/products → Brief context if relevant to understanding

### Research Boundaries
- **Not aggressive** - this is quick learning, not deep research
- Primary sources only (official docs, repos, company sites)
- No rabbit holes - one level deep maximum
- Speed over comprehensiveness

### How It's Used
- Enriches question quality (questions based on actual docs, not just video summary)
- Provides source snippets for session notes
- Enables deeper "dig deeper" conversations
- Creates clickable reference material for later exploration

---

## Data Model

### Settings
```
{
  userName: string
  geminiApiKey: string
  language: string
  // extensible for future preferences
}
```

### Session
```
{
  id: string
  createdAt: timestamp
  completedAt: timestamp | null
  video: {
    url: string
    title: string
    thumbnailUrl: string
    duration: number
    channel: string
  }
  knowledgeBase: {
    sources: [{
      url: string
      title: string
      snippet: string
      type: 'github' | 'documentation' | 'article' | 'other'
    }]
  }
  topics: [{
    id: string
    title: string
    summary: string
    questions: [{
      id: string
      text: string
      difficulty: 'standard' | 'easier' | 'harder'
      userAnswer: string | null
      feedback: string | null
      answeredAt: timestamp | null
    }]
    digDeeperConversation: [{
      role: 'user' | 'assistant'
      content: string
      timestamp: timestamp
    }] | null
    bookmarked: boolean
    skipped: boolean
    completed: boolean
  }]
  score: {
    topicsCompleted: number
    topicsSkipped: number
    questionsAnswered: number
    bookmarkedTopics: number
    digDeeperCount: number
  }
}
```

### Library (Collection of Sessions)
```
{
  sessions: Session[]
  // Searchable by: video title, topic titles, date, bookmarked items
}
```

---

## Technical Architecture

### Frontend
- **Framework**: React
- **Styling**: CSS with neobrutalism design system (could use Tailwind for utilities)
- **State Management**: React Context or Zustand (lightweight)
- **Storage**: localStorage for persistence (sessions, settings, library)
- **Routing**: React Router (Settings, New Session, Active Session, Library, Session Notes)

### External APIs

#### YouTube Data
- Transcript extraction (youtube-transcript library or API)
- Video metadata (oEmbed API for thumbnail, title)

#### Gemini API
- Transcript analysis and topic extraction
- Question generation
- Answer evaluation and feedback
- Dig deeper conversations
- Knowledge base summarization

#### Web Search/Fetch
- GitHub API for repository information
- Generic fetch for documentation and articles
- Used during knowledge base building phase

### Key Components

```
/src
  /components
    /ui            # Neobrutalism design system components
      Button
      Card
      Input
      Progress
      Chat
    /session
      VideoInput
      SessionOverview
      TopicCard
      QuestionDisplay
      FeedbackDisplay
      SummaryDisplay
      DifficultyToggle
      DigDeeperChat
      ProgressBar
    /library
      SessionList
      SessionCard
      SearchFilter
      SessionNotes
    /settings
      SettingsForm
  /hooks
    useGemini
    useYouTube
    useWebResearch
    useSession
    useLibrary
  /services
    gemini.ts
    youtube.ts
    webResearch.ts
    storage.ts
  /types
    index.ts
  /utils
    questionGenerator.ts
    transcriptParser.ts
  App.tsx
  index.tsx
```

---

## Page Structure

### 1. Home / New Session
- URL input field
- Recent sessions quick access
- Start new session button

### 2. Settings
- User name input
- Gemini API key input (masked)
- Language selector
- Save button

### 3. Session Overview (Pre-session)
- Video thumbnail and title
- Topic list preview
- Question count estimate
- "Start Learning" button

### 4. Active Session
- Progress indicator (Topic X of Y)
- Current topic content
- Question/Answer chat interface
- Difficulty toggle (Easier/Harder)
- Navigation (Skip, Bookmark, Continue, Dig Deeper)
- End session option

### 5. Dig Deeper Mode
- Chat interface for conversation
- "Generate More Questions" button
- "Return to Session" button

### 6. Session Complete
- Score summary
- Full session notes view
- Save to library (automatic)
- Start new session button
- View in library button

### 7. Library
- Grid/list of past sessions
- Video thumbnails displayed
- Search functionality
- Filter by date, bookmarked topics
- Click to view full session notes

### 8. Session Notes (Detail View)
- Full session artifact
- All Q&A exchanges
- Source snippets with links
- Bookmarked topics highlighted
- Export option (future)

---

## MVP Scope

### Phase 1 (MVP)
- Settings page with API key storage
- YouTube URL input and transcript extraction
- Basic knowledge base building (link extraction + fetch)
- Topic breakdown and question generation
- Interactive Q&A with feedback
- Difficulty toggle (easier/harder)
- Progress tracking
- Session completion with score
- Session notes generation
- Library with session history
- localStorage persistence
- Neobrutalism styling

### Phase 2 (Post-MVP)
- Dig deeper conversational mode
- Bookmark functionality
- Skip topic functionality
- Search within library
- Session notes export
- Enhanced source snippet display

### Phase 3 (Future)
- Backend persistence (optional)
- Spaced repetition for bookmarked topics
- Cross-session topic linking
- Performance analytics over time

---

## Success Metrics

- User completes sessions (doesn't abandon mid-way)
- User returns to library to review past sessions
- Session duration matches "quick learning" goal (10-20 min for typical video)
- User engages with dig deeper feature when concepts are unclear

---

## Open Questions / Decisions

1. **Transcript extraction method**: youtube-transcript npm package vs API vs scraping?
2. **Knowledge base depth**: How aggressively to follow links? Current spec says "not aggressive" - need to define limits
3. **Gemini model**: Which Gemini model for best balance of speed/quality/cost?
4. **Offline support**: Should sessions work offline once loaded? (localStorage enables this)
5. **Mobile experience**: Mobile-first or desktop-first for MVP?

---

## Appendix: Question Type Examples

### Explain
"In your own words, explain what [concept] means and why it matters."

### Apply
"If you were building [type of project], how would you use [concept] discussed in this section?"

### Compare
"What's the difference between [approach A] and [approach B] mentioned here?"

### Justify
"The video suggests using [method]. Why would this be preferable to alternatives?"

### Predict
"Based on what was explained, what would happen if [scenario]?"

### Connect
"How does [concept from this topic] relate to [concept from earlier topic or your existing knowledge]?"

---

## Appendix: Neobrutalism CSS Variables

```css
:root {
  /* Colors */
  --color-primary: #FFDE59;      /* Electric yellow */
  --color-secondary: #00D4FF;    /* Cyan accent */
  --color-background: #FFFEF0;   /* Off-white */
  --color-surface: #FFFFFF;      /* White cards */
  --color-text: #1A1A1A;         /* Near black */
  --color-border: #000000;       /* Pure black borders */
  --color-success: #00FF85;      /* Bright green */
  --color-error: #FF4444;        /* Bright red */
  
  /* Borders */
  --border-width: 3px;
  --border-style: solid;
  --border-radius: 0;            /* Sharp corners */
  
  /* Shadows */
  --shadow-offset: 4px;
  --shadow-color: #000000;
  --shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--shadow-color);
  --shadow-hover: 6px 6px 0 var(--shadow-color);
  
  /* Typography */
  --font-heading: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}
```

---

*Document Version: 1.0*
*Created: January 2025*
*Status: Ready for Development*