import { Router } from 'express';
import { readStore } from '../storage/db.js';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    const store = await readStore();
    res.json({
      status: 'ok',
      service: 'Voca Backend API',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      counts: {
        expenses: store.expenses?.length || 0,
        tasks: store.tasks?.length || 0,
        reminders: store.reminders?.length || 0,
        activities: store.activities?.length || 0
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to access storage layer',
      error: err.message
    });
  }
});

export default router;
