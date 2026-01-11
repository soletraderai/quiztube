import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/sessions
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.session.count({ where: { userId: req.user!.id } }),
    ]);

    res.json({
      sessions,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        sources: true,
        topics: { include: { questions: true } },
      },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    res.json(session);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { videoUrl } = req.body;

    const session = await prisma.session.create({
      data: {
        userId: req.user!.id,
        videoId: 'placeholder',
        videoTitle: 'New Session',
        videoUrl,
        videoThumbnail: '',
        videoDuration: 0,
        channelId: 'unknown',
        channelName: 'Unknown',
        transcript: '',
        status: 'SETUP',
      },
    });

    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/sessions/:id
router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.session.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: req.body,
    });

    if (session.count === 0) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const updated = await prisma.session.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.session.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (session.count === 0) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    res.json({ message: 'Session deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id/sources
router.get('/:id/sources', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const sources = await prisma.sessionSource.findMany({
      where: { sessionId: req.params.id },
    });

    res.json(sources);
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id/summary
router.get('/:id/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    res.json({
      id: session.id,
      summary: session.aiSummary,
      keyTakeaways: session.keyTakeaways,
      recommendations: session.recommendations,
      questionsAnswered: session.questionsAnswered,
      questionsCorrect: session.questionsCorrect,
      accuracy: session.questionsAnswered > 0
        ? (session.questionsCorrect / session.questionsAnswered * 100).toFixed(1)
        : 0,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
