import { Router, Response, NextFunction } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Helper function to rephrase a question for review
async function rephraseQuestionForReview(
  originalQuestion: string,
  topicName: string,
  correctAnswer: string | null,
  difficulty: string
): Promise<{ rephrasedQuestion: string; isRephrased: boolean }> {
  try {
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

Return ONLY valid JSON (no markdown code blocks):
{"rephrasedQuestion": "The new question text"}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        rephrasedQuestion: parsed.rephrasedQuestion || originalQuestion,
        isRephrased: true,
      };
    }
    return { rephrasedQuestion: originalQuestion, isRephrased: false };
  } catch (error) {
    console.error('Failed to rephrase question:', error);
    return { rephrasedQuestion: originalQuestion, isRephrased: false };
  }
}

const router = Router();

// GET /api/topics
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { category } = req.query;

    const topics = await prisma.topic.findMany({
      where: {
        userId: req.user!.id,
        ...(category && { category: category as string }),
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(topics);
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/due-for-review (must be before /:id)
router.get('/due-for-review', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const topics = await prisma.topic.findMany({
      where: {
        userId: req.user!.id,
        nextReviewDate: { lte: new Date() },
      },
      orderBy: { nextReviewDate: 'asc' },
    });

    res.json(topics);
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/quick-review - Get topics and questions for quick review session
router.get('/quick-review', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Get user preferences for max daily reviews
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.id },
    });
    const maxDailyReviews = preferences?.maxDailyReviews ?? 20;

    // Count how many reviews user has done today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayReviews = await prisma.topic.count({
      where: {
        userId: req.user!.id,
        lastReviewedAt: { gte: todayStart },
      },
    });

    // Calculate remaining reviews for today
    const remainingReviews = Math.max(0, maxDailyReviews - todayReviews);

    if (remainingReviews === 0) {
      return res.json({
        items: [],
        totalQuestions: 0,
        estimatedMinutes: 0,
        maxDailyReviews,
        todayReviews,
        limitReached: true,
      });
    }

    // Get topics due for review with their questions
    const topics = await prisma.topic.findMany({
      where: {
        userId: req.user!.id,
        nextReviewDate: { lte: new Date() },
      },
      include: {
        questions: {
          take: 2, // Limit to 2 questions per topic
          orderBy: { createdAt: 'desc' },
        },
        session: {
          select: {
            videoTitle: true,
            videoThumbnail: true,
            channelName: true,
          },
        },
      },
      orderBy: { nextReviewDate: 'asc' },
      take: Math.min(5, remainingReviews), // Limit to remaining reviews or 5 topics
    });

    // Flatten to get review items (topic + question pairs)
    const baseReviewItems = topics.flatMap((topic) =>
      topic.questions.map((question) => ({
        topicId: topic.id,
        topicName: topic.name,
        topicDescription: topic.description,
        masteryLevel: topic.masteryLevel,
        questionId: question.id,
        originalQuestionText: question.questionText,
        questionText: question.questionText, // Will be replaced with rephrased version
        correctAnswer: question.correctAnswer,
        difficulty: question.difficulty,
        videoTitle: topic.session.videoTitle,
        videoThumbnail: topic.session.videoThumbnail,
        channelName: topic.session.channelName,
        isRephrased: false,
      }))
    ).slice(0, Math.min(10, remainingReviews)); // Limit to 10 questions max or remaining reviews

    // Rephrase questions for review to prevent memorization
    // Process in parallel for better performance
    const reviewItems = await Promise.all(
      baseReviewItems.map(async (item) => {
        const { rephrasedQuestion, isRephrased } = await rephraseQuestionForReview(
          item.originalQuestionText,
          item.topicName,
          item.correctAnswer,
          item.difficulty
        );
        return {
          ...item,
          questionText: rephrasedQuestion,
          isRephrased,
        };
      })
    );

    res.json({
      items: reviewItems,
      totalQuestions: reviewItems.length,
      estimatedMinutes: Math.min(5, Math.ceil(reviewItems.length * 0.5)), // ~30 seconds per question
      maxDailyReviews,
      todayReviews,
      limitReached: false,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const topic = await prisma.topic.findFirst({
      where: { id, userId: req.user!.id },
      include: { questions: true },
    });

    if (!topic) {
      throw new AppError(404, 'Topic not found', 'TOPIC_NOT_FOUND');
    }

    res.json(topic);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/topics/:id
router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const topic = await prisma.topic.updateMany({
      where: { id, userId: req.user!.id },
      data: req.body,
    });

    if (topic.count === 0) {
      throw new AppError(404, 'Topic not found', 'TOPIC_NOT_FOUND');
    }

    const updated = await prisma.topic.findUnique({ where: { id } });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// POST /api/topics/:id/review
router.post('/:id/review', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { quality } = req.body; // 0-5 SM-2 quality rating

    const topic = await prisma.topic.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!topic) {
      throw new AppError(404, 'Topic not found', 'TOPIC_NOT_FOUND');
    }

    // SM-2 Algorithm
    let easeFactor = topic.easeFactor;
    let interval = topic.reviewIntervalDays;

    if (quality >= 3) {
      // Correct response
      if (topic.reviewCount === 0) {
        interval = 1;
      } else if (topic.reviewCount === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    } else {
      // Incorrect response
      interval = 1;
    }

    // Ensure ease factor doesn't go below 1.3
    easeFactor = Math.max(1.3, easeFactor);

    // Determine mastery level
    let masteryLevel = topic.masteryLevel;
    if (topic.reviewCount >= 5 && quality >= 4) {
      masteryLevel = 'MASTERED';
    } else if (topic.reviewCount >= 3 && quality >= 3) {
      masteryLevel = 'FAMILIAR';
    } else if (topic.reviewCount >= 1) {
      masteryLevel = 'DEVELOPING';
    }

    const updated = await prisma.topic.update({
      where: { id },
      data: {
        easeFactor,
        reviewIntervalDays: interval,
        nextReviewDate: new Date(Date.now() + interval * 24 * 60 * 60 * 1000),
        reviewCount: topic.reviewCount + 1,
        lastReviewedAt: new Date(),
        masteryLevel,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
