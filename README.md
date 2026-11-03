# Voca — Voice to Action AI Assistant

> **Turn natural speech into completed, multi-action productivity workflows.**
> Built for the 6-Hour Hackathon.

---

## 🎙️ Overview

**Voca** allows users to speak naturally and automatically extracts, categorizes, and executes compound productivity actions from a single spoken sentence.

**Example Compound Command:**
> *"I spent ₹250 on lunch, remind me to submit my assignment on Friday, and create a task to call Rahul tomorrow."*

From this single sentence, Voca orchestrates three distinct actions:
1. **Expense:** ₹250 under Food & Dining
2. **Reminder:** Friday at designated time
3. **Task:** Call Rahul tomorrow with high priority

---

## 🎨 Visual Identity

- **Main Canvas:** Deep Charcoal / Navy (`#0B0F17`)
- **Primary Typography:** Warm Ivory (`#F7F7F2`)
- **Primary Accent:** Electric Lime (`#CCFF00`) — used for the voice centerpiece, microphone pulse, and successful execution states.
- **Secondary AI Accent:** Violet (`#8B5CF6`) — used for AI reasoning and status badges.
- **Typography:** *Plus Jakarta Sans* & *JetBrains Mono*

---

## 🏗️ Project Architecture

```
vocal-ai/
├── package.json              # Root workspace scripts
├── .gitignore                # Excludes node_modules, .env, builds, and store data
├── README.md                 # Project documentation
│
├── client/                   # React + Vite Frontend
│   ├── public/               # Static assets & SVG favicon
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx           # Workspace navigation & backend status pill
│   │   │   ├── Header.jsx            # Dynamic greeting & sync trigger
│   │   │   ├── VoiceCenterpiece.jsx  # Mic button, audio waves, live transcript
│   │   │   ├── ExpenseCard.jsx       # Expenses summary & recent list
│   │   │   ├── TasksCard.jsx         # Interactive to-do list with priorities
│   │   │   ├── RemindersCard.jsx     # Scheduled time-based reminders
│   │   │   └── ActivityCard.jsx      # Audit trail of processed actions
│   │   ├── services/
│   │   │   └── api.js                # Frontend API client
│   │   ├── App.jsx                   # Central layout & state management
│   │   ├── index.css                 # Tailwind CSS v4 + keyframe animations
│   │   └── main.jsx                  # React DOM root
│   ├── vite.config.js        # Vite config with /api proxy to port 5000
│   └── package.json
│
└── server/                   # Node.js + Express Backend
    ├── data/
    │   ├── store.json        # JSON-based persistence layer
    │   └── .gitkeep
    ├── src/
    │   ├── routes/
    │   │   ├── health.js     # GET /api/health endpoint
    │   │   └── dashboard.js  # GET /api/dashboard & PATCH /api/tasks/:id/toggle
    │   ├── storage/
    │   │   └── db.js         # Atomic JSON read/write persistence module
    │   └── index.js          # Express app entrypoint
    ├── .env.example          # Environment variable template
    ├── .env                  # Local environment file (port 5000)
    └── package.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** v18+ (tested on v24.12.0)
- **npm** v10+

### 2. Start the Backend (Port 5000)
Open a terminal in the root directory:
```bash
npm run dev:server
```
*Health check URL:* `http://localhost:5000/api/health`

### 3. Start the Frontend (Port 5173)
In a second terminal:
```bash
npm run dev:client
```
*Application URL:* `http://localhost:5173`

*(The Vite dev server automatically proxies `/api/*` requests to `http://localhost:5000`.)*

---

## 🩺 Health Check & API Endpoints

- `GET /api/health`: Validates system status, server uptime, and storage item counts.
- `GET /api/dashboard`: Retrieves all expenses, tasks, reminders, activity logs, and computed summaries.
- `PATCH /api/tasks/:id/toggle`: Toggles completion status of a task and appends an audit event to the activity stream.

---

## 🧭 Milestone Roadmap

- [x] **Assignment 1 — Foundation (Current):**
  - Scaffold React + Vite frontend and Node.js + Express backend.
  - Implement distinctive dark charcoal, warm ivory, and electric lime design system.
  - Interactive voice interaction centerpiece with animated audio waveforms and Web Speech API structure.
  - JSON-based storage layer with live `/api/health` and `/api/dashboard` endpoints.
  - Interactive task status toggling connected directly to the backend store.
- [ ] **Assignment 2 — AI Intent Extraction:**
  - Gemini / OpenAI integration on the backend.
  - Compound intent parser separating expenses, tasks, and reminders.
  - Speech synthesis audio feedback confirmation.
