// Gemini AI service for question generation and answer evaluation
// Uses server-side proxy to protect API key
import type { VideoMetadata, Topic, Question, ChatMessage, TutorPersonality, EvaluationResult, EnhancedTranscriptSegment, ScrapedResource, TopicCategory, TopicIcon, ContentAnalysis } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { formatSegmentsForPrompt } from './transcript';

// Note: Transcript proxy (with AI) runs on 3002, API server runs on 3001
const AI_PROXY_URL = 'http://localhost:3002/api/ai/generate';

// Phase 9: Topic category descriptions for AI prompt guidance
export const TOPIC_CATEGORIES: Record<TopicCategory, string> = {
  'concept': 'Core concepts, definitions, and fundamental ideas',
  'technique': 'Methods, processes, how-to instructions, and procedures',
  'comparison': 'Comparing alternatives, trade-offs, pros/cons analysis',
  'example': 'Code examples, demonstrations, and practical illustrations',
  'application': 'Real-world use cases, practical applications, and implementations',
  'theory': 'Theoretical foundations, underlying principles, and academic explanations',
  'best-practice': 'Guidelines, recommendations, conventions, and industry standards',
};

// Phase 9: Icon mapping based on topic category
export const TOPIC_ICONS: Record<TopicCategory, TopicIcon> = {
  'concept': 'lightbulb',
  'technique': 'wrench',
  'comparison': 'scale',
  'example': 'code',
  'application': 'rocket',
  'theory': 'book',
  'best-practice': 'star',
};

// Custom error class for rate limiting
export class RateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// Make a request to AI via server-side proxy (no API key needed from frontend)
async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Handle rate limiting specifically (HTTP 429)
    if (response.status === 429) {
      const retryAfter = errorData.retryAfter || 60;
      throw new RateLimitError(
        errorData.error || `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`,
        retryAfter
      );
    }

    throw new Error(errorData.error || `AI API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.text) {
    throw new Error('No response from AI service');
  }

  return data.text;
}

// Extract JSON from Gemini response (handles markdown code blocks)
function extractJson(text: string): string {
  // Try to extract JSON from markdown code blocks
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Try to find raw JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return text;
}

// Generate ID for questions/topics
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Detect if video is likely a long/comprehensive course based on title
function isLongVideoFromTitle(title: string): boolean {
  const longVideoKeywords = [
    'course', 'tutorial', 'complete', 'full', 'beginner to advanced',
    'masterclass', 'bootcamp', 'crash course', 'comprehensive',
    'deep dive', 'lecture', 'series', 'hour', 'hours', 'workshop'
  ];
  const lowerTitle = title.toLowerCase();
  return longVideoKeywords.some(keyword => lowerTitle.includes(keyword));
}

// Generate a question helper
function createQuestion(text: string): Question {
  return {
    id: generateId(),
    text,
    difficulty: 'standard' as const,
    userAnswer: null,
    feedback: null,
    answeredAt: null,
  };
}

// Detect programming language from video title
function detectProgrammingLanguage(title: string): string | null {
  const langPatterns: Record<string, RegExp> = {
    'javascript': /\b(javascript|js|node\.?js|nodejs)\b/i,
    'typescript': /\b(typescript|ts)\b/i,
    'python': /\b(python|py)\b/i,
    'react': /\b(react|jsx)\b/i,
    'java': /\bjava\b/i,
    'csharp': /\b(c#|csharp|\.net)\b/i,
    'cpp': /\b(c\+\+|cpp)\b/i,
    'rust': /\brust\b/i,
    'go': /\bgolang|go\b/i,
    'ruby': /\bruby\b/i,
    'php': /\bphp\b/i,
    'html': /\bhtml\b/i,
    'css': /\bcss\b/i,
    'sql': /\bsql\b/i,
  };

  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(title)) {
      return lang === 'react' ? 'javascript' : lang;
    }
  }

  // Check for generic programming keywords
  if (/\b(programming|coding|developer|software|code|tutorial|beginner|learn)\b/i.test(title)) {
    return 'javascript'; // Default to javascript for generic programming tutorials
  }

  return null;
}

// Generate sample code examples for different programming topics
function generateCodeExample(topicTitle: string, language: string): { codeExample: string; codeLanguage: string } | null {
  const lowerTitle = topicTitle.toLowerCase();

  if (language === 'javascript' || language === 'typescript') {
    if (lowerTitle.includes('function') || lowerTitle.includes('fundamental')) {
      return {
        codeExample: `// Example: A simple function
function greet(name) {
  return \`Hello, \${name}!\`;
}

// Call the function
console.log(greet("World"));
// Output: Hello, World!`,
        codeLanguage: language,
      };
    }
    if (lowerTitle.includes('variable') || lowerTitle.includes('data type')) {
      return {
        codeExample: `// Variables in JavaScript
const name = "Alice";      // String
let age = 25;              // Number
let isStudent = true;      // Boolean
let hobbies = ["reading"]; // Array

console.log(name, age, isStudent);`,
        codeLanguage: language,
      };
    }
    if (lowerTitle.includes('array') || lowerTitle.includes('loop')) {
      return {
        codeExample: `// Array methods example
const numbers = [1, 2, 3, 4, 5];

// Map: transform each element
const doubled = numbers.map(n => n * 2);
console.log(doubled); // [2, 4, 6, 8, 10]

// Filter: keep only elements that pass test
const evens = numbers.filter(n => n % 2 === 0);
console.log(evens); // [2, 4]`,
        codeLanguage: language,
      };
    }
    if (lowerTitle.includes('object') || lowerTitle.includes('class')) {
      return {
        codeExample: `// Object-oriented example
class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }

  greet() {
    return \`Hi, I'm \${this.name}\`;
  }
}

const person = new Person("Alice", 25);
console.log(person.greet());`,
        codeLanguage: language,
      };
    }
    if (lowerTitle.includes('async') || lowerTitle.includes('promise')) {
      return {
        codeExample: `// Async/Await example
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage
fetchData('https://api.example.com/data')
  .then(data => console.log(data));`,
        codeLanguage: language,
      };
    }
  }

  if (language === 'python') {
    if (lowerTitle.includes('function') || lowerTitle.includes('fundamental')) {
      return {
        codeExample: `# Example: A simple function
def greet(name):
    return f"Hello, {name}!"

# Call the function
print(greet("World"))
# Output: Hello, World!`,
        codeLanguage: 'python',
      };
    }
    if (lowerTitle.includes('class') || lowerTitle.includes('object')) {
      return {
        codeExample: `# Object-oriented example
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greet(self):
        return f"Hi, I'm {self.name}"

person = Person("Alice", 25)
print(person.greet())`,
        codeLanguage: 'python',
      };
    }
  }

  // Default code example for core fundamentals
  if (lowerTitle.includes('core') || lowerTitle.includes('introduction') || lowerTitle.includes('beginner')) {
    if (language === 'python') {
      return {
        codeExample: `# Python basics
name = "Learner"
print(f"Welcome, {name}!")

# A simple list
numbers = [1, 2, 3, 4, 5]
total = sum(numbers)
print(f"Sum: {total}")`,
        codeLanguage: 'python',
      };
    }
    return {
      codeExample: `// JavaScript basics
const name = "Learner";
console.log(\`Welcome, \${name}!\`);

// A simple array
const numbers = [1, 2, 3, 4, 5];
const total = numbers.reduce((a, b) => a + b, 0);
console.log(\`Sum: \${total}\`);`,
      codeLanguage: language || 'javascript',
    };
  }

  return null;
}

// Generate fallback topics based on video metadata (used when API is unavailable)
function generateFallbackTopics(metadata: VideoMetadata): { topics: Topic[]; estimatedDuration: number } {
  const videoTitle = metadata.title;
  const isLongVideo = isLongVideoFromTitle(videoTitle);
  const detectedLanguage = detectProgrammingLanguage(videoTitle);
  const videoDuration = metadata.duration || 600; // Default 10 minutes

  // Helper to add code example to topic if programming tutorial
  const addCodeExample = (topic: Topic, topicTitle: string): Topic => {
    if (detectedLanguage) {
      const codeEx = generateCodeExample(topicTitle, detectedLanguage);
      if (codeEx) {
        return { ...topic, codeExample: codeEx.codeExample, codeLanguage: codeEx.codeLanguage };
      }
    }
    return topic;
  };

  // Phase 7.6: Helper to add timestamps to topics based on video duration
  const addTimestamps = (topics: Topic[]): Topic[] => {
    const topicDuration = videoDuration / topics.length;
    return topics.map((topic, index) => ({
      ...topic,
      timestampStart: Math.floor(index * topicDuration),
      timestampEnd: Math.floor((index + 1) * topicDuration),
      sectionName: topic.title,
    }));
  };

  // For long videos/courses, generate more comprehensive topics (5-7 topics, 2-3 questions each = 12-21 questions)
  // Phase 7.6: Updated to focus on COMPREHENSION, not application
  // Phase 9: Added category and icon fields
  if (isLongVideo) {
    const rawTopics: Topic[] = [
      {
        id: generateId(),
        title: `Introduction and Overview`,
        summary: `This topic covers the fundamental concepts introduced in "${videoTitle}". Pay attention to how the instructor defines key terms and sets up the learning objectives.`,
        questions: [
          createQuestion(`What are the main topics or concepts that the instructor says will be covered in "${videoTitle}"?`),
          createQuestion(`How does the instructor define the key terms introduced at the beginning?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
        category: 'concept',
        icon: 'lightbulb',
      },
      {
        id: generateId(),
        title: `Core Fundamentals`,
        summary: `This section explores the foundational concepts that form the building blocks of the subject. These are the essential ideas that everything else is built upon.`,
        questions: [
          createQuestion(`What fundamental concepts does the instructor explain as the foundation for this topic?`),
          createQuestion(`What examples or analogies does the instructor use to explain these core concepts?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
        category: 'theory',
        icon: 'book',
      },
      {
        id: generateId(),
        title: `Key Concepts Explained`,
        summary: `This section dives deeper into the main ideas, explaining how they work and why they matter within the context of the subject.`,
        questions: [
          createQuestion(`What are the key differences between the main concepts explained in this section?`),
          createQuestion(`According to the video, what is the relationship between these concepts?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
        category: 'concept',
        icon: 'lightbulb',
      },
      {
        id: generateId(),
        title: `Detailed Explanations`,
        summary: `This section provides in-depth explanations of how things work, including any technical details or nuances the instructor highlights.`,
        questions: [
          createQuestion(`What specific details or nuances does the instructor emphasize about this topic?`),
          createQuestion(`What warnings or common mistakes does the instructor mention to avoid?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
        category: 'technique',
        icon: 'wrench',
      },
      {
        id: generateId(),
        title: `Examples and Demonstrations`,
        summary: `The instructor demonstrates concepts through examples, showing how they work in practice and what outcomes to expect.`,
        questions: [
          createQuestion(`What specific examples does the instructor walk through in this section?`),
          createQuestion(`What results or outcomes does the instructor show when demonstrating these concepts?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
        category: 'example',
        icon: 'code',
      },
      {
        id: generateId(),
        title: `Important Considerations`,
        summary: `The instructor covers important factors, edge cases, or special considerations that affect how these concepts work.`,
        questions: [
          createQuestion(`What important considerations or limitations does the instructor mention?`),
          createQuestion(`What edge cases or special scenarios does the instructor address?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
        category: 'best-practice',
        icon: 'star',
      },
      {
        id: generateId(),
        title: `Summary and Key Takeaways`,
        summary: `The instructor summarizes the main points and highlights the most important things to remember from the content.`,
        questions: [
          createQuestion(`What does the instructor identify as the most important takeaways from this content?`),
          createQuestion(`How does the instructor summarize the main points at the end?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
        category: 'concept',
        icon: 'lightbulb',
      },
    ];

    // Apply code examples and timestamps to each topic for programming tutorials
    const topicsWithCode = rawTopics.map(t => addCodeExample(t, t.title));
    const topics = addTimestamps(topicsWithCode);

    return {
      topics,
      estimatedDuration: 45, // Longer estimated duration for comprehensive courses
    };
  }

  // Standard fallback for shorter videos (3 topics, 2 questions each = 6 questions)
  // Phase 7.6: Updated to focus on COMPREHENSION, not application
  // Phase 9: Added category and icon fields
  const rawTopics: Topic[] = [
    {
      id: generateId(),
      title: `Introduction to ${videoTitle}`,
      summary: `This topic covers the fundamental concepts introduced in "${videoTitle}". Pay attention to how the speaker introduces and defines the main subject.`,
      questions: [
        createQuestion(`What is the main topic or subject that the speaker introduces in "${videoTitle}"?`),
        createQuestion(`How does the speaker define or describe the key concept at the beginning?`),
      ],
      digDeeperConversation: null,
      bookmarked: false,
      skipped: false,
      completed: false,
      category: 'concept',
      icon: 'lightbulb',
    },
    {
      id: generateId(),
      title: `Key Concepts Explained`,
      summary: `This section explores the main ideas and concepts presented in the video. Focus on the specific explanations and examples the speaker provides.`,
      questions: [
        createQuestion(`What are the key concepts or main points that the speaker explains in this video?`),
        createQuestion(`What examples or explanations does the speaker use to illustrate these concepts?`),
      ],
      digDeeperConversation: null,
      bookmarked: false,
      skipped: false,
      completed: false,
      category: 'technique',
      icon: 'wrench',
    },
    {
      id: generateId(),
      title: `Details and Takeaways`,
      summary: `The speaker covers important details and summarizes the key takeaways. Pay attention to any specific advice, warnings, or conclusions mentioned.`,
      questions: [
        createQuestion(`What specific details or important points does the speaker emphasize?`),
        createQuestion(`What conclusions or key takeaways does the speaker mention at the end?`),
      ],
      digDeeperConversation: null,
      bookmarked: false,
      skipped: false,
      completed: false,
      category: 'best-practice',
      icon: 'star',
    },
  ];

  // Apply code examples and timestamps to each topic
  const topicsWithCode = rawTopics.map(t => addCodeExample(t, t.title));
  const topics = addTimestamps(topicsWithCode);

  return {
    topics,
    estimatedDuration: 10,
  };
}

// Phase 8: Options for topic generation
export interface TopicGenerationOptions {
  transcript?: string;
  enhancedSegments?: EnhancedTranscriptSegment[];
  scrapedResources?: ScrapedResource[];
  // Phase 10: Content analysis from Stage 1 of two-stage pipeline
  contentAnalysis?: ContentAnalysis;
}

// ============================================================================
// Phase 10: Stage 1 — Content Analysis Engine
// ============================================================================

/**
 * Analyze transcript content to extract structured concepts, relationships, and sections.
 * This is Stage 1 of the two-stage pipeline. Its output feeds into Stage 2 (question generation)
 * as compressed, structured context instead of raw transcript text.
 */
export async function analyzeTranscriptContent(
  metadata: VideoMetadata,
  transcript: string,
  enhancedSegments?: EnhancedTranscriptSegment[]
): Promise<ContentAnalysis> {
  const formattedSegments = enhancedSegments && enhancedSegments.length > 0
    ? `\n\nTRANSCRIPT WITH TIMESTAMPS AND SEGMENT IDs:\n${formatSegmentsForPrompt(enhancedSegments, 60)}`
    : '';

  const prompt = `You are a content analysis engine. Your ONLY job is to analyze this video transcript and extract a structured understanding of its content. Do NOT generate any questions.

Video Title: "${metadata.title}"
Channel: ${metadata.channel}
Duration: ${metadata.duration ? Math.floor(metadata.duration / 60) + ' minutes' : 'Unknown'}

TRANSCRIPT:
${transcript.slice(0, 15000)}${transcript.length > 15000 ? ' ... (truncated)' : ''}${formattedSegments}

ANALYSIS INSTRUCTIONS:
1. Extract 5-12 key concepts from the transcript
2. For each concept, determine:
   - Bloom's taxonomy level needed to grasp it (remember/understand/apply/analyze/evaluate/create)
   - Webb's Depth of Knowledge level (1=recall, 2=skill/concept, 3=strategic thinking, 4=extended thinking)
   - Importance: core (essential to the topic), supporting (helps understand core), or tangential (mentioned but not central)
   - An EXACT quote from the transcript where this concept is explained
   - The approximate timestamp (in seconds) where this concept appears
   - Common misconceptions learners might have about this concept (1-3 per concept)
3. Identify relationships between concepts (depends-on, contrasts-with, example-of, part-of, leads-to)
4. Segment the content into 3-5 thematic sections with timestamp ranges
5. Determine the overall complexity and subject domain

Be analytical and precise. Use low creativity — focus on accurately representing what the transcript contains.

Return JSON matching this EXACT structure:
{
  "concepts": [
    {
      "id": "concept_1",
      "name": "Concept Name",
      "definition": "How the speaker defines/explains this concept",
      "bloomLevel": "understand",
      "dokLevel": 2,
      "importance": "core",
      "prerequisites": [],
      "sourceQuote": "Exact quote from transcript",
      "sourceTimestamp": 120,
      "misconceptions": ["Common misconception 1"]
    }
  ],
  "relationships": [
    {
      "fromConceptId": "concept_1",
      "toConceptId": "concept_2",
      "type": "depends-on",
      "explanation": "Why this relationship exists"
    }
  ],
  "sections": [
    {
      "title": "Section Title",
      "timestampStart": 0,
      "timestampEnd": 180,
      "conceptIds": ["concept_1", "concept_2"],
      "keyExamples": ["Example mentioned by speaker"],
      "complexityLevel": "introductory"
    }
  ],
  "overallComplexity": "intermediate",
  "subjectDomain": "e.g., Web Development, Machine Learning, etc.",
  "estimatedPrerequisites": ["Prior knowledge needed"]
}`;

  const result = await withRetry(
    () => callGemini(prompt),
    2,     // max 2 retries
    12000  // 12s timeout
  );

  const jsonStr = extractJson(result);
  const parsed = JSON.parse(jsonStr);

  // Validate and normalize the response
  const concepts = (parsed.concepts || []).map((c: Record<string, unknown>, i: number) => ({
    id: (c.id as string) || `concept_${i + 1}`,
    name: (c.name as string) || '',
    definition: (c.definition as string) || '',
    bloomLevel: c.bloomLevel || 'understand',
    dokLevel: typeof c.dokLevel === 'number' ? c.dokLevel : 2,
    importance: c.importance || 'supporting',
    prerequisites: Array.isArray(c.prerequisites) ? c.prerequisites : [],
    sourceQuote: (c.sourceQuote as string) || '',
    sourceTimestamp: typeof c.sourceTimestamp === 'number' ? c.sourceTimestamp : 0,
    misconceptions: Array.isArray(c.misconceptions) ? c.misconceptions : [],
  }));

  return {
    videoId: metadata.id || metadata.url,
    analyzedAt: Date.now(),
    concepts,
    relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    overallComplexity: parsed.overallComplexity || 'intermediate',
    subjectDomain: parsed.subjectDomain || '',
    estimatedPrerequisites: Array.isArray(parsed.estimatedPrerequisites) ? parsed.estimatedPrerequisites : [],
  };
}

// Generate topics and questions from video metadata
// Phase 7: Updated with timestamps, question types, and anti-repetition instructions
// Phase 8: Updated with source context requirements for contextual questions
export async function generateTopicsFromVideo(
  metadata: VideoMetadata,
  transcriptOrOptions?: string | TopicGenerationOptions
): Promise<{ topics: Topic[]; estimatedDuration: number }> {
  // Handle both old (string) and new (options object) signatures for backward compatibility
  let transcript: string | undefined;
  let enhancedSegments: EnhancedTranscriptSegment[] | undefined;
  let scrapedResources: ScrapedResource[] | undefined;

  let contentAnalysis: ContentAnalysis | undefined;

  if (typeof transcriptOrOptions === 'string') {
    transcript = transcriptOrOptions;
  } else if (transcriptOrOptions) {
    transcript = transcriptOrOptions.transcript;
    enhancedSegments = transcriptOrOptions.enhancedSegments;
    scrapedResources = transcriptOrOptions.scrapedResources;
    contentAnalysis = transcriptOrOptions.contentAnalysis;
  }
  // Detect if this is a programming/coding tutorial
  const isProgrammingTutorial = /\b(programming|coding|javascript|typescript|python|react|node|java|c\+\+|c#|rust|go|ruby|php|html|css|sql|api|backend|frontend|web dev|software|developer|code|tutorial)\b/i.test(metadata.title);

  // Phase 7.6: Updated question type instructions - focus on UNDERSTANDING, not application
  const questionTypeInstructions = `
QUESTION TYPE REQUIREMENTS:
- Each question MUST have a "questionType" from: comprehension, analysis, synthesis, evaluation, code
- Questions must test UNDERSTANDING of the content, NOT how the user would apply it
- Distribute question types:
  * At least 2 comprehension questions (tests recall and understanding of specific facts)
  * At least 1 analysis question (tests understanding of relationships/reasons)
  * Use "code" type ONLY for programming videos when asking about code

QUESTION TYPE EXAMPLES (GOOD - tests understanding):
- comprehension: "According to the video, what are the three main characteristics of X?"
- comprehension: "What specific example does the speaker use to illustrate Y?"
- analysis: "Based on the video, why does the speaker recommend Z over W?"
- synthesis: "How does concept X relate to concept Y as explained in the video?"
- evaluation: "What evidence does the speaker provide for their claim about X?"
- code: "What does this code output?" / "What error would this code produce?"

BANNED QUESTION PATTERNS (NEVER use these):
- "How would you apply..." / "How might you use..."
- "What best practices should you follow..."
- "How is this relevant to you/your life/your work..."
- "What would you do with this knowledge..."
- "How could you implement this in your own..."
- "What skills will you develop..."
- Any question about personal application or future use`;

  const codeQuestionInstructions = isProgrammingTutorial ? `

CODE QUESTIONS (for programming videos ONLY):
- Set "isCodeQuestion": true ONLY for questions that require writing/analyzing code
- For non-programming content, ALWAYS set "isCodeQuestion": false
- Include a "codeChallenge" object with:
  * "template": Starter code for the student to work with
  * "language": The programming language (e.g., "javascript", "python")` : `

CODE QUESTIONS:
- This is NOT a programming video, so "isCodeQuestion" must ALWAYS be false
- Do NOT generate any code-related questions`;

  const timestampInstructions = transcript ? `

TIMESTAMP REQUIREMENTS:
- For each topic, include approximate timestamps from the video:
  * "timestampStart": Start time in seconds
  * "timestampEnd": End time in seconds
  * "sectionName": A descriptive name for this section
- Estimate timestamps based on where topics appear in the transcript` : '';

  // Phase 9: Category and icon inference instructions
  const categoryInstructions = `

TOPIC CATEGORY AND ICON REQUIREMENTS:
For each topic, infer the most appropriate category and provide the matching icon.

CATEGORIES (choose ONE per topic based on the content):
- "concept": Core concepts, definitions, and fundamental ideas -> icon: "lightbulb"
- "technique": Methods, processes, how-to instructions -> icon: "wrench"
- "comparison": Comparing alternatives, trade-offs, pros/cons -> icon: "scale"
- "example": Code examples, demonstrations, practical illustrations -> icon: "code"
- "application": Real-world use cases, practical applications -> icon: "rocket"
- "theory": Theoretical foundations, underlying principles -> icon: "book"
- "best-practice": Guidelines, recommendations, conventions -> icon: "star"

ICON MAPPING (use the matching icon for the category):
- concept -> lightbulb
- technique -> wrench
- comparison -> scale
- example -> code
- application -> rocket
- theory -> book
- best-practice -> star

IMPORTANT FOR SUMMARIES:
- The summary should explain what the topic covers WITHOUT revealing specific answers
- Do NOT include answer spoilers in the summary
- Focus on WHAT will be learned, not the actual facts/answers themselves`;

  const antiRepetitionRules = `

CRITICAL RULES:
1. NEVER start two questions with the same phrase
2. Each question MUST reference SPECIFIC facts, examples, or statements from the transcript
3. AVOID generic questions like "What is the main message?" or "What did you learn?"
4. Questions should feel unique and tied to actual video content
5. Vary question structure: don't use the same pattern twice
6. Questions must TEST UNDERSTANDING of what the speaker said, not personal opinions or applications`;

  // Phase 8: Source context requirements for contextual questions
  const sourceContextInstructions = enhancedSegments && enhancedSegments.length > 0 ? `

SOURCE CONTEXT REQUIREMENTS (CRITICAL):
For EVERY question, you MUST include:
1. "sourceQuote": An EXACT or close paraphrase quote from the transcript that this question is based on
2. "sourceTimestamp": The timestamp (in seconds) where this content appears in the video
3. "sourceSegmentId": The segment ID from the transcript (format: seg_XXX_X_XXXX)

Example question with source context:
{
  "text": "According to the video, what are the three main benefits of X?",
  "expectedAnswer": "The three main benefits are A, B, and C",
  "questionType": "comprehension",
  "isCodeQuestion": false,
  "sourceQuote": "The three main benefits are speed, reliability, and cost-effectiveness",
  "sourceTimestamp": 145,
  "sourceSegmentId": "seg_145_3_benefits"
}

BANNED QUESTION TYPES (questions without clear source):
- Generic recall: "What is the main topic of this video?"
- Opinion-based: "What do you think about X?"
- Application-based: "How would you apply X?"
- Summary requests: "Summarize the key points"` : '';

  // Phase 8: Include scraped resources in context
  const resourcesContext = scrapedResources && scrapedResources.length > 0 ? `

EXTERNAL RESOURCES REFERENCED IN VIDEO:
${scrapedResources
  .filter(r => !r.error)
  .slice(0, 5)
  .map(r => `- ${r.title} (${r.sourceType}): ${r.overview.slice(0, 200)}`)
  .join('\n')}

When generating questions, you may reference these external resources if the video mentions them.
Include "relatedResourceIds" array if a question relates to a specific resource.` : '';

  // Phase 8: Format enhanced segments for the prompt
  const formattedSegments = enhancedSegments && enhancedSegments.length > 0
    ? `\n\nTRANSCRIPT WITH TIMESTAMPS AND SEGMENT IDs:\n${formatSegmentsForPrompt(enhancedSegments, 60)}`
    : '';

  // Phase 10: Analysis-aware prompt when content analysis is available
  const analysisAwarePrompt = contentAnalysis ? `You are creating a comprehension quiz grounded in a structured content analysis of this video.

Video Title: "${metadata.title}"
Channel: ${metadata.channel}
Video Duration: ${metadata.duration ? Math.floor(metadata.duration / 60) + ' minutes' : 'Unknown'}

CONTENT ANALYSIS (structured understanding of the video):
${JSON.stringify(contentAnalysis, null, 2)}

YOUR TASK: Generate 3-5 topics with questions that are GROUNDED in the content analysis above.

TOPIC CREATION RULES:
- Map each topic directly from the "sections" in the content analysis
- Each topic's questions should target the concepts listed in that section's "conceptIds"
- Use the concept's "bloomLevel" to determine the cognitive level of each question
- Use "sourceQuote" and "sourceTimestamp" from concepts to populate question source fields

COGNITIVE DISTRIBUTION (follow this closely):
- ~40% of questions at remember/understand level (test recall and comprehension)
- ~30% of questions at apply/analyze level (test application and relationships)
- ~20% of questions at evaluate/create level (test judgment and synthesis)
- ~10% of questions targeting misconceptions identified in the analysis

MISCONCEPTION-TARGETED QUESTIONS:
- For each concept that has "misconceptions", create at least ONE question that would reveal whether the learner holds that misconception
- Example: If misconception is "X is the same as Y", ask "What is the key difference between X and Y as explained in the video?"

SYNTHESIS QUESTIONS (use concept relationships):
- Use "relationships" from the analysis to create questions that connect concepts
- "depends-on": Ask about prerequisites ("Why must you understand X before Y?")
- "contrasts-with": Ask about differences ("How does the speaker distinguish X from Y?")
- "leads-to": Ask about consequences ("According to the video, what does X lead to?")

SOURCE CONTEXT REQUIREMENTS:
For EVERY question, include:
- "sourceQuote": From the concept's sourceQuote field
- "sourceTimestamp": From the concept's sourceTimestamp field
${questionTypeInstructions}${codeQuestionInstructions}${categoryInstructions}${antiRepetitionRules}

Format your response as JSON:
{
  "topics": [
    {
      "title": "Topic from content section",
      "summary": "What this section covers (NO answer spoilers)",
      "sectionName": "Section name",
      "timestampStart": 0,
      "timestampEnd": 180,
      "category": "concept",
      "icon": "lightbulb",
      "questions": [
        {
          "text": "Question targeting a specific concept at its Bloom's level",
          "expectedAnswer": "Answer grounded in the content analysis",
          "questionType": "comprehension",
          "isCodeQuestion": false,
          "sourceQuote": "Exact quote from content analysis",
          "sourceTimestamp": 45,
          "sourceSegmentId": ""
        }
      ]
    }
  ],
  "estimatedDuration": 15
}` : null;

  const prompt = analysisAwarePrompt || (transcript
    ? `You are creating a comprehension quiz to test if someone UNDERSTOOD the content of this video.

Video Title: "${metadata.title}"
Channel: ${metadata.channel}
Video Duration: ${metadata.duration ? Math.floor(metadata.duration / 60) + ' minutes' : 'Unknown'}

STEP 1: Read and understand the transcript:
${transcript.slice(0, 15000)} ${transcript.length > 15000 ? '... (truncated)' : ''}${formattedSegments}${resourcesContext}

STEP 2: Identify 3-5 distinct topics/sections covered in the video.

STEP 3: For each topic, create questions that test COMPREHENSION of what was said.

YOUR GOAL: Test whether the viewer UNDERSTOOD and can RECALL what the speaker explained.
- Questions should have FACTUAL answers based on the video content
- The viewer should be able to answer by remembering what the speaker said
- Do NOT ask about personal opinions, applications, or future use

GOOD QUESTION EXAMPLES:
- "According to the video, what three factors does [speaker] say influence X?"
- "What example does [speaker] give to demonstrate Y?"
- "In the video, how does [speaker] define Z?"
- "What warning or caution does [speaker] mention about X?"

BAD QUESTION EXAMPLES (NEVER use):
- "How would you apply this in your work?" (tests application, not understanding)
- "What best practices should you follow?" (generic, not from video)
- "Why is this relevant to you?" (personal, not comprehension)
${questionTypeInstructions}${codeQuestionInstructions}${timestampInstructions}${categoryInstructions}${antiRepetitionRules}${sourceContextInstructions}

Format your response as JSON:
{
  "topics": [
    {
      "title": "Topic Title (specific to this video)",
      "summary": "What the speaker explains about this topic (2-3 sentences, NO answer spoilers)",
      "sectionName": "Section name from video",
      "timestampStart": 0,
      "timestampEnd": 180,
      "category": "concept",
      "icon": "lightbulb",
      "questions": [
        {
          "text": "Question testing recall/understanding of specific content",
          "expectedAnswer": "The correct answer based on what the speaker said",
          "questionType": "comprehension",
          "isCodeQuestion": false,
          "sourceQuote": "Exact quote from transcript this question is based on",
          "sourceTimestamp": 45,
          "sourceSegmentId": "seg_45_2_example"
        }
      ]
    }
  ],
  "estimatedDuration": 15
}`
    : `You are creating a comprehension quiz for a video. Without the transcript, infer likely content from the title.

Video Title: "${metadata.title}"
Channel: ${metadata.channel}

Based on the video title, infer what specific topics and facts the video likely covers.
Create questions that would test UNDERSTANDING of the content (not personal application).

YOUR GOAL: Test whether the viewer UNDERSTOOD and can RECALL what was explained.
- Questions should have FACTUAL answers based on likely video content
- Do NOT ask about personal opinions, applications, or future use
${questionTypeInstructions}${codeQuestionInstructions}${categoryInstructions}${antiRepetitionRules}

Format your response as JSON:
{
  "topics": [
    {
      "title": "Topic Title (specific to likely content)",
      "summary": "What this section likely explains (NO answer spoilers)",
      "category": "concept",
      "icon": "lightbulb",
      "questions": [
        {
          "text": "Question testing understanding of specific content",
          "expectedAnswer": "Expected factual answer",
          "questionType": "comprehension",
          "isCodeQuestion": false
        }
      ]
    }
  ],
  "estimatedDuration": 15
}`);

  try {
    const response = await callGemini(prompt);
    const jsonStr = extractJson(response);
    const data = JSON.parse(jsonStr);

    // Phase 7 + Phase 8: Enhanced type for parsing AI response
    interface QuestionInput {
      text?: string;
      expectedAnswer?: string;
      questionType?: string;
      isCodeQuestion?: boolean;
      codeChallenge?: { template: string; language: string };
      // Phase 8: Source context fields
      sourceQuote?: string;
      sourceTimestamp?: number;
      sourceSegmentId?: string;
      relatedResourceIds?: string[];
    }

    interface TopicInput {
      title: string;
      summary: string;
      questions: (string | QuestionInput)[];
      codeExample?: string;
      codeLanguage?: string;
      timestampStart?: number;
      timestampEnd?: number;
      sectionName?: string;
      // Phase 9: Category and icon fields
      category?: string;
      icon?: string;
    }

    // Calculate fallback timestamps based on video duration and topic count
    const videoDuration = metadata.duration || 600; // Default 10 minutes
    const topicCount = data.topics?.length || 3;
    const avgTopicDuration = videoDuration / topicCount;

    // Transform to proper Topic format with Phase 7 + Phase 8 enhancements
    const topics: Topic[] = data.topics.map((t: TopicInput, topicIndex: number) => ({
      id: generateId(),
      title: t.title,
      summary: t.summary,
      questions: t.questions.map((q: string | QuestionInput) => {
        // Handle both string format and object format
        const isObject = typeof q !== 'string';
        const questionText = isObject ? (q as QuestionInput).text || '' : q;
        const qObj = isObject ? (q as QuestionInput) : {};
        return {
          id: generateId(),
          text: questionText,
          difficulty: 'standard' as const,
          expectedAnswer: qObj.expectedAnswer,
          userAnswer: null,
          feedback: null,
          answeredAt: null,
          // Phase 7: New fields
          questionType: qObj.questionType as import('../types').QuestionType || 'comprehension',
          isCodeQuestion: qObj.isCodeQuestion || false,
          codeChallenge: qObj.codeChallenge,
          // Phase 8: Source context fields
          sourceQuote: qObj.sourceQuote,
          sourceTimestamp: qObj.sourceTimestamp,
          sourceSegmentId: qObj.sourceSegmentId,
          relatedResourceIds: qObj.relatedResourceIds,
        };
      }),
      digDeeperConversation: null,
      bookmarked: false,
      skipped: false,
      completed: false,
      // Include code examples if present (for programming topics)
      ...(t.codeExample && { codeExample: t.codeExample }),
      ...(t.codeLanguage && { codeLanguage: t.codeLanguage }),
      // Phase 7: Timestamps (use AI-provided or fallback)
      timestampStart: t.timestampStart ?? Math.floor(topicIndex * avgTopicDuration),
      timestampEnd: t.timestampEnd ?? Math.floor((topicIndex + 1) * avgTopicDuration),
      sectionName: t.sectionName,
      // Phase 9: Category and icon (validate and use defaults if invalid)
      category: (t.category && Object.keys(TOPIC_CATEGORIES).includes(t.category))
        ? t.category as TopicCategory
        : 'concept',
      icon: (t.icon && Object.values(TOPIC_ICONS).includes(t.icon as TopicIcon))
        ? t.icon as TopicIcon
        : TOPIC_ICONS[(t.category as TopicCategory) || 'concept'],
    }));

    // Phase 7: Validate question diversity (log warning if not met)
    const allQuestions = topics.flatMap(t => t.questions);
    const questionTypes = new Set(allQuestions.map(q => q.questionType).filter(Boolean));
    if (questionTypes.size < 3) {
      console.warn(`Question diversity warning: Only ${questionTypes.size} question types found. Expected at least 3.`);
    }

    return {
      topics,
      estimatedDuration: data.estimatedDuration || 15,
    };
  } catch (error) {
    console.error('Error generating topics with Gemini API:', error);
    // Fallback to generating topics without AI if API fails
    console.log('Using fallback topic generation based on video metadata');
    return generateFallbackTopics(metadata);
  }
}

// ============================================================================
// Phase 8: Question Validation and Regeneration
// ============================================================================

// Banned question patterns that indicate low-quality or non-contextual questions
const BANNED_QUESTION_PATTERNS = [
  /^what is the main (topic|message|point)/i,
  /how would you apply/i,
  /how might you use/i,
  /what best practices should you/i,
  /how is this relevant to you/i,
  /what would you do with this knowledge/i,
  /how could you implement this in your own/i,
  /what skills will you develop/i,
  /summarize the key points/i,
  /what do you think about/i,
  /in your opinion/i,
  /how does this relate to your/i,
];

// Validation result interface
export interface QuestionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a question for Phase 8 requirements
 * Checks for source context and banned patterns
 */
export function validateQuestion(question: Question, requireSourceContext: boolean = false): QuestionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check question text exists and has meaningful content
  if (!question.text || question.text.trim().length < 10) {
    errors.push('Question text is too short or empty');
  }

  // Check for banned patterns
  for (const pattern of BANNED_QUESTION_PATTERNS) {
    if (pattern.test(question.text)) {
      errors.push(`Question matches banned pattern: "${pattern.source}"`);
      break; // Only report first match
    }
  }

  // Phase 8: Check for source context if required (when we have enhanced segments)
  if (requireSourceContext) {
    if (!question.sourceQuote || question.sourceQuote.trim().length < 5) {
      warnings.push('Question missing sourceQuote - context may be unclear');
    }

    if (question.sourceTimestamp === undefined || question.sourceTimestamp < 0) {
      warnings.push('Question missing sourceTimestamp - cannot link to video position');
    }

    if (!question.sourceSegmentId) {
      warnings.push('Question missing sourceSegmentId - cannot track segment origin');
    }
  }

  // Check for question mark (should end with ?)
  if (!question.text.trim().endsWith('?')) {
    warnings.push('Question should end with a question mark');
  }

  // Check for reasonable length
  if (question.text.length > 500) {
    warnings.push('Question is unusually long - consider simplifying');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate all questions in generated topics
 * Returns summary of validation results
 */
export function validateGeneratedTopics(
  topics: Topic[],
  requireSourceContext: boolean = false
): {
  totalQuestions: number;
  validQuestions: number;
  invalidQuestions: number;
  allErrors: Array<{ topicIndex: number; questionIndex: number; errors: string[] }>;
  allWarnings: Array<{ topicIndex: number; questionIndex: number; warnings: string[] }>;
} {
  let totalQuestions = 0;
  let validQuestions = 0;
  let invalidQuestions = 0;
  const allErrors: Array<{ topicIndex: number; questionIndex: number; errors: string[] }> = [];
  const allWarnings: Array<{ topicIndex: number; questionIndex: number; warnings: string[] }> = [];

  topics.forEach((topic, topicIndex) => {
    topic.questions.forEach((question, questionIndex) => {
      totalQuestions++;
      const result = validateQuestion(question, requireSourceContext);

      if (result.isValid) {
        validQuestions++;
      } else {
        invalidQuestions++;
        allErrors.push({ topicIndex, questionIndex, errors: result.errors });
      }

      if (result.warnings.length > 0) {
        allWarnings.push({ topicIndex, questionIndex, warnings: result.warnings });
      }
    });
  });

  return {
    totalQuestions,
    validQuestions,
    invalidQuestions,
    allErrors,
    allWarnings,
  };
}

/**
 * Regenerate an invalid question using AI
 * Includes the reason for rejection in the prompt to guide better generation
 */
export async function regenerateInvalidQuestion(
  topic: Topic,
  invalidQuestion: Question,
  validationErrors: string[],
  transcript?: string,
  maxRetries: number = 2
): Promise<Question | null> {
  const prompt = `You previously generated this question that failed validation:

Topic: ${topic.title}
Summary: ${topic.summary}
Original Question: "${invalidQuestion.text}"

VALIDATION ERRORS:
${validationErrors.map(e => `- ${e}`).join('\n')}

Generate a BETTER replacement question that:
1. Tests COMPREHENSION of what the speaker said (not application or opinion)
2. References SPECIFIC content from the topic
3. Has a clear factual answer based on the video content
4. Does NOT match any of these banned patterns:
   - "What is the main topic/message?"
   - "How would you apply..."
   - "How is this relevant to you?"
   - "What do you think about..."
   - Personal application questions

${transcript ? `\nRelevant transcript section:\n${transcript.slice(0, 2000)}` : ''}

Return ONLY a JSON object with:
{
  "text": "Your improved question ending with ?",
  "expectedAnswer": "The factual answer based on video content",
  "questionType": "comprehension",
  "sourceQuote": "Quote from transcript if available",
  "sourceTimestamp": 0
}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await callGemini(prompt);
      const jsonStr = extractJson(response);
      const parsed = JSON.parse(jsonStr);

      const newQuestion: Question = {
        id: generateId(),
        text: parsed.text || invalidQuestion.text,
        difficulty: invalidQuestion.difficulty || 'standard',
        expectedAnswer: parsed.expectedAnswer,
        userAnswer: null,
        feedback: null,
        answeredAt: null,
        questionType: parsed.questionType || 'comprehension',
        isCodeQuestion: false,
        sourceQuote: parsed.sourceQuote,
        sourceTimestamp: parsed.sourceTimestamp,
      };

      // Validate the regenerated question
      const validation = validateQuestion(newQuestion, false);
      if (validation.isValid) {
        return newQuestion;
      }

      console.warn(`Regeneration attempt ${attempt} still invalid:`, validation.errors);
    } catch (error) {
      console.error(`Regeneration attempt ${attempt} failed:`, error);
    }
  }

  // If all retries failed, return null
  console.warn('All regeneration attempts failed, keeping original question');
  return null;
}

// Get personality-aware openers for fallback feedback
function getPersonalityOpeners(personality: TutorPersonality): { excellent: string; good: string; minimal: string; standard: string } {
  const openers: Record<TutorPersonality, { excellent: string; good: string; minimal: string; standard: string }> = {
    PROFESSOR: {
      excellent: "Excellent scholarly response!",
      good: "A solid academic effort.",
      minimal: "I see you've begun to engage with the material.",
      standard: "Thank you for your academic contribution.",
    },
    COACH: {
      excellent: "Fantastic work! You're crushing it!",
      good: "Great effort! You're making progress!",
      minimal: "Thanks for giving it a shot!",
      standard: "Good start! Keep building on this!",
    },
    DIRECT: {
      excellent: "Correct. Well done.",
      good: "Good. Some key points covered.",
      minimal: "Brief response noted.",
      standard: "Noted. Here's feedback:",
    },
    CREATIVE: {
      excellent: "Like a master chef perfecting a recipe - excellent!",
      good: "You're painting a good picture here!",
      minimal: "Every journey starts with a single step!",
      standard: "Interesting thoughts! Let's explore further.",
    },
  };
  return openers[personality] || openers.COACH;
}

// Generate contextual fallback feedback when API is unavailable
// Phase 7: Updated to return EvaluationResult with three-tier system
export function generateFallbackFeedback(
  topic: Topic,
  question: Question,
  userAnswer: string,
  difficulty: 'standard' | 'easier' | 'harder'
): EvaluationResult {
  const wordCount = userAnswer.trim().split(/\s+/).length;
  const topicTitle = topic.title;

  // Get current personality from settings store
  const { settings } = useSettingsStore.getState();
  const personality = settings.tutorPersonality || 'COACH';
  const personalityOpeners = getPersonalityOpeners(personality);

  // Analyze answer quality indicators
  const hasExamples = /example|instance|such as|like|for instance/i.test(userAnswer);
  const hasExplanation = /because|therefore|since|due to|reason|explain/i.test(userAnswer);
  const hasComparison = /compare|contrast|similar|different|whereas|while/i.test(userAnswer);
  const hasQuestions = /\?/.test(userAnswer);
  const isDetailed = wordCount > 50;
  const isComprehensive = wordCount > 100;
  const isMinimal = wordCount < 15;
  const isEmpty = wordCount < 5;

  // Generate quality score
  let qualityScore = 0;
  if (hasExamples) qualityScore += 2;
  if (hasExplanation) qualityScore += 2;
  if (hasComparison) qualityScore += 1;
  if (isDetailed) qualityScore += 1;
  if (isComprehensive) qualityScore += 2;
  if (!isMinimal) qualityScore += 1;

  // Adjust for difficulty level
  const difficultyMultiplier = difficulty === 'harder' ? 0.8 : difficulty === 'easier' ? 1.2 : 1;
  const adjustedScore = qualityScore * difficultyMultiplier;

  // Determine result based on score
  let result: 'pass' | 'fail' | 'neutral';
  let feedback: string;
  const keyPointsHit: string[] = [];
  const keyPointsMissed: string[] = [];

  if (isEmpty) {
    // Empty or near-empty answer = fail
    result = 'fail';
    feedback = `${personalityOpeners.minimal} Your response was too brief to evaluate. Please provide a more detailed answer that addresses the question about "${topicTitle}".`;
    keyPointsMissed.push('Insufficient response provided');
    keyPointsMissed.push('Core concepts not addressed');
  } else if (adjustedScore >= 6) {
    // Excellent answer = pass
    result = 'pass';
    feedback = `${personalityOpeners.excellent} You've demonstrated a solid understanding of "${topicTitle}". ${
      hasExamples ? "Your use of examples helps illustrate the concepts well. " : ""
    }${hasExplanation ? "Your explanations show critical thinking. " : ""}`;

    if (hasExamples) keyPointsHit.push('Used concrete examples');
    if (hasExplanation) keyPointsHit.push('Provided clear explanations');
    if (hasComparison) keyPointsHit.push('Made relevant comparisons');
    if (isComprehensive) keyPointsHit.push('Comprehensive coverage');
  } else if (adjustedScore >= 3) {
    // Good answer = neutral (partial understanding)
    result = 'neutral';
    feedback = `${personalityOpeners.good} You've touched on some key points about "${topicTitle}". `;

    if (hasExamples) {
      keyPointsHit.push('Included examples');
    } else {
      keyPointsMissed.push('Could include specific examples');
    }
    if (hasExplanation) {
      keyPointsHit.push('Some explanation provided');
    } else {
      keyPointsMissed.push('Could explain the "why" behind points');
      feedback += "Consider explaining the reasoning behind your points. ";
    }
    keyPointsMissed.push('Review topic summary for additional insights');
  } else if (isMinimal) {
    // Minimal answer = fail
    result = 'fail';
    feedback = `${personalityOpeners.minimal} You've started to engage with "${topicTitle}", but your answer needs more depth. ${
      difficulty === 'easier'
        ? "Try expanding on your thoughts - even a few more sentences can help."
        : "Consider elaborating more. What examples can you think of?"
    }`;
    keyPointsMissed.push('Answer too brief');
    keyPointsMissed.push('Key concepts not fully addressed');
  } else {
    // Standard but incomplete = neutral
    result = 'neutral';
    feedback = `${personalityOpeners.standard} You've shared your thoughts on "${topicTitle}". ${
      hasQuestions
        ? "Great that you're asking questions! The topic summary may help address some of them."
        : "Consider how these concepts might apply to real-world situations."
    }`;

    if (hasQuestions) keyPointsHit.push('Shows curiosity with questions');
    keyPointsMissed.push('Could provide more depth');
    keyPointsMissed.push('Consider adding examples or explanations');
  }

  return {
    result,
    feedback,
    correctAnswer: question.expectedAnswer || `A complete answer should address the key concepts from "${topicTitle}" with examples and explanations.`,
    keyPointsHit,
    keyPointsMissed,
  };
}

// Get personality-specific prompting instructions
function getPersonalityInstructions(personality: TutorPersonality): string {
  const personalityPrompts: Record<TutorPersonality, string> = {
    PROFESSOR: `You are The Professor - respond in a formal, academic style with thorough explanations.
Use proper terminology and provide context and theory. Example tone: "Let me explain this concept in depth. First, consider the underlying principles..."`,
    COACH: `You are The Coach - respond in an encouraging, supportive style that celebrates progress.
Be warm and motivating. Example tone: "Great effort! You're on the right track. Let's build on what you've learned..."`,
    DIRECT: `You are The Direct - respond concisely and to the point, no fluff.
Be efficient and focus on key facts. Example tone: "Correct. Key point: X does Y. Next topic."`,
    CREATIVE: `You are The Creative - use analogies, stories, and creative examples to explain concepts.
Make learning fun and memorable. Example tone: "Think of it like cooking a recipe - each ingredient (concept) builds on the last..."`,
  };
  return personalityPrompts[personality] || personalityPrompts.COACH;
}

// Get current tutor personality from settings
function getCurrentPersonality(): TutorPersonality {
  const { settings } = useSettingsStore.getState();
  return settings.tutorPersonality || 'COACH';
}

// Evaluate user's answer to a question
// Phase 7: Updated to return EvaluationResult with three-tier system
export async function evaluateAnswer(
  topic: Topic,
  question: Question,
  userAnswer: string,
  difficulty: 'standard' | 'easier' | 'harder' = 'standard',
  sources?: Array<{ url: string; title: string; type: string }>
): Promise<EvaluationResult> {
  // Get current personality from settings
  const personality = getCurrentPersonality();
  const personalityInstructions = getPersonalityInstructions(personality);

  // Adjust evaluation criteria based on difficulty
  const difficultyInstructions = {
    easier: `The student is working at an easier difficulty level. Be more supportive and encouraging. Focus on the core understanding and don't be too strict about missing details.`,
    standard: `Evaluate the answer at a standard difficulty level. Balance encouragement with constructive feedback.`,
    harder: `The student is working at a harder difficulty level. Be more rigorous in your evaluation. Expect deeper understanding.`,
  };

  // Build sources section if available
  const sourcesSection = sources && sources.length > 0
    ? `\n\nRelevant learning resources for deeper study:\n${sources.map(s => `- ${s.title} (${s.type}): ${s.url}`).join('\n')}`
    : '';

  // Build expected answer hints from the question if available
  const expectedHints = question.expectedAnswer
    ? `\nExpected answer direction: ${question.expectedAnswer}`
    : '';

  // Phase 8: Include source context in evaluation
  const sourceContextSection = question.sourceQuote
    ? `\n\nSOURCE CONTEXT FROM VIDEO:
Quote: "${question.sourceQuote}"
${question.sourceTimestamp !== undefined ? `Timestamp: ${Math.floor(question.sourceTimestamp / 60)}:${String(question.sourceTimestamp % 60).padStart(2, '0')}` : ''}

When evaluating, check if the student's answer aligns with this source content from the video.
If the answer contradicts the video content, mark it as FAIL.
If the answer captures the key points from the source, mark it as PASS.`
    : '';

  const prompt = `${personalityInstructions}

You are an educational assistant evaluating a student's answer using a THREE-TIER system.

Topic: ${topic.title}
Context: ${topic.summary}${expectedHints}${sourceContextSection}

Question: ${question.text}

Student's Answer: ${userAnswer}

Difficulty Level: ${difficulty.toUpperCase()}
${difficultyInstructions[difficulty]}${sourcesSection}

EVALUATION CRITERIA:
- PASS: The answer demonstrates clear understanding of the core concept. Key points are addressed correctly.
- FAIL: The answer shows fundamental misunderstanding, is factually incorrect, or completely misses the point.
- NEUTRAL: The answer shows partial understanding. Some key points are addressed but important aspects are missing.

Return JSON with this EXACT structure:
{
  "result": "pass" | "fail" | "neutral",
  "feedback": "Constructive feedback in your personality style (2-3 sentences)",
  "correctAnswer": "What a complete answer should include",
  "keyPointsHit": ["Specific concepts the user got right"],
  "keyPointsMissed": ["Specific concepts the user missed or got wrong"]
}

Be fair and accurate. Use your personality style in the feedback.`;

  try {
    const response = await callGemini(prompt);
    const jsonStr = extractJson(response);
    const parsed = JSON.parse(jsonStr);

    // Validate and normalize the response
    const validResults = ['pass', 'fail', 'neutral'];
    return {
      result: validResults.includes(parsed.result?.toLowerCase())
        ? parsed.result.toLowerCase() as 'pass' | 'fail' | 'neutral'
        : 'neutral',
      feedback: parsed.feedback || 'Your answer has been evaluated.',
      correctAnswer: parsed.correctAnswer || question.expectedAnswer || '',
      keyPointsHit: Array.isArray(parsed.keyPointsHit) ? parsed.keyPointsHit : [],
      keyPointsMissed: Array.isArray(parsed.keyPointsMissed) ? parsed.keyPointsMissed : [],
    };
  } catch (error) {
    console.error('Error evaluating answer:', error);
    // Fall back to local evaluation when API fails
    console.log('Using fallback evaluation');
    return generateFallbackFeedback(topic, question, userAnswer, difficulty);
  }
}

// Generate fallback deeper questions when API is unavailable
function generateFallbackDeeperQuestion(topic: Topic, currentQuestion: Question, difficulty: 'easier' | 'harder'): string {
  const topicTitle = topic.title;

  // Templates for harder/deeper questions
  const harderTemplates = [
    `How would you compare and contrast different approaches to "${topicTitle}"?`,
    `What potential challenges or limitations might arise when applying concepts from "${topicTitle}" in real-world scenarios?`,
    `How does "${topicTitle}" connect to other related concepts you might already know?`,
    `What would be the consequences if the key principles of "${topicTitle}" were applied incorrectly?`,
    `Can you analyze the strengths and weaknesses of the main concepts in "${topicTitle}"?`,
    `How might the ideas from "${topicTitle}" evolve or change in the future?`,
    `What assumptions underlie the concepts discussed in "${topicTitle}"?`,
    `How would you teach the core concepts of "${topicTitle}" to someone completely new to the subject?`,
    `What are some edge cases or exceptions to consider when applying knowledge from "${topicTitle}"?`,
    `How do experts in this field approach "${topicTitle}" differently than beginners?`,
  ];

  // Templates for easier questions
  const easierTemplates = [
    `What is the main idea behind "${topicTitle}"?`,
    `Can you give a simple example related to "${topicTitle}"?`,
    `Why is "${topicTitle}" important to understand?`,
    `What's one key thing you should remember about "${topicTitle}"?`,
    `How would you describe "${topicTitle}" in your own words?`,
    `What's the first step to understanding "${topicTitle}"?`,
    `What do you find most interesting about "${topicTitle}"?`,
    `How does "${topicTitle}" relate to everyday life?`,
    `What's the simplest way to explain "${topicTitle}"?`,
    `What questions do you have about "${topicTitle}"?`,
  ];

  const templates = difficulty === 'harder' ? harderTemplates : easierTemplates;

  // Avoid returning the exact same question
  const currentText = currentQuestion.text.toLowerCase();
  const availableTemplates = templates.filter(t => !t.toLowerCase().includes(currentText.slice(0, 20).toLowerCase()));

  // Select a random question from available templates
  const randomIndex = Math.floor(Math.random() * (availableTemplates.length || templates.length));
  return (availableTemplates.length > 0 ? availableTemplates : templates)[randomIndex];
}

// Generate a new question with different difficulty
export async function generateAlternateQuestion(
  topic: Topic,
  currentQuestion: Question,
  difficulty: 'easier' | 'harder'
): Promise<string> {
  const difficultyGuidelines = {
    easier: `Generate a SIMPLER question that:
- Uses basic vocabulary and straightforward language
- Focuses on one clear concept at a time
- Can be answered with fundamental understanding
- Doesn't require prior expertise or deep analysis
- Is encouraging and accessible for beginners`,
    harder: `Generate a MORE CHALLENGING question that:
- Requires critical thinking and analysis
- May combine multiple concepts
- Expects deeper understanding and application
- Could involve real-world scenarios or edge cases
- Pushes the learner to think beyond surface-level understanding`,
  };

  const prompt = `Generate a ${difficulty} question about this topic:

Topic: ${topic.title}
Summary: ${topic.summary}

Current question (${currentQuestion.difficulty}): ${currentQuestion.text}

${difficultyGuidelines[difficulty]}

Return ONLY the question text, nothing else.`;

  try {
    const response = await callGemini(prompt);
    return response.trim();
  } catch (error) {
    console.error('Error generating question:', error);
    // Fallback to local question generation when API fails
    console.log('Using fallback question generation');
    return generateFallbackDeeperQuestion(topic, currentQuestion, difficulty);
  }
}

// Handle dig deeper conversation
export async function digDeeper(
  topic: Topic,
  conversation: ChatMessage[],
  userQuestion: string
): Promise<string> {
  // Get current personality from settings
  const personality = getCurrentPersonality();
  const personalityInstructions = getPersonalityInstructions(personality);

  const conversationContext = conversation
    .map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const prompt = `${personalityInstructions}

You are an educational assistant helping a student learn more about a topic.

Topic: ${topic.title}
Summary: ${topic.summary}

Previous conversation:
${conversationContext || 'No previous messages'}

Student's new question: ${userQuestion}

Response format rules (IMPORTANT - follow this structure):
1. Lead with a DIRECT answer to their question (1-2 sentences max)
2. When referencing the video/topic content, cite it: "From the topic summary: [quote or paraphrase]"
3. Use bullet points for multiple items
4. Keep responses scannable - maximum 3-4 sentences for initial response
5. End with: "Want more detail on any part?"

Stay in your personality style. Use examples when helpful. If the question goes beyond the topic scope, briefly relate it back or suggest they explore further.`;

  try {
    const response = await callGemini(prompt);
    return response.trim();
  } catch (error) {
    console.error('Error in dig deeper:', error);
    throw new Error(`Failed to get response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Check if AI service is available (server-side)
export async function checkAIServiceAvailable(): Promise<boolean> {
  try {
    await callGemini('Reply with just the word "ok"');
    return true;
  } catch (error) {
    console.error('AI service check failed:', error);
    return false;
  }
}

// Helper for retry logic with timeout
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  timeoutMs: number = 10000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });

      // Race between the actual function and timeout
      const result = await Promise.race([fn(), timeoutPromise]);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        // Wait a bit before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

// Generate structured notes from video transcript
export async function generateStructuredNotes(
  videoTitle: string,
  transcript: string,
  videoDuration?: number
): Promise<{
  sections: Array<{
    id: string;
    title: string;
    timestamp: string;
    content: string;
    keyPoints: string[];
  }>;
  summary: string;
}> {
  // Estimate timestamps based on content position if no real timestamps
  const formatTimestamp = (position: number, total: number, duration?: number): string => {
    if (duration) {
      const seconds = Math.floor((position / total) * duration);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
    }
    // Estimate based on typical video pacing (assume 10 min video if unknown)
    const estimatedDuration = 600;
    const seconds = Math.floor((position / total) * estimatedDuration);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
  };

  const prompt = `Analyze this video transcript and create structured learning notes.

Video: "${videoTitle}"

Transcript:
${transcript.slice(0, 8000)}

Create structured notes with:
1. A brief summary (2-3 sentences)
2. 3-5 main sections with:
   - Section title (clear, descriptive)
   - Key points (2-4 bullet points per section)
   - Explanation content (1-2 paragraphs)

Return JSON in this exact format:
{
  "summary": "Brief overview of the video content",
  "sections": [
    {
      "title": "Section Title",
      "keyPoints": ["Point 1", "Point 2", "Point 3"],
      "content": "Detailed explanation of this section..."
    }
  ]
}

Focus on educational value and key takeaways. Be specific and actionable.`;

  try {
    // Use retry logic with 10 second timeout per attempt, up to 3 retries
    const response = await withRetry(
      () => callGemini(prompt),
      3,  // maxRetries
      10000  // timeoutMs (10 seconds)
    );
    const jsonStr = extractJson(response);
    const parsed = JSON.parse(jsonStr);

    // Add IDs and timestamps to sections
    const sections = (parsed.sections || []).map((section: { title: string; keyPoints: string[]; content: string }, index: number, arr: unknown[]) => ({
      id: generateId(),
      title: section.title || `Section ${index + 1}`,
      timestamp: formatTimestamp(index, arr.length, videoDuration),
      content: section.content || '',
      keyPoints: section.keyPoints || [],
    }));

    return {
      sections,
      summary: parsed.summary || 'Notes generated from video transcript.',
    };
  } catch (error) {
    console.error('Error generating structured notes:', error);

    // Return fallback notes structure
    return {
      sections: [
        {
          id: generateId(),
          title: 'Introduction',
          timestamp: '[00:00]',
          content: `This video covers "${videoTitle}". Review the transcript for detailed information.`,
          keyPoints: ['Video content overview', 'Key concepts introduction'],
        },
        {
          id: generateId(),
          title: 'Main Content',
          timestamp: '[02:00]',
          content: 'The main content of this video focuses on the core subject matter. Refer to the transcript for specifics.',
          keyPoints: ['Core concepts', 'Important details', 'Practical applications'],
        },
        {
          id: generateId(),
          title: 'Summary',
          timestamp: '[08:00]',
          content: 'The video concludes with a summary of key points and takeaways.',
          keyPoints: ['Key takeaways', 'Next steps'],
        },
      ],
      summary: `Structured notes for "${videoTitle}". Generated from video transcript.`,
    };
  }
}
