/**
 * Scheduler Service
 *
 * Manages scheduled jobs for:
 * 1. Weekly summary emails (Sundays at 10 AM UTC)
 * 2. Daily email prompts (checks every hour, respects user timezone/quiet hours)
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendWeeklySummaryEmail, sendEmailPrompt } from './email.js';
import { getNextTopicForPrompt } from './topicPrioritizer.js';
import { isGoodTimeToNotify } from './notificationTiming.js';

const prisma = new PrismaClient();

let isSchedulerRunning = false;

/**
 * Send weekly summary emails to all active users.
 */
async function sendWeeklySummaries(): Promise<void> {
  console.log('[Scheduler] Starting weekly summary email job...');

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  try {
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

    console.log(`[Scheduler] Found ${activeUsers.length} active users for weekly summary`);

    let sent = 0;
    let failed = 0;

    for (const user of activeUsers) {
      try {
        // Calculate stats for the week
        const sessionsCompleted = user.sessions.length;
        const topicsCovered = user.sessions.reduce(
          (acc, session) => acc + session.topics.length,
          0
        );
        const timeSpentMinutes = user.sessions.reduce(
          (acc, session) => acc + (session.questionsAnswered * 2),
          0
        );

        // Generate recommendations
        const recommendations: string[] = [];
        if (sessionsCompleted < 3) {
          recommendations.push('Try to complete at least 3 sessions per week for better retention');
        }
        if (topicsCovered > 0) {
          recommendations.push(`Review your ${topicsCovered} topics from this week to reinforce learning`);
        }
        recommendations.push('Set a new learning goal for next week');

        const result = await sendWeeklySummaryEmail(
          user.email,
          user.displayName || 'Learner',
          {
            sessionsCompleted,
            timeSpentMinutes,
            topicsCovered,
            recommendations,
          }
        );

        if (result.success) {
          sent++;
        } else {
          failed++;
          console.error(`[Scheduler] Failed to send to ${user.email}: ${result.error}`);
        }
      } catch (error) {
        failed++;
        console.error(`[Scheduler] Error sending to ${user.email}:`, error);
      }
    }

    console.log(`[Scheduler] Weekly summary job completed: ${sent} sent, ${failed} failed`);
  } catch (error) {
    console.error('[Scheduler] Weekly summary job error:', error);
  }
}

/**
 * Send email prompts to Pro users who have them enabled.
 * Respects user timezone and quiet hours.
 */
async function sendEmailPrompts(): Promise<void> {
  console.log('[Scheduler] Starting email prompts job...');

  try {
    // Get all Pro users with email prompts enabled
    const eligibleUsers = await prisma.user.findMany({
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
      },
    });

    console.log(`[Scheduler] Found ${eligibleUsers.length} eligible users for email prompts`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of eligibleUsers) {
      try {
        // Check if this is a good time to send
        const timing = await isGoodTimeToNotify(user.id);

        if (!timing.shouldSend) {
          skipped++;
          continue;
        }

        // Check frequency - how many prompts sent this week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const promptsSentThisWeek = await prisma.emailPrompt.count({
          where: {
            userId: user.id,
            sentAt: {
              gte: oneWeekAgo,
            },
          },
        });

        const maxPromptsPerWeek = user.preferences?.emailPromptsFrequency || 3;

        if (promptsSentThisWeek >= maxPromptsPerWeek) {
          skipped++;
          continue;
        }

        // Get the next topic using spaced repetition
        const topicData = await getNextTopicForPrompt(user.id);

        if (!topicData) {
          skipped++;
          continue;
        }

        // Get the question for this topic
        const question = await prisma.question.findFirst({
          where: { topicId: topicData.topicId },
          orderBy: { createdAt: 'desc' },
        });

        if (!question) {
          skipped++;
          continue;
        }

        // Create email prompt record
        const emailPrompt = await prisma.emailPrompt.create({
          data: {
            userId: user.id,
            topicId: topicData.topicId,
            questionText: question.questionText,
            correctAnswer: question.correctAnswer || 'No correct answer provided',
            sentAt: new Date(),
          },
        });

        // Send the email
        const result = await sendEmailPrompt(
          user.email,
          user.displayName || 'Learner',
          topicData.topicName,
          question.questionText,
          emailPrompt.id,
          user.id
        );

        if (result.success) {
          sent++;
        } else {
          failed++;
          console.error(`[Scheduler] Failed to send prompt to ${user.email}: ${result.error}`);
        }
      } catch (error) {
        failed++;
        console.error(`[Scheduler] Error sending prompt to ${user.email}:`, error);
      }
    }

    console.log(`[Scheduler] Email prompts job completed: ${sent} sent, ${skipped} skipped, ${failed} failed`);
  } catch (error) {
    console.error('[Scheduler] Email prompts job error:', error);
  }
}

/**
 * Start all scheduled jobs.
 */
export function startScheduler(): void {
  if (isSchedulerRunning) {
    console.log('[Scheduler] Already running');
    return;
  }

  console.log('[Scheduler] Starting scheduled jobs...');

  // Weekly summary emails - Sundays at 10:00 AM UTC
  cron.schedule('0 10 * * 0', () => {
    sendWeeklySummaries();
  }, {
    timezone: 'UTC',
  });
  console.log('[Scheduler] Weekly summary job scheduled for Sundays at 10:00 AM UTC');

  // Email prompts - Every hour at minute 0
  // This checks each user's timezone and quiet hours
  cron.schedule('0 * * * *', () => {
    sendEmailPrompts();
  }, {
    timezone: 'UTC',
  });
  console.log('[Scheduler] Email prompts job scheduled to run hourly');

  isSchedulerRunning = true;
  console.log('[Scheduler] All jobs started successfully');
}

/**
 * Stop all scheduled jobs.
 */
export function stopScheduler(): void {
  // node-cron doesn't have a global stop, but we can prevent new runs
  isSchedulerRunning = false;
  console.log('[Scheduler] Scheduler marked as stopped');
}

/**
 * Manually trigger weekly summary (for testing).
 */
export async function triggerWeeklySummary(): Promise<void> {
  await sendWeeklySummaries();
}

/**
 * Manually trigger email prompts (for testing).
 */
export async function triggerEmailPrompts(): Promise<void> {
  await sendEmailPrompts();
}
