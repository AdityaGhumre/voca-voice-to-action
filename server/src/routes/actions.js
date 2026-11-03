import { Router } from 'express';
import {
  executeActions,
  getExpenses,
  updateExpense,
  deleteExpense,
  getTasks,
  getReminders,
  updateReminder,
  deleteReminder,
  toggleReminderStatus,
  getActivities,
  updateTask,
  deleteTask,
  toggleTaskStatus,
  getDashboardData,
  resetStore,
  findActionDuplicates
} from '../storage/db.js';
import { validateReminderSchedule } from '../utils/dateTime.js';

const router = Router();

// Idempotency cache: stores requestId -> { timestamp, response }
const idempotencyCache = new Map();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

function cleanIdempotencyCache() {
  const now = Date.now();
  for (const [key, record] of idempotencyCache.entries()) {
    if (now - record.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}

// -------------------------------------------------------------
// POST /api/execute-actions (with Idempotency Support)
// -------------------------------------------------------------
router.post('/execute-actions', async (req, res) => {
  res.type('application/json');

  try {
    const { actions, transcript, assistantMessage, requestId, force } = req.body || {};

    cleanIdempotencyCache();

    // Idempotency check: if client sent a requestId and we already processed it (unless force is true)
    if (requestId && typeof requestId === 'string' && !force) {
      const cached = idempotencyCache.get(requestId);
      if (cached) {
        console.log(`[Idempotency] Returning cached response for requestId: ${requestId}`);
        return res.status(200).json({
          ...cached.response,
          idempotent: true
        });
      }
    }

    if (!actions || typeof actions !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "actions" object is required.',
        code: 'INVALID_ACTIONS_PAYLOAD'
      });
    }

    // Action-Level Duplicate Protection (unless explicitly confirmed with force: true)
    if (!force) {
      const duplicates = await findActionDuplicates(actions);
      if (duplicates.length > 0) {
        console.log(`[Duplicate Guard] Detected ${duplicates.length} matching existing action(s). Prompting user.`);
        return res.status(200).json({
          success: true,
          duplicateWarning: true,
          duplicates,
          actions,
          transcript,
          assistantMessage,
          message: `Found ${duplicates.length} equivalent active record(s) already in storage.`
        });
      }
    }

    const result = await executeActions({
      actions,
      transcript: typeof transcript === 'string' ? transcript : '',
      assistantMessage: typeof assistantMessage === 'string' ? assistantMessage : ''
    });

    console.log(`[Action Engine] Successfully executed and persisted ${result.summary.totalActions} actions.`);

    const responsePayload = {
      success: true,
      message: 'Actions successfully executed and stored.',
      saved: result.saved,
      summary: result.summary,
      data: result
    };

    // Store in idempotency cache
    if (requestId && typeof requestId === 'string') {
      idempotencyCache.set(requestId, {
        timestamp: Date.now(),
        response: responsePayload
      });
    }

    return res.status(201).json(responsePayload);
  } catch (err) {
    console.error('[Action Execution Error]:', err.message);
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to execute actions.',
      code: 'EXECUTION_FAILED'
    });
  }
});

// -------------------------------------------------------------
// POST /api/dev/reset (Development-Only Reset Endpoint)
// -------------------------------------------------------------
router.post('/dev/reset', async (req, res) => {
  res.type('application/json');

  // Hard production security guard
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Destructive reset operations are strictly forbidden in production mode.',
      code: 'FORBIDDEN'
    });
  }

  try {
    const { mode = 'empty' } = req.body || {};
    const resetData = await resetStore(mode);
    // Clear idempotency cache on reset
    idempotencyCache.clear();

    console.log(`[Dev Reset] Database reset to "${mode}" state.`);
    return res.status(200).json({
      success: true,
      message: `Database reset to "${mode}" state successfully.`,
      data: {
        mode,
        counts: {
          expenses: resetData.expenses.length,
          tasks: resetData.tasks.length,
          reminders: resetData.reminders.length,
          activities: resetData.activities.length
        }
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to reset store.',
      code: 'RESET_FAILED'
    });
  }
});

// -------------------------------------------------------------
// GET /api/expenses
// -------------------------------------------------------------
router.get('/expenses', async (req, res) => {
  res.type('application/json');
  try {
    const expenses = await getExpenses();
    const totalAmount = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return res.json({
      success: true,
      data: {
        expenses,
        total: totalAmount,
        currency: '₹',
        count: expenses.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// PATCH /api/expenses/:id
// -------------------------------------------------------------
router.patch('/expenses/:id', async (req, res) => {
  res.type('application/json');
  try {
    const { amount, description } = req.body || {};

    if (amount !== undefined) {
      const num = Number(amount);
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Expense amount must be a positive number.',
          code: 'INVALID_AMOUNT'
        });
      }
    }

    if (description !== undefined && (typeof description !== 'string' || !description.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Expense description cannot be empty.',
        code: 'INVALID_DESCRIPTION'
      });
    }

    const updated = await updateExpense(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found.',
        code: 'EXPENSE_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      message: 'Expense successfully updated.',
      expense: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// DELETE /api/expenses/:id
// -------------------------------------------------------------
router.delete('/expenses/:id', async (req, res) => {
  res.type('application/json');
  try {
    const deleted = await deleteExpense(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found.',
        code: 'EXPENSE_NOT_FOUND'
      });
    }

    console.log(`[Expense Deleted] Removed expense "${deleted.description}" (₹${deleted.amount}, ID: ${deleted.id})`);
    return res.json({
      success: true,
      message: 'Expense successfully deleted.',
      expense: deleted
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// GET /api/tasks
// -------------------------------------------------------------
router.get('/tasks', async (req, res) => {
  res.type('application/json');
  try {
    const tasks = await getTasks();
    const pending = tasks.filter(t => !t.completed).length;
    const completed = tasks.filter(t => t.completed).length;
    return res.json({
      success: true,
      data: {
        tasks,
        pendingCount: pending,
        completedCount: completed,
        totalCount: tasks.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// GET /api/reminders
// -------------------------------------------------------------
router.get('/reminders', async (req, res) => {
  res.type('application/json');
  try {
    const reminders = await getReminders();
    const upcoming = reminders.filter(r => r.status === 'upcoming').length;
    return res.json({
      success: true,
      data: {
        reminders,
        upcomingCount: upcoming,
        totalCount: reminders.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// PATCH /api/reminders/:id
// -------------------------------------------------------------
router.patch('/reminders/:id', async (req, res) => {
  res.type('application/json');
  try {
    const { title, status, date, time, dateTime } = req.body || {};

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Reminder title cannot be empty.',
        code: 'INVALID_TITLE'
      });
    }

    if (status !== undefined && !['upcoming', 'completed', 'dismissed'].includes(String(status).toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Reminder status must be "upcoming", "completed", or "dismissed".',
        code: 'INVALID_STATUS'
      });
    }

    // Past date/time validation for reminder updates
    if (date !== undefined || time !== undefined || dateTime !== undefined) {
      const reminders = await getReminders();
      const existing = reminders.find(r => r.id === req.params.id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Reminder not found.',
          code: 'REMINDER_NOT_FOUND'
        });
      }

      const targetDate = date !== undefined ? date : existing.date;
      const targetTime = time !== undefined ? time : existing.time;
      const scheduleCheck = validateReminderSchedule(targetDate, targetTime);
      if (!scheduleCheck.valid && scheduleCheck.isPast) {
        return res.status(400).json({
          success: false,
          error: 'This reminder time has already passed. Please choose a future time.',
          code: 'PAST_REMINDER_TIME'
        });
      }
    }

    const updated = await updateReminder(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Reminder not found.',
        code: 'REMINDER_NOT_FOUND'
      });
    }

    console.log(`[Reminder Updated] Updated reminder "${updated.title}" (ID: ${updated.id})`);
    return res.json({ success: true, reminder: updated });
  } catch (err) {
    if (err.message?.includes('already passed')) {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: 'PAST_REMINDER_TIME'
      });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// DELETE /api/reminders/:id
// -------------------------------------------------------------
router.delete('/reminders/:id', async (req, res) => {
  res.type('application/json');
  try {
    const deleted = await deleteReminder(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Reminder not found.',
        code: 'REMINDER_NOT_FOUND'
      });
    }

    console.log(`[Reminder Deleted] Removed reminder "${deleted.title}" (ID: ${deleted.id})`);
    return res.json({
      success: true,
      message: 'Reminder successfully deleted.',
      reminder: deleted
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// PATCH /api/reminders/:id/toggle (helper endpoint)
// -------------------------------------------------------------
router.patch('/reminders/:id/toggle', async (req, res) => {
  res.type('application/json');
  try {
    const updated = await toggleReminderStatus(req.params.id);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Reminder not found.',
        code: 'REMINDER_NOT_FOUND'
      });
    }
    return res.json({ success: true, reminder: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// GET /api/activity
// -------------------------------------------------------------
router.get('/activity', async (req, res) => {
  res.type('application/json');
  try {
    const activities = await getActivities();
    return res.json({
      success: true,
      data: {
        activities,
        count: activities.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// PATCH /api/tasks/:id
// -------------------------------------------------------------
router.patch('/tasks/:id', async (req, res) => {
  res.type('application/json');
  try {
    const { title, priority } = req.body || {};

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Task title cannot be empty.',
        code: 'INVALID_TITLE'
      });
    }

    if (priority !== undefined && !['low', 'medium', 'high'].includes(priority.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Task priority must be "low", "medium", or "high".',
        code: 'INVALID_PRIORITY'
      });
    }

    const updated = await updateTask(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Task not found.', code: 'TASK_NOT_FOUND' });
    }
    return res.json({ success: true, task: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// DELETE /api/tasks/:id
// -------------------------------------------------------------
router.delete('/tasks/:id', async (req, res) => {
  res.type('application/json');
  try {
    const deleted = await deleteTask(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Task not found.',
        code: 'TASK_NOT_FOUND'
      });
    }

    console.log(`[Task Deleted] Removed task "${deleted.title}" (ID: ${deleted.id})`);
    return res.json({
      success: true,
      message: 'Task successfully deleted.',
      task: deleted
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// PATCH /api/tasks/:id/toggle (helper endpoint)
// -------------------------------------------------------------
router.patch('/tasks/:id/toggle', async (req, res) => {
  res.type('application/json');
  try {
    const updated = await toggleTaskStatus(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Task not found.', code: 'TASK_NOT_FOUND' });
    }
    return res.json({ success: true, task: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// GET /api/dashboard (full combined payload)
// -------------------------------------------------------------
router.get('/dashboard', async (req, res) => {
  res.type('application/json');
  try {
    const data = await getDashboardData();
    const totalExpenses = data.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const pendingTasks = data.tasks.filter(t => !t.completed).length;
    const completedTasks = data.tasks.filter(t => t.completed).length;
    const upcomingReminders = data.reminders.filter(r => r.status === 'upcoming').length;

    return res.json({
      success: true,
      data: {
        ...data,
        summary: {
          totalExpenses,
          expensesCurrency: '₹',
          pendingTasks,
          completedTasks,
          upcomingReminders,
          totalActions: data.expenses.length + data.tasks.length + data.reminders.length
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
