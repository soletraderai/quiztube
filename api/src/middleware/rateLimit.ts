import rateLimit from 'express-rate-limit';
import { redis } from '../index.js';
import { AuthenticatedRequest } from './auth.js';

// General API rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    const authReq = req as AuthenticatedRequest;
    // Pro users get 500 requests, Free users get 100
    return authReq.user?.tier === 'PRO' ? 500 : 100;
  },
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.user?.id || req.ip || 'unknown';
  },
});

// Auth rate limiting (stricter)
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please wait a minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
});

// AI request rate limiting (uses Redis for distributed limiting)
export const aiRateLimit = async (
  userId: string,
  tier: 'FREE' | 'PRO'
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> => {
  const hourlyLimit = tier === 'PRO' ? 100 : 20;
  const key = `ai_rate_limit:${userId}`;
  const windowMs = 60 * 60 * 1000; // 1 hour

  const current = await redis.incr(key);

  if (current === 1) {
    await redis.pexpire(key, windowMs);
  }

  const ttl = await redis.pttl(key);

  return {
    allowed: current <= hourlyLimit,
    remaining: Math.max(0, hourlyLimit - current),
    resetIn: ttl > 0 ? ttl : windowMs,
  };
};
