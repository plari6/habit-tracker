# 🎯 Habit Tracker & AI Performance Coach

A privacy-focused, local-first desktop application for tracking daily habits and receiving personalized AI performance evaluations without recurring cloud API fees.

---

## ✨ Core Features

- **Local-First Architecture:** All habit logs and streaks stay stored securely in a local SQLite database.
- **Zero-Cost AI Performance Coach:** Integrates with Google Gemini 1.5 Flash (`gemini-1.5-flash`) via context injection to evaluate habit performance and provide daily action items.
- **Dark Mode UI:** Modern, responsive interface built with React and Tailwind CSS.
- **One-Click Launcher:** Desktop shortcut integration for immediate access.

---

## 🛠️ Tech Stack

- **Frontend:** React, Tailwind CSS
- **Database:** Local SQLite (`data/habit-tracker.db`)
- **AI Integration:** Google Gemini API (Google AI Studio) / Ollama Local LLM
- **Desktop Runtime:** Electron / Tauri framework

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Google Gemini API Key

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/plari6/habit-tracker.git](https://github.com/plari6/habit-tracker.git)
   cd habit-tracker
