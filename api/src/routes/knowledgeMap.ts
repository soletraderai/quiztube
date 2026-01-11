import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requirePro } from '../middleware/auth.js';

const router = Router();

// GET /api/knowledge-map
router.get('/', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const topics = await prisma.topic.findMany({
      where: { userId: req.user!.id },
      include: {
        session: {
          select: { videoTitle: true },
        },
      },
    });

    // Create nodes for the map
    const nodes = topics.map(topic => ({
      id: topic.id,
      name: topic.name,
      category: topic.category,
      masteryLevel: topic.masteryLevel,
      reviewCount: topic.reviewCount,
      sessionTitle: topic.session.videoTitle,
    }));

    // Create connections based on shared categories and sessions
    const connections: Array<{ source: string; target: string; strength: number }> = [];

    for (let i = 0; i < topics.length; i++) {
      for (let j = i + 1; j < topics.length; j++) {
        const topic1 = topics[i];
        const topic2 = topics[j];

        let strength = 0;

        // Same session = strong connection
        if (topic1.sessionId === topic2.sessionId) {
          strength += 3;
        }

        // Same category = medium connection
        if (topic1.category && topic1.category === topic2.category) {
          strength += 2;
        }

        if (strength > 0) {
          connections.push({
            source: topic1.id,
            target: topic2.id,
            strength,
          });
        }
      }
    }

    // Group by category
    const categories = [...new Set(topics.map(t => t.category).filter(Boolean))];

    res.json({
      nodes,
      connections,
      categories,
      totalTopics: topics.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/knowledge-map/export-image
router.get('/export-image', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // This would typically render the map server-side and return an image
    // For now, return instructions for client-side rendering
    res.json({
      message: 'Use client-side rendering to export the map as an image',
      instructions: 'Call html2canvas or similar on the map component',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
