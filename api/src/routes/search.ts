import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/search - Live search with autocomplete support
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { q, limit = '5', type = 'all' } = req.query;
    const query = (q as string || '').toLowerCase().trim();
    const resultLimit = Math.min(parseInt(limit as string) || 5, 20);

    if (!query || query.length < 2) {
      return res.json({
        results: [],
        query,
        totalCount: 0,
      });
    }

    const results: Array<{
      id: string;
      type: 'session' | 'topic' | 'channel';
      title: string;
      subtitle?: string;
      thumbnail?: string;
      channel?: string;
      url?: string;
    }> = [];

    // Search sessions
    if (type === 'all' || type === 'sessions') {
      const sessions = await prisma.lesson.findMany({
        where: {
          userId: req.user!.id,
          OR: [
            { videoTitle: { contains: query, mode: 'insensitive' } },
            { channelName: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: resultLimit,
        select: {
          id: true,
          videoTitle: true,
          videoThumbnail: true,
          channelName: true,
          videoUrl: true,
          createdAt: true,
        },
      });

      sessions.forEach(session => {
        results.push({
          id: session.id,
          type: 'session',
          title: session.videoTitle,
          subtitle: `${session.channelName} • ${session.createdAt.toLocaleDateString()}`,
          thumbnail: session.videoThumbnail,
          channel: session.channelName,
          url: `/session/${session.id}/notes`,
        });
      });
    }

    // Search topics
    if (type === 'all' || type === 'topics') {
      const topics = await prisma.topic.findMany({
        where: {
          userId: req.user!.id,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: resultLimit,
        include: {
          session: {
            select: {
              videoTitle: true,
              videoThumbnail: true,
            },
          },
        },
      });

      topics.forEach(topic => {
        results.push({
          id: topic.id,
          type: 'topic',
          title: topic.name,
          subtitle: `From: ${topic.session.videoTitle}`,
          thumbnail: topic.session.videoThumbnail,
          url: `/session/${topic.sessionId}/notes`,
        });
      });
    }

    // Search channels
    if (type === 'all' || type === 'channels') {
      const channels = await prisma.followedChannel.findMany({
        where: {
          userId: req.user!.id,
          channelName: { contains: query, mode: 'insensitive' },
        },
        take: resultLimit,
      });

      channels.forEach(channel => {
        results.push({
          id: channel.id,
          type: 'channel',
          title: channel.channelName,
          subtitle: `${channel.sessionsCompleted} sessions completed`,
          thumbnail: channel.channelThumbnail || undefined,
          channel: channel.channelName,
          url: `/feed?channel=${channel.channelId}`,
        });
      });
    }

    // Log the search
    await prisma.searchLog.create({
      data: {
        userId: req.user!.id,
        query,
        resultsCount: results.length,
      },
    });

    // Update recent searches (upsert to update timestamp if exists)
    await prisma.recentSearch.upsert({
      where: {
        userId_query: {
          userId: req.user!.id,
          query,
        },
      },
      update: {
        searchedAt: new Date(),
      },
      create: {
        userId: req.user!.id,
        query,
      },
    });

    res.json({
      results: results.slice(0, resultLimit),
      query,
      totalCount: results.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/search/recent - Get recent searches for user
router.get('/recent', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { limit = '5' } = req.query;
    const resultLimit = Math.min(parseInt(limit as string) || 5, 10);

    const recentSearches = await prisma.recentSearch.findMany({
      where: { userId: req.user!.id },
      orderBy: { searchedAt: 'desc' },
      take: resultLimit,
    });

    res.json({
      searches: recentSearches.map(s => ({
        id: s.id,
        query: s.query,
        searchedAt: s.searchedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/search/recent/:id - Delete a recent search
router.delete('/recent/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    await prisma.recentSearch.deleteMany({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/search/recent - Clear all recent searches
router.delete('/recent', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.recentSearch.deleteMany({
      where: { userId: req.user!.id },
    });

    res.json({ success: true, message: 'All recent searches cleared' });
  } catch (error) {
    next(error);
  }
});

export default router;
