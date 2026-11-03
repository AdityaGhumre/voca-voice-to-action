const API_BASE = '/api';

// Timeout constants (ms)
const AI_REQUEST_TIMEOUT_MS = 30000;   // 30s for parse + execute (Gemini-backed)
const CRUD_REQUEST_TIMEOUT_MS = 15000; // 15s for PATCH / DELETE / GET operations

/**
 * Creates a fetch with an AbortController timeout.
 * Throws a friendly error on timeout or network failure.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = CRUD_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timerId);
    return res;
  } catch (err) {
    clearTimeout(timerId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. The server took too long to respond — please try again.');
    }
    // TypeError: Failed to fetch → server unreachable / no internet
    if (err instanceof TypeError) {
      throw new Error('Could not reach the Voca server. Please ensure the backend is running and your network is connected.');
    }
    throw err;
  }
}

/**
 * Safely reads and parses HTTP response bodies, preventing "Unexpected end of JSON input".
 */
async function safeReadJSON(res, endpointName = 'API') {
  let rawText;
  try {
    rawText = await res.text();
  } catch {
    throw new Error(`${endpointName}: failed to read response from server.`);
  }

  if (!rawText || !rawText.trim()) {
    throw new Error(`${endpointName} returned an empty response (${res.status} ${res.statusText || 'No Content'}). Ensure the backend server is running on port 5000.`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`${endpointName} returned non-JSON response (${res.status}): ${rawText.slice(0, 150)}`);
  }

  if (!res.ok || data?.success === false) {
    const errorMsg = data?.error || `${endpointName} request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    err.details = data?.details;
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }

  return data;
}

export async function fetchHealth() {
  const res = await fetchWithTimeout(`${API_BASE}/health`, {}, CRUD_REQUEST_TIMEOUT_MS);
  return safeReadJSON(res, 'Health Check');
}

export async function fetchAIStatus() {
  const res = await fetchWithTimeout(`${API_BASE}/ai-status`, {}, CRUD_REQUEST_TIMEOUT_MS);
  return safeReadJSON(res, 'AI Status');
}

export async function fetchDashboard() {
  const res = await fetchWithTimeout(`${API_BASE}/dashboard`, {}, CRUD_REQUEST_TIMEOUT_MS);
  const data = await safeReadJSON(res, 'Dashboard');
  return data.data;
}

export async function fetchExpenses() {
  const res = await fetchWithTimeout(`${API_BASE}/expenses`, {}, CRUD_REQUEST_TIMEOUT_MS);
  const data = await safeReadJSON(res, 'Expenses');
  return data.data;
}

export async function updateExpense(expenseId, updates) {
  const res = await fetchWithTimeout(
    `${API_BASE}/expenses/${expenseId}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) },
    CRUD_REQUEST_TIMEOUT_MS
  );
  const data = await safeReadJSON(res, 'Expense Update');
  return data.expense;
}

export async function deleteExpense(expenseId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/expenses/${expenseId}`,
    { method: 'DELETE', headers: { 'Accept': 'application/json' } },
    CRUD_REQUEST_TIMEOUT_MS
  );
  const data = await safeReadJSON(res, 'Expense Delete');
  return data.expense;
}

export async function fetchTasks() {
  const res = await fetchWithTimeout(`${API_BASE}/tasks`, {}, CRUD_REQUEST_TIMEOUT_MS);
  const data = await safeReadJSON(res, 'Tasks');
  return data.data;
}

export async function fetchReminders() {
  const res = await fetchWithTimeout(`${API_BASE}/reminders`, {}, CRUD_REQUEST_TIMEOUT_MS);
  const data = await safeReadJSON(res, 'Reminders');
  return data.data;
}

export async function updateReminder(reminderId, updates) {
  const res = await fetchWithTimeout(
    `${API_BASE}/reminders/${reminderId}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) },
    CRUD_REQUEST_TIMEOUT_MS
  );
  const data = await safeReadJSON(res, 'Reminder Update');
  return data.reminder;
}

export async function deleteReminder(reminderId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/reminders/${reminderId}`,
    { method: 'DELETE', headers: { 'Accept': 'application/json' } },
    CRUD_REQUEST_TIMEOUT_MS
  );
  const data = await safeReadJSON(res, 'Reminder Delete');
  return data.reminder;
}

export async function toggleReminder(reminderId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/reminders/${reminderId}/toggle`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' } },
    CRUD_REQUEST_TIMEOUT_MS
  );
  const data = await safeReadJSON(res, 'Reminder Toggle');
  return data.reminder;
}

export async function fetchActivities() {
  const res = await fetchWithTimeout(`${API_BASE}/activity`, {}, CRUD_REQUEST_TIMEOUT_MS);
  const data = await safeReadJSON(res, 'Activities');
  return data.data;
}

export async function updateTask(taskId, updates) {
  const res = await fetchWithTimeout(
    `${API_BASE}/tasks/${taskId}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) },
    CRUD_REQUEST_TIMEOUT_MS
  );
  const data = await safeReadJSON(res, 'Task Update');
  return data.task;
}

export async function deleteTask(taskId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/tasks/${taskId}`,
    { method: 'DELETE', headers: { 'Accept': 'application/json' } },
    CRUD_REQUEST_TIMEOUT_MS
  );
  const data = await safeReadJSON(res, 'Task Delete');
  return data.task;
}

export async function toggleTask(taskId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/tasks/${taskId}/toggle`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' } },
    CRUD_REQUEST_TIMEOUT_MS
  );
  const data = await safeReadJSON(res, 'Task Toggle');
  return data.task;
}

export async function parseCommand(transcript) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    throw new Error('Transcript cannot be empty.');
  }

  const res = await fetchWithTimeout(
    `${API_BASE}/parse-command`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ transcript: transcript.trim() })
    },
    AI_REQUEST_TIMEOUT_MS
  );

  const data = await safeReadJSON(res, 'Voice Parser');
  return data.data;
}

export async function executeActions({ actions, transcript, assistantMessage, requestId, force = false }) {
  const res = await fetchWithTimeout(
    `${API_BASE}/execute-actions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ actions, transcript, assistantMessage, requestId, force })
    },
    AI_REQUEST_TIMEOUT_MS
  );

  const data = await safeReadJSON(res, 'Action Engine');
  return data;
}

export async function resetDevData(mode = 'empty') {
  const res = await fetchWithTimeout(
    `${API_BASE}/dev/reset`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) },
    CRUD_REQUEST_TIMEOUT_MS
  );
  return safeReadJSON(res, 'Dev Reset');
}
