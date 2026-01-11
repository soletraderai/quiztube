import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

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
