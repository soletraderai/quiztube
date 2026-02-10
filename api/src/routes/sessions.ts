import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/sessions
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [sessions, total] = await Promise.all([
      prisma.lesson.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.lesson.count({ where: { userId: req.user!.id } }),
    ]);

    res.json({
      sessions,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.lesson.findFirst({
      where: { id, userId: req.user!.id },
      include: {
        sources: true,
        topics: { include: { questions: true } },
      },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    res.json(session);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      videoUrl,
      videoId,
      videoTitle,
      videoThumbnail,
      videoDuration,
      channelId,
      channelName,
      transcript,
      status,
      localSessionId,
      sessionData,
    } = req.body;

    // Check session limit for FREE tier users
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    if (!subscription || subscription.tier === 'FREE') {
      // Count sessions created this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const sessionsThisMonth = await prisma.lesson.count({
        where: {
          userId: req.user!.id,
          createdAt: { gte: startOfMonth },
        },
      });

      const FREE_TIER_SESSION_LIMIT = 3;
      if (sessionsThisMonth >= FREE_TIER_SESSION_LIMIT) {
        throw new AppError(
          402,
          'Free tier limited to 3 sessions per month. Upgrade to Pro for unlimited sessions.',
          'SESSION_LIMIT_REACHED'
        );
      }
    }

    const session = await prisma.lesson.create({
      data: {
        userId: req.user!.id,
        videoId: videoId || 'placeholder',
        videoTitle: videoTitle || 'New Session',
        videoUrl: videoUrl || '',
        videoThumbnail: videoThumbnail || '',
        videoDuration: videoDuration || 0,
        channelId: channelId || 'unknown',
        channelName: channelName || 'Unknown',
        transcript: transcript || '',
        status: status || 'SETUP',
        localSessionId: localSessionId || null,
        sessionData: sessionData ? JSON.parse(sessionData) : null,
      },
    });

    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/sessions/:id
router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Parse sessionData if it's a string
    const updateData = { ...req.body };
    if (updateData.sessionData && typeof updateData.sessionData === 'string') {
      updateData.sessionData = JSON.parse(updateData.sessionData);
    }

    const session = await prisma.lesson.updateMany({
      where: { id, userId: req.user!.id },
      data: updateData,
    });

    if (session.count === 0) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const updated = await prisma.lesson.findUnique({ where: { id } });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.lesson.deleteMany({
      where: { id, userId: req.user!.id },
    });

    if (session.count === 0) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    res.json({ message: 'Session deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id/sources
router.get('/:id/sources', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.lesson.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const sources = await prisma.lessonSource.findMany({
      where: { sessionId: id },
    });

    res.json(sources);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/:id/sources - Create knowledge base sources for a session
router.post('/:id/sources', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { sources } = req.body;

    // Verify session belongs to user
    const session = await prisma.lesson.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    if (!sources || !Array.isArray(sources)) {
      throw new AppError(400, 'Sources array is required', 'INVALID_INPUT');
    }

    // Map frontend source types to database enum
    const mapSourceType = (type: string): 'TRANSCRIPT' | 'DOCUMENTATION' | 'REPOSITORY' | 'ARTICLE' | 'ACADEMIC' => {
      switch (type) {
        case 'github':
          return 'REPOSITORY';
        case 'documentation':
          return 'DOCUMENTATION';
        case 'article':
          return 'ARTICLE';
        default:
          return 'ARTICLE';
      }
    };

    // Delete existing sources for this session (in case of re-generation)
    await prisma.lessonSource.deleteMany({
      where: { sessionId: id },
    });

    // Create new sources
    const createdSources = await Promise.all(
      sources.map((source: { url: string; title: string; snippet?: string; type: string }) =>
        prisma.lessonSource.create({
          data: {
            sessionId: id,
            url: source.url,
            title: source.title,
            description: source.snippet || null,
            sourceType: mapSourceType(source.type),
          },
        })
      )
    );

    res.status(201).json(createdSources);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/:id/complete
router.post('/:id/complete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.lesson.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    if (session.status === 'COMPLETED') {
      // Already completed, return without updating channel count
      return res.json(session);
    }

    // Update session status to completed
    const updatedSession = await prisma.lesson.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Update channel session count if user follows this channel
    await prisma.followedChannel.updateMany({
      where: {
        userId: req.user!.id,
        channelId: session.channelId,
      },
      data: {
        sessionsCompleted: { increment: 1 },
        lastSessionAt: new Date(),
      },
    });

    // Update learning model data collection
    const completedAt = new Date();
    const hour = completedAt.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    // Get user's learning model settings
    const learningModel = await prisma.learningModel.findUnique({
      where: { userId: req.user!.id },
    });

    // Only collect if learning model tracking is enabled (default: enabled)
    const shouldCollect = !learningModel || learningModel.timeOfDayEnabled;

    if (shouldCollect) {
      // Calculate difficulty sweet spot based on accuracy
      // Target accuracy is 70-80%, which corresponds to a sweet spot of 0.75
      // Accuracy of 100% suggests questions are too easy (sweet spot should be higher)
      // Accuracy of 50% suggests questions are too hard (sweet spot should be lower)
      let difficultySweetSpot: number | undefined = undefined;
      if (session.questionsAnswered > 0) {
        const accuracy = session.questionsCorrect / session.questionsAnswered;
        // Map accuracy to sweet spot: high accuracy = need harder, low accuracy = need easier
        // Sweet spot ranges from 0.3 (very easy) to 0.9 (very hard)
        // Accuracy > 80% -> increase sweet spot (make harder)
        // Accuracy < 70% -> decrease sweet spot (make easier)
        // Accuracy 70-80% -> sweet spot is 0.75 (optimal)
        difficultySweetSpot = Math.min(0.9, Math.max(0.3, accuracy * 0.6 + 0.3));
      }

      // Upsert the learning model with updated data
      const model = await prisma.learningModel.upsert({
        where: { userId: req.user!.id },
        update: {
          sessionsAnalyzed: { increment: 1 },
          avgSessionDuration: session.timeSpentSeconds > 0 ? session.timeSpentSeconds : undefined,
          optimalTime: timeOfDay,
          lastUpdated: new Date(),
          confidenceScore: { increment: 0.05 },
          ...(difficultySweetSpot !== undefined && { difficultySweetSpot }),
        },
        create: {
          userId: req.user!.id,
          sessionsAnalyzed: 1,
          avgSessionDuration: session.timeSpentSeconds > 0 ? session.timeSpentSeconds : null,
          optimalTime: timeOfDay,
          confidenceScore: 0.1,
          difficultySweetSpot: difficultySweetSpot || 0.75,
        },
      });

      // Add a pattern for time of day
      await prisma.learningModelPattern.create({
        data: {
          learningModelId: model.id,
          patternType: 'session_time',
          patternData: {
            hour,
            timeOfDay,
            completedAt: completedAt.toISOString(),
            questionsAnswered: session.questionsAnswered,
            questionsCorrect: session.questionsCorrect,
          },
        },
      });
    }

    res.json(updatedSession);
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id/notes - Get or generate learning notes for a session
router.get('/:id/notes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Verify session belongs to user
    const session = await prisma.lesson.findFirst({
      where: { id, userId: req.user!.id },
      include: {
        topics: { include: { questions: true } },
        learningNotes: true,
      },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    // If notes already exist, return them
    if (session.learningNotes) {
      return res.json({
        id: session.learningNotes.id,
        sessionId: session.id,
        notesMarkdown: session.learningNotes.notesMarkdown,
        sections: session.learningNotes.sections,
        codeDetected: session.learningNotes.codeDetected,
        generatedAt: session.learningNotes.generatedAt,
      });
    }

    // Generate notes from session data
    const sections: { title: string; content: string; timestamp?: string }[] = [];
    let notesMarkdown = `# Learning Notes: ${session.videoTitle}\n\n`;
    notesMarkdown += `**Video:** ${session.videoTitle}\n`;
    notesMarkdown += `**Channel:** ${session.channelName}\n`;
    notesMarkdown += `**Date:** ${session.createdAt.toLocaleDateString()}\n\n`;

    // Add overview section
    notesMarkdown += `## Overview\n\n`;
    if (session.aiSummary) {
      notesMarkdown += `${session.aiSummary}\n\n`;
    } else {
      notesMarkdown += `This session covered ${session.topics.length} topics with ${session.questionsAnswered} questions answered.\n\n`;
    }
    sections.push({
      title: 'Overview',
      content: session.aiSummary || `This session covered ${session.topics.length} topics.`,
    });

    // Add key takeaways if available
    if (session.keyTakeaways && session.keyTakeaways.length > 0) {
      notesMarkdown += `## Key Takeaways\n\n`;
      session.keyTakeaways.forEach((takeaway) => {
        notesMarkdown += `- ${takeaway}\n`;
      });
      notesMarkdown += '\n';
      sections.push({
        title: 'Key Takeaways',
        content: session.keyTakeaways.join('\n'),
      });
    }

    // Add topics and Q&A
    let codeDetected = false;
    session.topics.forEach((topic, index) => {
      notesMarkdown += `## ${index + 1}. ${topic.name}\n\n`;
      if (topic.description) {
        notesMarkdown += `${topic.description}\n\n`;
      }

      const topicContent: string[] = [];
      if (topic.description) {
        topicContent.push(topic.description);
      }

      // Add questions and answers
      const answeredQuestions = topic.questions.filter((q) => q.userAnswer);
      if (answeredQuestions.length > 0) {
        notesMarkdown += `### Questions & Answers\n\n`;
        answeredQuestions.forEach((q) => {
          notesMarkdown += `**Q:** ${q.questionText}\n\n`;
          notesMarkdown += `**Your Answer:** ${q.userAnswer}\n\n`;
          if (q.feedback) {
            notesMarkdown += `**Feedback:** ${q.feedback}\n\n`;
          }
          notesMarkdown += `---\n\n`;

          // Check for code in answers
          if (q.userAnswer && (q.userAnswer.includes('```') || q.userAnswer.includes('function ') || q.userAnswer.includes('const ') || q.userAnswer.includes('let '))) {
            codeDetected = true;
          }

          topicContent.push(`Q: ${q.questionText}\nA: ${q.userAnswer}`);
        });
      }

      sections.push({
        title: topic.name,
        content: topicContent.join('\n\n'),
      });
    });

    // Add recommendations if available
    if (session.recommendations && session.recommendations.length > 0) {
      notesMarkdown += `## Next Steps\n\n`;
      session.recommendations.forEach((rec) => {
        notesMarkdown += `- ${rec}\n`;
      });
      sections.push({
        title: 'Next Steps',
        content: session.recommendations.join('\n'),
      });
    }

    // Save the generated notes
    const learningNotes = await prisma.lessonLearningNotes.create({
      data: {
        sessionId: session.id,
        notesMarkdown,
        sections,
        codeDetected,
      },
    });

    res.json({
      id: learningNotes.id,
      sessionId: session.id,
      notesMarkdown: learningNotes.notesMarkdown,
      sections: learningNotes.sections,
      codeDetected: learningNotes.codeDetected,
      generatedAt: learningNotes.generatedAt,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/:id/notes/generate - Force regenerate learning notes
router.post('/:id/notes/generate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const startTime = Date.now();

    // Verify session belongs to user
    const session = await prisma.lesson.findFirst({
      where: { id, userId: req.user!.id },
      include: {
        topics: { include: { questions: true } },
        learningNotes: true,
      },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    // Delete existing notes if they exist
    if (session.learningNotes) {
      await prisma.lessonLearningNotes.delete({
        where: { id: session.learningNotes.id },
      });
    }

    // Generate notes from session data
    const sections: { title: string; content: string; timestamp?: string }[] = [];
    let notesMarkdown = `# Learning Notes: ${session.videoTitle}\n\n`;
    notesMarkdown += `**Video:** ${session.videoTitle}\n`;
    notesMarkdown += `**Channel:** ${session.channelName}\n`;
    notesMarkdown += `**Date:** ${session.createdAt.toLocaleDateString()}\n`;
    notesMarkdown += `**Regenerated:** ${new Date().toLocaleString()}\n\n`;

    // Add overview section
    notesMarkdown += `## Overview\n\n`;
    if (session.aiSummary) {
      notesMarkdown += `${session.aiSummary}\n\n`;
    } else {
      notesMarkdown += `This session covered ${session.topics.length} topics with ${session.questionsAnswered} questions answered.\n\n`;
    }
    sections.push({
      title: 'Overview',
      content: session.aiSummary || `This session covered ${session.topics.length} topics.`,
    });

    // Add key takeaways if available
    if (session.keyTakeaways && session.keyTakeaways.length > 0) {
      notesMarkdown += `## Key Takeaways\n\n`;
      session.keyTakeaways.forEach((takeaway) => {
        notesMarkdown += `- ${takeaway}\n`;
      });
      notesMarkdown += '\n';
      sections.push({
        title: 'Key Takeaways',
        content: session.keyTakeaways.join('\n'),
      });
    }

    // Add topics and Q&A
    let codeDetected = false;
    session.topics.forEach((topic, index) => {
      notesMarkdown += `## ${index + 1}. ${topic.name}\n\n`;
      if (topic.description) {
        notesMarkdown += `${topic.description}\n\n`;
      }

      const topicContent: string[] = [];
      if (topic.description) {
        topicContent.push(topic.description);
      }

      // Add questions and answers
      const answeredQuestions = topic.questions.filter((q) => q.userAnswer);
      if (answeredQuestions.length > 0) {
        notesMarkdown += `### Questions & Answers\n\n`;
        answeredQuestions.forEach((q) => {
          notesMarkdown += `**Q:** ${q.questionText}\n\n`;
          notesMarkdown += `**Your Answer:** ${q.userAnswer}\n\n`;
          if (q.feedback) {
            notesMarkdown += `**Feedback:** ${q.feedback}\n\n`;
          }
          notesMarkdown += `---\n\n`;

          // Check for code in answers
          if (q.userAnswer && (q.userAnswer.includes('```') || q.userAnswer.includes('function ') || q.userAnswer.includes('const ') || q.userAnswer.includes('let '))) {
            codeDetected = true;
          }

          topicContent.push(`Q: ${q.questionText}\nA: ${q.userAnswer}`);
        });
      }

      sections.push({
        title: topic.name,
        content: topicContent.join('\n\n'),
      });
    });

    // Add recommendations if available
    if (session.recommendations && session.recommendations.length > 0) {
      notesMarkdown += `## Next Steps\n\n`;
      session.recommendations.forEach((rec) => {
        notesMarkdown += `- ${rec}\n`;
      });
      sections.push({
        title: 'Next Steps',
        content: session.recommendations.join('\n'),
      });
    }

    // Save the generated notes
    const learningNotes = await prisma.lessonLearningNotes.create({
      data: {
        sessionId: session.id,
        notesMarkdown,
        sections,
        codeDetected,
      },
    });

    const generationDurationMs = Date.now() - startTime;

    res.json({
      id: learningNotes.id,
      sessionId: session.id,
      notesMarkdown: learningNotes.notesMarkdown,
      sections: learningNotes.sections,
      codeDetected: learningNotes.codeDetected,
      generatedAt: learningNotes.generatedAt,
      generationDurationMs,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id/creator - Get creator info for session's video
router.get('/:id/creator', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const session = await prisma.lesson.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    // Check if user follows this channel
    const followedChannel = await prisma.followedChannel.findFirst({
      where: {
        userId: req.user!.id,
        channelId: session.channelId,
      },
    });

    res.json({
      channelId: session.channelId,
      channelName: session.channelName,
      channelThumbnail: null, // Would need to fetch from YouTube API
      videoUrl: session.videoUrl,
      videoTitle: session.videoTitle,
      isFollowing: !!followedChannel,
      sessionsCompleted: followedChannel?.sessionsCompleted || 0,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id/summary
router.get('/:id/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.lesson.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    res.json({
      id: session.id,
      summary: session.aiSummary,
      keyTakeaways: session.keyTakeaways,
      recommendations: session.recommendations,
      questionsAnswered: session.questionsAnswered,
      questionsCorrect: session.questionsCorrect,
      accuracy: session.questionsAnswered > 0
        ? (session.questionsCorrect / session.questionsAnswered * 100).toFixed(1)
        : 0,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
