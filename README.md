# Sage — Learn by Teaching

An AI-powered learning tool that uses the teach-back method to help students identify gaps in their understanding. Teach a concept to Sage, watch its understanding update in real time, and then see how well it does on a quiz.

## Features

- **Teach-back interaction** — Explain a concept to Sage in a natural conversation
- **Live knowledge panel** — Watch Sage's understanding update in real time as you teach
- **Quiz assessment** — Sage answers questions based only on what you taught
- **Calibration comparison** — Compare your pre-session confidence to Sage's actual performance
- **Study recommendations** — Get specific, actionable advice on what to review next
- **File uploads** — Upload notes, textbooks, or slides (PDF, TXT, MD, DOCX) to ground the session

## Tech Stack

- **Frontend:** React + Vite
- **Styling:** Tailwind CSS v4
- **AI:** Google Claude API (Claude 2.5 Flash)
- **File parsing:** pdfjs-dist (PDF), JSZip (DOCX), FileReader API (TXT/MD)

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Claude API key

### Setup

1. Clone the repo:
   ```bash
   git clone <repo-url>
   cd Sage
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Claude API key:
   ```bash
   # Add your Claude API key to .env:
   # VITE_ANTHROPIC_API_KEY=your_key_here
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173` in your browser.

## Deployment

The app is Vercel-ready. Just connect the repo to Vercel, set the `VITE_ANTHROPIC_API_KEY` environment variable, and deploy.

## Session Logging

Every completed session is automatically saved to `localStorage` with the key `sage_session_[timestamp]`. This includes the full conversation history, quiz results, and knowledge panel state — useful for reviewing past sessions or research purposes.
