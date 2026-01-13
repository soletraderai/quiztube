/**
 * Topic Prioritizer Service
 *
 * Implements SM-2 (SuperMemo 2) spaced repetition algorithm for optimal topic review scheduling.
 * Topics are prioritized based on:
 * 1. Time since last review (overdue topics get higher priority)
 * 2. Topic difficulty (calculated from user performance)
 * 3. User mastery level
 */

import { PrismaClient, MasteryLevel } from '@prisma/client';

const prisma = new PrismaClient();

// SM-2 algorithm constants
const MIN_EASE_FACTOR = 1.3;
const INITIAL_EASE_FACTOR = 2.5;
const INITIAL_INTERVAL_DAYS = 1;

interface PrioritizedTopic {
  topicId: string;
  topicName: string;
  priority: number; // Higher = more urgent
  overdueBy: number; // Days overdue (negative = not yet due)
  difficulty: number; // 0-1 scale, higher = harder
  recommendedAction: 'review' | 'reinforce' | 'introduce';
}

// Map mastery level enum to numeric value for calculations
const MASTERY_LEVEL_VALUES: Record<MasteryLevel, number> = {
  INTRODUCED: 25,
  DEVELOPING: 50,
  FAMILIAR: 75,
  MASTERED: 100,
};

/**
 * Calculate the ease factor based on user performance.
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 * where q is quality of response (0-5 scale)
 */
export function calculateEaseFactor(
  currentEF: number,
  qualityOfResponse: number // 0-5 scale
): number {
  const newEF = currentEF + (0.1 - (5 - qualityOfResponse) * (0.08 + (5 - qualityOfResponse) * 0.02));
  return Math.max(MIN_EASE_FACTOR, newEF);
}

/**
 * Calculate the next review interval based on SM-2 algorithm.
 * I(1) = 1 day
 * I(2) = 6 days
 * I(n) = I(n-1) * EF
 */
export function calculateNextInterval(
  repetitionNumber: number,
  easeFactor: number,
  previousInterval: number
): number {
  if (repetitionNumber === 1) {
    return INITIAL_INTERVAL_DAYS;
  }
  if (repetitionNumber === 2) {
    return 6;
  }
  return Math.round(previousInterval * easeFactor);
}

/**
 * Convert user performance (correct/incorrect ratio) to quality score (0-5).
 */
export function performanceToQuality(correctRatio: number): number {
  // Map 0-1 ratio to 0-5 scale
  // 100% correct = 5 (perfect response)
  // 60% correct = 3 (correct response with difficulty)
  // 0% correct = 0 (complete blackout)
  return Math.round(correctRatio * 5);
}

/**
 * Get the next mastery level based on current level and performance.
 */
function getNextMasteryLevel(currentLevel: MasteryLevel, wasCorrect: boolean): MasteryLevel {
  const levels: MasteryLevel[] = ['INTRODUCED', 'DEVELOPING', 'FAMILIAR', 'MASTERED'];
  const currentIndex = levels.indexOf(currentLevel);

  if (wasCorrect) {
    // Move up one level (max MASTERED)
    return levels[Math.min(currentIndex + 1, levels.length - 1)];
  } else {
    // Move down one level (min INTRODUCED)
    return levels[Math.max(currentIndex - 1, 0)];
  }
}

/**
 * Get prioritized topics for a user based on spaced repetition.
 */
export async function getPrioritizedTopics(
  userId: string,
  limit: number = 10
): Promise<PrioritizedTopic[]> {
  const now = new Date();

  // Get all topics for the user with their questions
  const topics = await prisma.topic.findMany({
    where: { userId },
    include: {
      questions: {
        select: {
          isCorrect: true,
        },
      },
    },
  });

  const prioritizedTopics: PrioritizedTopic[] = topics.map((topic) => {
    // Calculate correct/incorrect counts from questions
    const correctCount = topic.questions.filter(q => q.isCorrect === true).length;
    const incorrectCount = topic.questions.filter(q => q.isCorrect === false).length;
    const totalAnswered = correctCount + incorrectCount;

    const correctRatio = totalAnswered > 0 ? correctCount / totalAnswered : 0.5;
    const difficulty = 1 - correctRatio; // Higher difficulty = lower correct ratio

    // Calculate overdue days
    const nextReviewDate = topic.nextReviewDate || now;
    const overdueMs = now.getTime() - nextReviewDate.getTime();
    const overdueBy = overdueMs / (1000 * 60 * 60 * 24); // Convert to days

    // Get numeric mastery level
    const masteryValue = MASTERY_LEVEL_VALUES[topic.masteryLevel];

    // Calculate priority score
    // Higher priority for:
    // 1. More overdue topics (weight: 3)
    // 2. Lower mastery topics (weight: 2)
    // 3. Higher difficulty topics (weight: 1)
    const priority =
      (overdueBy > 0 ? overdueBy * 3 : 0) + // Overdue bonus
      ((100 - masteryValue) / 100) * 2 + // Low mastery bonus
      difficulty * 1; // Difficulty bonus

    // Determine recommended action based on mastery level
    let recommendedAction: 'review' | 'reinforce' | 'introduce';
    if (topic.masteryLevel === 'INTRODUCED') {
      recommendedAction = 'introduce';
    } else if (topic.masteryLevel === 'DEVELOPING' || topic.masteryLevel === 'FAMILIAR') {
      recommendedAction = 'reinforce';
    } else {
      recommendedAction = 'review';
    }

    return {
      topicId: topic.id,
      topicName: topic.name,
      priority,
      overdueBy,
      difficulty,
      recommendedAction,
    };
  });

  // Sort by priority (highest first) and return top N
  return prioritizedTopics
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

/**
 * Update a topic's spaced repetition data after a review.
 */
export async function updateTopicAfterReview(
  topicId: string,
  wasCorrect: boolean
): Promise<void> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      questions: {
        select: {
          isCorrect: true,
        },
      },
    },
  });

  if (!topic) {
    throw new Error(`Topic not found: ${topicId}`);
  }

  // Calculate performance ratio from all questions
  const correctCount = topic.questions.filter(q => q.isCorrect === true).length + (wasCorrect ? 1 : 0);
  const totalCount = topic.questions.filter(q => q.isCorrect !== null).length + 1;
  const correctRatio = totalCount > 0 ? correctCount / totalCount : 0.5;
  const qualityOfResponse = performanceToQuality(correctRatio);

  // Calculate new ease factor
  const currentEF = topic.easeFactor || INITIAL_EASE_FACTOR;
  const newEF = calculateEaseFactor(currentEF, qualityOfResponse);

  // Calculate new interval
  const currentInterval = topic.reviewIntervalDays || INITIAL_INTERVAL_DAYS;
  const reviewCount = (topic.reviewCount || 0) + 1;

  // If answer was incorrect, reset to first interval
  const newInterval = wasCorrect
    ? calculateNextInterval(reviewCount, newEF, currentInterval)
    : INITIAL_INTERVAL_DAYS;

  const now = new Date();
  const nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

  // Update mastery level based on performance
  const newMasteryLevel = getNextMasteryLevel(topic.masteryLevel, wasCorrect);

  await prisma.topic.update({
    where: { id: topicId },
    data: {
      easeFactor: newEF,
      reviewCount,
      reviewIntervalDays: newInterval,
      lastReviewedAt: now,
      nextReviewDate,
      masteryLevel: newMasteryLevel,
    },
  });
}

/**
 * Get the next topic to review for email prompts.
 * Considers spaced repetition priority and ensures variety.
 */
export async function getNextTopicForPrompt(
  userId: string
): Promise<{ topicId: string; topicName: string; questionId: string; questionText: string } | null> {
  const prioritizedTopics = await getPrioritizedTopics(userId, 5);

  if (prioritizedTopics.length === 0) {
    return null;
  }

  // Try each prioritized topic until we find one with an available question
  for (const pt of prioritizedTopics) {
    const topic = await prisma.topic.findUnique({
      where: { id: pt.topicId },
      include: {
        questions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (topic && topic.questions.length > 0) {
      return {
        topicId: topic.id,
        topicName: topic.name,
        questionId: topic.questions[0].id,
        questionText: topic.questions[0].questionText,
      };
    }
  }

  return null;
}
