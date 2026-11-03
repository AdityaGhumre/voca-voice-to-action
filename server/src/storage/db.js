import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateReminderSchedule } from '../utils/dateTime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../../data/store.json');
const TEMP_DATA_FILE = path.resolve(__dirname, '../../data/store.json.tmp');

const INITIAL_DATA = {
  expenses: [],
  tasks: [],
  reminders: [],
  activities: []
};

// Sequential write queue to prevent race conditions and corrupted JSON
let writeQueue = Promise.resolve();

export function generateId(prefix) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${random}`;
}

// Ensure data file and directory exist
async function ensureStore() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
  }
}

export async function readStore() {
  await ensureStore();
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : []
    };
  } catch (error) {
    console.error('Error reading JSON store:', error);
    return INITIAL_DATA;
  }
}

/**
 * Atomic write: writes to temp file first, then atomically renames to DATA_FILE.
 */
export async function writeStore(data) {
  await ensureStore();

  const task = async () => {
    const payload = JSON.stringify(data, null, 2);
    // Write to temporary file first
    await fs.writeFile(TEMP_DATA_FILE, payload, 'utf-8');
    // Atomic rename replaces target safely
    await fs.rename(TEMP_DATA_FILE, DATA_FILE);
    return data;
  };

  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

export async function getDashboardData() {
  const data = await readStore();
  return {
    expenses: data.expenses,
    tasks: data.tasks,
    reminders: data.reminders,
    activities: data.activities
  };
}

export async function getExpenses() {
  const data = await readStore();
  return data.expenses;
}

export async function getTasks() {
  const data = await readStore();
  return data.tasks;
}

export async function getReminders() {
  const data = await readStore();
  return data.reminders;
}

export async function getActivities() {
  const data = await readStore();
  return data.activities;
}

export function normalizeString(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether any proposed actions match active/existing records in storage.
 */
export async function findActionDuplicates(actions = {}) {
  const store = await readStore();
  const duplicates = [];

  // Check Tasks (compare normalized title against pending tasks)
  if (Array.isArray(actions.tasks)) {
    for (const t of actions.tasks) {
      const normTitle = normalizeString(t.title);
      if (!normTitle) continue;

      const match = store.tasks.find(
        existing => !existing.completed && normalizeString(existing.title) === normTitle
      );

      if (match) {
        duplicates.push({
          type: 'task',
          item: t,
          existingRecord: {
            id: match.id,
            title: match.title,
            priority: match.priority,
            dueDate: match.dueDate,
            createdAt: match.createdAt
          },
          message: `Pending task "${match.title}" already exists (Due: ${match.dueDate}, ID: ${match.id})`
        });
      }
    }
  }

  // Check Reminders (compare normalized title + date against upcoming reminders)
  if (Array.isArray(actions.reminders)) {
    for (const r of actions.reminders) {
      const normTitle = normalizeString(r.title);
      const normDate = normalizeString(r.date);
      if (!normTitle) continue;

      const match = store.reminders.find(existing => {
        if (existing.status !== 'upcoming') return false;
        const exTitle = normalizeString(existing.title);
        const exDate = normalizeString(existing.date);
        return exTitle === normTitle && exDate === normDate;
      });

      if (match) {
        duplicates.push({
          type: 'reminder',
          item: r,
          existingRecord: {
            id: match.id,
            title: match.title,
            dateTime: match.dateTime,
            createdAt: match.createdAt
          },
          message: `Reminder "${match.title}" already scheduled for ${match.dateTime} (ID: ${match.id})`
        });
      }
    }
  }

  // Check Expenses (amount, date, and description)
  if (Array.isArray(actions.expenses)) {
    for (const exp of actions.expenses) {
      const amount = Number(exp.amount);
      const normDesc = normalizeString(exp.description);
      const expDate = exp.date;

      const match = store.expenses.find(existing => {
        return (
          Number(existing.amount) === amount &&
          existing.date === expDate &&
          normalizeString(existing.description) === normDesc
        );
      });

      if (match) {
        duplicates.push({
          type: 'expense',
          item: exp,
          existingRecord: {
            id: match.id,
            amount: match.amount,
            description: match.description,
            category: match.category,
            date: match.date,
            createdAt: match.createdAt
          },
          message: `Expense of ₹${match.amount} for "${match.description}" on ${match.date} already exists (ID: ${match.id})`
        });
      }
    }
  }

  return duplicates;
}

/**
 * Validates, assigns unique IDs, timestamps, and persists AI-extracted actions.
 */
export async function executeActions({ actions = {}, transcript = '', assistantMessage = '' }) {
  const store = await readStore();
  const nowISO = new Date().toISOString();

  const addedExpenses = [];
  const addedTasks = [];
  const addedReminders = [];

  // Validate and format Expenses
  if (Array.isArray(actions.expenses)) {
    for (const exp of actions.expenses) {
      const amount = Number(exp.amount);
      if (!isNaN(amount) && amount > 0) {
        const item = {
          id: generateId('exp'),
          amount,
          currency: exp.currency || '₹',
          category: exp.category || 'General',
          description: (exp.description || 'Expense').trim(),
          date: exp.date || nowISO.split('T')[0],
          createdAt: nowISO,
          updatedAt: nowISO
        };
        addedExpenses.push(item);
      }
    }
  }

  // Validate and format Tasks
  if (Array.isArray(actions.tasks)) {
    for (const t of actions.tasks) {
      const title = (t.title || '').trim();
      if (title) {
        const priority = ['low', 'medium', 'high'].includes(t.priority?.toLowerCase())
          ? t.priority.toLowerCase()
          : 'medium';

        const item = {
          id: generateId('tsk'),
          title,
          description: typeof t.description === 'string' ? t.description.trim() || null : null,
          notes: typeof t.notes === 'string' ? t.notes.trim() || null : null,
          priority,
          dueDate: t.dueDate || 'Soon',
          completed: false,
          createdAt: nowISO,
          updatedAt: nowISO
        };
        addedTasks.push(item);
      }
    }
  }

  // Validate and format Reminders
  if (Array.isArray(actions.reminders)) {
    for (const r of actions.reminders) {
      const title = (r.title || '').trim();
      if (title) {
        const scheduleCheck = validateReminderSchedule(r.date, r.time);
        if (!scheduleCheck.valid && scheduleCheck.isPast) {
          throw new Error('This reminder time has already passed. Please choose a future time.');
        }

        const cleanDate = scheduleCheck.normalizedDate || r.date || 'Upcoming';
        const cleanTime = scheduleCheck.normalizedTime || r.time || null;
        const dateTimeStr = cleanTime ? `${cleanDate}, ${cleanTime}` : cleanDate;

        const item = {
          id: generateId('rem'),
          title,
          description: typeof r.description === 'string' ? r.description.trim() || null : null,
          notes: typeof r.notes === 'string' ? r.notes.trim() || null : null,
          date: cleanDate,
          time: cleanTime,
          dateTime: dateTimeStr,
          status: 'upcoming',
          createdAt: nowISO,
          updatedAt: nowISO
        };
        addedReminders.push(item);
      }
    }
  }

  const totalAdded = addedExpenses.length + addedTasks.length + addedReminders.length;
  if (totalAdded === 0) {
    throw new Error('No valid actions could be validated for execution.');
  }

  // Append new records to collections (newest first for UI clarity)
  store.expenses = [...addedExpenses, ...store.expenses];
  store.tasks = [...addedTasks, ...store.tasks];
  store.reminders = [...addedReminders, ...store.reminders];

  // Compose clean activity log entry
  const parts = [];
  if (addedExpenses.length > 0) {
    const totalExp = addedExpenses.reduce((sum, e) => sum + e.amount, 0);
    parts.push(`added ₹${totalExp} expense`);
  }
  if (addedTasks.length > 0) {
    parts.push(`created ${addedTasks.length} task${addedTasks.length > 1 ? 's' : ''}`);
  }
  if (addedReminders.length > 0) {
    parts.push(`scheduled ${addedReminders.length} reminder${addedReminders.length > 1 ? 's' : ''}`);
  }

  const activitySummary = parts.length > 0
    ? `Voice Action: ${parts.join(', ')}`
    : `Processed voice command`;

  const activity = {
    id: generateId('act'),
    type: 'voice_command',
    summary: activitySummary,
    transcript: transcript.trim(),
    assistantMessage: assistantMessage || '',
    timestamp: nowISO,
    actionsCount: totalAdded
  };

  store.activities = [activity, ...(store.activities || [])];

  // Persist atomically to disk
  await writeStore(store);

  return {
    saved: {
      expenses: addedExpenses,
      tasks: addedTasks,
      reminders: addedReminders
    },
    summary: {
      totalActions: totalAdded,
      expenseCount: addedExpenses.length,
      taskCount: addedTasks.length,
      reminderCount: addedReminders.length
    },
    activity
  };
}

/**
 * Updates a task (e.g. marking completed, editing title, description, notes, priority, due date).
 */
export async function updateTask(taskId, updates = {}) {
  const store = await readStore();
  const task = store.tasks.find(t => t.id === taskId);
  if (!task) return null;

  const wasCompleted = task.completed;
  let hasFieldChanges = false;

  if (typeof updates.completed === 'boolean' && updates.completed !== wasCompleted) {
    task.completed = updates.completed;
  }

  if (typeof updates.title === 'string' && updates.title.trim()) {
    const trimmedTitle = updates.title.trim();
    if (trimmedTitle !== task.title) {
      task.title = trimmedTitle;
      hasFieldChanges = true;
    }
  }

  if (updates.description !== undefined) {
    const cleanDesc = typeof updates.description === 'string' ? updates.description.trim() || null : null;
    if (cleanDesc !== (task.description || null)) {
      task.description = cleanDesc;
      hasFieldChanges = true;
    }
  }

  if (updates.notes !== undefined) {
    const cleanNotes = typeof updates.notes === 'string' ? updates.notes.trim() || null : null;
    if (cleanNotes !== (task.notes || null)) {
      task.notes = cleanNotes;
      hasFieldChanges = true;
    }
  }

  if (updates.priority && ['low', 'medium', 'high'].includes(updates.priority.toLowerCase())) {
    const cleanPrio = updates.priority.toLowerCase();
    if (cleanPrio !== task.priority) {
      task.priority = cleanPrio;
      hasFieldChanges = true;
    }
  }

  if (updates.dueDate !== undefined) {
    const cleanDue = typeof updates.dueDate === 'string' ? updates.dueDate.trim() || null : null;
    if (cleanDue !== (task.dueDate || null)) {
      task.dueDate = cleanDue;
      hasFieldChanges = true;
    }
  }

  const nowISO = new Date().toISOString();
  task.updatedAt = nowISO;

  // Record audit activity
  if (typeof updates.completed === 'boolean' && wasCompleted !== updates.completed) {
    store.activities.unshift({
      id: generateId('act'),
      type: task.completed ? 'task_completed' : 'task_reopened',
      summary: `${task.completed ? 'Completed' : 'Reopened'} task: "${task.title}"`,
      timestamp: nowISO,
      actionsCount: 1
    });
  } else if (hasFieldChanges) {
    store.activities.unshift({
      id: generateId('act'),
      type: 'task_updated',
      summary: `Updated task: "${task.title}"`,
      timestamp: nowISO,
      actionsCount: 1
    });
  }

  await writeStore(store);
  return task;
}

/**
 * Deletes a task from persistent storage and logs audit activity.
 */
export async function deleteTask(taskId) {
  const store = await readStore();
  const taskIndex = store.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return null;

  const [deletedTask] = store.tasks.splice(taskIndex, 1);
  const nowISO = new Date().toISOString();

  store.activities = [
    {
      id: generateId('act'),
      type: 'task_deleted',
      summary: `Deleted task: "${deletedTask.title}"`,
      timestamp: nowISO,
      actionsCount: 1
    },
    ...(store.activities || [])
  ];

  await writeStore(store);
  return deletedTask;
}

/**
 * Updates an expense with atomic writes and audit logging.
 */
export async function updateExpense(expenseId, updates = {}) {
  const store = await readStore();
  const expense = store.expenses.find(e => e.id === expenseId);
  if (!expense) return null;

  let hasChanges = false;

  if (updates.amount !== undefined) {
    const numAmount = Number(updates.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Expense amount must be a positive number.');
    }
    if (numAmount !== expense.amount) {
      expense.amount = numAmount;
      hasChanges = true;
    }
  }

  if (updates.description !== undefined) {
    if (typeof updates.description !== 'string' || !updates.description.trim()) {
      throw new Error('Expense description cannot be empty.');
    }
    const cleanDesc = updates.description.trim();
    if (cleanDesc !== expense.description) {
      expense.description = cleanDesc;
      hasChanges = true;
    }
  }

  if (updates.category !== undefined && typeof updates.category === 'string' && updates.category.trim()) {
    const cleanCat = updates.category.trim();
    if (cleanCat !== expense.category) {
      expense.category = cleanCat;
      hasChanges = true;
    }
  }

  if (updates.date !== undefined && typeof updates.date === 'string' && updates.date.trim()) {
    const cleanDate = updates.date.trim();
    if (cleanDate !== expense.date) {
      expense.date = cleanDate;
      hasChanges = true;
    }
  }

  if (updates.currency !== undefined && typeof updates.currency === 'string' && updates.currency.trim()) {
    expense.currency = updates.currency.trim();
  }

  const nowISO = new Date().toISOString();
  expense.updatedAt = nowISO;

  if (hasChanges) {
    store.activities.unshift({
      id: generateId('act'),
      type: 'expense_updated',
      summary: `Updated expense: ₹${expense.amount} for "${expense.description}"`,
      timestamp: nowISO,
      actionsCount: 1
    });
  }

  await writeStore(store);
  return expense;
}

/**
 * Deletes an expense from persistent storage and logs audit activity.
 */
export async function deleteExpense(expenseId) {
  const store = await readStore();
  const index = store.expenses.findIndex(e => e.id === expenseId);
  if (index === -1) return null;

  const [deletedExpense] = store.expenses.splice(index, 1);
  const nowISO = new Date().toISOString();

  store.activities.unshift({
    id: generateId('act'),
    type: 'expense_deleted',
    summary: `Deleted expense: ₹${deletedExpense.amount} for "${deletedExpense.description}"`,
    timestamp: nowISO,
    actionsCount: 1
  });

  await writeStore(store);
  return deletedExpense;
}

export async function toggleTaskStatus(taskId) {
  const store = await readStore();
  const task = store.tasks.find(t => t.id === taskId);
  if (!task) return null;

  return updateTask(taskId, { completed: !task.completed });
}

/**
 * Updates a reminder (title, description, notes, date, time, dateTime, status).
 */
export async function updateReminder(reminderId, updates = {}) {
  const store = await readStore();
  const reminder = store.reminders.find(r => r.id === reminderId);
  if (!reminder) return null;

  // Validate that proposed scheduled date/time is not in the past
  if (updates.date !== undefined || updates.time !== undefined || updates.dateTime !== undefined) {
    const targetDate = updates.date !== undefined ? updates.date : reminder.date;
    const targetTime = updates.time !== undefined ? updates.time : reminder.time;
    const scheduleCheck = validateReminderSchedule(targetDate, targetTime);
    if (!scheduleCheck.valid && scheduleCheck.isPast) {
      throw new Error('This reminder time has already passed. Please choose a future time.');
    }
  }

  const previousStatus = reminder.status || 'upcoming';
  let hasFieldChanges = false;

  if (typeof updates.title === 'string' && updates.title.trim()) {
    const trimmedTitle = updates.title.trim();
    if (trimmedTitle !== reminder.title) {
      reminder.title = trimmedTitle;
      hasFieldChanges = true;
    }
  }

  if (updates.description !== undefined) {
    const cleanDesc = typeof updates.description === 'string' ? updates.description.trim() || null : null;
    if (cleanDesc !== (reminder.description || null)) {
      reminder.description = cleanDesc;
      hasFieldChanges = true;
    }
  }

  if (updates.notes !== undefined) {
    const cleanNotes = typeof updates.notes === 'string' ? updates.notes.trim() || null : null;
    if (cleanNotes !== (reminder.notes || null)) {
      reminder.notes = cleanNotes;
      hasFieldChanges = true;
    }
  }

  if (updates.date !== undefined && typeof updates.date === 'string' && updates.date.trim()) {
    const cleanDate = updates.date.trim();
    if (cleanDate !== reminder.date) {
      reminder.date = cleanDate;
      hasFieldChanges = true;
    }
  }

  if (updates.time !== undefined) {
    const cleanTime = typeof updates.time === 'string' && updates.time.trim() ? updates.time.trim() : null;
    if (cleanTime !== (reminder.time || null)) {
      reminder.time = cleanTime;
      hasFieldChanges = true;
    }
  }

  if (updates.dateTime !== undefined && typeof updates.dateTime === 'string' && updates.dateTime.trim()) {
    const cleanDateTime = updates.dateTime.trim();
    if (cleanDateTime !== reminder.dateTime) {
      reminder.dateTime = cleanDateTime;
      hasFieldChanges = true;
    }
  } else if (hasFieldChanges && (updates.date !== undefined || updates.time !== undefined)) {
    reminder.dateTime = reminder.time ? `${reminder.date}, ${reminder.time}` : reminder.date || 'Upcoming';
  }

  if (updates.status !== undefined && typeof updates.status === 'string') {
    const cleanStatus = updates.status.trim().toLowerCase();
    if (['upcoming', 'completed', 'dismissed'].includes(cleanStatus) && cleanStatus !== reminder.status) {
      reminder.status = cleanStatus;
    }
  }

  const nowISO = new Date().toISOString();
  reminder.updatedAt = nowISO;

  // Record audit activity
  if (updates.status !== undefined && previousStatus !== reminder.status) {
    store.activities.unshift({
      id: generateId('act'),
      type: reminder.status === 'completed' ? 'reminder_completed' : 'reminder_reopened',
      summary: `${reminder.status === 'completed' ? 'Completed' : 'Reopened'} reminder: "${reminder.title}"`,
      timestamp: nowISO,
      actionsCount: 1
    });
  } else if (hasFieldChanges) {
    store.activities.unshift({
      id: generateId('act'),
      type: 'reminder_updated',
      summary: `Updated reminder: "${reminder.title}"`,
      timestamp: nowISO,
      actionsCount: 1
    });
  }

  await writeStore(store);
  return reminder;
}

/**
 * Deletes a reminder from persistent storage and logs audit activity.
 */
export async function deleteReminder(reminderId) {
  const store = await readStore();
  const reminderIndex = store.reminders.findIndex(r => r.id === reminderId);
  if (reminderIndex === -1) return null;

  const [deletedReminder] = store.reminders.splice(reminderIndex, 1);
  const nowISO = new Date().toISOString();

  store.activities.unshift({
    id: generateId('act'),
    type: 'reminder_deleted',
    summary: `Deleted reminder: "${deletedReminder.title}"`,
    timestamp: nowISO,
    actionsCount: 1
  });

  await writeStore(store);
  return deletedReminder;
}

export async function toggleReminderStatus(reminderId) {
  const store = await readStore();
  const reminder = store.reminders.find(r => r.id === reminderId);
  if (!reminder) return null;

  const newStatus = reminder.status === 'completed' ? 'upcoming' : 'completed';
  return updateReminder(reminderId, { status: newStatus });
}

/**
 * Development-only store reset. Never executes in production.
 */
export async function resetStore(mode = 'empty') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetStore is strictly forbidden in production mode.');
  }

  let resetData;
  if (mode === 'seed') {
    const nowISO = new Date().toISOString();
    resetData = {
      expenses: [
        {
          id: 'exp-1',
          amount: 250,
          currency: '₹',
          category: 'Food & Dining',
          description: 'Lunch at cafe with team',
          date: nowISO.split('T')[0],
          createdAt: nowISO
        }
      ],
      tasks: [
        {
          id: 'tsk-1',
          title: 'Review frontend component architecture',
          priority: 'high',
          dueDate: 'Tomorrow',
          completed: false,
          createdAt: nowISO
        }
      ],
      reminders: [
        {
          id: 'rem-1',
          title: 'Submit assignment draft on Hackathon portal',
          date: 'Friday',
          time: '5:00 PM',
          dateTime: 'Friday, 5:00 PM',
          status: 'upcoming',
          createdAt: nowISO
        }
      ],
      activities: [
        {
          id: generateId('act'),
          type: 'voice_command',
          summary: 'Workspace initialized with seed template',
          timestamp: nowISO,
          actionsCount: 3
        }
      ]
    };
  } else {
    resetData = {
      expenses: [],
      tasks: [],
      reminders: [],
      activities: []
    };
  }

  await writeStore(resetData);
  return resetData;
}
