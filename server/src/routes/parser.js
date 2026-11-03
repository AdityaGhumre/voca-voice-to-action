import { Router } from 'express';
import { parseCommandWithGemini, isGeminiConfigured } from '../services/gemini.js';

const router = Router();

// Safe health/test endpoint for checking Gemini connectivity without exposing secrets
router.get('/ai-status', (req, res) => {
  res.type('application/json');
  try {
    const configured = isGeminiConfigured();
    return res.status(200).json({
      status: 'ok',
      aiService: 'Google Gemini',
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      configured,
      ready: configured
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve AI service status',
      details: err.message
    });
  }
});

// Primary endpoint: /api/parse-command
router.post('/parse-command', async (req, res) => {
  res.type('application/json');

  try {
    const body = req.body || {};
    const { transcript } = body;

    // Request validation
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "transcript" must be a non-empty string.',
        code: 'INVALID_TRANSCRIPT'
      });
    }

    // Configuration check
    if (!isGeminiConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Gemini AI service is not configured. Please check GEMINI_API_KEY in server/.env.',
        code: 'API_KEY_MISSING'
      });
    }

    console.log(`[AI Parser] Processing transcript (${transcript.length} chars): "${transcript.slice(0, 80)}${transcript.length > 80 ? '...' : ''}"`);
    const result = await parseCommandWithGemini(transcript.trim());

    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'AI service returned an empty result.',
        code: 'EMPTY_AI_RESULT'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[AI Parse Error]:', err.message);

    const isAuth = err.message?.includes('API_KEY') || err.message?.includes('API key');
    const isRateLimit = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');

    const statusCode = isAuth ? 401 : isRateLimit ? 429 : 500;
    const errorMsg = isAuth
      ? 'Authentication failed with the Gemini API. Please verify server API key configuration.'
      : isRateLimit
      ? 'Gemini API rate limit exceeded. Please wait a moment and try again.'
      : (err.message || 'Failed to interpret voice command. Please try speaking again.');

    return res.status(statusCode).json({
      success: false,
      error: errorMsg,
      code: isAuth ? 'AI_AUTH_ERROR' : isRateLimit ? 'AI_RATE_LIMIT' : 'AI_PARSING_FAILED'
    });
  }
});

export default router;
