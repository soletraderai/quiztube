import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    tier: 'FREE' | 'PRO';
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Authorization header missing or invalid', 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AppError(401, 'Access token missing', 'UNAUTHORIZED');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError(500, 'JWT secret not configured', 'SERVER_ERROR');
    }

    try {
      const decoded = jwt.verify(token, secret) as {
        userId: string;
        email: string;
      };

      // Get user with subscription info
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { subscription: true },
      });

      if (!user) {
        throw new AppError(401, 'User not found', 'UNAUTHORIZED');
      }

      // Update last active
      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      });

      req.user = {
        id: user.id,
        email: user.email,
        tier: user.subscription?.tier || 'FREE',
      };

      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'Access token expired', 'TOKEN_EXPIRED');
      }
      if (jwtError instanceof jwt.JsonWebTokenError) {
        throw new AppError(401, 'Invalid access token', 'INVALID_TOKEN');
      }
      throw jwtError;
    }
  } catch (error) {
    next(error);
  }
};

export const requirePro = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.tier !== 'PRO') {
    return res.status(403).json({
      error: 'Subscription Required',
      message: 'This feature requires a Pro subscription',
      upgradeUrl: '/pricing',
    });
  }
  next();
};
