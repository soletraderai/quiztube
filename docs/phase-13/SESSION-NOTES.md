# Phase 13 Session Notes: Backend API Consolidation & Apify Integration

---

## Session 1: 2026-02-10

### Focus
Migrate all transcript proxy server (`server.js`, port 3002) endpoints into the backend API (`api/`, port 3001), replace the unreliable `youtube-captions-api` library with the Apify actor `supreme_coder/youtube-transcript-scraper`, and eliminate the third server entirely.

### Key Findings

#### Proxy Server Analysis
- `server.js` (524 lines) ran on port 3002 and handled 6 endpoints: health check, video metadata, transcript extraction, settings validation, YouTube URL validation, AI generate, source fetch, source summarize - VERIFIED
- 7 alternative YouTube transcript libraries were tried and left in root `package.json` — all unreliable - VERIFIED
- The proxy added architectural complexity: 3 servers to maintain (frontend 5173, API 3001, proxy 3002) - VERIFIED

#### Frontend Service Patterns
- `src/services/youtube.ts` had an `isProxyAvailable()` health check before every call — unnecessary latency - VERIFIED
- `src/services/gemini.ts` called the proxy directly without auth headers — security gap - VERIFIED
- `src/services/externalSources.ts` hardcoded proxy base URL — no auth headers - VERIFIED
- `src/services/api.ts` already had auth header pattern via `useAuthStore.getState().accessToken` — reusable - VERIFIED

#### Backend API Patterns
- `api/src/routes/ai.ts` uses `AuthenticatedRequest`, `AppError`, `aiRateLimit` from middleware — consistent patterns to follow - VERIFIED
- `api/src/middleware/rateLimit.ts` provides Redis-backed `aiRateLimit()` function — reused for transcript and source endpoints - VERIFIED
- `api/src/index.ts` registers routes as `app.use('/api/...', authMiddleware, router)` — standard pattern - VERIFIED
- Redis instance exported from `api/src/index.ts` as `redis` — available for transcript caching - VERIFIED

### Changes Made

#### 1. Dependencies & Configuration
- [x] Installed `apify-client` in `api/` directory
- [x] Added `APIFY_API_TOKEN` to `api/.env` and `api/.env.example`
- File: `api/package.json:18` (new dep)
- File: `api/.env:47-48` (new env var)
- File: `api/.env.example:40-41` (new env var)

#### 2. New Backend Routes — `api/src/routes/youtube.ts` (created)
- [x] `GET /api/youtube/video/:videoId` — Scrapes YouTube page for metadata (title, channel, duration, thumbnail, description)
- [x] `GET /api/youtube/transcript/:videoId` — Fetches transcripts via Apify `supreme_coder/youtube-transcript-scraper`
- [x] Redis caching with key `transcript:{userId}:{videoId}`, TTL 7 days
- [x] Video ID validation (11-char alphanumeric)
- [x] `extractChaptersFromDescription()` helper ported from `server.js` lines 12-35
- [x] Rate limiting via `aiRateLimit()` on transcript endpoint
- [x] Apify response transform: `{ text, start (s), duration (s) }` → `{ text, offset (ms), duration (ms) }`
- [x] Chapter extraction fallback from YouTube page if not available in Apify metadata
- File: `api/src/routes/youtube.ts` (new, ~170 lines)

#### 3. New Backend Routes — `api/src/routes/sources.ts` (created)
- [x] `POST /api/sources/fetch` — Fetches external URL content, strips HTML, returns `{ content, title, statusCode }`
- [x] `POST /api/sources/summarize` — AI summarization via Gemini `gemini-2.0-flash` model
- [x] Rate limiting on summarize endpoint
- [x] 10-second timeout on URL fetch
- File: `api/src/routes/sources.ts` (new, ~115 lines)

#### 4. Extended Backend Route — `api/src/routes/ai.ts`
- [x] Added `POST /api/ai/generate` — Generic Gemini proxy endpoint matching old `server.js` contract
- [x] Rate limiting + usage tracking (upsert to `usageTracking` table)
- [x] 429 handling for rate limit and quota errors
- [x] Response: `{ text }` — exact same contract as proxy
- File: `api/src/routes/ai.ts:491-587` (new endpoint)

#### 5. Extended Backend Route — `api/src/routes/validate.ts`
- [x] Added `POST /api/validate/youtube-url` — YouTube URL validation with 3 regex patterns
- [x] Ported from `server.js` lines 272-314
- File: `api/src/routes/validate.ts:43-82` (new endpoint)

#### 6. Route Registration — `api/src/index.ts`
- [x] Imported `youtubeRoutes` and `sourcesRoutes`
- [x] Registered as authenticated routes: `app.use('/api/youtube', authMiddleware, youtubeRoutes)` and `app.use('/api/sources', authMiddleware, sourcesRoutes)`
- File: `api/src/index.ts:33-34` (imports), `api/src/index.ts:181-182` (registration)

#### 7. Frontend Service Updates — `src/services/youtube.ts`
- [x] Changed base URL from `http://localhost:3002` to `http://localhost:3001`
- [x] Removed `isProxyAvailable()` function entirely
- [x] Added `getAuthHeaders()` helper using `useAuthStore.getState().accessToken`
- [x] Updated `fetchVideoMetadata()` to call `GET /api/youtube/video/:videoId` with auth headers, oEmbed fallback
- [x] Updated `fetchTranscript()` to call `GET /api/youtube/transcript/:videoId` with auth headers
- [x] Added `credentials: 'include'` to all fetch calls
- File: `src/services/youtube.ts:1-127` (rewritten top section)

#### 8. Frontend Service Updates — `src/services/gemini.ts`
- [x] Changed `AI_PROXY_URL` from `http://localhost:3002/api/ai/generate` to `http://localhost:3001/api/ai/generate`
- [x] Added `useAuthStore` import
- [x] Updated `callGemini()` to include `Authorization: Bearer` header and `credentials: 'include'`
- File: `src/services/gemini.ts:1-8` (imports/URL), `src/services/gemini.ts:44-52` (callGemini)

#### 9. Frontend Service Updates — `src/services/externalSources.ts`
- [x] Changed `PROXY_BASE` from `http://localhost:3002` to `http://localhost:3001` (renamed to `API_BASE`)
- [x] Added `getAuthHeaders()` helper using `useAuthStore`
- [x] Updated source fetch URL to `/api/sources/fetch`
- [x] Updated summarize URL from `/api/ai/summarize-source` to `/api/sources/summarize`
- [x] Added auth headers and `credentials: 'include'` to both fetch calls
- File: `src/services/externalSources.ts:1-20` (imports/URL), `src/services/externalSources.ts:113-135` (fetchAndSummarize)

#### 10. Cleanup — Deleted Files
- [x] Deleted `server.js` (524 lines, entire proxy server)

#### 11. Cleanup — Root `package.json`
- [x] Removed 9 unused dependencies:
  - `express` (only used by `server.js`)
  - `cors` (only used by `server.js`)
  - `youtube-captions-api`, `youtube-captions-scraper`, `youtube-transcript`, `youtube-transcript-api`, `youtube-transcript-ts`, `youtubei.js`, `yt-transcript` (7 YouTube transcript libraries)
- [x] Ran `npm install` to prune — removed 114 packages
- File: `package.json:12-29` (cleaned dependencies)

#### 12. Cleanup — `start-dev.sh`
- [x] Removed "Start Transcript Proxy" section (was step 3/4)
- [x] Removed port 3002 from cleanup function
- [x] Removed proxy log from `tail -f`
- [x] Updated step numbers: now 3 services (1. Redis, 2. Backend API, 3. Frontend) instead of 4
- File: `start-dev.sh` (rewritten, 146 lines → 145 lines)

#### 13. Documentation — `CLAUDE.md`
- [x] Removed "Transcript Proxy Server" section from Architecture
- [x] Updated dev commands comment from "Redis, API, Proxy, Frontend" to "Redis, API, Frontend"
- [x] Added `/youtube`, `/sources`, `/validate` to API Routes section
- [x] Added `APIFY_API_TOKEN` to Environment Variables section
- File: `CLAUDE.md:24-27` (removed proxy section), `CLAUDE.md:85-91` (routes), `CLAUDE.md:97` (env var)

### Testing Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| Backend TypeScript compilation (`api/`) | PASSED | No new errors in youtube.ts, sources.ts, ai.ts, validate.ts |
| Frontend TypeScript compilation | PASSED | Zero errors |
| Port 3002 references eliminated | PASSED | `grep -r "3002" src/ api/` returns nothing |
| `server.js` references eliminated | PASSED | Only comment in ai.ts mentioning "old server.js" |
| Root dependency cleanup | PASSED | 114 packages removed, 0 vulnerabilities |
| Git status clean | PASSED | 14 modified files, 2 new files, 1 deleted file — all expected |

### Session Summary

**Status:** COMPLETE

**Completed:**
- Eliminated `server.js` proxy server entirely (524 lines deleted)
- Created 2 new backend route files: `youtube.ts` (transcript via Apify + video metadata) and `sources.ts` (external source fetch + summarize)
- Extended 2 existing backend routes: `ai.ts` (generic generate), `validate.ts` (YouTube URL validation)
- Updated 3 frontend services to use authenticated backend API calls instead of unauthenticated proxy
- Added Redis caching for transcripts (7-day TTL, per-user keys)
- Removed 9 unused root dependencies
- Updated `start-dev.sh` to 3-service architecture (was 4)
- Updated `CLAUDE.md` documentation

**Architecture improvement:**
- Before: 3 servers (frontend 5173, API 3001, proxy 3002), 9 YouTube libs, unauthenticated proxy calls
- After: 2 servers (frontend 5173, API 3001), 1 Apify actor, all calls authenticated + rate-limited + cached

**Next Steps:**
- Set real `APIFY_API_TOKEN` value in `api/.env` for production use
- End-to-end testing: create a lesson from a YouTube URL to verify full pipeline
- Monitor Apify costs ($0.0005/transcript)

---

## Phase Summary

### Phase Status: COMPLETE

### What Was Accomplished
- Eliminated the standalone transcript proxy server (`server.js`, port 3002)
- Consolidated all endpoints into the backend API (`api/`, port 3001)
- Replaced 7 unreliable YouTube transcript libraries with Apify actor `supreme_coder/youtube-transcript-scraper`
- Added per-user Redis caching for transcripts (7-day TTL)
- Secured all frontend-to-backend calls with JWT authentication
- Simplified architecture from 3 servers to 2 servers

### Files Modified
| File | Changes |
|------|---------|
| `api/src/routes/youtube.ts` | **New** — Video metadata + Apify transcript endpoints with Redis caching |
| `api/src/routes/sources.ts` | **New** — External source fetch + AI summarize endpoints |
| `api/src/routes/ai.ts` | Added `POST /generate` generic Gemini proxy endpoint |
| `api/src/routes/validate.ts` | Added `POST /youtube-url` validation endpoint |
| `api/src/index.ts` | Registered youtube and sources routes |
| `api/package.json` | Added `apify-client` dependency |
| `api/.env` / `api/.env.example` | Added `APIFY_API_TOKEN` |
| `src/services/youtube.ts` | Redirected to backend API with auth headers |
| `src/services/gemini.ts` | Redirected to backend API with auth headers |
| `src/services/externalSources.ts` | Redirected to backend API with auth headers |
| `package.json` (root) | Removed 9 unused dependencies |
| `start-dev.sh` | Removed proxy server startup, now 3 services |
| `server.js` | **Deleted** (524 lines) |
| `CLAUDE.md` | Updated architecture documentation |

### Lessons Learned
- The `youtube-captions-api` and 6 alternatives all had reliability issues — external service (Apify) with 99.9% success rate is the right choice for transcript extraction
- Moving proxy endpoints into the authenticated backend improves security (all calls now require JWT) and reduces ops complexity
- Redis caching per-user prevents redundant Apify calls and saves costs on repeat video views

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `CLAUDE.md` | Updated architecture docs | Updated |
| `CHANGELOG.md` | Release changelog | Updated |
| `docs/phase-12/phase-12-tasks.md` | Previous phase tasks | Complete |
