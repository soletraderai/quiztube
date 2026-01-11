// Gemini AI service for question generation and answer evaluation
// Uses server-side proxy to protect API key
import type { VideoMetadata, Topic, Question, ChatMessage, TutorPersonality } from '../types';
import { useSettingsStore } from '../stores/settingsStore';

const AI_PROXY_URL = 'http://localhost:3001/api/ai/generate';

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
    const response = await callGemini(prompt);
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
export function generateFallbackFeedback(
  topic: Topic,
  _question: Question,
  userAnswer: string,
  difficulty: 'standard' | 'easier' | 'harder'
): string {
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

  // Generate contextual feedback based on score and characteristics
  let opener: string;
  let body: string;
  let suggestion: string;

  if (adjustedScore >= 6) {
    // Excellent answer
    opener = isComprehensive
      ? personalityOpeners.excellent
      : personalityOpeners.excellent;
    body = `You've demonstrated a solid understanding of "${topicTitle}". ${
      hasExamples ? "Your use of examples helps illustrate the concepts well. " : ""
    }${hasExplanation ? "Your explanations show critical thinking. " : ""}`;
    suggestion = difficulty === 'harder'
      ? "Consider exploring edge cases or alternative perspectives to deepen your understanding further."
      : "Keep up this level of thoughtful analysis!";
  } else if (adjustedScore >= 3) {
    // Good answer
    opener = personalityOpeners.good;
    body = `You've touched on some key points about "${topicTitle}". `;
    if (!hasExamples) {
      suggestion = "Try including specific examples to strengthen your answer.";
    } else if (!hasExplanation) {
      suggestion = "Consider explaining the 'why' behind your points to show deeper understanding.";
    } else {
      suggestion = "Review the topic summary for additional insights you might incorporate.";
    }
  } else if (isMinimal) {
    // Minimal answer
    opener = personalityOpeners.minimal;
    body = `You've started to engage with "${topicTitle}". `;
    suggestion = difficulty === 'easier'
      ? "Try expanding on your thoughts - even a few more sentences can help reinforce your understanding."
      : "Consider elaborating more on your answer. What examples can you think of? Why do you think this is important?";
  } else {
    // Standard answer
    opener = personalityOpeners.standard;
    body = `You've shared your thoughts on "${topicTitle}". `;
    suggestion = hasQuestions
      ? "Great that you're asking questions! The topic summary may help address some of them."
      : "Consider how these concepts might apply to real-world situations.";
  }

  return `${opener} ${body}${suggestion}`;
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
export async function evaluateAnswer(
  topic: Topic,
  question: Question,
  userAnswer: string,
  difficulty: 'standard' | 'easier' | 'harder' = 'standard'
): Promise<string> {
  // Get current personality from settings
  const personality = getCurrentPersonality();
  const personalityInstructions = getPersonalityInstructions(personality);

  // Adjust evaluation criteria based on difficulty
  const difficultyInstructions = {
    easier: `The student is working at an easier difficulty level. Be more supportive and encouraging. Focus on the core understanding and don't be too strict about missing details. Highlight what they got right and provide gentle guidance.`,
    standard: `Evaluate the answer at a standard difficulty level. Balance encouragement with constructive feedback. Acknowledge correct understanding while pointing out areas for improvement.`,
    harder: `The student is working at a harder difficulty level. Be more rigorous in your evaluation. Expect deeper understanding and more comprehensive answers. Challenge them to think more critically while still being encouraging.`,
  };

  const prompt = `${personalityInstructions}

You are an educational assistant evaluating a student's answer.

Topic: ${topic.title}
Context: ${topic.summary}

Question: ${question.text}

Student's Answer: ${userAnswer}

Difficulty Level: ${difficulty.toUpperCase()}
${difficultyInstructions[difficulty]}

Please evaluate the answer and provide constructive feedback in your personality style:
1. Acknowledge what the student got right
2. Gently correct any misconceptions
3. Add any important points they may have missed
4. Keep the feedback encouraging and educational

Provide a concise response (2-4 sentences). Start with an assessment that matches your personality style.`;

  try {
    const response = await callGemini(prompt);
    return response.trim();
  } catch (error) {
    console.error('Error evaluating answer:', error);
    throw new Error(`Failed to evaluate answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

Provide a helpful, educational response in your personality style. Be thorough but concise. Use examples when helpful. If the question goes beyond the topic scope, try to relate it back or suggest resources.`;

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
