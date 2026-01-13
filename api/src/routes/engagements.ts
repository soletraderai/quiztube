import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { EngagementType } from '@prisma/client';

const router = Router();

// POST /api/engagements - Track creator engagement click
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { session_id, channel_id, engagement_type } = req.body;

    // Validate required fields
    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    if (!channel_id) {
      return res.status(400).json({ error: 'channel_id is required' });
    }

    if (!engagement_type) {
      return res.status(400).json({ error: 'engagement_type is required' });
    }

    // Validate engagement_type is a valid enum value
    const validTypes: EngagementType[] = ['LIKE', 'COMMENT', 'SUBSCRIBE'];
    const upperType = engagement_type.toUpperCase() as EngagementType;

    if (!validTypes.includes(upperType)) {
      return res.status(400).json({
        error: 'Invalid engagement_type. Must be one of: LIKE, COMMENT, SUBSCRIBE',
      });
    }

    // Verify session exists and belongs to user
    const session = await prisma.session.findFirst({
      where: {
        id: session_id,
        userId: req.user!.id,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Create the engagement record
    const engagement = await prisma.creatorEngagement.create({
      data: {
        userId: req.user!.id,
        sessionId: session_id,
        channelId: channel_id,
        engagementType: upperType,
      },
    });

    res.status(201).json({
      id: engagement.id,
      session_id: engagement.sessionId,
      channel_id: engagement.channelId,
      engagement_type: engagement.engagementType,
      clicked_at: engagement.clickedAt,
      created_at: engagement.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/engagements - Get user's engagement history
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { session_id, channel_id, type, limit = '50' } = req.query;
    const resultLimit = Math.min(parseInt(limit as string) || 50, 100);

    const where: {
      userId: string;
      sessionId?: string;
      channelId?: string;
      engagementType?: EngagementType;
    } = {
      userId: req.user!.id,
    };

    if (session_id) {
      where.sessionId = session_id as string;
    }

    if (channel_id) {
      where.channelId = channel_id as string;
    }

    if (type) {
      const upperType = (type as string).toUpperCase() as EngagementType;
      if (['LIKE', 'COMMENT', 'SUBSCRIBE'].includes(upperType)) {
        where.engagementType = upperType;
      }
    }

    const engagements = await prisma.creatorEngagement.findMany({
      where,
      orderBy: { clickedAt: 'desc' },
      take: resultLimit,
      include: {
        session: {
          select: {
            videoTitle: true,
            channelName: true,
          },
        },
      },
    });

    res.json({
      engagements: engagements.map(e => ({
        id: e.id,
        session_id: e.sessionId,
        channel_id: e.channelId,
        engagement_type: e.engagementType,
        clicked_at: e.clickedAt,
        video_title: e.session.videoTitle,
        channel_name: e.session.channelName,
      })),
      total: engagements.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/engagements/stats - Get engagement statistics
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { channel_id, days = '30' } = req.query;
    const daysBack = parseInt(days as string) || 30;
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const where: {
      userId: string;
      channelId?: string;
      clickedAt: { gte: Date };
    } = {
      userId: req.user!.id,
      clickedAt: { gte: since },
    };

    if (channel_id) {
      where.channelId = channel_id as string;
    }

    const [likes, comments, subscribes] = await Promise.all([
      prisma.creatorEngagement.count({
        where: { ...where, engagementType: 'LIKE' },
      }),
      prisma.creatorEngagement.count({
        where: { ...where, engagementType: 'COMMENT' },
      }),
      prisma.creatorEngagement.count({
        where: { ...where, engagementType: 'SUBSCRIBE' },
      }),
    ]);

    res.json({
      period_days: daysBack,
      stats: {
        likes,
        comments,
        subscribes,
        total: likes + comments + subscribes,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
