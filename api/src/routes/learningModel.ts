import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/learning-model
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const model = await prisma.learningModel.findUnique({
      where: { userId: req.user!.id },
      include: { patterns: true },
    });

    if (!model) {
      return res.json({
        hasData: false,
        message: 'No learning data yet. Complete more sessions to build your profile.',
      });
    }

    res.json({
      hasData: true,
      optimalTime: model.optimalTime,
      avgSessionDuration: model.avgSessionDuration,
      difficultySweetSpot: model.difficultySweetSpot,
      preferredPacing: model.preferredPacing,
      preferredDevice: model.preferredDevice,
      sessionsAnalyzed: model.sessionsAnalyzed,
      confidenceScore: model.confidenceScore,
      patterns: model.patterns,
      signals: {
        timeOfDay: model.timeOfDayEnabled,
        sessionDuration: model.sessionDurationEnabled,
        difficulty: model.difficultyEnabled,
        pacing: model.pacingEnabled,
        device: model.deviceEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/learning-model
router.delete('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.learningModel.deleteMany({
      where: { userId: req.user!.id },
    });

    res.json({ message: 'Learning model reset' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/learning-model/signals
router.patch('/signals', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { signal, enabled } = req.body;

    const signalMap: Record<string, string> = {
      timeOfDay: 'timeOfDayEnabled',
      sessionDuration: 'sessionDurationEnabled',
      difficulty: 'difficultyEnabled',
      pacing: 'pacingEnabled',
      device: 'deviceEnabled',
    };

    const field = signalMap[signal];
    if (!field) {
      return res.status(400).json({ error: 'Invalid signal' });
    }

    const model = await prisma.learningModel.upsert({
      where: { userId: req.user!.id },
      update: { [field]: enabled },
      create: {
        userId: req.user!.id,
        [field]: enabled,
      },
    });

    res.json({
      signal,
      enabled: (model as Record<string, unknown>)[field],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/learning-model/export
router.get('/export', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const [user, preferences, model, sessions, topics, dailyRecords] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.id } }),
      prisma.userPreferences.findUnique({ where: { userId: req.user!.id } }),
      prisma.learningModel.findUnique({
        where: { userId: req.user!.id },
        include: { patterns: true },
      }),
      prisma.session.findMany({
        where: { userId: req.user!.id },
        include: { topics: true, questions: true },
      }),
      prisma.topic.findMany({ where: { userId: req.user!.id } }),
      prisma.dailyRecord.findMany({ where: { userId: req.user!.id } }),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        email: user?.email,
        displayName: user?.displayName,
        createdAt: user?.createdAt,
      },
      preferences,
      learningModel: model,
      sessions: sessions.length,
      topics: topics.length,
      dailyRecords: dailyRecords.length,
      fullData: {
        sessions,
        topics,
        dailyRecords,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="teachy-data-export.json"');
    res.json(exportData);
  } catch (error) {
    next(error);
  }
});

export default router;
