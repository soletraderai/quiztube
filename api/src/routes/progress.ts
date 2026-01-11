import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { requirePro } from '../middleware/auth.js';

const router = Router();

// GET /api/progress/dashboard
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const [sessions, topics, dailyRecords] = await Promise.all([
      prisma.session.findMany({
        where: { userId, status: 'COMPLETED' },
        select: {
          timeSpentSeconds: true,
          questionsAnswered: true,
          questionsCorrect: true,
        },
      }),
      prisma.topic.findMany({
        where: { userId },
        select: { category: true, masteryLevel: true },
      }),
      prisma.dailyRecord.findMany({
        where: {
          userId,
          date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const totalSessions = sessions.length;
    const totalTimeMinutes = sessions.reduce((acc, s) => acc + s.timeSpentSeconds / 60, 0);
    const totalQuestions = sessions.reduce((acc, s) => acc + s.questionsAnswered, 0);
    const totalCorrect = sessions.reduce((acc, s) => acc + s.questionsCorrect, 0);
    const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions * 100).toFixed(1) : 0;

    const categories = [...new Set(topics.map(t => t.category).filter(Boolean))];

    res.json({
      totalSessions,
      totalTimeMinutes: Math.round(totalTimeMinutes),
      topicsCovered: topics.length,
      totalQuestions,
      accuracy,
      categories,
      commitmentDaysMet: dailyRecords.filter(d => d.commitmentMet).length,
      totalCommitmentDays: dailyRecords.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/daily
router.get('/daily', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { days = '30' } = req.query;

    const records = await prisma.dailyRecord.findMany({
      where: {
        userId: req.user!.id,
        date: { gte: new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000) },
      },
      orderBy: { date: 'asc' },
    });

    res.json(records);
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/weekly-chart
router.get('/weekly-chart', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const records = await prisma.dailyRecord.findMany({
      where: {
        userId: req.user!.id,
        date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { date: 'asc' },
    });

    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);

      const record = records.find(r => {
        const recordDate = new Date(r.date);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === date.getTime();
      });

      chartData.push({
        date: date.toISOString().split('T')[0],
        timeSpentMinutes: record?.timeSpentMinutes || 0,
        questionsAnswered: record?.questionsAnswered || 0,
        commitmentMet: record?.commitmentMet || false,
      });
    }

    res.json(chartData);
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/monthly-chart
router.get('/monthly-chart', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const records = await prisma.dailyRecord.findMany({
      where: {
        userId: req.user!.id,
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { date: 'asc' },
    });

    const chartData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);

      const record = records.find(r => {
        const recordDate = new Date(r.date);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === date.getTime();
      });

      chartData.push({
        date: date.toISOString().split('T')[0],
        timeSpentMinutes: record?.timeSpentMinutes || 0,
        questionsAnswered: record?.questionsAnswered || 0,
        commitmentMet: record?.commitmentMet || false,
      });
    }

    res.json(chartData);
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/insights (Pro only)
router.get('/insights', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const learningModel = await prisma.learningModel.findUnique({
      where: { userId: req.user!.id },
      include: { patterns: true },
    });

    if (!learningModel) {
      return res.json({
        hasEnoughData: false,
        message: 'Complete more sessions to generate insights',
      });
    }

    res.json({
      hasEnoughData: learningModel.sessionsAnalyzed >= 5,
      optimalTime: learningModel.optimalTime,
      avgSessionDuration: learningModel.avgSessionDuration,
      difficultySweetSpot: learningModel.difficultySweetSpot,
      preferredPacing: learningModel.preferredPacing,
      confidenceScore: learningModel.confidenceScore,
      patterns: learningModel.patterns,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/export (Pro only)
router.get('/export', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;

    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user!.id,
        ...(startDate && endDate && {
          createdAt: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        }),
      },
      include: {
        topics: { include: { questions: true } },
        sources: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'json') {
      res.json(sessions);
    } else if (format === 'markdown') {
      let markdown = '# Teachy Progress Export\n\n';

      for (const session of sessions) {
        markdown += `## ${session.videoTitle}\n`;
        markdown += `Date: ${session.createdAt.toLocaleDateString()}\n\n`;

        for (const topic of session.topics) {
          markdown += `### ${topic.name}\n`;
          for (const q of topic.questions) {
            markdown += `**Q:** ${q.questionText}\n`;
            markdown += `**A:** ${q.userAnswer || 'Not answered'}\n`;
            markdown += `**Correct:** ${q.isCorrect ? 'Yes' : 'No'}\n\n`;
          }
        }
        markdown += '---\n\n';
      }

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename="teachy-export.md"');
      res.send(markdown);
    } else {
      res.status(400).json({ error: 'Invalid format' });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
