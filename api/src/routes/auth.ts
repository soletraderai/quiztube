import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../index.js';
import { AppError } from '../middleware/errorHandler.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.js';

const router = Router();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// Helper to generate tokens
const generateTokens = async (userId: string, email: string) => {
  const accessToken = jwt.sign(
    { userId, email },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  // Store refresh token in database
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { accessToken, refreshToken };
};

// POST /api/auth/signup
router.post('/signup', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, displayName } = signupSchema.parse(req.body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError(409, 'An account with this email already exists', 'EMAIL_EXISTS');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification token with 24-hour expiration
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with preferences and subscription
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        emailVerificationToken,
        emailVerificationExpires,
        preferences: {
          create: {}, // Use defaults
        },
        subscription: {
          create: {
            tier: 'FREE',
            status: 'ACTIVE',
          },
        },
      },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    // Send verification email
    await sendVerificationEmail(email, emailVerificationToken);

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user.id, user.email);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        tier: user.subscription?.tier || 'FREE',
        onboardingCompleted: user.preferences?.onboardingCompleted || false,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    // Generic error message for security
    const invalidCredentialsError = new AppError(
      401,
      'Invalid email or password',
      'INVALID_CREDENTIALS'
    );

    if (!user) {
      throw invalidCredentialsError;
    }

    // Check if user has password (might be OAuth only)
    if (!user.passwordHash) {
      throw new AppError(
        401,
        'Please sign in with Google',
        'OAUTH_ONLY'
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw invalidCredentialsError;
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user.id, user.email);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        tier: user.subscription?.tier || 'FREE',
        onboardingCompleted: user.preferences?.onboardingCompleted || false,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      // Find and revoke the refresh token
      const tokens = await prisma.refreshToken.findMany({
        where: {
          userId: req.user!.id,
          revokedAt: null,
        },
      });

      // Revoke all tokens for this user
      await prisma.refreshToken.updateMany({
        where: {
          userId: req.user!.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    // Clear cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new AppError(401, 'Refresh token missing', 'NO_REFRESH_TOKEN');
    }

    // Find valid refresh tokens
    const tokens = await prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    // Find matching token
    let validToken: (typeof tokens)[number] | null = null;
    for (const token of tokens) {
      const match = await bcrypt.compare(refreshToken, token.tokenHash);
      if (match) {
        validToken = token;
        break;
      }
    }

    if (!validToken) {
      throw new AppError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: validToken.user.id, email: validToken.user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token as string;

    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new AppError(400, 'Invalid verification token', 'INVALID_TOKEN');
    }

    // Check if token has expired (24-hour validity)
    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      throw new AppError(400, 'Verification token has expired. Please request a new verification email.', 'TOKEN_EXPIRED');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      throw new AppError(400, 'Email is required', 'EMAIL_REQUIRED');
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (user && !user.emailVerified) {
      // Generate new verification token with 24-hour expiration
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken,
          emailVerificationExpires,
        },
      });

      await sendVerificationEmail(email, emailVerificationToken);
    }

    res.json({ message: 'If an unverified account exists, a verification email has been sent' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (user && user.passwordHash) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });

      await sendPasswordResetEmail(email, resetToken);
    }

    res.json({ message: 'If an account exists, a reset link has been sent' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError(400, 'Invalid or expired reset token', 'INVALID_TOKEN');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Revoke all refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/google
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, idToken } = req.body;

    // TODO: Implement Google OAuth token verification
    // This would verify the token with Google and get user info
    throw new AppError(501, 'Google OAuth not yet implemented', 'NOT_IMPLEMENTED');
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      tier: user.subscription?.tier || 'FREE',
      subscriptionStatus: user.subscription?.status || 'ACTIVE',
      onboardingCompleted: user.preferences?.onboardingCompleted || false,
      preferences: user.preferences,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
