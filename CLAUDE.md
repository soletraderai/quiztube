# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuizTube is an interactive learning application that transforms YouTube videos into quiz-based learning sessions. It extracts video transcripts, builds knowledge bases from referenced sources, and generates AI-powered comprehension questions using Google Gemini.

## Architecture

### Frontend (React + TypeScript + Vite)
- **Port**: 5173 (Vite dev server)
- **State**: Zustand stores in `src/stores/` (sessionStore, settingsStore, authStore)
- **Routing**: React Router with routes defined in `src/config/routes.ts`
- **Styling**: Tailwind CSS with Neobrutalism design system (hard black borders, electric yellow #FFDE59, cyan #00D4FF accents)

### Backend API (Express + TypeScript)
- **Port**: 3001
- **Location**: `api/` directory
- **Database**: Supabase (PostgreSQL) via Prisma ORM
- **Auth**: JWT tokens stored in cookies
- **Routes**: Individual route files in `api/src/routes/`

## Development Commands

```bash
# Start all services (Redis, API, Frontend)
./start-dev.sh

# Frontend only
npm run dev

# Backend API only
cd api && npm run dev

# Build
npm run build          # Frontend
cd api && npm run build  # API

# Lint
npm run lint

# Database (from api/)
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run migrations
npm run db:push        # Push schema changes
npm run db:studio      # Open Prisma Studio
```

## Key Services

### AI Service (`src/services/gemini.ts`)
- Two-stage content analysis pipeline (Phase 10):
  1. `analyzeTranscriptContent()` - Extracts concepts, relationships, sections
  2. `generateTopicsFromVideo()` - Generates questions grounded in analysis
- Question validation against banned patterns (no application-focused questions)
- Answer evaluation with three-tier system: pass/fail/neutral
- Personality-aware feedback (PROFESSOR, COACH, DIRECT, CREATIVE)

### Session Management (`src/stores/sessionStore.ts`)
- Zustand store with localStorage persistence
- Cloud sync to Supabase (optimistic updates with retry)
- Pause/resume functionality (Phase 9)

### Transcript Processing (`src/services/transcript.ts`)
- Enhanced segments with IDs for question source tracking
- Timestamp linking between questions and video positions

## Type System

Core types in `src/types/index.ts`:
- `Session` - Complete learning session with video, topics, questions, score
- `Topic` - Learning topic with category, icon, questions, timestamps
- `Question` - Question with source context, evaluation result, code challenge support
- `ContentAnalysis` - Structured concept extraction (Bloom's taxonomy, Webb's DOK levels)
- `EvaluationResult` - Three-tier (pass/fail/neutral) with key points hit/missed

## API Routes (Backend)

Key endpoints in `api/src/routes/`:
- `/auth` - Login, signup, JWT refresh
- `/sessions` - CRUD for learning sessions
- `/ai` - Gemini AI calls (generate, evaluate, summarize)
- `/youtube` - Video metadata + transcript extraction (via Apify, Redis-cached)
- `/sources` - External source fetching + AI summarization
- `/validate` - Input validation (settings, YouTube URLs)
- `/commitment` - Learning progress tracking
- `/subscriptions` - Stripe payment integration
- `/timedSessions` - Rapid/Focused/Comprehensive quiz modes

## Environment Variables

Frontend uses Vite env vars (`VITE_*`). Backend requires:
- `GEMINI_API_KEY` - Google AI Studio key
- `APIFY_API_TOKEN` - Apify API token (YouTube transcript extraction)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` - Supabase config
- `STRIPE_*` - Payment processing
- `RESEND_API_KEY` - Email service
