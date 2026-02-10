import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requirePro } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  goalType: z.enum(['TIME', 'TOPIC', 'OUTCOME']),
  targetValue: z.number().optional(),
  targetUnit: z.string().optional(),
  deadline: z.string().optional(),
});

// GET /api/goals
router.get('/', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status = 'ACTIVE' } = req.query;

    const goals = await prisma.goal.findMany({
      where: {
        userId: req.user!.id,
        status: status as 'ACTIVE' | 'COMPLETED' | 'ABANDONED',
      },
      include: { milestones: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(goals);
  } catch (error) {
    next(error);
  }
});

// GET /api/goals/suggestions (must be before /:id route)
router.get('/suggestions', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const suggestions: Array<{
      id: string;
      type: 'TIME' | 'TOPIC' | 'OUTCOME';
      title: string;
      description: string;
      targetValue?: number;
      targetUnit?: string;
      reason: string;
    }> = [];

    // Get user's learning history
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get completed sessions in the last 30 days
    const recentSessions = await prisma.lesson.findMany({
      where: {
        userId: req.user!.id,
        status: 'COMPLETED',
        completedAt: { gte: thirtyDaysAgo },
      },
    });

    // Get user's topics
    const topics = await prisma.topic.findMany({
      where: { userId: req.user!.id },
    });

    // Get user's existing active goals to avoid duplicates
    const existingGoals = await prisma.goal.findMany({
      where: { userId: req.user!.id, status: 'ACTIVE' },
    });

    const existingGoalTitles = existingGoals.map(g => g.title.toLowerCase());

    // Suggestion 1: Time-based goal based on average session time
    if (recentSessions.length >= 3) {
      const totalMinutes = recentSessions.reduce((sum, session) => {
        if (session.completedAt && session.startedAt) {
          return sum + (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / (1000 * 60);
        }
        return sum;
      }, 0);
      const avgMinutesPerSession = Math.round(totalMinutes / recentSessions.length);

      if (avgMinutesPerSession >= 10 && !existingGoalTitles.some(t => t.includes('minute') || t.includes('hour'))) {
        const suggestedMinutes = Math.max(15, Math.round(avgMinutesPerSession * 1.2 / 5) * 5);
        suggestions.push({
          id: 'time-daily',
          type: 'TIME',
          title: `Learn for ${suggestedMinutes} minutes daily`,
          description: `Build a consistent learning habit with daily practice`,
          targetValue: suggestedMinutes,
          targetUnit: 'minutes',
          reason: `Based on your average session time of ${avgMinutesPerSession} minutes`,
        });
      }
    }

    // Suggestion 2: Topic-based goal based on topics in progress
    const introducedTopics = topics.filter(t => t.masteryLevel === 'INTRODUCED');
    const developingTopics = topics.filter(t => t.masteryLevel === 'DEVELOPING');

    if (introducedTopics.length + developingTopics.length >= 2 && !existingGoalTitles.some(t => t.includes('topic'))) {
      const targetTopics = Math.min(10, Math.max(5, introducedTopics.length + developingTopics.length));
      suggestions.push({
        id: 'topic-mastery',
        type: 'TOPIC',
        title: `Master ${targetTopics} topics`,
        description: `Advance your knowledge by reaching mastery level`,
        targetValue: targetTopics,
        targetUnit: 'topics',
        reason: `You have ${introducedTopics.length + developingTopics.length} topics in progress`,
      });
    }

    // Suggestion 3: Outcome-based goal based on channel patterns
    const channelSessionCounts: Record<string, { count: number; name: string }> = {};
    for (const session of recentSessions) {
      if (session.channelId && session.channelName) {
        if (!channelSessionCounts[session.channelId]) {
          channelSessionCounts[session.channelId] = { count: 0, name: session.channelName };
        }
        channelSessionCounts[session.channelId].count++;
      }
    }

    const topChannel = Object.entries(channelSessionCounts)
      .sort((a, b) => b[1].count - a[1].count)[0];

    if (topChannel && topChannel[1].count >= 3 && !existingGoalTitles.some(t => t.toLowerCase().includes(topChannel[1].name.toLowerCase()))) {
      suggestions.push({
        id: 'channel-series',
        type: 'OUTCOME',
        title: `Complete a ${topChannel[1].name} learning path`,
        description: `Finish a comprehensive course or series from this channel`,
        reason: `You've watched ${topChannel[1].count} videos from ${topChannel[1].name}`,
      });
    }

    // Suggestion 4: If user has no activity, suggest starting goals
    if (recentSessions.length === 0 && suggestions.length === 0) {
      suggestions.push({
        id: 'getting-started',
        type: 'TIME',
        title: `Learn for 15 minutes daily`,
        description: `Start your learning journey with achievable daily goals`,
        targetValue: 15,
        targetUnit: 'minutes',
        reason: `A great starting point for building learning habits`,
      });

      suggestions.push({
        id: 'first-topics',
        type: 'TOPIC',
        title: `Complete 5 topics`,
        description: `Build a foundation of knowledge`,
        targetValue: 5,
        targetUnit: 'topics',
        reason: `Perfect for getting started with structured learning`,
      });
    }

    // Suggestion 5: Weekly time goal if daily exists
    if (existingGoalTitles.some(t => t.includes('daily')) && !existingGoalTitles.some(t => t.includes('weekly'))) {
      suggestions.push({
        id: 'time-weekly',
        type: 'TIME',
        title: `Learn for 3 hours weekly`,
        description: `Maintain consistent weekly progress`,
        targetValue: 180,
        targetUnit: 'minutes',
        reason: `Level up your daily habit with weekly targets`,
      });
    }

    res.json(suggestions.slice(0, 5)); // Return max 5 suggestions
  } catch (error) {
    next(error);
  }
});

// GET /api/goals/approaching-deadlines (must be before /:id route)
router.get('/approaching-deadlines', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 7;
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const goals = await prisma.goal.findMany({
      where: {
        userId: req.user!.id,
        status: 'ACTIVE',
        deadline: {
          not: null,
          lte: futureDate,
          gte: now,
        },
      },
      include: { milestones: true },
      orderBy: { deadline: 'asc' },
    });

    // Calculate days remaining and predicted completion for each goal
    const goalsWithPrediction = goals.map((goal) => {
      const daysRemaining = goal.deadline
        ? Math.ceil((new Date(goal.deadline).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      const progress = goal.targetValue
        ? (goal.currentValue / goal.targetValue) * 100
        : 0;

      // Predict if goal will be completed on time based on current progress rate
      const daysSinceCreated = Math.max(1, Math.ceil((now.getTime() - new Date(goal.createdAt).getTime()) / (24 * 60 * 60 * 1000)));
      const progressPerDay = progress / daysSinceCreated;
      const daysToComplete = progressPerDay > 0 ? (100 - progress) / progressPerDay : Infinity;
      const predictedOnTime = daysRemaining !== null ? daysToComplete <= daysRemaining : true;

      return {
        ...goal,
        daysRemaining,
        progressPercentage: Math.round(progress),
        predictedOnTime,
      };
    });

    res.json(goalsWithPrediction);
  } catch (error) {
    next(error);
  }
});

// POST /api/goals
router.post('/', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = createGoalSchema.parse(req.body);

    const goal = await prisma.goal.create({
      data: {
        userId: req.user!.id,
        title: data.title,
        goalType: data.goalType,
        targetValue: data.targetValue,
        targetUnit: data.targetUnit,
        deadline: data.deadline ? new Date(data.deadline) : null,
        milestones: {
          create: [
            { milestonePercentage: 25 },
            { milestonePercentage: 50 },
            { milestonePercentage: 75 },
            { milestonePercentage: 100 },
          ],
        },
      },
      include: { milestones: true },
    });

    res.status(201).json(goal);
  } catch (error) {
    next(error);
  }
});

// GET /api/goals/:id
router.get('/:id', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const goal = await prisma.goal.findFirst({
      where: { id, userId: req.user!.id },
      include: { milestones: true },
    });

    if (!goal) {
      throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
    }

    res.json(goal);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/goals/:id
router.patch('/:id', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const goal = await prisma.goal.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!goal) {
      throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
    }

    const updated = await prisma.goal.update({
      where: { id },
      data: {
        ...req.body,
        ...(req.body.deadline && { deadline: new Date(req.body.deadline) }),
      },
      include: { milestones: true },
    });

    // Check for milestone completion
    if (updated.targetValue && updated.currentValue) {
      const percentage = (updated.currentValue / updated.targetValue) * 100;
      const milestones = await prisma.goalMilestone.findMany({
        where: { goalId: updated.id, reachedAt: null },
      });

      for (const milestone of milestones) {
        if (percentage >= milestone.milestonePercentage) {
          await prisma.goalMilestone.update({
            where: { id: milestone.id },
            data: { reachedAt: new Date() },
          });
        }
      }

      // Check for goal completion
      if (percentage >= 100 && updated.status === 'ACTIVE') {
        await prisma.goal.update({
          where: { id: updated.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/goals/:id
router.delete('/:id', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const goal = await prisma.goal.deleteMany({
      where: { id, userId: req.user!.id },
    });

    if (goal.count === 0) {
      throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
    }

    res.json({ message: 'Goal deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/goals/:id/milestones
router.get('/:id/milestones', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const goal = await prisma.goal.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!goal) {
      throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
    }

    const milestones = await prisma.goalMilestone.findMany({
      where: { goalId: id },
      orderBy: { milestonePercentage: 'asc' },
    });

    res.json(milestones);
  } catch (error) {
    next(error);
  }
});

export default router;
