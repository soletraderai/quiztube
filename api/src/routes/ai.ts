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
router.post('/evaluate-answer', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rateLimit = await aiRateLimit(req.user!.id, req.user!.tier);
    if (!rateLimit.allowed) {
      throw new AppError(429, 'AI rate limit exceeded', 'RATE_LIMITED');
    }

    const { question, userAnswer, expectedAnswer, personality = 'COACH' } = req.body;

    const personalityPrompts = {
      PROFESSOR: 'Respond in a formal, academic style with thorough explanations.',
      COACH: 'Respond in an encouraging, supportive style that builds confidence.',
      DIRECT: 'Respond concisely and to the point, no fluff.',
      CREATIVE: 'Respond using analogies and creative examples to explain concepts.',
    };

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `${personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.COACH}

Evaluate this answer and provide feedback:

Question: ${question}
User's Answer: ${userAnswer}
Expected concepts to cover: ${expectedAnswer}

Return JSON:
{
  "isCorrect": true | false,
  "feedback": "Your feedback here",
  "keyPoints": ["Point they got right", "Point they missed"],
  "suggestion": "What to focus on next"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AppError(500, 'Failed to parse AI response', 'AI_PARSE_ERROR');
    }

    res.json(JSON.parse(jsonMatch[0]));
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

export default router;
