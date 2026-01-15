// Gemini AI service for question generation and answer evaluation
// Uses server-side proxy to protect API key
import type { VideoMetadata, Topic, Question, ChatMessage, TutorPersonality, EvaluationResult } from '../types';
import { useSettingsStore } from '../stores/settingsStore';

// Note: Transcript proxy (with AI) runs on 3002, API server runs on 3001
const AI_PROXY_URL = 'http://localhost:3002/api/ai/generate';

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

  // For long videos/courses, generate more comprehensive topics (5-7 topics, 2-3 questions each = 12-21 questions)
  if (isLongVideo) {
    const rawTopics: Topic[] = [
      {
        id: generateId(),
        title: `Introduction and Overview`,
        summary: `This topic covers the fundamental concepts introduced in "${videoTitle}". Understanding these basics will help you grasp the more advanced concepts discussed later.`,
        questions: [
          createQuestion(`What do you think is the main purpose or goal of "${videoTitle}"?`),
          createQuestion(`What prior knowledge or prerequisites might be helpful before starting this course?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
      },
      {
        id: generateId(),
        title: `Core Fundamentals`,
        summary: `This section explores the foundational concepts that form the building blocks of the subject. Mastering these fundamentals is essential for understanding advanced topics.`,
        questions: [
          createQuestion(`What are the core fundamental concepts introduced in the early part of this course?`),
          createQuestion(`Why is it important to understand these fundamentals before moving forward?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
      },
      {
        id: generateId(),
        title: `Intermediate Concepts`,
        summary: `Building on the fundamentals, this section introduces more complex ideas and techniques that bridge basic understanding with advanced applications.`,
        questions: [
          createQuestion(`How do the intermediate concepts build upon the fundamentals you learned earlier?`),
          createQuestion(`What challenges might you face when learning these intermediate topics?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
      },
      {
        id: generateId(),
        title: `Advanced Topics`,
        summary: `This section covers advanced concepts and techniques that require a solid understanding of the fundamentals and intermediate material.`,
        questions: [
          createQuestion(`What advanced topics does this course cover and why are they important?`),
          createQuestion(`How do the advanced concepts relate to real-world professional applications?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
      },
      {
        id: generateId(),
        title: `Best Practices and Patterns`,
        summary: `Learn about industry best practices, common patterns, and professional guidelines that help you write better, more maintainable solutions.`,
        questions: [
          createQuestion(`What best practices should you follow when applying what you've learned?`),
          createQuestion(`Why are coding patterns and best practices important in professional work?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
      },
      {
        id: generateId(),
        title: `Practical Projects`,
        summary: `Apply your knowledge through hands-on projects and exercises. Building real projects solidifies understanding and builds your portfolio.`,
        questions: [
          createQuestion(`What types of projects could you build using the skills from this course?`),
          createQuestion(`How would you approach planning and building a project from scratch?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
      },
      {
        id: generateId(),
        title: `Next Steps and Resources`,
        summary: `Explore what to learn next after completing this course. Identify additional resources, communities, and advanced topics to continue your learning journey.`,
        questions: [
          createQuestion(`What should you focus on learning after completing this course?`),
          createQuestion(`What resources or communities would you recommend for continued learning?`),
        ],
        digDeeperConversation: null,
        bookmarked: false,
        skipped: false,
        completed: false,
      },
    ];

    // Apply code examples to each topic for programming tutorials
    const topics = rawTopics.map(t => addCodeExample(t, t.title));

    return {
      topics,
      estimatedDuration: 45, // Longer estimated duration for comprehensive courses
    };
  }

  // Standard fallback for shorter videos (3 topics, 2 questions each = 6 questions)
  const rawTopics: Topic[] = [
    {
      id: generateId(),
      title: `Introduction to ${videoTitle}`,
      summary: `This topic covers the fundamental concepts introduced in "${videoTitle}". Understanding these basics will help you grasp the more advanced concepts discussed later.`,
      questions: [
        createQuestion(`What do you think is the main purpose or message of "${videoTitle}"?`),
        createQuestion(`What prior knowledge might be helpful before watching this video?`),
      ],
      digDeeperConversation: null,
      bookmarked: false,
      skipped: false,
      completed: false,
    },
    {
      id: generateId(),
      title: `Key Concepts`,
      summary: `This section explores the main ideas and concepts presented in the video. These are the building blocks that form the foundation of the topic.`,
      questions: [
        createQuestion(`What are the most important concepts or ideas you learned from this video?`),
        createQuestion(`How would you explain these concepts to someone who hasn't seen the video?`),
      ],
      digDeeperConversation: null,
      bookmarked: false,
      skipped: false,
      completed: false,
    },
    {
      id: generateId(),
      title: `Practical Applications`,
      summary: `Learn how the concepts from this video can be applied in real-world scenarios. Understanding practical applications helps reinforce learning and shows the relevance of the material.`,
      questions: [
        createQuestion(`How might you apply what you've learned from this video in your daily life or work?`),
        createQuestion(`Can you think of any examples where these concepts have been applied successfully?`),
      ],
      digDeeperConversation: null,
      bookmarked: false,
      skipped: false,
      completed: false,
    },
  ];

  // Apply code examples to each topic for programming tutorials
  const topics = rawTopics.map(t => addCodeExample(t, t.title));

  return {
    topics,
    estimatedDuration: 10,
  };
}

// Generate topics and questions from video metadata
// Phase 7: Updated with timestamps, question types, and anti-repetition instructions
export async function generateTopicsFromVideo(
  metadata: VideoMetadata,
  transcript?: string
): Promise<{ topics: Topic[]; estimatedDuration: number }> {
  // Detect if this is a programming/coding tutorial
  const isProgrammingTutorial = /\b(programming|coding|javascript|typescript|python|react|node|java|c\+\+|c#|rust|go|ruby|php|html|css|sql|api|backend|frontend|web dev|software|developer|code|tutorial)\b/i.test(metadata.title);

  // Phase 7: Question type instructions
  const questionTypeInstructions = `
QUESTION TYPE REQUIREMENTS:
- Each question MUST have a "questionType" from: comprehension, application, analysis, synthesis, evaluation, code
- Distribute question types across the session:
  * At least 1 comprehension question (tests recall and understanding)
  * At least 1 application question (tests ability to apply concepts)
  * At least 1 analysis or synthesis question (tests deeper thinking)
  * Use "code" type ONLY for programming videos when asking about code

QUESTION TYPE EXAMPLES:
- comprehension: "According to the video, what is..." / "What does the speaker say about..."
- application: "How would you apply this to..." / "Given this scenario, how would you..."
- analysis: "Why does the speaker recommend..." / "What is the relationship between..."
- synthesis: "How does concept X connect to concept Y..." / "Combine these ideas to explain..."
- evaluation: "What are the pros and cons of..." / "Which approach is better and why..."
- code: "Fix the bug in this function..." / "What does this code output..."`;

  const codeQuestionInstructions = isProgrammingTutorial ? `

CODE QUESTIONS (for programming videos only):
- Set "isCodeQuestion": true for questions that involve writing/analyzing code
- Include a "codeChallenge" object with:
  * "template": Starter code for the student to work with
  * "language": The programming language (e.g., "javascript", "python")` : '';

  const timestampInstructions = transcript ? `

TIMESTAMP REQUIREMENTS:
- For each topic, include approximate timestamps from the video:
  * "timestampStart": Start time in seconds
  * "timestampEnd": End time in seconds
  * "sectionName": A descriptive name for this section
- Estimate timestamps based on where topics appear in the transcript` : '';

  const antiRepetitionRules = `

CRITICAL ANTI-REPETITION RULES:
1. NEVER start two questions with the same phrase
2. Each question MUST reference SPECIFIC content from the video/transcript
3. AVOID generic questions like "What is the main message?" or "What did you learn?"
4. Questions should feel unique and tied to actual video content
5. Vary question structure: don't use the same pattern twice`;

  const prompt = transcript
    ? `Analyze this YouTube video transcript and create an educational learning session with VARIED, SPECIFIC questions.

Video Title: "${metadata.title}"
Channel: ${metadata.channel}
Video Duration: ${metadata.duration ? Math.floor(metadata.duration / 60) + ' minutes' : 'Unknown'}

Transcript:
${transcript.slice(0, 15000)} ${transcript.length > 15000 ? '... (truncated)' : ''}

Based on the video content:
1. Identify 3-5 main topics covered in the video
2. For each topic, provide a concise summary (2-3 sentences) that references SPECIFIC content
3. Generate 2-3 questions per topic that test understanding
4. For EACH question, include:
   - "text": The question (must reference specific video content)
   - "expectedAnswer": Key points a correct answer should mention
   - "questionType": One of comprehension/application/analysis/synthesis/evaluation/code
${questionTypeInstructions}${codeQuestionInstructions}${timestampInstructions}${antiRepetitionRules}

Format your response as JSON:
{
  "topics": [
    {
      "title": "Topic Title",
      "summary": "Summary referencing specific content from the video",
      "sectionName": "e.g., Introduction, Core Concepts, Practical Examples",
      "timestampStart": 0,
      "timestampEnd": 180,
      "questions": [
        {
          "text": "Specific question referencing video content",
          "expectedAnswer": "Key points: 1) ... 2) ...",
          "questionType": "comprehension",
          "isCodeQuestion": false
        }
      ],
      "codeExample": "// Optional code example",
      "codeLanguage": "javascript"
    }
  ],
  "estimatedDuration": 15
}

Make questions thought-provoking and SPECIFIC to this video's content.`
    : `Analyze this YouTube video and create an educational learning session with VARIED questions:

Video Title: "${metadata.title}"
Channel: ${metadata.channel}
URL: ${metadata.url}

Based on the video title and likely content:
1. Identify 3-5 main topics this video probably covers
2. For each topic, provide an educational summary (2-3 sentences)
3. Generate 2-3 questions per topic with varied question types
${questionTypeInstructions}${codeQuestionInstructions}${antiRepetitionRules}

Format your response as JSON:
{
  "topics": [
    {
      "title": "Topic Title",
      "summary": "Educational summary of what this topic covers",
      "questions": [
        {
          "text": "Question text",
          "expectedAnswer": "Key points: 1) ... 2) ...",
          "questionType": "comprehension",
          "isCodeQuestion": false
        }
      ]
    }
  ],
  "estimatedDuration": 15
}

Make questions thought-provoking and focused on understanding concepts.`;

  try {
    const response = await callGemini(prompt);
    const jsonStr = extractJson(response);
    const data = JSON.parse(jsonStr);

    // Phase 7: Enhanced type for parsing AI response
    interface QuestionInput {
      text?: string;
      expectedAnswer?: string;
      questionType?: string;
      isCodeQuestion?: boolean;
      codeChallenge?: { template: string; language: string };
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
    }

    // Calculate fallback timestamps based on video duration and topic count
    const videoDuration = metadata.duration || 600; // Default 10 minutes
    const topicCount = data.topics?.length || 3;
    const avgTopicDuration = videoDuration / topicCount;

    // Transform to proper Topic format with Phase 7 enhancements
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

  const prompt = `${personalityInstructions}

You are an educational assistant evaluating a student's answer using a THREE-TIER system.

Topic: ${topic.title}
Context: ${topic.summary}${expectedHints}

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
