import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getLocalDateString,
  getLocalTimeString,
  getLocalTime24String,
  validateReminderSchedule
} from '../utils/dateTime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

let aiClient = null;

function getAIClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Calculates current date context for relative date resolution.
 */
function getDateContext() {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: timezone };
  const formattedDate = new Intl.DateTimeFormat('en-US', options).format(now);
  const isoDate = getLocalDateString(now);
  const timeFormatted = getLocalTimeString(now);
  const time24 = getLocalTime24String(now);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[now.getDay()];

  return {
    todayISO: isoDate,
    formattedToday: formattedDate,
    dayOfWeek,
    currentTime: timeFormatted,
    currentTime24: time24,
    timezone
  };
}

/**
 * Parses natural language voice transcript into structured actions.
 */
export async function parseCommandWithGemini(transcript) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    throw new Error('Transcript is required and must be a non-empty string.');
  }

  const ai = getAIClient();
  const dateContext = getDateContext();
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  const systemInstruction = `
You are the AI parser engine for "Voca", a voice-to-action productivity assistant.
Your job is to understand user speech transcripts and convert them into structured JSON productivity actions.

CURRENT DATE & TIME CONTEXT:
- Today's Date: ${dateContext.todayISO} (${dateContext.dayOfWeek}, ${dateContext.formattedToday})
- Current Server Time: ${dateContext.currentTime} (${dateContext.currentTime24})
- Server Timezone: ${dateContext.timezone}

SUPPORTED ACTION TYPES:
1. "expenses":
   - amount: number (e.g. 250)
   - currency: string (e.g. "₹", "$", or default "₹")
   - category: string (e.g. "Food & Dining", "Groceries", "Transit", "Shopping", "Entertainment", "Software", "Health", "Bills", "General")
   - description: string (clear description of expense)
   - date: string in YYYY-MM-DD format (resolve relative dates like "today", "yesterday", or default to today's date)

2. "tasks":
   - title: string (actionable task title)
   - description: string or null (optional detailed description, sub-steps or details if explicitly spoken by user, e.g. "description: ...", "details: ...", "with details...", default to null)
   - notes: string or null (optional extra notes, context or instructions if explicitly spoken by user, default to null)
   - priority: "low" | "medium" | "high" (infer from urgency or words like "important", "urgent", "high priority", default to "medium")
   - dueDate: string in YYYY-MM-DD format (or relative descriptor if exact date cannot be resolved)

3. "reminders":
   - title: string (what to be reminded of)
   - date: string in YYYY-MM-DD format (resolve days like "Friday", "tomorrow", or "next Monday")
   - time: string or null (e.g. "09:00 PM", "17:00", or null if not specified)

STRICT RULES:
1. A single sentence may contain multiple actions (e.g., an expense AND a reminder AND a task). Extract all valid actions.
2. Rely on natural language semantics, not rigid keywords.
3. For tasks, extract description and notes ONLY when the user explicitly provides them in speech (e.g. "Create a high-priority task to prepare the hackathon demo, description: test the microphone, verify all three actions and prepare the presentation" -> title: "Prepare the hackathon demo", priority: "high", description: "Test the microphone, verify all three actions and prepare the presentation"). NEVER invent, extrapolate, or hallucinate descriptions or notes when none were spoken.
4. NEVER invent or hallucinate missing critical info.
   - If an expense is mentioned without an amount (e.g. "I spent on lunch" or "I spent money on lunch"), set clarificationNeeded: true and specify what is missing in clarificationMessage.
   - If a reminder is mentioned without a title or topic, ask for clarification.
5. Resolve relative dates accurately using the provided Today's Date (${dateContext.todayISO}):
   - "tomorrow" -> add 1 day
   - "Friday" -> find the upcoming Friday
   - "yesterday" -> subtract 1 day
6. PAST DATE & TIME VALIDATION FOR REMINDERS:
   Reminders can ONLY be scheduled for future dates and times relative to the current server date (${dateContext.todayISO}) and time (${dateContext.currentTime} / ${dateContext.currentTime24}).
   If a user requests a reminder for a date in the past (e.g. yesterday, earlier dates) OR for today at a time that has already passed, DO NOT schedule that reminder.
   Instead:
   - Do NOT include that reminder in actions.reminders (keep reminders array empty).
   - Set clarificationNeeded: true.
   - Set clarificationMessage: "This reminder time has already passed. Please choose a future time."
   - Set assistantMessage: "This reminder time has already passed. Please choose a future time."
7. Return a friendly "assistantMessage" summarizing what actions were identified, or clarifying what is needed.
8. Return ONLY valid JSON matching the exact schema below.

OUTPUT JSON SCHEMA:
{
  "assistantMessage": "string summarizing parsed actions or asking for clarification",
  "clarificationNeeded": boolean,
  "clarificationMessage": "string or null",
  "actions": {
    "expenses": [
      {
        "amount": number,
        "currency": "string",
        "category": "string",
        "description": "string",
        "date": "YYYY-MM-DD"
      }
    ],
    "tasks": [
      {
        "title": "string",
        "description": "string or null",
        "notes": "string or null",
        "priority": "low" | "medium" | "high",
        "dueDate": "string"
      }
    ],
    "reminders": [
      {
        "title": "string",
        "date": "YYYY-MM-DD",
        "time": "string or null"
      }
    ]
  }
}
`;

  const prompt = `User voice transcript: "${transcript.trim()}"`;

  const GEMINI_TIMEOUT_MS = 25000; // 25 seconds
  const geminiRequest = ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json'
    }
  });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('Gemini API timed out. Please check your connection and try again.')),
      GEMINI_TIMEOUT_MS
    )
  );
  const response = await Promise.race([geminiRequest, timeoutPromise]);

  const rawText = response.text?.trim() || '';
  if (!rawText) {
    throw new Error('Gemini API returned an empty text response.');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Attempt fallback in case response was wrapped in markdown fences
    const cleaned = rawText.replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Attempt substring bracket extraction
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
      } else {
        throw new Error('Failed to parse Gemini output as structured JSON.');
      }
    }
  }

  // Backend Validation and Normalization
  return sanitizeAndValidateAIOutput(parsed, transcript);
}

/**
 * Validates and sanitizes AI output to ensure strict reliability before sending to frontend.
 */
function sanitizeAndValidateAIOutput(aiResult, originalTranscript) {
  const clarificationNeeded = Boolean(aiResult.clarificationNeeded);
  const clarificationMessage = aiResult.clarificationMessage || null;

  const rawActions = aiResult.actions || {};
  const expenses = [];
  const tasks = [];
  const reminders = [];

  // Validate Expenses
  if (Array.isArray(rawActions.expenses)) {
    for (const exp of rawActions.expenses) {
      const amount = Number(exp.amount);
      if (!isNaN(amount) && amount > 0) {
        expenses.push({
          amount,
          currency: exp.currency || '₹',
          category: exp.category || 'General',
          description: exp.description || 'Expense',
          date: exp.date || new Date().toISOString().split('T')[0]
        });
      }
    }
  }

  // Validate Tasks
  if (Array.isArray(rawActions.tasks)) {
    for (const task of rawActions.tasks) {
      if (task.title && typeof task.title === 'string' && task.title.trim()) {
        const priority = ['low', 'medium', 'high'].includes(task.priority?.toLowerCase())
          ? task.priority.toLowerCase()
          : 'medium';

        tasks.push({
          title: task.title.trim(),
          description: typeof task.description === 'string' ? task.description.trim() || null : null,
          notes: typeof task.notes === 'string' ? task.notes.trim() || null : null,
          priority,
          dueDate: task.dueDate || 'Soon'
        });
      }
    }
  }

  // Validate Reminders (Past date/time rejection)
  let pastReminderDetected = false;
  const PAST_DATE_ERROR_MSG = 'This reminder time has already passed. Please choose a future time.';

  if (Array.isArray(rawActions.reminders)) {
    for (const rem of rawActions.reminders) {
      if (rem.title && typeof rem.title === 'string' && rem.title.trim()) {
        const scheduleCheck = validateReminderSchedule(rem.date, rem.time);

        if (!scheduleCheck.valid && scheduleCheck.isPast) {
          console.warn(`[AI Guard] Rejected past reminder: "${rem.title}" scheduled for date="${rem.date}" time="${rem.time || ''}"`);
          pastReminderDetected = true;
          continue; // Do NOT add past reminder
        }

        reminders.push({
          title: rem.title.trim(),
          date: scheduleCheck.normalizedDate || rem.date || 'Upcoming',
          time: scheduleCheck.normalizedTime || rem.time || null
        });
      }
    }
  }

  const totalActions = expenses.length + tasks.length + reminders.length;

  // Handle case where reminder was requested for the past
  if (pastReminderDetected) {
    if (totalActions === 0) {
      return {
        transcript: originalTranscript,
        assistantMessage: PAST_DATE_ERROR_MSG,
        clarificationNeeded: true,
        clarificationMessage: PAST_DATE_ERROR_MSG,
        actions: { expenses: [], tasks: [], reminders: [] },
        summary: { totalActions: 0, expenseCount: 0, taskCount: 0, reminderCount: 0 }
      };
    } else {
      // Other actions (e.g. expenses/tasks) were valid, but the reminder was rejected
      return {
        transcript: originalTranscript,
        assistantMessage: `${aiResult.assistantMessage || `Processed ${totalActions} valid action(s).`} Note: A reminder scheduled for a past time was not saved. Please choose a future time.`,
        clarificationNeeded: false,
        clarificationMessage: null,
        actions: { expenses, tasks, reminders },
        summary: {
          totalActions,
          expenseCount: expenses.length,
          taskCount: tasks.length,
          reminderCount: reminders.length
        }
      };
    }
  }

  return {
    transcript: originalTranscript,
    assistantMessage: aiResult.assistantMessage || (
      totalActions > 0
        ? `Identified ${totalActions} action${totalActions > 1 ? 's' : ''} from your voice command.`
        : 'Could not extract any actionable tasks or expenses from that sentence.'
    ),
    clarificationNeeded: clarificationNeeded || (totalActions === 0 && !clarificationMessage),
    clarificationMessage: clarificationMessage || (totalActions === 0 ? 'No specific expenses, tasks, or reminders were recognized in this sentence.' : null),
    actions: {
      expenses,
      tasks,
      reminders
    },
    summary: {
      totalActions,
      expenseCount: expenses.length,
      taskCount: tasks.length,
      reminderCount: reminders.length
    }
  };
}
