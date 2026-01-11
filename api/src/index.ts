import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import subscriptionRoutes from './routes/subscriptions.js';
import sessionRoutes from './routes/sessions.js';
import topicRoutes from './routes/topics.js';
import aiRoutes from './routes/ai.js';
import channelRoutes from './routes/channels.js';
import progressRoutes from './routes/progress.js';
import commitmentRoutes from './routes/commitment.js';
import goalRoutes from './routes/goals.js';
import emailPromptRoutes from './routes/emailPrompts.js';
import learningModelRoutes from './routes/learningModel.js';
import knowledgeMapRoutes from './routes/knowledgeMap.js';
import codeRoutes from './routes/code.js';
import timedSessionRoutes from './routes/timedSessions.js';
import questionRoutes from './routes/questions.js';
import webhookRoutes from './routes/webhooks.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma
export const prisma = new PrismaClient();

// Initialize Redis
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(requestLogger);

// Webhooks need raw body (before express.json)
app.use('/api/webhooks', webhookRoutes);

// JSON parsing for all other routes
app.use(express.json());

// Health check endpoint (public)
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connection
    await redis.ping();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/subscriptions', authMiddleware, subscriptionRoutes);
app.use('/api/sessions', authMiddleware, sessionRoutes);
app.use('/api/topics', authMiddleware, topicRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/channels', authMiddleware, channelRoutes);
app.use('/api/progress', authMiddleware, progressRoutes);
app.use('/api/commitment', authMiddleware, commitmentRoutes);
app.use('/api/goals', authMiddleware, goalRoutes);
app.use('/api/email-prompts', authMiddleware, emailPromptRoutes);
app.use('/api/learning-model', authMiddleware, learningModelRoutes);
app.use('/api/knowledge-map', authMiddleware, knowledgeMapRoutes);
app.use('/api/code', authMiddleware, codeRoutes);
app.use('/api/timed-sessions', authMiddleware, timedSessionRoutes);
app.use('/api/questions', authMiddleware, questionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Connected to PostgreSQL database');

    // Test Redis connection
    await redis.ping();
    console.log('Connected to Redis');

    app.listen(PORT, () => {
      console.log(`Teachy API server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
