# Habit Tracker & AI Performance Coach

## Stack Architecture
- Desktop Framework: Electron / Tauri + React + Tailwind CSS
- Database: Local SQLite
- Background Agent: Scheduled Node.js script for email reminders via SMTP
- AI Agent: Weekly habit evaluator chatbot

## Rules & Standards
- Keep database strictly local (`data/habits.db`).
- Primary color palette: Light theme, white background with light purple (violet) accents.
- Commit clean progress at the end of each functional step.
