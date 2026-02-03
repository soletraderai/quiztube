# Phase 10 Tasks: Smarter Question Generation (Two-Stage Pipeline)

<!--
=============================================================================
TASK LIST - Created from phase-10-implementation-plan.md
Status: Awaiting user approval
=============================================================================
-->

## User Preferences

- **Pipeline approach:** Two-stage (content analysis → question generation) with silent fallback to single-stage on failure
- **Temperature strategy:** Stage 1 at 0.3 (analytical consistency), Stage 2 at 0.7 (creative variety) — configured via prompt instructions since temperature is set server-side in the AI proxy
- **Cognitive distribution:** ~40% remember/understand, ~30% apply/analyze, ~20% evaluate/synthesize, ~10% misconception-targeted
- **Performance budget:** ≤5s additional session creation time
- **Fallback policy:** Stage 1 failure → proceed with existing single-stage generation silently; RateLimitError → skip without retry

---

## Phase 10.1: Foundation — Types & Content Analysis - COMPLETE

### Type Definitions (`src/types/index.ts`)

- [ ] Add `BloomLevel` type alias: `'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'`
- [ ] Add `DOKLevel` type alias: `1 | 2 | 3 | 4`
- [ ] Add `ExtractedConcept` interface with fields: `id`, `name`, `definition`, `bloomLevel`, `dokLevel`, `importance` (`'core' | 'supporting' | 'tangential'`), `prerequisites` (string[]), `sourceQuote`, `sourceTimestamp`, `misconceptions` (string[])
- [ ] Add `ConceptRelationship` interface with fields: `fromConceptId`, `toConceptId`, `type` (`'depends-on' | 'contrasts-with' | 'example-of' | 'part-of' | 'leads-to'`), `explanation`
- [ ] Add `ContentSection` interface with fields: `title`, `timestampStart`, `timestampEnd`, `conceptIds` (string[]), `keyExamples` (string[]), `complexityLevel` (`'introductory' | 'intermediate' | 'advanced'`)
- [ ] Add `ContentAnalysis` interface with fields: `videoId`, `analyzedAt`, `concepts` (ExtractedConcept[]), `relationships` (ConceptRelationship[]), `sections` (ContentSection[]), `overallComplexity` (`'beginner' | 'intermediate' | 'advanced' | 'mixed'`), `subjectDomain`, `estimatedPrerequisites` (string[])
- [ ] Add `contentAnalysis?: ContentAnalysis` field to `Session` interface (after `enhancedSegments` field, ~line 202)
- [ ] Add `'analyzing_content'` to `ProcessingState.step` union type (insert between `'building_knowledge'` and `'generating_topics'`, line 262)

### Content Analysis Function (`src/services/gemini.ts`)

- [ ] Add `contentAnalysis?: ContentAnalysis` field to `TopicGenerationOptions` interface (line ~518)
- [ ] Create the Stage 1 content analysis prompt string
  - Instruct Gemini to ONLY analyze content structure, NOT generate questions
  - Request 5-12 concepts with Bloom's/DOK mappings
  - Request concept relationships and thematic sections
  - Request misconception identification per concept
  - Request `sourceQuote` and `sourceTimestamp` for each concept
  - Specify JSON output matching `ContentAnalysis` interface
  - Include enhanced segments when available for timestamp accuracy
  - Cap transcript input at 15K characters (consistent with existing limit)
  - Include instruction for temperature 0.3 behavior (analytical, consistent)
- [ ] Implement `analyzeTranscriptContent()` function
  - Signature: `export async function analyzeTranscriptContent(metadata: VideoMetadata, transcript: string, enhancedSegments?: EnhancedTranscriptSegment[]): Promise<ContentAnalysis>`
  - Build the prompt with transcript and optional enhanced segments
  - Call `callGemini()` with the analysis prompt
  - Parse JSON response and validate against `ContentAnalysis` structure
  - Generate concept IDs if not provided by the model
  - Set `analyzedAt` to `Date.now()` and `videoId` from metadata
  - Handle JSON parse errors gracefully (throw typed error)
  - Add timeout of 12s and max 2 retries on transient failures

---

## Phase 10.2: Analysis-Aware Question Generation - COMPLETE

### Enhanced Stage 2 Prompt (`src/services/gemini.ts`)

- [ ] Create the analysis-aware question generation prompt that receives `ContentAnalysis` JSON as context instead of raw transcript
  - Map topics from `ContentSection` entries
  - Include concept definitions, Bloom's levels, and misconceptions in prompt context
  - Instruct cognitive distribution: ~40% remember/understand, ~30% apply/analyze, ~20% evaluate/synthesize, ~10% misconception-targeted
  - Include concept relationship data for synthesis/comparison questions
  - Instruct the model to set `sourceQuote` and `sourceTimestamp` from the analysis data
  - Instruct model to target each question at the concept's mapped Bloom's level
  - Preserve existing instructions for `TopicCategory` and `TopicIcon` assignment (Phase 9)

### Function Modification (`src/services/gemini.ts`)

- [ ] Modify `generateTopicsFromVideo()` to branch on `contentAnalysis` presence:
  - When `options.contentAnalysis` is defined → use the new analysis-aware prompt
  - When `options.contentAnalysis` is undefined → use the existing prompt unchanged (backward compatible)
- [ ] In the analysis-aware branch, serialize `ContentAnalysis` to JSON and embed in the prompt
- [ ] Ensure the response parsing/validation logic (topic transformation, category/icon assignment at ~line 844) works identically for both branches — no changes to output format

---

## Phase 10.3: Pipeline Integration & Fallback - COMPLETE

### Session Pipeline (`src/services/session.ts`)

- [ ] Insert new Step 4.5 between knowledge base building (current Step 4, ~line 60) and topic generation (current Step 5, ~line 82)
  - Add `onProgress?.({ step: 'analyzing_content', progress: 60, message: 'Analyzing content structure...' })`
  - Call `analyzeTranscriptContent(metadata, transcript, preProcessedSegments)` wrapped in try/catch
  - Store result in a `let contentAnalysis: ContentAnalysis | undefined` variable
- [ ] Wire `contentAnalysis` into `TopicGenerationOptions` passed to `generateTopicsFromVideo()`:
  - Add `contentAnalysis` to the options object (~line 94)
- [ ] Store `contentAnalysis` on the Session object:
  - Add `contentAnalysis` field to the session creation object (~line 130)

### Fallback Logic (`src/services/session.ts`)

- [ ] In the Step 4.5 catch block: set `contentAnalysis = undefined` and log warning (no user-facing error)
- [ ] Add specific handling for `RateLimitError`: skip content analysis entirely without retry, log that rate limit was hit
- [ ] Verify that when `contentAnalysis` is undefined, `generateTopicsFromVideo()` uses the existing single-stage prompt (backward compatible path)

### Progress Percentage Adjustment (`src/services/session.ts`)

- [ ] Update progress percentages across all steps:
  - `fetching_video`: 10 (unchanged)
  - `extracting_transcript`: 25 (was 30)
  - `building_knowledge`: 45 (was 50)
  - `analyzing_content`: 60 (new)
  - `generating_topics`: 80 (was 70)
  - `ready`: 100 (unchanged)

### Import Updates

- [ ] Add import for `analyzeTranscriptContent` from `./gemini` in `session.ts`
- [ ] Add import for `ContentAnalysis` from `../types` in `session.ts` (if not already covered by existing imports)

---

## Phase 10.4: Validation & Quality Assurance - PENDING

### Functional Testing

- [ ] Test full two-stage pipeline with a real YouTube video — verify topics/questions are generated successfully
- [ ] Verify questions span 3+ different Bloom's levels in the generated output
- [ ] Verify at least 1 question per session targets a misconception from the content analysis
- [ ] Verify `sourceQuote` and `sourceTimestamp` are populated on questions when transcript is available
- [ ] Test with a video that has no transcript — verify graceful handling (should skip content analysis)

### Fallback Testing

- [ ] Test fallback: temporarily break the content analysis prompt/response to simulate Stage 1 failure — verify single-stage generation still works
- [ ] Test RateLimitError handling: simulate rate limit — verify analysis is skipped without retry and session completes
- [ ] Verify no user-facing error messages when content analysis fails silently

### Performance Testing

- [ ] Measure session creation time with two-stage pipeline vs current single-stage
- [ ] Verify additional time is ≤5 seconds

### Regression Testing

- [ ] Verify existing `validateQuestion()` function works with questions from the new pipeline
- [ ] Verify existing `regenerateInvalidQuestion()` function works with questions from the new pipeline
- [ ] Verify dig-deeper conversation still works correctly
- [ ] Verify session overview page displays topics/questions correctly
- [ ] Dev server runs without errors
- [ ] No new console errors or warnings
- [ ] No new TypeScript compilation errors

---

## Reference Tables

### Bloom's Taxonomy Levels

| Level | Description | Question Type Example |
|-------|-------------|----------------------|
| `remember` | Recall facts | "What is X?" |
| `understand` | Explain concepts | "Explain how X works" |
| `apply` | Use in new context | "How would you use X to solve Y?" |
| `analyze` | Break down relationships | "What's the relationship between X and Y?" |
| `evaluate` | Judge/critique | "Which approach is better for X and why?" |
| `create` | Synthesize new ideas | "Design a solution using X and Y" |

### Cognitive Distribution Target

| Category | Target % | Bloom's Levels |
|----------|----------|---------------|
| Foundation | ~40% | remember, understand |
| Application | ~30% | apply, analyze |
| Higher-order | ~20% | evaluate, create |
| Misconception-targeted | ~10% | any level |

### Progress Percentages (New vs Old)

| Step | Old % | New % |
|------|-------|-------|
| fetching_video | 10 | 10 |
| extracting_transcript | 30 | 25 |
| building_knowledge | 50 | 45 |
| analyzing_content | — | 60 |
| generating_topics | 70 | 80 |
| ready | 100 | 100 |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | Add ContentAnalysis types, update Session and ProcessingState |
| `src/services/gemini.ts` | Add `analyzeTranscriptContent()`, modify `generateTopicsFromVideo()` with analysis-aware prompt |
| `src/services/session.ts` | Insert Step 4.5, wire content analysis into pipeline, adjust progress |

All paths relative to `generations/teachy/`.

---

## Verification Checklist

- [ ] All sub-phase sections marked COMPLETE
- [ ] Dev server runs and all pages load
- [ ] Two-stage pipeline produces questions at 3+ Bloom's levels
- [ ] Fallback to single-stage works when Stage 1 fails
- [ ] Session creation time increase ≤5 seconds
- [ ] No regressions in existing question/topic functionality
- [ ] No new console errors or warnings
- [ ] No TypeScript compilation errors
- [ ] Code committed with descriptive message
- [ ] SESSION-NOTES.md updated with final summary

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | Workflow guide | Reference |
| `phase-10-feedback.md` | Source requirements | Complete |
| `phase-10-implementation-plan.md` | Implementation strategy | Complete |
| `SESSION-NOTES.md` | Progress documentation | Pending |
