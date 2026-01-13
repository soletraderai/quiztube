import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { LearningPathStatus, LearningPathItemStatus } from '@prisma/client';

const router = Router();

// POST /api/learning-paths - Create a new learning path
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { title, description, items } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Create learning path with items if provided
    const learningPath = await prisma.learningPath.create({
      data: {
        userId: req.user!.id,
        title: title.trim(),
        description: description?.trim() || null,
        itemsTotal: items?.length || 0,
        items: items ? {
          create: items.map((item: {
            video_id?: string;
            video_url?: string;
            video_title?: string;
            video_thumbnail?: string;
            channel_name?: string;
          }, index: number) => ({
            videoId: item.video_id,
            videoUrl: item.video_url,
            videoTitle: item.video_title,
            videoThumbnail: item.video_thumbnail,
            channelName: item.channel_name,
            sortOrder: index,
          })),
        } : undefined,
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.status(201).json({
      id: learningPath.id,
      title: learningPath.title,
      description: learningPath.description,
      status: learningPath.status,
      items_total: learningPath.itemsTotal,
      items_completed: learningPath.itemsCompleted,
      created_at: learningPath.createdAt,
      items: learningPath.items.map((item) => ({
        id: item.id,
        video_id: item.videoId,
        video_url: item.videoUrl,
        video_title: item.videoTitle,
        video_thumbnail: item.videoThumbnail,
        channel_name: item.channelName,
        status: item.status,
        sort_order: item.sortOrder,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/learning-paths - List all learning paths
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, limit = '20', offset = '0' } = req.query;
    const resultLimit = Math.min(parseInt(limit as string) || 20, 100);
    const resultOffset = parseInt(offset as string) || 0;

    const where: {
      userId: string;
      status?: LearningPathStatus;
    } = {
      userId: req.user!.id,
    };

    if (status && ['ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED'].includes(status as string)) {
      where.status = status as LearningPathStatus;
    }

    const [learningPaths, totalCount] = await Promise.all([
      prisma.learningPath.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: resultLimit,
        skip: resultOffset,
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            take: 5, // Preview of first 5 items
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.learningPath.count({ where }),
    ]);

    res.json({
      learning_paths: learningPaths.map((path) => ({
        id: path.id,
        title: path.title,
        description: path.description,
        status: path.status,
        items_total: path.itemsTotal,
        items_completed: path.itemsCompleted,
        progress_percentage: path.itemsTotal > 0
          ? Math.round((path.itemsCompleted / path.itemsTotal) * 100)
          : 0,
        created_at: path.createdAt,
        updated_at: path.updatedAt,
        preview_items: path.items.map((item) => ({
          id: item.id,
          video_title: item.videoTitle,
          video_thumbnail: item.videoThumbnail,
          status: item.status,
        })),
      })),
      total: totalCount,
      limit: resultLimit,
      offset: resultOffset,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/learning-paths/:id - Get a single learning path with all items
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const learningPath = await prisma.learningPath.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!learningPath) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    res.json({
      id: learningPath.id,
      title: learningPath.title,
      description: learningPath.description,
      status: learningPath.status,
      items_total: learningPath.itemsTotal,
      items_completed: learningPath.itemsCompleted,
      progress_percentage: learningPath.itemsTotal > 0
        ? Math.round((learningPath.itemsCompleted / learningPath.itemsTotal) * 100)
        : 0,
      created_at: learningPath.createdAt,
      updated_at: learningPath.updatedAt,
      items: learningPath.items.map((item) => ({
        id: item.id,
        video_id: item.videoId,
        video_url: item.videoUrl,
        video_title: item.videoTitle,
        video_thumbnail: item.videoThumbnail,
        channel_name: item.channelName,
        status: item.status,
        sort_order: item.sortOrder,
        completed_at: item.completedAt,
        skipped: item.skipped,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/learning-paths/:id - Update a learning path
router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;

    // Verify ownership
    const existing = await prisma.learningPath.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    // Build update data
    const updateData: {
      title?: string;
      description?: string | null;
      status?: LearningPathStatus;
    } = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      updateData.title = title.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (status !== undefined) {
      if (!['ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status. Must be one of: ACTIVE, COMPLETED, PAUSED, ARCHIVED',
        });
      }
      updateData.status = status as LearningPathStatus;
    }

    const learningPath = await prisma.learningPath.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.json({
      id: learningPath.id,
      title: learningPath.title,
      description: learningPath.description,
      status: learningPath.status,
      items_total: learningPath.itemsTotal,
      items_completed: learningPath.itemsCompleted,
      updated_at: learningPath.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/learning-paths/:id - Delete a learning path
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.learningPath.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    await prisma.learningPath.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Learning path deleted' });
  } catch (error) {
    next(error);
  }
});

// POST /api/learning-paths/:id/items - Add item to a learning path
router.post('/:id/items', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { video_id, video_url, video_title, video_thumbnail, channel_name } = req.body;

    // Verify ownership
    const learningPath = await prisma.learningPath.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: {
        items: {
          orderBy: { sortOrder: 'desc' },
          take: 1,
        },
      },
    });

    if (!learningPath) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    // Get next sort order
    const nextSortOrder = learningPath.items.length > 0
      ? learningPath.items[0].sortOrder + 1
      : 0;

    // Create item and update total count
    const [item] = await prisma.$transaction([
      prisma.learningPathItem.create({
        data: {
          learningPathId: id,
          videoId: video_id,
          videoUrl: video_url,
          videoTitle: video_title,
          videoThumbnail: video_thumbnail,
          channelName: channel_name,
          sortOrder: nextSortOrder,
        },
      }),
      prisma.learningPath.update({
        where: { id },
        data: { itemsTotal: { increment: 1 } },
      }),
    ]);

    res.status(201).json({
      id: item.id,
      video_id: item.videoId,
      video_url: item.videoUrl,
      video_title: item.videoTitle,
      video_thumbnail: item.videoThumbnail,
      channel_name: item.channelName,
      status: item.status,
      sort_order: item.sortOrder,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/learning-paths/:id/items/:itemId - Update item status
router.patch('/:id/items/:itemId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id, itemId } = req.params;
    const { status, sort_order } = req.body;

    // Verify ownership
    const learningPath = await prisma.learningPath.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!learningPath) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    const existingItem = await prisma.learningPathItem.findFirst({
      where: {
        id: itemId,
        learningPathId: id,
      },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updateData: {
      status?: LearningPathItemStatus;
      sortOrder?: number;
      completedAt?: Date | null;
      skipped?: boolean;
    } = {};

    if (status !== undefined) {
      if (!['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status. Must be one of: PENDING, IN_PROGRESS, COMPLETED, SKIPPED',
        });
      }
      updateData.status = status as LearningPathItemStatus;

      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      } else if (status === 'SKIPPED') {
        updateData.skipped = true;
      }
    }

    if (sort_order !== undefined && typeof sort_order === 'number') {
      updateData.sortOrder = sort_order;
    }

    const item = await prisma.learningPathItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Update completed count if status changed to/from completed
    if (status !== undefined) {
      const wasCompleted = existingItem.status === 'COMPLETED';
      const isCompleted = status === 'COMPLETED';

      if (wasCompleted !== isCompleted) {
        await prisma.learningPath.update({
          where: { id },
          data: {
            itemsCompleted: {
              [isCompleted ? 'increment' : 'decrement']: 1,
            },
          },
        });
      }
    }

    res.json({
      id: item.id,
      video_id: item.videoId,
      video_url: item.videoUrl,
      video_title: item.videoTitle,
      status: item.status,
      sort_order: item.sortOrder,
      completed_at: item.completedAt,
      skipped: item.skipped,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/learning-paths/:id/items/:itemId - Remove item from path
router.delete('/:id/items/:itemId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id, itemId } = req.params;

    // Verify ownership
    const learningPath = await prisma.learningPath.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!learningPath) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    const item = await prisma.learningPathItem.findFirst({
      where: {
        id: itemId,
        learningPathId: id,
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete item and update counts
    await prisma.$transaction([
      prisma.learningPathItem.delete({
        where: { id: itemId },
      }),
      prisma.learningPath.update({
        where: { id },
        data: {
          itemsTotal: { decrement: 1 },
          itemsCompleted: item.status === 'COMPLETED'
            ? { decrement: 1 }
            : undefined,
        },
      }),
    ]);

    res.json({ success: true, message: 'Item removed from learning path' });
  } catch (error) {
    next(error);
  }
});

// POST /api/learning-paths/:id/reorder - Reorder items
router.post('/:id/reorder', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { item_ids } = req.body;

    if (!Array.isArray(item_ids)) {
      return res.status(400).json({ error: 'item_ids must be an array' });
    }

    // Verify ownership
    const learningPath = await prisma.learningPath.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!learningPath) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    // Update sort orders
    await prisma.$transaction(
      item_ids.map((itemId: string, index: number) =>
        prisma.learningPathItem.updateMany({
          where: {
            id: itemId,
            learningPathId: id,
          },
          data: { sortOrder: index },
        })
      )
    );

    res.json({ success: true, message: 'Items reordered' });
  } catch (error) {
    next(error);
  }
});

export default router;
