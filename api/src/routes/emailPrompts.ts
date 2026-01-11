import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requirePro } from '../middleware/auth.js';

const router = Router();

// GET /api/email-prompts/settings
router.get('/settings', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.id },
    });

    res.json({
      enabled: preferences?.emailPromptsEnabled || false,
      frequency: preferences?.emailPromptsFrequency || 3,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/email-prompts/settings
router.put('/settings', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { enabled, frequency } = req.body;

    const preferences = await prisma.userPreferences.update({
      where: { userId: req.user!.id },
      data: {
        emailPromptsEnabled: enabled,
        emailPromptsFrequency: frequency,
      },
    });

    res.json({
      enabled: preferences.emailPromptsEnabled,
      frequency: preferences.emailPromptsFrequency,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/email-prompts/history
router.get('/history', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const prompts = await prisma.emailPrompt.findMany({
      where: { userId: req.user!.id },
      include: { topic: true },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });

    res.json(prompts);
  } catch (error) {
    next(error);
  }
});

export default router;
