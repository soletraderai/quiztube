import { Router, Response, NextFunction } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { aiRateLimit } from '../middleware/rateLimit.js';

const router = Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// POST /api/ai/generate-questions
router.post('/generate-questions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Check rate limit
    const rateLimit = await aiRateLimit(req.user!.id, req.user!.tier);
    if (!rateLimit.allowed) {
      throw new AppError(429, 'AI rate limit exceeded', 'RATE_LIMITED');
    }

    const { transcript, topicCount = 5 } = req.body;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `Analyze this transcript and generate ${topicCount} topics with questions for learning.

Transcript:
${transcript}

Return JSON in this format:
{
  "topics": [
    {
      "name": "Topic Name",
      "description": "Brief description",
      "questions": [
        {
          "text": "Question text?",
          "difficulty": "EASY" | "MEDIUM" | "HARD",
          "expectedAnswer": "What a good answer should cover"
        }
      ]
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Track usage
    await prisma.usageTracking.upsert({
      where: {
        userId_periodStart: {
          userId: req.user!.id,
          periodStart: new Date(new Date().setDate(1)),
        },
      },
      update: { aiRequestsCount: { increment: 1 } },
      create: {
        userId: req.user!.id,
        periodStart: new Date(new Date().setDate(1)),
        periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1, 0)),
        aiRequestsCount: 1,
      },
    });

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AppError(500, 'Failed to parse AI response', 'AI_PARSE_ERROR');
    }

    res.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/evaluate-answer
// Phase 7: Updated to return three-tier evaluation (pass/fail/neutral)
router.post('/evaluate-answer', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rateLimit = await aiRateLimit(req.user!.id, req.user!.tier);
    if (!rateLimit.allowed) {
      throw new AppError(429, 'AI rate limit exceeded', 'RATE_LIMITED');
    }

    const { question, userAnswer, expectedAnswer, personality = 'COACH', sources = [] } = req.body;

    const personalityPrompts = {
      PROFESSOR: 'Respond in a formal, academic style with thorough explanations.',
      COACH: 'Respond in an encouraging, supportive style that builds confidence.',
      DIRECT: 'Respond concisely and to the point, no fluff.',
      CREATIVE: 'Respond using analogies and creative examples to explain concepts.',
    };

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Build sources section if available
    const sourcesSection = sources.length > 0
      ? `\nRelevant learning resources to reference in feedback:\n${sources.map((s: { title: string; url: string; type: string }) =>
          `- ${s.title} (${s.type}): ${s.url}`
        ).join('\n')}\n\nWhen providing suggestions, reference these sources where appropriate.`
      : '';

    const prompt = `${personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.COACH}

Evaluate this answer using a THREE-TIER system:

Question: ${question}
User's Answer: ${userAnswer}
Expected concepts to cover: ${expectedAnswer}${sourcesSection}

EVALUATION CRITERIA:
- PASS: The answer demonstrates clear understanding of the core concept. Key points are addressed correctly, even if explanation isn't perfect.
- FAIL: The answer shows fundamental misunderstanding, is factually incorrect, or completely misses the point of the question.
- NEUTRAL: The answer shows partial understanding. Some key points are addressed but important aspects are missing or unclear.

Return JSON with this EXACT structure:
{
  "result": "pass" | "fail" | "neutral",
  "feedback": "Constructive feedback explaining the evaluation",
  "correctAnswer": "What a complete answer should include (especially important for fail/neutral)",
  "keyPointsHit": ["Specific concepts the user got right"],
  "keyPointsMissed": ["Specific concepts the user missed or got wrong"]
}

Be fair but accurate in your evaluation. Partial credit (neutral) is appropriate when the user shows effort and some understanding but is incomplete.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AppError(500, 'Failed to parse AI response', 'AI_PARSE_ERROR');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize the response
    const validResults = ['pass', 'fail', 'neutral'];
    const normalizedResult = {
      result: validResults.includes(parsed.result?.toLowerCase())
        ? parsed.result.toLowerCase()
        : 'neutral',
      feedback: parsed.feedback || 'Your answer has been evaluated.',
      correctAnswer: parsed.correctAnswer || '',
      keyPointsHit: Array.isArray(parsed.keyPointsHit) ? parsed.keyPointsHit : [],
      keyPointsMissed: Array.isArray(parsed.keyPointsMissed) ? parsed.keyPointsMissed : [],
    };

    res.json(normalizedResult);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/generate-summary
router.post('/generate-summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rateLimit = await aiRateLimit(req.user!.id, req.user!.tier);
    if (!rateLimit.allowed) {
      throw new AppError(429, 'AI rate limit exceeded', 'RATE_LIMITED');
    }

    const { sessionId } = req.body;

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: req.user!.id },
      include: { topics: { include: { questions: true } } },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const questionsAnswered = session.topics.flatMap(t => t.questions.filter(q => q.userAnswer));

    const prompt = `Generate a learning session summary:

Video: ${session.videoTitle}
Topics covered: ${session.topics.map(t => t.name).join(', ')}
Questions answered: ${questionsAnswered.length}
Correct: ${questionsAnswered.filter(q => q.isCorrect).length}

Q&A Summary:
${questionsAnswered.map(q => `Q: ${q.questionText}\nA: ${q.userAnswer}\nCorrect: ${q.isCorrect}`).join('\n\n')}

Return JSON:
{
  "summary": "Overall session summary",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "strengths": ["What they did well"],
  "areasForImprovement": ["What to work on"],
  "recommendations": ["Recommended next step 1", "Recommended next step 2"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AppError(500, 'Failed to parse AI response', 'AI_PARSE_ERROR');
    }

    const summaryData = JSON.parse(jsonMatch[0]);

    // Update session with summary
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        aiSummary: summaryData.summary,
        keyTakeaways: summaryData.keyTakeaways,
        recommendations: summaryData.recommendations,
      },
    });

    res.json(summaryData);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/rephrase-question
router.post('/rephrase-question', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rateLimit = await aiRateLimit(req.user!.id, req.user!.tier);
    if (!rateLimit.allowed) {
      throw new AppError(429, 'AI rate limit exceeded', 'RATE_LIMITED');
    }

    const { originalQuestion, topicName, correctAnswer, difficulty } = req.body;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `Rephrase this review question to test the same concept but with different wording.
The goal is to prevent the user from memorizing the original answer word-for-word.

Original question: ${originalQuestion}
Topic: ${topicName}
Difficulty: ${difficulty || 'MEDIUM'}
Expected concepts: ${correctAnswer || 'N/A'}

Requirements:
1. Test the same underlying concept
2. Use different phrasing and structure
3. May ask from a different angle or perspective
4. Keep the same difficulty level
5. Should still be answerable with the same knowledge

Return JSON:
{
  "rephrasedQuestion": "The new question text",
  "questionAngle": "Brief description of how this question differs from the original"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: return original question if AI fails
      return res.json({
        rephrasedQuestion: originalQuestion,
        questionAngle: 'original',
      });
    }

    res.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    // Fallback: return original question on error
    console.error('Failed to rephrase question:', error);
    res.json({
      rephrasedQuestion: req.body.originalQuestion,
      questionAngle: 'original',
    });
  }
});

// POST /api/ai/dig-deeper
router.post('/dig-deeper', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rateLimit = await aiRateLimit(req.user!.id, req.user!.tier);
    if (!rateLimit.allowed) {
      throw new AppError(429, 'AI rate limit exceeded', 'RATE_LIMITED');
    }

    const { context, question, conversationHistory = [], personality = 'COACH' } = req.body;

    const personalityPrompts = {
      PROFESSOR: 'You are a formal, academic tutor.',
      COACH: 'You are an encouraging, supportive learning coach.',
      DIRECT: 'You are a concise, direct tutor.',
      CREATIVE: 'You are a creative tutor who uses analogies.',
    };

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const historyText = conversationHistory
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `${personalityPrompts[personality as keyof typeof personalityPrompts]}

Context: ${context}

Previous conversation:
${historyText}

User's question: ${question}

Provide a helpful, educational response.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    res.json({
      response: response.text(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/generate-learning-path - Generate AI-recommended learning path
router.post('/generate-learning-path', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rateLimit = await aiRateLimit(req.user!.id, req.user!.tier);
    if (!rateLimit.allowed) {
      throw new AppError(429, 'AI rate limit exceeded', 'RATE_LIMITED');
    }

    const { goal, topic, existingVideos = [], preferredDuration = 'medium' } = req.body;

    if (!goal && !topic) {
      throw new AppError(400, 'Either goal or topic is required', 'INVALID_INPUT');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Build context from existing videos
    const existingContext = existingVideos.length > 0
      ? `\nUser has already watched these videos:\n${existingVideos.map((v: { title: string; channel: string }) => `- ${v.title} by ${v.channel}`).join('\n')}\n\nSuggest videos that build upon this knowledge without repeating content.`
      : '';

    const durationGuide = {
      short: '5-10 videos for quick overview',
      medium: '10-20 videos for comprehensive learning',
      long: '20-30 videos for deep mastery',
    };

    const prompt = `You are a learning path generator. Create an ordered list of recommended YouTube videos for learning.

Learning Goal: ${goal || `Master ${topic}`}
Topic Area: ${topic || 'derived from goal'}
Recommended Path Length: ${durationGuide[preferredDuration as keyof typeof durationGuide] || durationGuide.medium}${existingContext}

Generate a structured learning path with videos in logical order from beginner to advanced.
Include a mix of:
- Foundational concepts (start here)
- Core skills and techniques
- Practical applications and projects
- Advanced topics (for deepening knowledge)

Return JSON:
{
  "pathTitle": "Descriptive title for this learning path",
  "pathDescription": "Brief description of what the learner will achieve",
  "estimatedDuration": "X hours total",
  "recommendations": [
    {
      "order": 1,
      "title": "Suggested video title/topic",
      "searchQuery": "YouTube search query to find this video",
      "channel": "Recommended channel if known (or 'Any quality channel')",
      "duration": "Estimated video length (e.g., '15 min')",
      "reason": "Why this video is recommended at this point",
      "difficulty": "beginner" | "intermediate" | "advanced"
    }
  ],
  "milestones": [
    {
      "afterVideo": 3,
      "achievement": "What the learner can do after reaching this point"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Track usage
    await prisma.usageTracking.upsert({
      where: {
        userId_periodStart: {
          userId: req.user!.id,
          periodStart: new Date(new Date().setDate(1)),
        },
      },
      update: { aiRequestsCount: { increment: 1 } },
      create: {
        userId: req.user!.id,
        periodStart: new Date(new Date().setDate(1)),
        periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1, 0)),
        aiRequestsCount: 1,
      },
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AppError(500, 'Failed to parse AI response', 'AI_PARSE_ERROR');
    }

    res.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/evaluate-timed-answer - Quick evaluation for timed sessions
router.post('/evaluate-timed-answer', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rateLimit = await aiRateLimit(req.user!.id, req.user!.tier);
    if (!rateLimit.allowed) {
      // For timed sessions, provide a fallback instead of erroring
      return res.json({
        isCorrect: false,
        feedback: 'Your answer has been recorded. Review this topic later for detailed feedback.',
      });
    }

    const { questionId, topicName, questionText, userAnswer } = req.body;

    // If answer is too short, mark as incorrect
    if (!userAnswer || userAnswer.trim().length < 10) {
      return res.json({
        isCorrect: false,
        feedback: 'Your answer was too brief. Try to provide more detail in your responses.',
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are a quick answer evaluator for a timed learning session.

Topic: ${topicName}
Question: ${questionText}
User's Answer: ${userAnswer}

Evaluate if the answer demonstrates understanding of the concept. Be encouraging but honest.
Respond with a brief evaluation (2-3 sentences max).

Return JSON:
{
  "isCorrect": true or false (true if answer shows understanding, false if incorrect or missing key concepts),
  "feedback": "Brief encouraging feedback"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: give credit for attempting
      return res.json({
        isCorrect: true,
        feedback: 'Good attempt! Your answer has been recorded.',
      });
    }

    res.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    // Fallback on error
    console.error('Failed to evaluate timed answer:', error);
    res.json({
      isCorrect: false,
      feedback: 'Your answer has been recorded. Review this topic later for detailed feedback.',
    });
  }
});

export default router;
