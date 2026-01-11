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
