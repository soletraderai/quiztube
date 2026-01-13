import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/recommendations - Get personalized recommendations
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { limit = '5' } = req.query;
    const resultLimit = Math.min(parseInt(limit as string) || 5, 20);
    const now = new Date();

    // 1. Topics that need review (low mastery)
    const reviewNeededTopics = await prisma.topic.findMany({
      where: {
        userId: req.user!.id,
        masteryLevel: {
          in: ['INTRODUCED', 'DEVELOPING'],
        },
      },
      orderBy: [
        { masteryLevel: 'asc' },
        { lastReviewedAt: 'asc' },
      ],
      take: resultLimit,
      include: {
        session: {
          select: {
            id: true,
            videoTitle: true,
            videoThumbnail: true,
            channelName: true,
          },
        },
        questions: {
          select: {
            id: true,
            isCorrect: true,
          },
        },
      },
    });

    // 2. Continue series - channels with recent activity but incomplete learning
    const recentChannels = await prisma.session.groupBy({
      by: ['channelId', 'channelName'],
      where: {
        userId: req.user!.id,
        status: 'COMPLETED',
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: resultLimit,
    });

    // Get more details about each channel's sessions
    const continueSeries = await Promise.all(
      recentChannels.map(async (channel) => {
        const sessions = await prisma.session.findMany({
          where: {
            userId: req.user!.id,
            channelId: channel.channelId,
            status: 'COMPLETED',
          },
          orderBy: { completedAt: 'desc' },
          take: 3,
          select: {
            id: true,
            videoTitle: true,
            videoThumbnail: true,
            completedAt: true,
            questionsCorrect: true,
            questionsAnswered: true,
          },
        });

        // Find topics from this channel that need more work
        const needsWorkTopics = await prisma.topic.count({
          where: {
            userId: req.user!.id,
            session: { channelId: channel.channelId },
            masteryLevel: { in: ['INTRODUCED', 'DEVELOPING'] },
          },
        });

        return {
          channel_id: channel.channelId,
          channel_name: channel.channelName,
          sessions_completed: channel._count.id,
          topics_need_work: needsWorkTopics,
          recent_sessions: sessions.map((s) => ({
            id: s.id,
            title: s.videoTitle,
            thumbnail: s.videoThumbnail,
            completed_at: s.completedAt,
            accuracy: s.questionsAnswered > 0
              ? Math.round((s.questionsCorrect / s.questionsAnswered) * 100)
              : null,
          })),
        };
      })
    );

    // 3. Topics due for spaced repetition review
    const dueForReview = await prisma.topic.findMany({
      where: {
        userId: req.user!.id,
        nextReviewDate: {
          lte: now,
        },
        masteryLevel: {
          not: 'MASTERED',
        },
      },
      orderBy: [
        { nextReviewDate: 'asc' },
        { masteryLevel: 'asc' },
      ],
      take: resultLimit,
      include: {
        session: {
          select: {
            id: true,
            videoTitle: true,
            videoThumbnail: true,
            channelName: true,
          },
        },
      },
    });

    // Calculate overall stats
    const totalTopics = await prisma.topic.count({
      where: { userId: req.user!.id },
    });

    const masteredTopics = await prisma.topic.count({
      where: {
        userId: req.user!.id,
        masteryLevel: 'MASTERED',
      },
    });

    res.json({
      review_needed: reviewNeededTopics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        mastery_level: topic.masteryLevel,
        review_count: topic.reviewCount,
        last_reviewed_at: topic.lastReviewedAt,
        session: {
          id: topic.session.id,
          title: topic.session.videoTitle,
          thumbnail: topic.session.videoThumbnail,
          channel: topic.session.channelName,
        },
        questions_total: topic.questions.length,
        questions_correct: topic.questions.filter((q) => q.isCorrect === true).length,
      })),
      continue_series: continueSeries.filter((c) => c.topics_need_work > 0),
      due_for_review: dueForReview.map((topic) => ({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        mastery_level: topic.masteryLevel,
        next_review_date: topic.nextReviewDate,
        review_interval_days: topic.reviewIntervalDays,
        session: {
          id: topic.session.id,
          title: topic.session.videoTitle,
          thumbnail: topic.session.videoThumbnail,
          channel: topic.session.channelName,
        },
      })),
      stats: {
        total_topics: totalTopics,
        mastered_topics: masteredTopics,
        mastery_percentage: totalTopics > 0
          ? Math.round((masteredTopics / totalTopics) * 100)
          : 0,
        due_for_review_count: dueForReview.length,
        review_needed_count: reviewNeededTopics.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/recommendations/daily - Get daily learning recommendations
router.get('/daily', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get user's preferences
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.id },
    });

    const maxReviews = preferences?.maxDailyReviews || 20;
    const commitmentMinutes = preferences?.dailyCommitmentMinutes || 15;

    // Get today's completed reviews
    const completedToday = await prisma.topic.count({
      where: {
        userId: req.user!.id,
        lastReviewedAt: { gte: startOfDay },
      },
    });

    // Get topics due for review (not yet reviewed today)
    const pendingReviews = await prisma.topic.findMany({
      where: {
        userId: req.user!.id,
        nextReviewDate: { lte: now },
        OR: [
          { lastReviewedAt: null },
          { lastReviewedAt: { lt: startOfDay } },
        ],
      },
      orderBy: [
        { nextReviewDate: 'asc' },
        { reviewIntervalDays: 'asc' },
      ],
      take: maxReviews - completedToday,
      include: {
        session: {
          select: {
            id: true,
            videoTitle: true,
            videoThumbnail: true,
            channelName: true,
          },
        },
      },
    });

    // Estimate time needed
    const estimatedMinutesPerReview = 3;
    const estimatedTotalMinutes = pendingReviews.length * estimatedMinutesPerReview;

    res.json({
      daily_goal: {
        commitment_minutes: commitmentMinutes,
        max_reviews: maxReviews,
        completed_reviews: completedToday,
        remaining_reviews: Math.max(0, maxReviews - completedToday),
        progress_percentage: Math.min(100, Math.round((completedToday / maxReviews) * 100)),
      },
      pending_reviews: pendingReviews.map((topic) => ({
        id: topic.id,
        name: topic.name,
        mastery_level: topic.masteryLevel,
        days_overdue: topic.nextReviewDate
          ? Math.max(0, Math.floor((now.getTime() - topic.nextReviewDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 0,
        session: {
          id: topic.session.id,
          title: topic.session.videoTitle,
          thumbnail: topic.session.videoThumbnail,
          channel: topic.session.channelName,
        },
      })),
      estimated_time_minutes: estimatedTotalMinutes,
      on_track: completedToday >= Math.floor(maxReviews / 2) ||
        pendingReviews.length === 0,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
