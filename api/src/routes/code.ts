import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requirePro } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// POST /api/code/run
router.post('/run', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { code, language } = req.body;

    // JavaScript execution would happen client-side
    // This endpoint is for logging/saving purposes
    if (language === 'javascript') {
      // In production, you might use a sandboxed execution environment
      res.json({
        message: 'JavaScript execution should happen client-side',
        suggestion: 'Use eval() in a sandboxed iframe or Web Worker',
      });
    } else if (language === 'python') {
      // Python would use Pyodide client-side
      res.json({
        message: 'Python execution should use Pyodide client-side',
        suggestion: 'Load Pyodide and run Python in the browser',
      });
    } else {
      throw new AppError(400, 'Unsupported language', 'UNSUPPORTED_LANGUAGE');
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/code/snippets
router.post('/snippets', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId, language, code, output } = req.body;

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const snippet = await prisma.codeSnippet.create({
      data: {
        sessionId,
        userId: req.user!.id,
        language: language.toUpperCase(),
        code,
        output,
      },
    });

    res.status(201).json(snippet);
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id/snippets (defined here for convenience)
router.get('/sessions/:id/snippets', requirePro, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const snippets = await prisma.codeSnippet.findMany({
      where: { sessionId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    res.json(snippets);
  } catch (error) {
    next(error);
  }
});

export default router;
