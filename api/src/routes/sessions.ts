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
    const id = req.params.id as string;
    const session = await prisma.session.findFirst({
      where: { id, userId: req.user!.id },
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
    const {
      videoUrl,
      videoId,
      videoTitle,
      videoThumbnail,
      videoDuration,
      channelId,
      channelName,
      transcript,
      status,
      localSessionId,
      sessionData,
    } = req.body;

    const session = await prisma.session.create({
      data: {
        userId: req.user!.id,
        videoId: videoId || 'placeholder',
        videoTitle: videoTitle || 'New Session',
        videoUrl: videoUrl || '',
        videoThumbnail: videoThumbnail || '',
        videoDuration: videoDuration || 0,
        channelId: channelId || 'unknown',
        channelName: channelName || 'Unknown',
        transcript: transcript || '',
        status: status || 'SETUP',
        localSessionId: localSessionId || null,
        sessionData: sessionData ? JSON.parse(sessionData) : null,
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
    const id = req.params.id as string;

    // Parse sessionData if it's a string
    const updateData = { ...req.body };
    if (updateData.sessionData && typeof updateData.sessionData === 'string') {
      updateData.sessionData = JSON.parse(updateData.sessionData);
    }

    const session = await prisma.session.updateMany({
      where: { id, userId: req.user!.id },
      data: updateData,
    });

    if (session.count === 0) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const updated = await prisma.session.findUnique({ where: { id } });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.session.deleteMany({
      where: { id, userId: req.user!.id },
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
    const id = req.params.id as string;
    const session = await prisma.session.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const sources = await prisma.sessionSource.findMany({
      where: { sessionId: id },
    });

    res.json(sources);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/:id/complete
router.post('/:id/complete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.session.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    if (session.status === 'COMPLETED') {
      // Already completed, return without updating channel count
      return res.json(session);
    }

    // Update session status to completed
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Update channel session count if user follows this channel
    await prisma.followedChannel.updateMany({
      where: {
        userId: req.user!.id,
        channelId: session.channelId,
      },
      data: {
        sessionsCompleted: { increment: 1 },
        lastSessionAt: new Date(),
      },
    });

    // Update learning model data collection
    const completedAt = new Date();
    const hour = completedAt.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    // Get user's learning model settings
    const learningModel = await prisma.learningModel.findUnique({
      where: { userId: req.user!.id },
    });

    // Only collect if learning model tracking is enabled (default: enabled)
    const shouldCollect = !learningModel || learningModel.timeOfDayEnabled;

    if (shouldCollect) {
      // Calculate difficulty sweet spot based on accuracy
      // Target accuracy is 70-80%, which corresponds to a sweet spot of 0.75
      // Accuracy of 100% suggests questions are too easy (sweet spot should be higher)
      // Accuracy of 50% suggests questions are too hard (sweet spot should be lower)
      let difficultySweetSpot: number | undefined = undefined;
      if (session.questionsAnswered > 0) {
        const accuracy = session.questionsCorrect / session.questionsAnswered;
        // Map accuracy to sweet spot: high accuracy = need harder, low accuracy = need easier
        // Sweet spot ranges from 0.3 (very easy) to 0.9 (very hard)
        // Accuracy > 80% -> increase sweet spot (make harder)
        // Accuracy < 70% -> decrease sweet spot (make easier)
        // Accuracy 70-80% -> sweet spot is 0.75 (optimal)
        difficultySweetSpot = Math.min(0.9, Math.max(0.3, accuracy * 0.6 + 0.3));
      }

      // Upsert the learning model with updated data
      const model = await prisma.learningModel.upsert({
        where: { userId: req.user!.id },
        update: {
          sessionsAnalyzed: { increment: 1 },
          avgSessionDuration: session.timeSpentSeconds > 0 ? session.timeSpentSeconds : undefined,
          optimalTime: timeOfDay,
          lastUpdated: new Date(),
          confidenceScore: { increment: 0.05 },
          ...(difficultySweetSpot !== undefined && { difficultySweetSpot }),
        },
        create: {
          userId: req.user!.id,
          sessionsAnalyzed: 1,
          avgSessionDuration: session.timeSpentSeconds > 0 ? session.timeSpentSeconds : null,
          optimalTime: timeOfDay,
          confidenceScore: 0.1,
          difficultySweetSpot: difficultySweetSpot || 0.75,
        },
      });

      // Add a pattern for time of day
      await prisma.learningModelPattern.create({
        data: {
          learningModelId: model.id,
          patternType: 'session_time',
          patternData: {
            hour,
            timeOfDay,
            completedAt: completedAt.toISOString(),
            questionsAnswered: session.questionsAnswered,
            questionsCorrect: session.questionsCorrect,
          },
        },
      });
    }

    res.json(updatedSession);
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id/summary
router.get('/:id/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.session.findFirst({
      where: { id, userId: req.user!.id },
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
