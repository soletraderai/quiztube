import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// POST /api/questions - Create a new question
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { topicId, sessionId, questionText, correctAnswer, difficulty } = req.body;

    // Verify the topic belongs to the user
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, userId: req.user!.id },
    });

    if (!topic) {
      throw new AppError(404, 'Topic not found', 'TOPIC_NOT_FOUND');
    }

    // Check question limit for FREE tier users
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    if (!subscription || subscription.tier === 'FREE') {
      // Count questions in this session
      const questionsInSession = await prisma.question.count({
        where: { sessionId },
      });

      const FREE_TIER_QUESTIONS_LIMIT = 10;
      if (questionsInSession >= FREE_TIER_QUESTIONS_LIMIT) {
        throw new AppError(
          402,
          'Free tier limited to 10 questions per session. Upgrade to Pro for unlimited questions.',
          'QUESTION_LIMIT_REACHED'
        );
      }
    }

    const question = await prisma.question.create({
      data: {
        topicId,
        sessionId,
        questionText,
        correctAnswer,
        difficulty: difficulty || 'MEDIUM',
      },
    });

    res.status(201).json(question);
  } catch (error) {
    next(error);
  }
});

// GET /api/questions/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const question = await prisma.question.findFirst({
      where: {
        id,
        topic: { userId: req.user!.id },
      },
      include: { topic: true },
    });

    if (!question) {
      throw new AppError(404, 'Question not found', 'QUESTION_NOT_FOUND');
    }

    res.json(question);
  } catch (error) {
    next(error);
  }
});

// POST /api/questions/:id/answer
router.post('/:id/answer', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { userAnswer, timeTakenSeconds } = req.body;

    const question = await prisma.question.findFirst({
      where: {
        id,
        topic: { userId: req.user!.id },
      },
      include: { topic: true, session: true },
    });

    if (!question) {
      throw new AppError(404, 'Question not found', 'QUESTION_NOT_FOUND');
    }

    // Simple evaluation logic (in production, this would call AI)
    // For now, we just mark as answered and return feedback
    const isCorrect = userAnswer.toLowerCase().includes(
      (question.correctAnswer || '').toLowerCase().slice(0, 10)
    );

    const updated = await prisma.question.update({
      where: { id },
      data: {
        userAnswer,
        isCorrect,
        feedback: isCorrect
          ? 'Good job! Your answer covers the key concepts.'
          : 'Your answer could be improved. Review the topic and try again.',
        timeTakenSeconds: timeTakenSeconds || null,
        answeredAt: new Date(),
      },
    });

    // Update session stats
    await prisma.session.update({
      where: { id: question.sessionId },
      data: {
        questionsAnswered: { increment: 1 },
        questionsCorrect: isCorrect ? { increment: 1 } : undefined,
      },
    });

    res.json({
      id: updated.id,
      isCorrect: updated.isCorrect,
      feedback: updated.feedback,
      userAnswer: updated.userAnswer,
      answeredAt: updated.answeredAt,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
