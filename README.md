
# Voca — Voice to Action AI Assistant

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Open%20Voca-CCFF00?style=for-the-badge&logo=vercel&logoColor=black)](https://voca-voice-to-action.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Render-6D5DFB?style=for-the-badge)](https://voca-voice-to-action.onrender.com)
[![GitHub](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/AdityaGhumre/voca-voice-to-action)

**Turn natural speech into completed, multi-action productivity workflows — instantly.**

---

## 🧩 Problem Statement

Modern productivity tools demand that users open separate apps for expenses, tasks, and reminders — each with its own input flow. When you are in the middle of a conversation or a meeting, that friction means things get forgotten.

The core problem: capturing multiple related thoughts at once — across different productivity categories — is cumbersome. No single tool lets a user express a compound intention naturally and have it interpreted and executed in one interaction.

---

## 💡 Why Voca

**Who it is for:** Students, busy individuals, and anyone who wants to capture everyday expenses, tasks, and reminders quickly — especially when speaking is more convenient than filling out forms.

**What makes it different:** Instead of requiring separate entry flows in an expense tracker, a to-do app, and a reminder app, Voca interprets one compound spoken instruction and creates multiple structured records from it simultaneously.

**Hackathon:** `[TODO: add hackathon name and track]`

---

## 🎙️ Project Overview

Voca is a voice-first AI productivity assistant that transforms natural spoken commands into structured, executed actions across expenses, tasks, and reminders in a single interaction.

A user speaks once. Voca listens, interprets the full intent using Google Gemini AI, validates and executes the requested actions, persists the data, and confirms successful actions with spoken voice feedback.

### Example Compound Command

> *"I spent ₹250 on lunch, remind me to submit my assignment on Friday at 5 PM, and create a high-priority task to prepare the hackathon demo with description: test the microphone, verify all three actions and prepare the presentation."*

From this single sentence, Voca simultaneously creates:

- **Expense** — ₹250, category: Food & Dining, date: today.
- **Reminder** — "Submit assignment", scheduled for Friday at 5:00 PM (future-date validated).
- **Task** — "Prepare the hackathon demo", high priority, with the supplied description.

No manual form-filling. No switching apps. One voice command.

---

## ⚙️ How Voca Works

```text
Voice Input → Gemini AI Intent Parsing → Validation → Action Execution
     ↓                                                   ↓
Browser SpeechRecognition                      Duplicate + idempotency checks
                                                         ↓
                                                  JSON file storage
                                                         ↓
                         Voice confirmation ← Successful persistence
                                  ↓
                           Dashboard refresh
```

### Step-by-Step Flow

1. **Voice Input (Browser):** The user activates the microphone. The Web Speech API (`SpeechRecognition`) captures speech across multiple recognition sessions with automatic restarts and combines all transcript segments. A 3-second silence timer finalizes the command; a 7-second inactivity timer cancels recording if no speech is detected.

2. **AI Intent Parsing (Server):** The transcript is sent to `POST /api/parse-command`. The Express server calls `@google/genai` with a structured system prompt that includes the current server date and time for relative-date resolution. The default model is `gemini-3.5-flash-lite` (overridable via `GEMINI_MODEL` environment variable). Gemini returns structured expense, task, and reminder data, or a clarification request when required information is missing.

3. **Validation & Sanitization:** `sanitizeAndValidateAIOutput()` validates and normalizes fields, including types, value ranges, and priorities, and validates reminder schedules. It rejects invalid or malformed values, including out-of-range amounts, invalid types, and past-dated reminders.

4. **Action Execution (Server):** `POST /api/execute-actions` saves validated actions through a sequential Promise write queue in `db.js`, writing to a temporary file and then atomically renaming it to `store.json`.

5. **Duplicate Protection:** Three independent mechanisms (see Detailed Features) prevent accidental duplicate records from double-taps, network retries, and re-spoken commands.

6. **Voice Confirmation (Browser):** After confirmed backend persistence, `SpeechSynthesis` reads the assistant's confirmation aloud. Currency symbols such as ₹ are normalized to spoken words before synthesis.

7. **Dashboard Refresh:** The React frontend polls the dashboard every 15 seconds and also triggers an immediate refresh after every successful execution.

---

## ✨ Detailed Features

### 🎤 Voice Engine

- **Multi-session speech capture with automatic restarts** — `SpeechRecognition` runs with `continuous = false` and automatically restarts after each session ends, allowing up to 5 restarts once speech has begun, to handle natural pauses.
- 3-second silence window finalizes recording after quiet following actual speech.
- 7-second inactivity timeout returns to idle if no speech is detected after clicking the microphone.
- Transcript segments from each session are accumulated and joined without word duplication.
- Sample prompts provide example commands for quick demonstration.

### 🧠 Gemini AI Intent Parsing

- Extracts multiple action types from a single sentence.
- Resolves relative dates ("tomorrow", "next Friday", "yesterday") using server-side date and time context injected into the system prompt.
- Infers expense categories from natural-language descriptions.
- Extracts task titles, descriptions, notes, priorities, and due dates from spoken detail.
- Requests clarification when required fields are missing (for example, an expense without an amount).
- Rejects past-dated reminders at both the AI validation layer and the server storage layer.
- **Server-side Gemini timeout: 25 seconds.** The frontend AI request timeout is **30 seconds** as a client-side fallback; the server-side timeout is expected to fire first.

### 💰 Expense Tracking

- Records amount, category, description, and date from voice.
- Nine built-in categories: Food & Dining, Groceries, Transit, Shopping, Entertainment, Software, Health, Bills, and General.
- Expense detail view with an edit form and delete confirmation dialog.
- Dashboard summary with total spend and per-item history.

### ✅ Task Management

- Rich task data model: title, description, notes, priority (low / medium / high), due date, and completed status.
- One-click task completion toggle, persisted to the backend immediately.
- Task detail panel with editing and deletion.
- Priority badges, due-date display, and completion tracking.

### 🔔 Reminder Management

- Schedules reminders with title, description/notes, date, and time.
- **Past-date guard:** voice-created, manually created, and edited reminders are all validated against the current server timestamp before saving. Past times are rejected with a user-readable message.
- Reminder detail panel with editing and deletion.
- Reminder status tracking: upcoming / completed.

### 🛡️ Duplicate Protection — Three Layers

1. **Request-level (client):** A normalized command fingerprint is compared against the last executed command within a 60-second rolling window. Exact repeats prompt the user to confirm before re-execution.
2. **Action-level (server):** `findActionDuplicates()` compares normalized titles against existing records. The backend returns a `duplicateWarning` payload; the frontend shows a contextual confirmation prompt.
3. **Idempotency (server):** Every execution request includes a unique `requestId`. The server caches responses for 5 minutes so that network retries return the original result rather than creating duplicate records.

### 🔊 Voice Feedback

- Successful actions are read aloud using the browser `SpeechSynthesis` API.
- Prioritizes `en-IN` (Indian English) voices; falls back to any available English voice.
- Mute toggle with preference persisted in `localStorage`.
- Replay button to hear the last confirmation again.
- Currency symbols (₹) are normalized to spoken words before synthesis.

### 🌐 Network & Error Handling

- **Frontend request timeouts:** 30 seconds for AI-backed endpoints (`parse-command`, `execute-actions`) and 15 seconds for CRUD operations (GET, PATCH, DELETE). All requests use `AbortController`.
- **Server-side Gemini timeout:** 25 seconds via `Promise.race`, which is expected to fire before the frontend's 30-second fallback.
- Friendly network error messages are shown instead of raw stack traces or `TypeError` exceptions.
- Backend health polling runs every 15 seconds and displays an offline banner when the backend is unreachable.
- Global Express error handler returns valid JSON for all uncaught server exceptions.
- `isAIInFlightRef` prevents concurrent AI submissions; the processing state disables the microphone button during active requests.
- Gemini 429 / `RESOURCE_EXHAUSTED` errors from the API are detected and surfaced as a friendly "rate limit exceeded" message.

### 📱 Responsive Design

- Responsive layouts across desktop, tablet (768 px), and mobile (390 px / 360 px).
- Modals and detail panels scroll within the viewport on smaller screens.
- No horizontal page overflow.

---

## 🧰 Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend framework | React 19 | Hooks-based state management, concurrent rendering, and component-driven UI. |
| Build tool | Vite 8 | Fast development server with HMR, quick production builds, and built-in `/api` proxy for local development. |
| Styling | Tailwind CSS v4 | Utility-first styling and consistent design tokens; no runtime overhead. |
| Icons | Lucide React | Lightweight, tree-shakable SVG icon library. |
| HTTP client | Native `fetch` + `AbortController` | Full timeout and cancellation control without an additional HTTP client dependency. |
| Speech input | Web Speech API (`SpeechRecognition`) | Browser-native speech recognition. Works best in Chrome and Edge; Safari support is partial; Firefox is not supported. |
| Speech output | Web Speech API (`SpeechSynthesis`) | Browser-native text-to-speech with voice selection, rate, and pitch control. |
| Backend runtime | Node.js v18+ (ES Modules) | Asynchronous I/O and native ES module support. |
| Backend framework | Express 4 | Minimal, well-documented HTTP framework; easy middleware composition. |
| AI model | Google Gemini (`@google/genai`) | Natural-language intent parsing with structured JSON output mode. Default model: `gemini-3.5-flash-lite` (configurable via `GEMINI_MODEL`). |
| Storage | JSON file (`fs/promises`, atomic rename) | Simple, inspectable, zero-dependency storage appropriate for the hackathon MVP scope. |
| Linter | OXLint | Fast Rust-based linter with zero configuration. |
| Backend deployment | Render | Hosted Node.js service with environment-variable management. |
| Frontend deployment | Vercel | Zero-config Vite deployment with build-time environment-variable support. |

---

## 🏗️ System Architecture

```text
voca-voice-to-action/
├── package.json                 # Root workspace scripts
├── .gitignore                   # Excludes .env, node_modules, dist, store.json
├── .gitattributes               # Enforces LF line endings cross-platform
├── README.md
├── client/                      # React + Vite frontend
│   ├── public/                  # Static assets and SVG favicon
│   ├── src/
│   │   ├── App.jsx              # Root layout, tab routing, dashboard state, health polling
│   │   ├── components/
│   │   │   ├── VoiceCenterpiece.jsx   # Mic engine, silence/inactivity timers, AI pipeline
│   │   │   ├── Sidebar.jsx            # Navigation tabs, backend status pill
│   │   │   ├── Header.jsx             # Greeting, sync button, backend status
│   │   │   ├── ExpenseCard.jsx        # Expense list (opens ExpenseDetailModal)
│   │   │   ├── ExpenseDetailModal.jsx # View / edit / delete expense
│   │   │   ├── TasksCard.jsx          # Task list with toggle (opens TaskDetailModal)
│   │   │   ├── TaskDetailModal.jsx    # View / edit / delete task
│   │   │   ├── RemindersCard.jsx      # Reminder list (opens ReminderDetailModal)
│   │   │   ├── ReminderDetailModal.jsx # View / edit / delete reminder (past-date guard)
│   │   │   └── ActivityCard.jsx       # Audit trail of processed voice commands
│   │   └── services/
│   │       ├── api.js                 # Typed fetch wrappers with timeout + error handling
│   │       └── speechSynthesis.js     # TTS helper: voice selection, text normalization
│   ├── vite.config.js           # /api proxy → localhost:5000 (development only)
│   └── package.json
└── server/                      # Node.js + Express backend
    ├── data/
    │   ├── store.example.json   # Example data shape for reference
    │   └── .gitkeep             # Keeps the data/ directory tracked in Git
    ├── src/
    │   ├── index.js             # Express app, CORS, 404 handler, global error handler
    │   ├── routes/
    │   │   ├── health.js        # GET /api/health
    │   │   ├── parser.js        # POST /api/parse-command → Gemini
    │   │   ├── actions.js       # POST /api/execute-actions; CRUD for tasks, expenses, reminders
    │   │   └── dashboard.js     # GET /api/dashboard and list endpoints
    │   ├── services/
    │   │   └── gemini.js        # Gemini AI client, system prompt, validation, 25s timeout
    │   ├── storage/
    │   │   └── db.js            # Atomic JSON read/write, sequential write queue, duplicate finder
    │   └── utils/
    │       └── dateTime.js      # Local time/date helpers, reminder schedule validator
    ├── .env.example             # Environment variable template — copy this to .env locally
    └── package.json
```

> ⚠️ `server/.env` is git-ignored and must never be committed. To run locally, copy `server/.env.example` to `server/.env` and add your own `GEMINI_API_KEY`.
>
> `server/data/store.json` is generated at runtime and is git-ignored.

### Data Flow

1. The browser captures a transcript and sends it to `POST /api/parse-command`.
2. The Express server sends the transcript and current date/time context to Gemini.
3. Gemini returns structured intent; the server validates and sanitizes the response.
4. The client sends the validated actions and a unique `requestId` to `POST /api/execute-actions`.
5. The backend checks the idempotency cache, runs the duplicate-detection check, then writes records through the sequential atomic-write mechanism.
6. The backend returns the saved result; the browser speaks the confirmation and triggers a dashboard refresh.

---

## 👤 Individual Contribution

Voca is a **solo project**, built entirely by **Aditya Ghumre** over the hackathon sprint.

Work completed by one person:

- Product concept and UX design.
- Full-stack architecture (React frontend + Node.js/Express backend).
- Gemini AI integration and prompt engineering for multi-intent extraction.
- Voice input engine: multi-session `SpeechRecognition`, silence detection, transcript accumulation.
- Voice output engine: `SpeechSynthesis`, voice selection, text normalization.
- Three-layer duplicate detection (client fingerprint, server title match, idempotency cache).
- Past-date validation for reminders at both the AI output layer and the storage layer.
- Full CRUD management for expenses, tasks, and reminders.
- Network error handling and request timeout infrastructure (frontend and server).
- Responsive interface across desktop, tablet, and mobile.
- Security audit: no API keys in frontend code or Git history.
- Backend deployment on Render and frontend deployment on Vercel.

---

## 🧗 Technical Challenges and Solutions

### 1. Natural Speech Pauses Without False Endings

**Problem:** The browser's `SpeechRecognition` API ends sessions after short silences, cutting off mid-sentence.

**Solution:** `VoiceCenterpiece.jsx` runs recognition with `continuous = false` and automatically restarts the session on `onend` while `isRecordingSessionRef` is active (up to 5 restarts after speech begins). Transcript segments are accumulated in `sessionTranscriptPartsRef` and joined without word duplication. A 3-second silence timer (reset on every `onresult` event) triggers finalization; a separate 7-second inactivity timer handles the case where the user starts the microphone but says nothing.

### 2. Multi-Intent Parsing from Free-Form Speech

**Problem:** A single sentence can contain an expense, a reminder, and a task — each with different required fields and date formats.

**Solution:** A structured Gemini system prompt with a strict JSON output schema, field-level rules, and injected current date/time context. `sanitizeAndValidateAIOutput()` acts as a second validation layer, normalizing types and value ranges, and verifying reminder dates against the actual server clock.

### 3. Preventing Duplicate Records

**Problem:** Accidental double-taps, network retries, and repeated voice commands can create identical records.

**Solution:** Three independent guards: (1) a client-side 60-second command fingerprint window with a user confirmation prompt, (2) a server-side `findActionDuplicates()` title-match check that returns a `duplicateWarning` payload, and (3) a `requestId`-keyed idempotency cache (5-minute TTL) on the action execution endpoint.

### 4. Atomic JSON Writes Under Concurrency

**Problem:** Concurrent API requests could corrupt the JSON storage file through interleaved writes.

**Solution:** `writeStore()` in `db.js` chains all writes through a Promise-based sequential queue (`writeQueue = writeQueue.then(task)`) and writes to a `.tmp` file first before atomically renaming it to `store.json`. The main file is never left in a partial state.

### 5. Slow or Unavailable API Responses

**Problem:** If Gemini or the backend is slow or unreachable, the UI needs a recovery path rather than waiting indefinitely.

**Solution:** `fetchWithTimeout()` in `api.js` wraps every `fetch` call with an `AbortController` (30-second timeout for AI endpoints, 15 seconds for CRUD). The server wraps the Gemini call in a `Promise.race` with a 25-second rejection, which is expected to fire before the frontend's 30-second fallback. All timeout and network errors surface as user-readable messages — never as raw `TypeError` exceptions.

### 6. Past-Date Reminder Validation and Timezones

**Problem:** Reminder interpretation can differ when the server and user are in different timezones. A reminder intended for 5 PM IST may be evaluated incorrectly if the deployed server runs in UTC.

**Solution in code:** `dateTime.js` uses `new Date()` on the server process (local clock) for all date and time operations. The server timezone is injected into the Gemini system prompt via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Reminder schedules are compared against `new Date()` before saving.

**Deployment note:** To ensure correct behavior in production, set `TZ=Asia/Kolkata` in the Render environment. `[TODO: confirm whether TZ is configured in the deployed Render service.]`

---

## 🧪 Testing and Quality Assurance

Testing was performed manually and through Node.js scripts targeting individual subsystems.

### Voice & AI Pipeline

- Tested single-intent commands (expense only, task only, reminder only).
- Tested compound commands combining all three action types in one sentence.
- Tested ambiguous input (expense with no amount); confirmed clarification prompt appears.
- Tested empty voice input; confirmed no API call is made.
- Tested duplicate commands within 60 seconds; confirmed duplicate prompt appears.

### Past-Date Validation

- Tested reminders for yesterday, earlier today, and future times.
- Verified server-side rejection returns a user-readable message.
- Verified voice-created, manually created, and edited reminders use the same validation path.

### Network Failure Scenarios

- Stopped the backend mid-session; frontend showed a connection error and the microphone remained usable.
- Tested a slow Gemini response; the 25-second server-side timeout fires before the 30-second frontend fallback.
- Tested rapid repeated microphone activation during processing; the in-flight guard prevented concurrent submissions.
- Tested a save failure after parsing succeeded; confirmed the parsed AI result remains visible for the user.

### CRUD Operations

- Tested edit and delete for expenses, tasks, and reminders.
- Confirmed optimistic UI updates are rolled back on failure.
- Confirmed task completion toggle persists to the backend and refreshes dashboard counts.

### Production Build

- `vite build` completed with zero errors and zero warnings.
- Confirmed correct local fallback and production `VITE_API_BASE_URL` build behaviour.
- Confirmed no API keys appear in the compiled JavaScript bundle.

---

## 🚀 Deployment

### Live Frontend — Vercel

**URL:** [https://voca-voice-to-action.vercel.app/](https://voca-voice-to-action.vercel.app/)

**Required environment variable on Vercel:**

```env
VITE_API_BASE_URL=https://voca-voice-to-action.onrender.com
```

The `getApiBase()` function in `client/src/services/api.js` reads `VITE_API_BASE_URL` at Vite build time, normalizes the URL, and appends `/api` when needed. Without this variable it falls back to `/api` for local development (proxied to `localhost:5000`).

### Backend — Render

**URL:** [https://voca-voice-to-action.onrender.com](https://voca-voice-to-action.onrender.com)
**Health check:** [https://voca-voice-to-action.onrender.com/api/health](https://voca-voice-to-action.onrender.com/api/health)

The Express server runs on Render using `npm start` (`node src/index.js`).

**Required environment variable on Render:**

```env
GEMINI_API_KEY=your_key_here
```

> Render injects its own `PORT` at runtime. Do **not** set `PORT` in the Render environment. `PORT=5000` is for local development only.

**Storage note:** Render's free tier uses ephemeral disk storage. Data stored in `server/data/store.json` **will not persist across deployments or service restarts** unless a persistent disk is attached. For production use, migrate `db.js` to a persistent database such as Supabase, MongoDB Atlas, or Render Postgres.

**Cold start note:** A Render free-tier service may sleep after a period of inactivity. The first request after the service wakes up can take up to approximately one minute.

### Source Code

**GitHub:** [https://github.com/AdityaGhumre/voca-voice-to-action](https://github.com/AdityaGhumre/voca-voice-to-action)

---

## ⚠️ Known Limitations

| Limitation | Detail |
|---|---|
| **No authentication** | All visitors currently share one dataset. Any user can read, create, edit, or delete records. |
| **Ephemeral storage** | Render's free-tier filesystem does not guarantee that `store.json` survives service restarts or redeployments unless a persistent disk is configured. |
| **Cold starts** | The Render free-tier service may sleep after inactivity. The first request after waking can take up to approximately one minute. |
| **Browser support** | Speech recognition works best in Chrome and Edge; Safari support is partial; Firefox is not supported. |
| **No server-side rate limiting** | The server detects Gemini 429 errors and surfaces a friendly message, but no independent rate-limiting middleware is applied to the API endpoints. Any user can send requests freely. |
| **Timezone** | Reminder validation uses the server's local clock. `[TODO: confirm TZ=Asia/Kolkata is set in the Render environment.]` |
| **CORS** | The backend currently allows all origins (`origin: '*'`). This is acceptable for a hackathon demo but should be tightened for production. |

---

## 🖥️ Local Setup

### Prerequisites

- Node.js v18+ (developed on v24.12.0).
- npm v10+.
- A Google Gemini API key — [obtain one free at Google AI Studio](https://aistudio.google.com/app/apikey).
- A supported browser: **Google Chrome** or **Microsoft Edge** recommended. Speech recognition works best in Chrome and Edge; Safari support is partial; Firefox is not supported.

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

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
```

> Never commit your `.env` file or API key to Git.

### 4. Start the Backend (Port 5000)

```bash
npm run dev:server
```

Health check: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 5. Start the Frontend (Port 5173)

```bash
npm run dev:client
```

Application: [http://localhost:5173](http://localhost:5173)

The Vite development server proxies all `/api/*` requests to `http://localhost:5000`.

### Optional Database Utilities

```bash
npm run db:reset   # Clear all stored data
npm run db:seed    # Load example seed records
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server status, uptime, AI configuration flag, record counts. |
| GET | `/api/ai-status` | Gemini API connectivity and model configuration check. |
| POST | `/api/parse-command` | Parse voice transcript into structured intent (Gemini). |
| POST | `/api/execute-actions` | Save parsed actions to storage (idempotency + duplicate checks). |
| GET | `/api/dashboard` | Full dashboard data: expenses, tasks, reminders, activity log. |
| GET | `/api/expenses` | List all expenses. |
| PATCH | `/api/expenses/:id` | Update expense (amount, description, category, date). |
| DELETE | `/api/expenses/:id` | Delete expense. |
| GET | `/api/tasks` | List all tasks. |
| PATCH | `/api/tasks/:id` | Update task (title, description, notes, priority, due date). |
| PATCH | `/api/tasks/:id/toggle` | Toggle task completion status. |
| DELETE | `/api/tasks/:id` | Delete task. |
| GET | `/api/reminders` | List all reminders. |
| PATCH | `/api/reminders/:id` | Update reminder; past-date validated. |
| PATCH | `/api/reminders/:id/toggle` | Toggle reminder completion status. |
| DELETE | `/api/reminders/:id` | Delete reminder. |
| GET | `/api/activity` | Activity log of processed voice commands. |

---

## 🎨 Visual Identity

| Element | Value |
|---|---|
| Background | Deep Navy `#0B0F17` |
| Card Surface | Dark Blue `#101726` |
| Primary Text | Warm Ivory `#F7F7F2` |
| Primary Accent | Electric Lime `#CCFF00` — mic pulse, success states, active navigation |
| AI / Secondary Accent | Violet `#8B5CF6` — AI badges, reminder indicators |
| Muted Text | Steel Blue `#9AA6BC` |
| Typography | *Plus Jakarta Sans* (UI) · *JetBrains Mono* (data, IDs) |

---

## 🎬 Demo Video & Screenshots

> **[TODO: add demo video link]**

> **[TODO: add screenshots or a link to the Google Drive project-screenshot folder]**

Recommended screenshots:
- Dashboard overview with expenses, tasks, and reminders.
- Voice recording in progress (listening state with waveform animation).
- Multi-action result panel after a compound command.
- Task, expense, and reminder detail views (view and edit modes).
- Reminder past-date rejection message.
- Mobile layout.

The full demo video and screenshot collection can be kept in the linked Google Drive submission folder.

---

## 🔭 Future Improvements

- **Persistent database** — replace the JSON file store with Supabase, MongoDB Atlas, or Render Postgres to retain data across server restarts.
- **User authentication** — add user accounts so visitors have separate, private datasets.
- **Recurring reminders** — support patterns such as "every Monday" or "daily at 9 AM".
- **Expense analytics** — charts and summaries for monthly spend by category, with budget alerts.
- **Calendar integration** — sync tasks and reminders to Google Calendar or Apple Calendar.
- **Push notifications** — browser or mobile push when a reminder time is reached.
- **Offline queueing** — capture voice commands locally and sync when connectivity is restored.
- **Multilingual support** — regional Indian languages (Hindi, Marathi, Tamil) using multilingual Gemini prompts.
- **Custom expense categories** — user-defined categories beyond the built-in nine.
- **Export** — download expenses as CSV, tasks as a markdown checklist, and reminders as an `.ics` calendar file.
- **Server-side rate limiting** — add `express-rate-limit` middleware to protect the AI endpoints.
- **CORS tightening** — restrict `origin: '*'` to the production frontend URL only.

---

## 📄 License

ISC — built for the hackathon, open for learning and extension.

---

*Built solo by [Aditya Ghumre](https://github.com/AdityaGhumre) · November 2026*
