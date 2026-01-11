import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requirePro } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const createTimedSessionSchema = z.object({
  sessionType: z.enum(['RAPID', 'FOCUSED', 'COMPREHENSIVE']),
  topicFilter: z.string().optional(),
});

const SESSION_CONFIG = {
  RAPID: { questions: 10, timeLimit: 10 * 30 }, // 30 seconds per question
  FOCUSED: { questions: 20, timeLimit: 15 * 60 }, // 15 minutes
  COMPREHENSIVE: { questions: 30, timeLimit: 30 * 60 }, // 30 minutes
};

// POST /api/timed-sessions
router.post('/', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionType, topicFilter } = createTimedSessionSchema.parse(req.body);
    const config = SESSION_CONFIG[sessionType];

    const timedSession = await prisma.timedSession.create({
      data: {
        userId: req.user!.id,
        sessionType,
        topicFilter,
        questionsTotal: config.questions,
        timeLimitSeconds: config.timeLimit,
      },
    });

    res.status(201).json(timedSession);
  } catch (error) {
    next(error);
  }
});

// GET /api/timed-sessions/:id
router.get('/:id', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const timedSession = await prisma.timedSession.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!timedSession) {
      throw new AppError(404, 'Timed session not found', 'TIMED_SESSION_NOT_FOUND');
    }

    const timeRemaining = timedSession.timeLimitSeconds - timedSession.timeUsedSeconds;

    res.json({
      ...timedSession,
      timeRemaining: Math.max(0, timeRemaining),
      progress: (timedSession.questionsAnswered / timedSession.questionsTotal) * 100,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/timed-sessions/:id
router.patch('/:id', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const timedSession = await prisma.timedSession.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!timedSession) {
      throw new AppError(404, 'Timed session not found', 'TIMED_SESSION_NOT_FOUND');
    }

    const { questionsAnswered, questionsCorrect, timeUsedSeconds, status } = req.body;

    const updated = await prisma.timedSession.update({
      where: { id: req.params.id },
      data: {
        ...(questionsAnswered !== undefined && { questionsAnswered }),
        ...(questionsCorrect !== undefined && { questionsCorrect }),
        ...(timeUsedSeconds !== undefined && { timeUsedSeconds }),
        ...(status && { status, completedAt: status !== 'ACTIVE' ? new Date() : null }),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// GET /api/timed-sessions/history
router.get('/history', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.timedSession.findMany({
      where: {
        userId: req.user!.id,
        status: { in: ['COMPLETED', 'ABANDONED'] },
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });

    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

export default router;
