import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './routes/health.js';
import parserRouter from './routes/parser.js';
import actionsRouter from './routes/actions.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());

// Routes
app.use('/api', healthRouter);
app.use('/api', parserRouter);
app.use('/api', actionsRouter);

// Root fallback
app.get('/', (req, res) => {
  res.type('application/json');
  res.json({
    message: 'Voca Voice AI Assistant API is running',
    endpoints: {
      health: 'GET /api/health',
      aiStatus: 'GET /api/ai-status',
      parseCommand: 'POST /api/parse-command',
      executeActions: 'POST /api/execute-actions',
      dashboard: 'GET /api/dashboard',
      expenses: 'GET /api/expenses',
      tasks: 'GET /api/tasks',
      reminders: 'GET /api/reminders',
      updateReminder: 'PATCH /api/reminders/:id',
      deleteReminder: 'DELETE /api/reminders/:id',
      activity: 'GET /api/activity',
      updateTask: 'PATCH /api/tasks/:id'
    }
  });
});

// 404 handler (always returns valid JSON)
app.use((req, res) => {
  res.type('application/json');
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND'
  });
});

// Centralized error handler (guarantees valid JSON on any uncaught exception)
app.use((err, req, res, _next) => {
  console.error('[Unhandled Server Error]:', err.message);
  res.type('application/json');
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error occurred',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Voca server running on http://localhost:${PORT}`);
  console.log(`🩺 Health check available at http://localhost:${PORT}/api/health`);
  console.log(`🧠 AI parser ready at http://localhost:${PORT}/api/parse-command`);
  console.log(`⚡ Action engine ready at http://localhost:${PORT}/api/execute-actions`);
});
