import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

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

// GET /api/topics/due-for-review
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
