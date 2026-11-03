import { Router } from 'express';
import { getDashboardData, toggleTaskStatus } from '../storage/db.js';

const router = Router();

// Full dashboard payload
router.get('/dashboard', async (req, res) => {
  try {
    const data = await getDashboardData();
    const totalExpenses = data.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const pendingTasks = data.tasks.filter(t => !t.completed).length;
    const completedTasks = data.tasks.filter(t => t.completed).length;
    const upcomingReminders = data.reminders.filter(r => r.status === 'upcoming').length;

    res.json({
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle task completion
router.patch('/tasks/:id/toggle', async (req, res) => {
  try {
    const updated = await toggleTaskStatus(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, task: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
