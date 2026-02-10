import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Validation schemas
const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

const updatePreferencesSchema = z.object({
  learningPurpose: z.enum(['CAREER', 'SKILLS', 'EXAM', 'CURIOSITY']).optional(),
  learningStyle: z.enum(['QUICK', 'THOROUGH', 'CHALLENGING']).optional(),
  tutorPersonality: z.enum(['PROFESSOR', 'COACH', 'DIRECT', 'CREATIVE']).optional(),
  languageVariant: z.enum(['BRITISH', 'AMERICAN', 'AUSTRALIAN']).optional(),
  dailyCommitmentMinutes: z.number().min(5).max(120).optional(),
  preferredTime: z.string().optional().nullable(),
  preferredDays: z.array(z.string()).optional(),
  emailPromptsEnabled: z.boolean().optional(),
  emailPromptsFrequency: z.number().min(1).max(5).optional(),
  pushNotificationsEnabled: z.boolean().optional(),
  timezone: z.string().optional(),
  quietHoursStart: z.string().optional().nullable(),
  quietHoursEnd: z.string().optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
  onboardingStep: z.number().optional(),
  maxDailyReviews: z.number().min(1).max(100).optional(),
});

// GET /api/users/profile
router.get('/profile', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      tier: user.subscription?.tier || 'FREE',
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/profile
router.patch('/profile', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
    });

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/account
router.delete('/account', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Delete user and all related data (cascade)
    await prisma.user.delete({
      where: { id: req.user!.id },
    });

    res.clearCookie('refreshToken');
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/preferences
router.get('/preferences', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.id },
    });

    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: { userId: req.user!.id },
      });
    }

    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/preferences
router.put('/preferences', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = updatePreferencesSchema.parse(req.body);

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: { userId: req.user!.id, ...data },
    });

    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/preferences - partial update
router.patch('/preferences', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = updatePreferencesSchema.parse(req.body);

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: { userId: req.user!.id, ...data },
    });

    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

// POST /api/users/complete-onboarding
router.post('/complete-onboarding', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      tutorPersonality,
      learningStyle,
      languageVariant,
      dailyCommitmentMinutes,
      preferredTime,
      preferredDays
    } = req.body;

    // Map frontend tutor personality to valid enum value
    const validPersonalities = ['PROFESSOR', 'COACH', 'DIRECT', 'CREATIVE'];
    const personality = validPersonalities.includes(tutorPersonality) ? tutorPersonality : 'COACH';

    // Map frontend learning style to valid enum value
    const learningStyleMap: Record<string, string> = {
      'visual': 'THOROUGH',
      'reading': 'THOROUGH',
      'auditory': 'QUICK',
      'kinesthetic': 'CHALLENGING',
    };
    const mappedLearningStyle = learningStyleMap[learningStyle] || 'THOROUGH';

    // Map language variant
    const validLanguageVariants = ['BRITISH', 'AMERICAN', 'AUSTRALIAN'];
    const mappedLanguageVariant = validLanguageVariants.includes(languageVariant) ? languageVariant : 'AMERICAN';

    // Build update data
    const updateData: Record<string, unknown> = {
      tutorPersonality: personality,
      onboardingCompleted: true,
      learningStyle: mappedLearningStyle,
      languageVariant: mappedLanguageVariant,
    };

    if (dailyCommitmentMinutes && typeof dailyCommitmentMinutes === 'number') {
      updateData.dailyCommitmentMinutes = dailyCommitmentMinutes;
    }

    if (preferredTime) {
      updateData.preferredTime = preferredTime;
    }

    if (preferredDays && Array.isArray(preferredDays)) {
      updateData.preferredDays = preferredDays;
    }

    // Update preferences with onboarding data
    const preferences = await prisma.userPreferences.upsert({
      where: { userId: req.user!.id },
      update: updateData,
      create: { userId: req.user!.id, ...updateData },
    });

    res.json({
      message: 'Onboarding completed successfully',
      preferences,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/me/sidebar-preference
router.get('/me/sidebar-preference', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.id },
      select: { sidebarCollapsed: true },
    });

    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: { userId: req.user!.id },
        select: { sidebarCollapsed: true },
      });
    }

    res.json({
      sidebar_collapsed: preferences.sidebarCollapsed,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/me/sidebar-preference
router.put('/me/sidebar-preference', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sidebar_collapsed } = req.body;

    if (typeof sidebar_collapsed !== 'boolean') {
      return res.status(400).json({ error: 'sidebar_collapsed must be a boolean' });
    }

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: req.user!.id },
      update: { sidebarCollapsed: sidebar_collapsed },
      create: { userId: req.user!.id, sidebarCollapsed: sidebar_collapsed },
      select: { sidebarCollapsed: true },
    });

    res.json({
      sidebar_collapsed: preferences.sidebarCollapsed,
      message: 'Sidebar preference saved',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/migrate-local-data
router.post('/migrate-local-data', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessions } = req.body;

    if (!Array.isArray(sessions)) {
      throw new AppError(400, 'Sessions must be an array', 'INVALID_DATA');
    }

    let migratedCount = 0;
    const errors: string[] = [];

    for (const session of sessions) {
      try {
        // Create session from localStorage data
        await prisma.lesson.create({
          data: {
            userId: req.user!.id,
            videoId: session.video?.id || session.videoId || 'unknown',
            videoTitle: session.video?.title || session.videoTitle || 'Untitled',
            videoUrl: session.video?.url || session.videoUrl || '',
            videoThumbnail: session.video?.thumbnailUrl || session.videoThumbnail || '',
            videoDuration: session.video?.duration || session.videoDuration || 0,
            channelId: session.video?.channelId || 'unknown',
            channelName: session.video?.channel || session.channelName || 'Unknown',
            transcript: session.transcript || '',
            status: session.completedAt ? 'COMPLETED' : 'ABANDONED',
            startedAt: session.createdAt ? new Date(session.createdAt) : null,
            completedAt: session.completedAt ? new Date(session.completedAt) : null,
            questionsAnswered: session.score?.questionsAnswered || 0,
            questionsCorrect: session.score?.questionsCorrect || 0,
            createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
          },
        });
        migratedCount++;
      } catch (err) {
        errors.push(`Failed to migrate session: ${session.id || 'unknown'}`);
      }
    }

    res.json({
      message: 'Migration completed',
      migratedCount,
      errors,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
