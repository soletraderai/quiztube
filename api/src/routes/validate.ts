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

    // Validate geminiApiKey
    if (!geminiApiKey || typeof geminiApiKey !== 'string') {
      errors.geminiApiKey = 'API key is required';
    } else if (geminiApiKey.trim().length < 10) {
      errors.geminiApiKey = 'API key appears to be invalid';
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

export default router;
