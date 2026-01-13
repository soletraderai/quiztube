import { Router, Response, NextFunction, Request } from 'express';
import crypto from 'crypto';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requirePro } from '../middleware/auth.js';

const router = Router();

// Generate unsubscribe token from user ID (simple hash)
export function generateUnsubscribeToken(userId: string): string {
  const secret = process.env.JWT_SECRET || 'teachy-secret';
  return crypto.createHmac('sha256', secret).update(userId).digest('hex').slice(0, 32);
}

// Verify unsubscribe token
export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expectedToken = generateUnsubscribeToken(userId);
  return token === expectedToken;
}

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

// GET /api/email-prompts/unsubscribe - Unsubscribe from email prompts (no auth required)
// This endpoint is accessible via link in emails
router.get('/unsubscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, token } = req.query;

    if (!userId || !token || typeof userId !== 'string' || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid unsubscribe link' });
    }

    // Verify token
    if (!verifyUnsubscribeToken(userId, token)) {
      return res.status(400).json({ error: 'Invalid unsubscribe token' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Disable email prompts
    await prisma.userPreferences.update({
      where: { userId },
      data: { emailPromptsEnabled: false },
    });

    res.json({
      success: true,
      message: 'You have been unsubscribed from email prompts',
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
