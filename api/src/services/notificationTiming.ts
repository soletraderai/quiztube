/**
 * Notification Timing Service
 *
 * Determines the optimal time to send notifications to users based on:
 * 1. User's timezone
 * 2. User's preferred time (if set)
 * 3. User's quiet hours
 * 4. Historical engagement patterns
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface UserTimingPreferences {
  userId: string;
  timezone: string;
  preferredTime: string | null; // HH:MM format
  quietHoursStart: string | null; // HH:MM format
  quietHoursEnd: string | null; // HH:MM format
  preferredDays: string[]; // e.g., ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
}

interface OptimalSendTime {
  shouldSend: boolean;
  reason: string;
  suggestedTime?: Date;
  nextAvailableWindow?: Date;
}

/**
 * Parse a time string (HH:MM) to hours and minutes.
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Get current time in a specific timezone.
 */
function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';

  return new Date(
    parseInt(get('year')),
    parseInt(get('month')) - 1,
    parseInt(get('day')),
    parseInt(get('hour')),
    parseInt(get('minute'))
  );
}

/**
 * Get the day of week name for a date.
 */
function getDayName(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

/**
 * Check if current time is within quiet hours.
 */
function isInQuietHours(
  currentTime: Date,
  quietStart: string | null,
  quietEnd: string | null
): boolean {
  if (!quietStart || !quietEnd) {
    return false;
  }

  const start = parseTime(quietStart);
  const end = parseTime(quietEnd);
  const currentHours = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;
  const startTotalMinutes = start.hours * 60 + start.minutes;
  const endTotalMinutes = end.hours * 60 + end.minutes;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startTotalMinutes > endTotalMinutes) {
    return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes < endTotalMinutes;
  }

  return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
}

/**
 * Calculate next available send time after quiet hours.
 */
function getNextAvailableTime(
  currentTime: Date,
  timezone: string,
  quietEnd: string | null,
  preferredTime: string | null
): Date {
  const nextTime = new Date(currentTime);

  if (quietEnd) {
    const end = parseTime(quietEnd);
    nextTime.setHours(end.hours, end.minutes, 0, 0);

    // If the quiet hours end time is in the past today, move to tomorrow
    if (nextTime <= currentTime) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
  } else if (preferredTime) {
    const preferred = parseTime(preferredTime);
    nextTime.setHours(preferred.hours, preferred.minutes, 0, 0);

    if (nextTime <= currentTime) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
  } else {
    // Default: next morning at 9 AM
    nextTime.setHours(9, 0, 0, 0);
    if (nextTime <= currentTime) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
  }

  return nextTime;
}

/**
 * Determine if now is a good time to send a notification to a user.
 */
export async function isGoodTimeToNotify(userId: string): Promise<OptimalSendTime> {
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId },
  });

  if (!preferences) {
    return {
      shouldSend: true,
      reason: 'No preferences set, using defaults',
    };
  }

  const timezone = preferences.timezone || 'America/New_York';
  const currentTime = getCurrentTimeInTimezone(timezone);
  const currentDay = getDayName(currentTime);

  // Check preferred days
  const preferredDays = preferences.preferredDays as string[] || [];
  if (preferredDays.length > 0 && !preferredDays.includes(currentDay)) {
    const nextDay = preferredDays.find(day => {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentIndex = days.indexOf(currentDay);
      const dayIndex = days.indexOf(day);
      return dayIndex > currentIndex;
    }) || preferredDays[0];

    return {
      shouldSend: false,
      reason: `Today (${currentDay}) is not a preferred learning day`,
      nextAvailableWindow: getNextDayDate(currentTime, nextDay, preferences.preferredTime),
    };
  }

  // Check quiet hours
  if (isInQuietHours(currentTime, preferences.quietHoursStart, preferences.quietHoursEnd)) {
    return {
      shouldSend: false,
      reason: 'Currently in quiet hours',
      nextAvailableWindow: getNextAvailableTime(
        currentTime,
        timezone,
        preferences.quietHoursEnd,
        preferences.preferredTime
      ),
    };
  }

  // Check if outside reasonable hours (before 7 AM or after 10 PM)
  const currentHour = currentTime.getHours();
  if (currentHour < 7) {
    const nextTime = new Date(currentTime);
    nextTime.setHours(preferences.preferredTime ? parseTime(preferences.preferredTime).hours : 9, 0, 0, 0);
    return {
      shouldSend: false,
      reason: 'Too early in the morning',
      nextAvailableWindow: nextTime,
    };
  }

  if (currentHour >= 22) {
    const nextTime = new Date(currentTime);
    nextTime.setDate(nextTime.getDate() + 1);
    nextTime.setHours(preferences.preferredTime ? parseTime(preferences.preferredTime).hours : 9, 0, 0, 0);
    return {
      shouldSend: false,
      reason: 'Too late in the evening',
      nextAvailableWindow: nextTime,
    };
  }

  // Check if this is the preferred time (within 30-minute window)
  if (preferences.preferredTime) {
    const preferred = parseTime(preferences.preferredTime);
    const preferredTotalMinutes = preferred.hours * 60 + preferred.minutes;
    const currentTotalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const diff = Math.abs(currentTotalMinutes - preferredTotalMinutes);

    if (diff <= 30) {
      return {
        shouldSend: true,
        reason: 'Within preferred time window',
      };
    }
  }

  return {
    shouldSend: true,
    reason: 'Good time to send notification',
  };
}

/**
 * Get the next occurrence of a specific day.
 */
function getNextDayDate(currentTime: Date, dayName: string, preferredTime: string | null): Date {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName);
  const currentDay = currentTime.getDay();

  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }

  const nextDate = new Date(currentTime);
  nextDate.setDate(nextDate.getDate() + daysUntilTarget);

  if (preferredTime) {
    const preferred = parseTime(preferredTime);
    nextDate.setHours(preferred.hours, preferred.minutes, 0, 0);
  } else {
    nextDate.setHours(9, 0, 0, 0);
  }

  return nextDate;
}

/**
 * Get users who should receive notifications now.
 * This considers timezone and quiet hours for each user.
 */
export async function getUsersReadyForNotification(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      preferences: {
        emailPromptsEnabled: true,
      },
      subscription: {
        tier: 'PRO',
      },
    },
    select: {
      id: true,
    },
  });

  const readyUsers: string[] = [];

  for (const user of users) {
    const timing = await isGoodTimeToNotify(user.id);
    if (timing.shouldSend) {
      readyUsers.push(user.id);
    }
  }

  return readyUsers;
}

/**
 * Get the optimal send time for a specific user based on their patterns.
 */
export async function getOptimalSendTimeForUser(userId: string): Promise<Date> {
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId },
  });

  const timezone = preferences?.timezone || 'America/New_York';
  const currentTime = getCurrentTimeInTimezone(timezone);

  // If user has a preferred time, use it
  if (preferences?.preferredTime) {
    const preferred = parseTime(preferences.preferredTime);
    const optimalTime = new Date(currentTime);
    optimalTime.setHours(preferred.hours, preferred.minutes, 0, 0);

    // If the preferred time is in the past today, schedule for tomorrow
    if (optimalTime <= currentTime) {
      optimalTime.setDate(optimalTime.getDate() + 1);
    }

    return optimalTime;
  }

  // Default optimal time: 9 AM in user's timezone
  const optimalTime = new Date(currentTime);
  optimalTime.setHours(9, 0, 0, 0);

  if (optimalTime <= currentTime) {
    optimalTime.setDate(optimalTime.getDate() + 1);
  }

  return optimalTime;
}
