import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// POST /api/validate/settings
router.post('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userName, geminiApiKey, language } = req.body;
    const errors: Record<string, string> = {};

    // Validate userName
    if (!userName || typeof userName !== 'string') {
      errors.userName = 'Name is required';
    } else if (userName.trim().length < 2) {
      errors.userName = 'Name must be at least 2 characters';
    } else if (userName.length > 50) {
      errors.userName = 'Name must be less than 50 characters';
    }

    // Validate geminiApiKey (optional - only validate if provided)
    if (geminiApiKey && typeof geminiApiKey === 'string' && geminiApiKey.trim().length > 0) {
      if (geminiApiKey.trim().length < 10) {
        errors.geminiApiKey = 'API key appears to be invalid';
      }
    }

    // Validate language (accepts both codes and names)
    const validLanguages = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh', 'English', 'Spanish', 'French', 'German', 'Portuguese', 'Japanese', 'Korean', 'Chinese'];
    if (!language || !validLanguages.includes(language)) {
      errors.language = 'Please select a valid language';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    res.json({ valid: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/validate/youtube-url
router.post('/youtube-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'Validation failed',
        errors: { url: 'URL is required' },
      });
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: { url: 'URL cannot be empty or whitespace only' },
      });
    }

    // Match various YouTube URL formats
    const youtubePatterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
    ];

    const isValidYouTube = youtubePatterns.some((pattern) => pattern.test(trimmedUrl));

    if (!isValidYouTube) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: { url: 'Please enter a valid YouTube URL (youtube.com/watch?v=... or youtu.be/...)' },
      });
    }

    res.json({
      success: true,
      message: 'YouTube URL is valid',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
