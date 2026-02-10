// Phase 12: External Source Detection and Summarization Service
import type { ExternalSource } from '../types';

const PROXY_BASE = 'http://localhost:3002';

// Known non-content URL patterns to filter out
const EXCLUDED_PATTERNS = [
  /youtube\.com\/(?:channel|user|c|@)/,
  /youtu\.be\//,
  /youtube\.com\/watch/,
  /twitter\.com\/\w+$/,
  /x\.com\/\w+$/,
  /instagram\.com\/\w+$/,
  /facebook\.com\/\w+$/,
  /tiktok\.com\/@\w+$/,
  /^https?:\/\/(www\.)?google\.com\/?$/,
  /linkedin\.com\/in\//,
  /discord\.gg\//,
  /t\.me\//,
  /patreon\.com\//,
  /buymeacoffee\.com\//,
];

/**
 * Detect URLs from transcript text and video description
 */
export function detectSources(
  transcript: string,
  videoDescription: string
): { url: string; foundIn: 'transcript' | 'description' }[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const found = new Map<string, 'transcript' | 'description'>();

  // Scan transcript
  const transcriptUrls = transcript.match(urlRegex) || [];
  for (const url of transcriptUrls) {
    const cleaned = cleanUrl(url);
    if (cleaned && !isExcluded(cleaned)) {
      found.set(cleaned, 'transcript');
    }
  }

  // Scan description
  const descriptionUrls = videoDescription.match(urlRegex) || [];
  for (const url of descriptionUrls) {
    const cleaned = cleanUrl(url);
    if (cleaned && !isExcluded(cleaned)) {
      if (!found.has(cleaned)) {
        found.set(cleaned, 'description');
      }
    }
  }

  return Array.from(found.entries()).map(([url, foundIn]) => ({ url, foundIn }));
}

/**
 * Classify a URL into a source type
 */
export function classifySourceType(url: string): ExternalSource['type'] {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes('github.com') || hostname.includes('gitlab.com') || hostname.includes('bitbucket.org')) {
    return 'github';
  }
  if (hostname.startsWith('docs.') || hostname.startsWith('developer.') ||
      hostname.includes('readthedocs.io') || hostname.includes('devdocs.io') ||
      hostname.includes('mdn.') || hostname.includes('w3.org')) {
    return 'documentation';
  }
  if (hostname.includes('medium.com') || hostname.includes('dev.to') ||
      hostname.includes('blog.') || hostname.includes('hashnode.') ||
      hostname.includes('substack.com') || hostname.includes('wordpress.com')) {
    return 'article';
  }
  if (hostname.includes('npmjs.com') || hostname.includes('pypi.org') ||
      hostname.includes('crates.io') || hostname.includes('packagist.org') ||
      hostname.includes('rubygems.org') || hostname.includes('nuget.org')) {
    return 'platform';
  }

  return 'other';
}

/**
 * Extract summaries for detected URLs using the proxy AI endpoint
 */
export async function extractSourceSummaries(
  detectedUrls: { url: string; foundIn: 'transcript' | 'description' }[],
  videoTitle: string
): Promise<ExternalSource[]> {
  // Cap at 10 sources max
  const urlsToProcess = detectedUrls.slice(0, 10);
  const sources: ExternalSource[] = [];

  // Process in batches of 3 (parallel with concurrency limit)
  for (let i = 0; i < urlsToProcess.length; i += 3) {
    const batch = urlsToProcess.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(({ url }) => fetchAndSummarize(url, videoTitle))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        sources.push(result.value);
      }
    }
  }

  return sources;
}

async function fetchAndSummarize(url: string, videoTitle: string): Promise<ExternalSource | null> {
  try {
    // Step 1: Fetch content via proxy
    const fetchResponse = await fetch(`${PROXY_BASE}/api/sources/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!fetchResponse.ok) return null;

    const { content, title: pageTitle } = await fetchResponse.json();
    if (!content || content.length < 50) return null;

    // Step 2: Summarize via AI proxy
    const aiResponse = await fetch(`${PROXY_BASE}/api/ai/summarize-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, videoTitle, url }),
    });

    if (!aiResponse.ok) {
      // Fallback: use page title as summary
      return {
        id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        url,
        type: classifySourceType(url),
        title: pageTitle || url,
        summary: content.slice(0, 200) + '...',
        relevance: 'Referenced in video',
        extractedAt: new Date().toISOString(),
      };
    }

    const { title, summary, relevance } = await aiResponse.json();

    return {
      id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      url,
      type: classifySourceType(url),
      title: title || pageTitle || url,
      summary: summary || content.slice(0, 200),
      relevance: relevance || 'Referenced in video',
      extractedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function cleanUrl(url: string): string | null {
  try {
    // Remove trailing punctuation
    let cleaned = url.replace(/[.,;:!?)}\]]+$/, '');
    // Validate
    new URL(cleaned);
    return cleaned;
  } catch {
    return null;
  }
}

function isExcluded(url: string): boolean {
  return EXCLUDED_PATTERNS.some(pattern => pattern.test(url));
}
