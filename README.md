# Voca — Voice to Action AI Assistant

> **Turn natural speech into completed, multi-action productivity workflows — instantly.**

[![Live Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)](https://voca-voice-to-action.onrender.com/api/health)
[![GitHub](https://img.shields.io/badge/Source-GitHub-181717?style=flat-square&logo=github)](https://github.com/AdityaGhumre/voca-voice-to-action)
[![Node](https://img.shields.io/badge/Node.js-v18+-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)

---

## 🧩 Problem Statement

Modern productivity tools demand that users open separate apps for expenses, tasks, and reminders — each with its own input flow. When you're in the middle of a conversation or a meeting, that friction means things get forgotten.

**The core problem:** Capturing multiple related thoughts at once — across different productivity categories — is broken. No single tool lets you express a compound intention naturally and have it executed completely.

---

## 🎙️ Project Overview

**Voca** is a voice-first AI productivity assistant that transforms natural spoken commands into structured, executed actions — across expenses, tasks, and reminders — in a single interaction.

A user speaks once. Voca listens, comprehends the full intent using Google Gemini AI, executes every sub-action, persists the data, and confirms with spoken voice feedback.

**Example compound command:**
> *"I spent ₹250 on lunch, remind me to submit my assignment on Friday at 5 PM, and create a high-priority task to prepare the hackathon demo with description: test the microphone, verify all three actions and prepare the presentation."*

From this single sentence, Voca simultaneously creates:
1. **Expense** — ₹250, category: Food & Dining, date: today
2. **Reminder** — "Submit assignment", scheduled: Friday at 5:00 PM (future-date validated)
3. **Task** — "Prepare the hackathon demo", priority: high, with structured description

No manual form-filling. No switching apps. One voice command.

---

## ⚙️ How Voca Works

```
Voice Input  ──▶  Gemini AI Parse  ──▶  Action Engine  ──▶  JSON Storage
    │                   │                     │                    │
    │        (Structured JSON intent)   (Dedup + Validate)   (Atomic write)
    │                   │                     │                    │
    └───────────────────▼─────────────────────▼────────────────────▼
                   Voice Confirmation (SpeechSynthesis API)
                   Dashboard Refresh (Real-time UI update)
```

### Step-by-step Flow

1. **Voice Input (Browser):** The user clicks the microphone. The Web Speech API (`SpeechRecognition`) captures continuous speech across multiple recognition sessions, combining segments into a single transcript. A 3-second silence timer finalizes the command; a 7-second inactivity timer auto-cancels if the user says nothing.

2. **AI Intent Parsing (Server):** The transcript is sent to `POST /api/parse-command`. The Express server calls `@google/genai` (`gemini-3.5-flash-lite` by default) with a structured system prompt that includes today's date and current time for accurate relative date resolution. Gemini returns a typed JSON object containing arrays of `expenses`, `tasks`, and `reminders` — or a clarification request if critical information is missing.

3. **Validation & Sanitization:** The server's `sanitizeAndValidateAIOutput()` function validates every field, normalizes priorities, rejects past-dated reminders, and ensures no hallucinated amounts or titles are accepted.

4. **Action Execution (Server):** `POST /api/execute-actions` saves all validated actions in a single atomic write through the sequential write queue in `db.js`. An idempotency cache (5-minute TTL, keyed by `requestId`) prevents double-saves from network retries.

5. **Action-level Duplicate Detection:** Before saving, `findActionDuplicates()` compares normalized titles against existing pending tasks, upcoming reminders, and recent expenses. Duplicates surface a user-facing confirmation prompt rather than silently re-creating records.

6. **Voice Confirmation (Browser):** After confirmed backend persistence, `SpeechSynthesis` reads the assistant's confirmation message aloud. Currency symbols (`₹`) are normalized to spoken words before synthesis.

7. **Dashboard Refresh:** The React frontend polls the dashboard every 15 seconds and also triggers an immediate refresh after every successful execution.

---

## ✨ Detailed Features

### 🎤 Voice Engine
- **Multi-session speech capture** — automatically restarts `SpeechRecognition` on session end to handle natural pauses (up to 5 consecutive restarts after speech begins).
- **3-second silence window** — finalizes recording after detecting 3 seconds of quiet following actual speech.
- **7-second inactivity timeout** — auto-cancels recording and returns to idle if no speech is detected after clicking the mic.
- **Transcript deduplication** — interim and final results are merged without word duplication across segments.
- **Sample prompts** — built-in example commands for quick demonstration.

### 🧠 Gemini AI Intent Parsing
- Extracts multiple action types from a single sentence.
- Resolves relative dates ("tomorrow", "next Friday", "yesterday") using server-side date context.
- Infers expense categories from natural language descriptions.
- Extracts task titles, structured descriptions, notes, priorities, and due dates from spoken detail.
- Requests clarification when required fields are missing (e.g., expense without an amount).
- Rejects past-dated reminders before they reach storage.
- 25-second server-side timeout; falls back with a friendly error if Gemini is unreachable.

### 💰 Expense Tracking
- Record amount, category, description, and date from voice.
- 9 built-in categories: Food & Dining, Groceries, Transit, Shopping, Entertainment, Software, Health, Bills, General.
- Full expense detail view with edit form and delete with confirmation dialog.
- Dashboard summary with total spend and per-item history.

### ✅ Task Management
- Rich task data model: title, description, notes, priority (low / medium / high), due date, completed status.
- One-click task completion toggle — persisted to backend immediately.
- Full task detail panel with edit and delete.
- Priority badges, due date display, and completion tracking.

### 🔔 Reminder Management
- Schedule reminders with title, description/notes, date, and time.
- **Past-date guard:** both voice-created and manually created/edited reminders are validated against the current server timestamp — past times are rejected with a friendly message.
- Full reminder detail panel with edit and delete.
- Reminder status tracking: upcoming / completed.

### 🛡️ Duplicate Protection — Two Layers
1. **Request-level (client):** A normalized command fingerprint is compared against the last executed command within a 60-second rolling window. Exact repeats prompt the user to confirm before re-execution.
2. **Action-level (server):** `findActionDuplicates()` compares normalized titles against existing records. The backend returns a `duplicateWarning` payload; the frontend shows a contextual prompt.
3. **Idempotency (server):** Every execution request includes a unique `requestId`. The server caches responses for 5 minutes, ensuring network retries return the original result rather than creating duplicate records.

### 🔊 Voice Feedback
- Successful actions are read aloud using the browser `SpeechSynthesis` API.
- Prioritizes `en-IN` (Indian English) voices; falls back to any available English voice.
- Mute toggle with preference persisted in `localStorage`.
- Replay button to re-hear the last confirmation.
- Currency symbols (₹) normalized to spoken words.

### 🌐 Network & Error Handling
- **Frontend request timeouts:** 30 seconds for AI-backed requests (`parse-command`, `execute-actions`); 15 seconds for CRUD operations (PATCH/DELETE/GET). All use `AbortController`.
- **Friendly error messages:** `TypeError: Failed to fetch` is caught and shown as a human-readable connection error — never a raw stack trace.
- **Backend health polling:** Frontend polls `/api/health` every 15 seconds and shows an offline banner when the backend is unreachable.
- **Global Express error handler:** All uncaught server exceptions return valid JSON rather than HTML error pages.
- **Button guards:** `isAIInFlightRef` prevents concurrent AI submissions; `isProcessing` disables the microphone during active requests.

### 📱 Responsive Design
- Fully responsive across desktop (1280px+), tablet (768px), and mobile (390px / 360px).
- Mobile: collapsible sidebar replaced by a bottom navigation drawer.
- Modals and detail panels scroll within the viewport on small screens.
- No horizontal overflow.

---

## 🧰 Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend Framework** | React 19 | Concurrent rendering, hooks-based state, large ecosystem |
| **Build Tool** | Vite 8 | Instant HMR, fast production builds, built-in proxy for local dev |
| **Styling** | Tailwind CSS v4 | Utility-first, no runtime overhead, consistent design tokens |
| **Icons** | Lucide React | Lightweight, tree-shakable SVG icon library |
| **HTTP Client** | Native `fetch` + `AbortController` | Zero dependency, full timeout and cancellation control |
| **Speech Input** | Web Speech API (`SpeechRecognition`) | Built into Chrome/Edge/Safari — no external library required |
| **Speech Output** | Web Speech API (`SpeechSynthesis`) | Native TTS with voice selection and rate/pitch control |
| **Backend Runtime** | Node.js v18+ (ES Modules) | Async I/O, `node --watch` for dev, native ESM support |
| **Backend Framework** | Express 4 | Minimal, well-documented, easy middleware composition |
| **AI Model** | Google Gemini (`@google/genai`) | Structured JSON output mode, strong multi-intent NLU, fast flash-lite variant |
| **Storage** | JSON file (`fs/promises`, atomic rename) | Zero external dependency, easy to inspect and reset, suitable for hackathon scope |
| **Linter** | OXLint | Extremely fast Rust-based linter with zero config |
| **Deployment (Backend)** | Render | Free-tier Node.js hosting with environment variable management |
| **Deployment (Frontend)** | Vercel | Zero-config Vite deployment, `VITE_API_BASE_URL` env var support |

---

## 🏗️ System Architecture

```
vocal-ai/
├── package.json              # Root workspace scripts (dev, build, db:reset, db:seed)
├── .gitignore                # Excludes .env, node_modules, dist, store.json
├── .gitattributes            # Enforces LF line endings cross-platform
├── README.md
│
├── client/                   # React + Vite Frontend
│   ├── public/               # Static assets (SVG favicon, icons)
│   ├── src/
│   │   ├── App.jsx           # Root layout, tab routing, dashboard state, health polling
│   │   ├── components/
│   │   │   ├── VoiceCenterpiece.jsx  # Mic engine, silence/inactivity timers, AI pipeline
│   │   │   ├── Sidebar.jsx           # Navigation tabs, backend status pill, mobile drawer
│   │   │   ├── Header.jsx            # Greeting, sync button, backend status
│   │   │   ├── ExpenseCard.jsx       # Expense list (opens ExpenseDetailModal)
│   │   │   ├── ExpenseDetailModal.jsx # View / edit / delete expense
│   │   │   ├── TasksCard.jsx         # Task list with toggle (opens TaskDetailModal)
│   │   │   ├── TaskDetailModal.jsx   # View / edit / delete task
│   │   │   ├── RemindersCard.jsx     # Reminder list (opens ReminderDetailModal)
│   │   │   ├── ReminderDetailModal.jsx # View / edit / delete reminder (past-date guard)
│   │   │   └── ActivityCard.jsx      # Audit trail of voice actions
│   │   └── services/
│   │       ├── api.js                # Typed fetch wrappers with timeout + error handling
│   │       └── speechSynthesis.js    # TTS helper: voice selection, text normalization
│   └── vite.config.js        # /api proxy → localhost:5000 (dev only)
│
└── server/                   # Node.js + Express Backend
    ├── data/
    │   ├── store.json        # Runtime JSON database (git-ignored)
    │   ├── store.example.json # Example data shape for reference
    │   └── .gitkeep          # Keeps the data/ directory tracked in Git
    ├── src/
    │   ├── index.js          # Express app, CORS, 404 handler, global error handler
    │   ├── routes/
    │   │   ├── health.js     # GET /api/health
    │   │   ├── parser.js     # POST /api/parse-command → Gemini
    │   │   ├── actions.js    # POST /api/execute-actions, CRUD for tasks/expenses/reminders
    │   │   └── dashboard.js  # GET /api/dashboard, GET /api/expenses, GET /api/tasks, etc.
    │   ├── services/
    │   │   └── gemini.js     # Gemini AI client, system prompt, response validation
    │   ├── storage/
    │   │   └── db.js         # Atomic JSON read/write, sequential write queue, duplicate finder
    │   └── utils/
    │       └── dateTime.js   # Local time/date helpers, reminder schedule validator
    └── .env.example          # Environment variable template (copy to .env to run locally)
```

> ⚠️ `server/.env` is **git-ignored**. Never commit your real API key. Copy `.env.example` to `.env` and add your own `GEMINI_API_KEY`.

### Data Flow Diagram

```
Browser                     Express Server                  Gemini API
  │                               │                              │
  │── POST /api/parse-command ───▶│                              │
  │   { transcript }              │── generateContent() ────────▶│
  │                               │   (system prompt + text)     │
  │                               │◀── JSON intent response ─────│
  │                               │   sanitizeAndValidateAIOutput()
  │◀── { actions, summary } ──────│                              │
  │                               │
  │── POST /api/execute-actions ─▶│
  │   { actions, requestId }      │── idempotency check
  │                               │── findActionDuplicates()
  │                               │── writeStore() (atomic)
  │◀── { saved, message } ────────│
  │                               │
  │  SpeechSynthesis.speak()      │
  │  Dashboard refresh poll       │
```

---

## 👤 Individual Contribution

Voca is a **solo project**, built entirely by **Aditya Ghumre** over the hackathon sprint.

All aspects of the project were designed, implemented, tested, and deployed by one person:

- Product concept and UX design
- Full-stack architecture (React frontend + Node.js/Express backend)
- Gemini AI integration and prompt engineering
- Voice input engine (multi-session `SpeechRecognition`, silence detection, transcript deduplication)
- Voice output engine (`SpeechSynthesis`, voice selection, text normalization)
- Duplicate detection at both client and server levels
- Idempotency system for safe network retries
- Past-date validation for reminders (client + server)
- Full CRUD management for expenses, tasks, and reminders
- Network error handling and request timeout infrastructure
- Responsive CSS (desktop, tablet, mobile)
- Git setup, whitespace cleanup, security audit (no secrets in source)
- Backend deployment on Render, frontend build configuration for Vercel

---

## 🧗 Technical Challenges and Solutions

### Challenge 1 — Natural Speech Pauses Without False Endings
**Problem:** The browser's `SpeechRecognition` API ends sessions after short silences, cutting off mid-sentence.

**Solution:** `VoiceCenterpiece.jsx` runs recognition in `continuous = false` mode and auto-restarts the session on `onend` while `isRecordingSessionRef` is active. Final transcript segments are accumulated in `sessionTranscriptPartsRef` and joined without duplicates. A 3-second silence timer (reset on every `onresult` event) triggers finalization; a separate 7-second inactivity timer handles the case where the user starts the mic but says nothing.

### Challenge 2 — Multi-Intent Parsing from Free-Form Speech
**Problem:** A single sentence can contain an expense, a reminder, and a task — each with different required fields and date formats.

**Solution:** A carefully engineered Gemini system prompt with a strict JSON output schema, field-level rules, and injected current date/time context. The server's `sanitizeAndValidateAIOutput()` function acts as a second validation layer, normalizing types, rejecting invalid amounts, and verifying reminder dates against the actual server clock.

### Challenge 3 — Preventing Duplicate Records
**Problem:** Accidental double-taps, network retries, and re-spoken commands all risk creating identical records.

**Solution:** Three independent guards: (1) a client-side 60-second command fingerprint window, (2) a server-side `findActionDuplicates()` title-match check with user confirmation prompt, and (3) a `requestId`-keyed idempotency cache (5-minute TTL) on the action execution endpoint.

### Challenge 4 — Atomic JSON Writes Under Concurrency
**Problem:** Concurrent requests could corrupt the JSON storage file through interleaved writes.

**Solution:** `writeStore()` in `db.js` chains all writes through a `Promise`-based sequential queue (`writeQueue = writeQueue.then(task)`), and writes to a `.tmp` file first before atomically renaming it to `store.json`. This ensures the main file is never left in a partial state.

### Challenge 5 — Indefinite Hangs on Slow API Responses
**Problem:** If Gemini or the backend is slow or unreachable, the UI would freeze with no recovery path.

**Solution:** `fetchWithTimeout()` in `api.js` wraps every `fetch` call with an `AbortController` (30-second timeout for AI endpoints, 15-second for CRUD). The server wraps the Gemini API call in a `Promise.race` with a 25-second rejection. All timeout/network errors surface as user-readable messages, not raw `TypeError` exceptions.

### Challenge 6 — Past-Date Reminder Validation Across Timezones
**Problem:** Gemini resolves dates in UTC but the server runs in a local timezone; a reminder for "today at 8 AM" could be accepted at 9 AM.

**Solution:** `dateTime.js` provides `getLocalDateString()` and `getLocalTimeString()` using the server process's local clock, which are injected directly into the Gemini system prompt. `validateReminderSchedule()` performs a final comparison against `new Date()` on the server before the record is saved.

---

## 🧪 Testing and Quality Assurance

Testing was performed manually and through Node.js scripts targeting individual subsystems.

### Voice & AI Pipeline
- Tested single-intent commands (expense only, task only, reminder only).
- Tested compound commands combining all three action types in one sentence.
- Tested ambiguous input (expense with no amount) — confirmed clarification prompt appears.
- Tested empty voice input — confirmed no API call is made.
- Tested duplicate commands within 60 seconds — confirmed duplicate prompt appears.

### Past-Date Validation
- Tested reminders for yesterday, earlier today, and future times.
- Verified server-side rejection returns a user-readable message.
- Verified voice-created, manually created, and edited reminders all pass through the same validation path.

### Network Failure Scenarios
- Backend stopped mid-session — frontend shows connection error; mic remains usable.
- Simulated slow Gemini response — confirmed timeout fires after 30 seconds with friendly message.
- Rapid double-click on mic during processing — `isAIInFlightRef` guard confirmed effective.
- Save fails after parse succeeds — confirmed `aiResult` is preserved so the user sees what was understood.

### CRUD Operations
- Edit and delete tested for expenses, tasks, and reminders.
- Confirmed optimistic UI updates are rolled back on failure.
- Confirmed task toggle persists to backend and refreshes counts.

### Production Build
- `vite build` passes with **0 errors, 0 warnings**.
- `git diff --cached --check` passes with **0 whitespace issues**.
- Confirmed no API keys appear in the compiled JavaScript bundle.

---

## 🚀 Deployment

### Backend — Render
**URL:** [https://voca-voice-to-action.onrender.com](https://voca-voice-to-action.onrender.com)
**Health check:** [https://voca-voice-to-action.onrender.com/api/health](https://voca-voice-to-action.onrender.com/api/health)

The Express server runs on Render's free tier using `npm start` (`node src/index.js`).

> ⚠️ **Storage note:** Render's free tier uses ephemeral disk storage. Data stored in `server/data/store.json` **will not persist across deployments or restarts** unless a persistent disk is attached. For production use, migrate `db.js` to a persistent database such as MongoDB Atlas or Supabase.

Required environment variable on Render:
```
GEMINI_API_KEY=your_key_here
PORT=5000
```

### Frontend — Vercel
**URL:** _(Vercel deployment pending — link to be added after final deployment)_

Required environment variable on Vercel:
```
VITE_API_BASE_URL=https://voca-voice-to-action.onrender.com
```

The `getApiBase()` function in `client/src/services/api.js` reads `VITE_API_BASE_URL` at build time (Vite replaces it via `import.meta.env`). Without this variable, it falls back to `/api` for local development.

### Source Code
**GitHub:** [https://github.com/AdityaGhumre/voca-voice-to-action](https://github.com/AdityaGhumre/voca-voice-to-action)

---

## 🖥️ Local Setup

### Prerequisites
- **Node.js** v18+ (developed on v24.12.0)
- **npm** v10+
- A **Google Gemini API key** — [get one free at Google AI Studio](https://aistudio.google.com/app/apikey)
- A browser with Web Speech API support: **Google Chrome** or **Microsoft Edge** (recommended)

### 1. Clone the Repository
```bash
git clone https://github.com/AdityaGhumre/voca-voice-to-action.git
cd voca-voice-to-action
```

### 2. Install Dependencies
```bash
npm run install:all
```

### 3. Configure the Backend
```bash
cp server/.env.example server/.env
```
Open `server/.env` and add your Gemini API key:
```
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Start the Backend (Port 5000)
```bash
npm run dev:server
```
Health check: `http://localhost:5000/api/health`

### 5. Start the Frontend (Port 5173)
```bash
npm run dev:client
```
Application: `http://localhost:5173`

> The Vite dev server automatically proxies all `/api/*` requests to `http://localhost:5000`.

### Optional Database Utilities
```bash
npm run db:reset   # Clear all stored data
npm run db:seed    # Load example seed records
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server status, uptime, AI config flag, record counts |
| `GET` | `/api/ai-status` | Gemini API connectivity check |
| `POST` | `/api/parse-command` | Parse voice transcript → structured intent (Gemini) |
| `POST` | `/api/execute-actions` | Save parsed actions to storage (idempotency + dedup) |
| `GET` | `/api/dashboard` | Full dashboard data (expenses, tasks, reminders, activity) |
| `GET` | `/api/expenses` | List all expenses |
| `PATCH` | `/api/expenses/:id` | Update expense (amount, description, category, date) |
| `DELETE` | `/api/expenses/:id` | Delete expense |
| `GET` | `/api/tasks` | List all tasks |
| `PATCH` | `/api/tasks/:id` | Update task (title, description, notes, priority, dueDate) |
| `PATCH` | `/api/tasks/:id/toggle` | Toggle task completion |
| `DELETE` | `/api/tasks/:id` | Delete task |
| `GET` | `/api/reminders` | List all reminders |
| `PATCH` | `/api/reminders/:id` | Update reminder (title, description, date, time — past-date validated) |
| `PATCH` | `/api/reminders/:id/toggle` | Toggle reminder completion |
| `DELETE` | `/api/reminders/:id` | Delete reminder |
| `GET` | `/api/activity` | Audit log of all processed voice commands |

---

## 🎨 Visual Identity

| Element | Value |
|---------|-------|
| **Background** | Deep Navy `#0B0F17` |
| **Card Surface** | Dark Blue `#101726` |
| **Primary Text** | Warm Ivory `#F7F7F2` |
| **Primary Accent** | Electric Lime `#CCFF00` — mic pulse, success states, active nav |
| **AI / Secondary Accent** | Violet `#8B5CF6` — AI badges, reminder indicators |
| **Muted Text** | Steel Blue `#9AA6BC` |
| **Typography** | *Plus Jakarta Sans* (UI) · *JetBrains Mono* (data, IDs) |

---

## 🎬 Demo

### Screenshots

> _Screenshots to be added after final deployment._
>
> Planned captures:
> - Dashboard overview with expenses, tasks, and reminders
> - Voice recording in progress (listening state with audio waveform)
> - Multi-action result panel after a compound command
> - Task detail modal (view + edit)
> - Expense detail modal
> - Reminder detail modal with past-date rejection message
> - Mobile view (drawer navigation)

### Demo Video

> _Demo video link to be added after recording._

---

## 🔭 Future Improvements

- **Persistent database** — Replace the JSON file store with a hosted database (MongoDB Atlas, PlanetScale, Supabase) to retain data across server restarts on Render.
- **User authentication** — Add user accounts so multiple users can maintain separate data.
- **Recurring reminders** — Support "every Monday", "daily at 9 AM" scheduling patterns.
- **Expense analytics** — Charts and summaries: monthly spend by category, budget alerts.
- **Calendar integration** — Sync tasks and reminders to Google Calendar or Apple Calendar.
- **Push notifications** — Browser or mobile push when a reminder time is reached.
- **Offline support** — Queue voice commands locally and sync when connectivity is restored.
- **Multi-language** — Support for regional Indian languages (Hindi, Marathi, Tamil) using multilingual Gemini prompts.
- **Custom categories** — User-defined expense categories beyond the built-in nine.
- **Export** — Download expenses as CSV, tasks as a markdown checklist, or reminders as an `.ics` calendar file.

---

## 📄 License

ISC — built for the hackathon, open for learning and extension.

---

*Built solo by [Aditya Ghumre](https://github.com/AdityaGhumre) · November 2026*
