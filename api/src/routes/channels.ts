import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/channels
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const channels = await prisma.followedChannel.findMany({
      where: { userId: req.user!.id },
      orderBy: { followedAt: 'desc' },
    });

    res.json(channels);
  } catch (error) {
    next(error);
  }
});

// POST /api/channels/:channelId/follow
router.post('/:channelId/follow', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { channelId } = req.params;
    const { channelName, channelThumbnail } = req.body;

    const channel = await prisma.followedChannel.upsert({
      where: {
        userId_channelId: {
          userId: req.user!.id,
          channelId,
        },
      },
      update: {},
      create: {
        userId: req.user!.id,
        channelId,
        channelName: channelName || 'Unknown Channel',
        channelThumbnail,
      },
    });

    res.status(201).json(channel);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/channels/:channelId/unfollow
router.delete('/:channelId/unfollow', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { channelId } = req.params;

    await prisma.followedChannel.deleteMany({
      where: {
        userId: req.user!.id,
        channelId,
      },
    });

    res.json({ message: 'Channel unfollowed' });
  } catch (error) {
    next(error);
  }
});

// GET /api/channels/feed
router.get('/feed', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const followedChannels = await prisma.followedChannel.findMany({
      where: { userId: req.user!.id },
    });

    const channelIds = followedChannels.map(c => c.channelId);

    // Get sessions from followed channels
    const sessions = await prisma.session.findMany({
      where: {
        channelId: { in: channelIds },
        userId: req.user!.id,
      },
      select: { videoId: true },
    });

    const watchedVideoIds = sessions.map(s => s.videoId);

    // Return placeholder feed - in production this would fetch from YouTube API
    res.json({
      channels: followedChannels,
      watchedVideoIds,
      feed: [], // Would be populated with videos from YouTube API
    });
  } catch (error) {
    next(error);
  }
});

export default router;
