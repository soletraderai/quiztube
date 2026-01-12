import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/commitment/today
router.get('/today', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [preferences, record] = await Promise.all([
      prisma.userPreferences.findUnique({
        where: { userId: req.user!.id },
      }),
      prisma.dailyRecord.findUnique({
        where: {
          userId_date: {
            userId: req.user!.id,
            date: today,
          },
        },
      }),
    ]);

    const baseTargetMinutes = preferences?.dailyCommitmentMinutes || 15;
    const busyWeekMode = record?.busyWeekMode || false;
    const vacationMode = record?.vacationMode || false;

    // Reduce target by 50% when in busy week mode
    const targetMinutes = busyWeekMode ? Math.ceil(baseTargetMinutes / 2) : baseTargetMinutes;

    const currentMinutes = record?.timeSpentMinutes || 0;
    const commitmentMet = record?.commitmentMet || false;

    res.json({
      date: today.toISOString().split('T')[0],
      targetMinutes,
      baseTargetMinutes,
      currentMinutes,
      progress: Math.min(100, (currentMinutes / targetMinutes) * 100),
      commitmentMet,
      questionsAnswered: record?.questionsAnswered || 0,
      sessionsCompleted: record?.sessionsCompleted || 0,
      busyWeekMode,
      vacationMode,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/commitment/calendar
router.get('/calendar', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { view = 'week' } = req.query;
    const days = view === 'month' ? 30 : 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const records = await prisma.dailyRecord.findMany({
      where: {
        userId: req.user!.id,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    const calendar: { date: string; commitmentMet: boolean; timeSpentMinutes: number; vacationMode: boolean }[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      const record = records.find(r => {
        const recordDate = new Date(r.date);
        return recordDate.toISOString().split('T')[0] === date.toISOString().split('T')[0];
      });

      calendar.push({
        date: date.toISOString().split('T')[0],
        commitmentMet: record?.commitmentMet || false,
        timeSpentMinutes: record?.timeSpentMinutes || 0,
        vacationMode: record?.vacationMode || false,
      });
    }

    const metDays = records.filter(r => r.commitmentMet && !r.vacationMode).length;
    const totalDays = records.filter(r => !r.vacationMode).length;
    const consistency = totalDays > 0 ? (metDays / totalDays * 100).toFixed(1) : 0;

    res.json({
      calendar,
      consistency,
      metDays,
      totalDays,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/commitment/log
router.post('/log', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { timeSpentMinutes, questionsAnswered, sessionsCompleted } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.id },
    });

    const targetMinutes = preferences?.dailyCommitmentMinutes || 15;

    const record = await prisma.dailyRecord.upsert({
      where: {
        userId_date: {
          userId: req.user!.id,
          date: today,
        },
      },
      update: {
        timeSpentMinutes: { increment: timeSpentMinutes || 0 },
        questionsAnswered: { increment: questionsAnswered || 0 },
        sessionsCompleted: { increment: sessionsCompleted || 0 },
      },
      create: {
        userId: req.user!.id,
        date: today,
        timeSpentMinutes: timeSpentMinutes || 0,
        questionsAnswered: questionsAnswered || 0,
        sessionsCompleted: sessionsCompleted || 0,
      },
    });

    // Check if commitment met
    const commitmentMet = record.timeSpentMinutes >= targetMinutes;
    if (commitmentMet !== record.commitmentMet) {
      await prisma.dailyRecord.update({
        where: { id: record.id },
        data: { commitmentMet },
      });
    }

    res.json({
      ...record,
      commitmentMet,
      targetMinutes,
      progress: Math.min(100, (record.timeSpentMinutes / targetMinutes) * 100),
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/commitment/settings
router.patch('/settings', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { busyWeekMode, vacationMode } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await prisma.dailyRecord.upsert({
      where: {
        userId_date: {
          userId: req.user!.id,
          date: today,
        },
      },
      update: {
        ...(busyWeekMode !== undefined && { busyWeekMode }),
        ...(vacationMode !== undefined && { vacationMode }),
      },
      create: {
        userId: req.user!.id,
        date: today,
        busyWeekMode: busyWeekMode || false,
        vacationMode: vacationMode || false,
      },
    });

    res.json(record);
  } catch (error) {
    next(error);
  }
});

export default router;
