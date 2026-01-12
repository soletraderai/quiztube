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
    const channelId = req.params.channelId as string;
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
    const channelId = req.params.channelId as string;

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

// GET /api/channels/search
router.get('/search', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.q as string || '').toLowerCase().trim();

    // Get all channels from user's sessions
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.id },
      select: {
        channelId: true,
        channelName: true,
      },
      distinct: ['channelId'],
    });

    // Get followed channels
    const followedChannels = await prisma.followedChannel.findMany({
      where: { userId: req.user!.id },
      select: { channelId: true },
    });

    const followedIds = new Set(followedChannels.map(c => c.channelId));

    // Filter channels: match search query and not already followed
    const results = sessions
      .filter(s => s.channelId && s.channelName)
      .filter(s => !followedIds.has(s.channelId!))
      .filter(s => !query || s.channelName!.toLowerCase().includes(query))
      .map(s => ({
        channelId: s.channelId,
        channelName: s.channelName,
      }));

    // Remove duplicates by channelId
    const uniqueResults = Array.from(
      new Map(results.map(r => [r.channelId, r])).values()
    );

    res.json(uniqueResults);
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

    // Get sessions from followed channels (for tracking watched videos)
    const userSessions = await prisma.session.findMany({
      where: {
        channelId: { in: channelIds },
        userId: req.user!.id,
      },
      select: { videoId: true },
    });

    const watchedVideoIds = userSessions.map(s => s.videoId);

    // Get recent videos from followed channels to show in feed
    // These are videos from sessions that can be clicked to start a new learning session
    const feedVideos = await prisma.session.findMany({
      where: {
        channelId: { in: channelIds.length > 0 ? channelIds : ['_no_channels_'] },
      },
      select: {
        videoId: true,
        videoUrl: true,
        videoTitle: true,
        videoThumbnail: true,
        videoDuration: true,
        channelId: true,
        channelName: true,
        createdAt: true,
      },
      distinct: ['videoId'],
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Filter out videos the user has already watched
    const userWatchedSet = new Set(watchedVideoIds);
    const unwatchedFeed = feedVideos.filter(v => !userWatchedSet.has(v.videoId));

    res.json({
      channels: followedChannels,
      watchedVideoIds,
      feed: unwatchedFeed, // Videos from followed channels the user hasn't watched
    });
  } catch (error) {
    next(error);
  }
});

export default router;
