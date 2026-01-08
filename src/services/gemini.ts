// Gemini AI service for question generation and answer evaluation
import type { VideoMetadata, Topic, Question, ChatMessage } from '../types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

// Make a request to Gemini API
async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Gemini API error: ${response.status} - ${errorData.error?.message || response.statusText}`
    );
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No response from Gemini API');
  }

  return text;
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

// Generate fallback topics based on video metadata (used when API is unavailable)
function generateFallbackTopics(metadata: VideoMetadata): { topics: Topic[]; estimatedDuration: number } {
  const videoTitle = metadata.title;
  const isLongVideo = isLongVideoFromTitle(videoTitle);

  // For long videos/courses, generate more comprehensive topics (5-7 topics, 2-3 questions each = 12-21 questions)
  if (isLongVideo) {
    const topics: Topic[] = [
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

    return {
      topics,
      estimatedDuration: 45, // Longer estimated duration for comprehensive courses
    };
  }

  // Standard fallback for shorter videos (3 topics, 2 questions each = 6 questions)
  const topics: Topic[] = [
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

  return {
    topics,
    estimatedDuration: 10,
  };
}

// Generate topics and questions from video metadata
export async function generateTopicsFromVideo(
  apiKey: string,
  metadata: VideoMetadata,
  transcript?: string
): Promise<{ topics: Topic[]; estimatedDuration: number }> {
  const prompt = transcript
    ? `Analyze this YouTube video transcript and create an educational learning session:

Video Title: "${metadata.title}"
Channel: ${metadata.channel}

Transcript:
${transcript.slice(0, 15000)} ${transcript.length > 15000 ? '... (truncated)' : ''}

Based on the video content, please:
1. Identify 3-5 main topics covered in the video
2. For each topic, provide a concise summary (2-3 sentences)
3. Generate 2-3 questions per topic that test understanding

Format your response as JSON with this exact structure:
{
  "topics": [
    {
      "title": "Topic Title",
      "summary": "Brief summary of what this topic covers (2-3 sentences)",
      "questions": [
        "Question 1 text",
        "Question 2 text"
      ]
    }
  ],
  "estimatedDuration": 15
}

The estimatedDuration should be in minutes. Make questions thought-provoking and focus on understanding.`
    : `Analyze this YouTube video and create an educational learning session:

Video Title: "${metadata.title}"
Channel: ${metadata.channel}
URL: ${metadata.url}

Based on the video title and likely content, please:
1. Identify 3-5 main topics this video probably covers
2. For each topic, provide an educational summary (2-3 sentences)
3. Generate 2-3 questions per topic that would help test understanding

Format your response as JSON with this exact structure:
{
  "topics": [
    {
      "title": "Topic Title",
      "summary": "Brief summary of what this topic covers (2-3 sentences)",
      "questions": [
        "Question 1 text",
        "Question 2 text"
      ]
    }
  ],
  "estimatedDuration": 15
}

The estimatedDuration should be in minutes. Make questions thought-provoking and focus on understanding concepts.`;

  try {
    const response = await callGemini(apiKey, prompt);
    const jsonStr = extractJson(response);
    const data = JSON.parse(jsonStr);

    // Transform to proper Topic format
    const topics: Topic[] = data.topics.map((t: { title: string; summary: string; questions: string[] }) => ({
      id: generateId(),
      title: t.title,
      summary: t.summary,
      questions: t.questions.map((q: string) => ({
        id: generateId(),
        text: q,
        difficulty: 'standard' as const,
        userAnswer: null,
        feedback: null,
        answeredAt: null,
      })),
      digDeeperConversation: null,
      bookmarked: false,
      skipped: false,
      completed: false,
    }));

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

// Evaluate user's answer to a question
export async function evaluateAnswer(
  apiKey: string,
  topic: Topic,
  question: Question,
  userAnswer: string
): Promise<string> {
  const prompt = `You are an educational assistant evaluating a student's answer.

Topic: ${topic.title}
Context: ${topic.summary}

Question: ${question.text}

Student's Answer: ${userAnswer}

Please evaluate the answer and provide constructive feedback:
1. Acknowledge what the student got right
2. Gently correct any misconceptions
3. Add any important points they may have missed
4. Keep the feedback encouraging and educational

Provide a concise response (2-4 sentences). Start with an assessment of their answer (like "Great answer!", "Good thinking!", or "Not quite, but...").`;

  try {
    const response = await callGemini(apiKey, prompt);
    return response.trim();
  } catch (error) {
    console.error('Error evaluating answer:', error);
    throw new Error(`Failed to evaluate answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Generate a new question with different difficulty
export async function generateAlternateQuestion(
  apiKey: string,
  topic: Topic,
  currentQuestion: Question,
  difficulty: 'easier' | 'harder'
): Promise<string> {
  const prompt = `Generate a ${difficulty} question about this topic:

Topic: ${topic.title}
Summary: ${topic.summary}

Current question (${currentQuestion.difficulty}): ${currentQuestion.text}

Please generate a ${difficulty === 'easier' ? 'simpler, more straightforward' : 'more challenging, deeper'} question about the same topic.

Return ONLY the question text, nothing else.`;

  try {
    const response = await callGemini(apiKey, prompt);
    return response.trim();
  } catch (error) {
    console.error('Error generating question:', error);
    throw new Error(`Failed to generate question: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Handle dig deeper conversation
export async function digDeeper(
  apiKey: string,
  topic: Topic,
  conversation: ChatMessage[],
  userQuestion: string
): Promise<string> {
  const conversationContext = conversation
    .map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const prompt = `You are an educational assistant helping a student learn more about a topic.

Topic: ${topic.title}
Summary: ${topic.summary}

Previous conversation:
${conversationContext || 'No previous messages'}

Student's new question: ${userQuestion}

Provide a helpful, educational response. Be thorough but concise. Use examples when helpful. If the question goes beyond the topic scope, try to relate it back or suggest resources.`;

  try {
    const response = await callGemini(apiKey, prompt);
    return response.trim();
  } catch (error) {
    console.error('Error in dig deeper:', error);
    throw new Error(`Failed to get response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Validate API key by making a test request
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    await callGemini(apiKey, 'Reply with just the word "ok"');
    return true;
  } catch (error) {
    console.error('API key validation failed:', error);
    return false;
  }
}
