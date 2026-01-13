import express from 'express';
import { PrismaClient } from '@prisma/client';
import { sendWeeklySummaryEmail, sendEmailPrompt } from '../services/email';

const router = express.Router();
const prisma = new PrismaClient();

// Trigger weekly summary emails for active users
// This endpoint should be called by a cron job or scheduler (e.g., weekly on Sunday)
router.post('/weekly-summary', async (req, res) => {
  try {
    // Get the API key from header (for cron job authentication)
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.CRON_API_KEY || 'cron-secret-key';

    if (apiKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all users who have been active in the past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Find users with sessions in the past week
    const activeUsers = await prisma.user.findMany({
      where: {
        sessions: {
          some: {
            createdAt: {
              gte: oneWeekAgo,
            },
          },
        },
      },
      include: {
        sessions: {
          where: {
            createdAt: {
              gte: oneWeekAgo,
            },
          },
          include: {
            topics: true,
          },
        },
      },
    });

    const results: { email: string; sent: boolean; error?: string }[] = [];

    for (const user of activeUsers) {
      try {
        // Calculate stats for the week
        const sessionsCompleted = user.sessions.length;
        const topicsCovered = user.sessions.reduce(
          (acc, session) => acc + session.topics.length,
          0
        );
        // Use questionsAnswered from session directly
        const timeSpentMinutes = user.sessions.reduce(
          (acc, session) => acc + (session.questionsAnswered * 2),
          0
        );

        // Generate personalized recommendations
        const recommendations: string[] = [];

        if (sessionsCompleted < 3) {
          recommendations.push(
            'Try to complete at least 3 sessions per week for better retention'
          );
        }
        if (topicsCovered > 0) {
          recommendations.push(
            `Review your ${topicsCovered} topics from this week to reinforce learning`
          );
        }
        recommendations.push('Set a new learning goal for next week');

        await sendWeeklySummaryEmail(
          user.email,
          user.displayName || 'Learner',
          {
            sessionsCompleted,
            timeSpentMinutes,
            topicsCovered,
            recommendations,
          }
        );

        results.push({ email: user.email, sent: true });
      } catch (error) {
        results.push({
          email: user.email,
          sent: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      emailsSent: results.filter((r) => r.sent).length,
      emailsFailed: results.filter((r) => !r.sent).length,
      details: results,
    });
  } catch (error) {
    console.error('Weekly summary error:', error);
    res.status(500).json({
      error: 'Failed to send weekly summaries',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Trigger weekly summary for a specific user (for testing)
router.post('/weekly-summary/test/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sessions: {
          where: {
            createdAt: {
              gte: oneWeekAgo,
            },
          },
          include: {
            topics: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate stats
    const sessionsCompleted = user.sessions.length;
    const topicsCovered = user.sessions.reduce(
      (acc, session) => acc + session.topics.length,
      0
    );
    // Use questionsAnswered from session directly
    const timeSpentMinutes = user.sessions.reduce(
      (acc, session) => acc + (session.questionsAnswered * 2),
      0
    );

    const recommendations = [
      'Continue your learning streak',
      `Review your ${topicsCovered} topics to reinforce learning`,
      'Set a new learning goal for next week',
    ];

    await sendWeeklySummaryEmail(user.email, user.displayName || 'Learner', {
      sessionsCompleted,
      timeSpentMinutes,
      topicsCovered,
      recommendations,
    });

    res.json({
      success: true,
      message: 'Weekly summary email sent',
      stats: {
        sessionsCompleted,
        timeSpentMinutes,
        topicsCovered,
        recommendations,
      },
    });
  } catch (error) {
    console.error('Test weekly summary error:', error);
    res.status(500).json({
      error: 'Failed to send weekly summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Trigger email prompts for Pro users who have enabled them
// This endpoint should be called by a cron job or scheduler (e.g., daily at a specific time)
router.post('/email-prompts', async (req, res) => {
  try {
    // Get the API key from header (for cron job authentication)
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.CRON_API_KEY || 'cron-secret-key';

    if (apiKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all Pro users who have email prompts enabled
    const proUsersWithPrompts = await prisma.user.findMany({
      where: {
        subscription: {
          tier: 'PRO',
        },
        preferences: {
          emailPromptsEnabled: true,
        },
      },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    const results: { email: string; sent: boolean; topicName?: string; error?: string }[] = [];

    for (const user of proUsersWithPrompts) {
      try {
        // Find topics due for review for this user
        const topicsDueForReview = await prisma.topic.findMany({
          where: {
            userId: user.id,
            nextReviewDate: { lte: new Date() },
          },
          include: {
            questions: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
          take: 1,
          orderBy: { nextReviewDate: 'asc' },
        });

        if (topicsDueForReview.length === 0) {
          results.push({ email: user.email, sent: false, error: 'No topics due for review' });
          continue;
        }

        const topic = topicsDueForReview[0];
        const question = topic.questions[0];

        if (!question) {
          results.push({ email: user.email, sent: false, error: 'No questions for topic' });
          continue;
        }

        // Create an email prompt record
        const emailPrompt = await prisma.emailPrompt.create({
          data: {
            userId: user.id,
            topicId: topic.id,
            questionText: question.questionText,
            correctAnswer: question.correctAnswer || 'No correct answer provided',
            sentAt: new Date(),
          },
        });

        // Send the email
        await sendEmailPrompt(
          user.email,
          user.displayName || 'Learner',
          topic.name,
          question.questionText,
          emailPrompt.id,
          user.id
        );

        results.push({
          email: user.email,
          sent: true,
          topicName: topic.name,
        });
      } catch (error) {
        results.push({
          email: user.email,
          sent: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      emailsSent: results.filter((r) => r.sent).length,
      emailsFailed: results.filter((r) => !r.sent).length,
      details: results,
    });
  } catch (error) {
    console.error('Email prompts error:', error);
    res.status(500).json({
      error: 'Failed to send email prompts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Trigger email prompt for a specific user (for testing)
router.post('/email-prompts/test/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.subscription?.tier !== 'PRO') {
      return res.status(403).json({ error: 'Email prompts are a Pro feature' });
    }

    // Find topics due for review for this user
    const topicsDueForReview = await prisma.topic.findMany({
      where: {
        userId: user.id,
        nextReviewDate: { lte: new Date() },
      },
      include: {
        questions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      take: 1,
      orderBy: { nextReviewDate: 'asc' },
    });

    if (topicsDueForReview.length === 0) {
      return res.status(404).json({ error: 'No topics due for review' });
    }

    const topic = topicsDueForReview[0];
    const question = topic.questions[0];

    if (!question) {
      return res.status(404).json({ error: 'No questions for topic' });
    }

    // Create an email prompt record
    const emailPrompt = await prisma.emailPrompt.create({
      data: {
        userId: user.id,
        topicId: topic.id,
        questionText: question.questionText,
        correctAnswer: question.correctAnswer || 'No correct answer provided',
        sentAt: new Date(),
      },
    });

    // Send the email
    await sendEmailPrompt(
      user.email,
      user.displayName || 'Learner',
      topic.name,
      question.questionText,
      emailPrompt.id,
      user.id
    );

    res.json({
      success: true,
      message: 'Email prompt sent',
      topic: topic.name,
      question: question.questionText,
      promptId: emailPrompt.id,
    });
  } catch (error) {
    console.error('Test email prompt error:', error);
    res.status(500).json({
      error: 'Failed to send email prompt',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
