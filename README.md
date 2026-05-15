# FlashBattle

A real-time multiplayer flashcard battle platform built for HackathonX. Study smarter, compete live, and climb the leaderboard.

---

## Features

- **Real-time Battles** — challenge other players to live flashcard duels powered by Socket.io
- **Deck Builder** — create, edit, and publish decks across 20 categories
- **Study Mode** — solo study sessions with accuracy tracking and spaced repetition feel
- **XP & Levelling** — earn XP for every session, level up, and unlock achievements
- **Daily Challenge** — a rotating public deck challenge each day
- **Leaderboard** — global XP rankings across all users
- **Stats Dashboard** — 7-day activity history, accuracy trends, and week-over-week comparisons
- **Public Library** — browse and play community-shared decks

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express |
| Templating | EJS |
| Real-time | Socket.io |
| Database | NeDB (embedded, file-based) |
| Auth | bcryptjs + express-session |
| Styling | Custom CSS |

## Getting Started

### Prerequisites

- Node.js v18+
- npm

### Install & Run

```bash
git clone https://github.com/njkarp06-design/FlashBattle-Hackathon-App.git
cd FlashBattle-Hackathon-App
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

For development with auto-reload:

```bash
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory:

```
SESSION_SECRET=your_secret_here
PORT=3000
```

`SESSION_SECRET` defaults to `flashbattle-secret` if not set.

## Demo Account

| Username | Password |
|---|---|
| FlashMaster | demo123 |

## Project Structure

```
FlashBattle/
├── database/        # NeDB setup and seed data
├── middleware/      # Auth middleware
├── public/
│   ├── css/         # Stylesheets
│   └── js/          # Client-side scripts
├── routes/          # Express route handlers
├── utils/           # Achievements and constants
├── views/           # EJS templates
├── server.js        # App entry point
└── socket.js        # Socket.io battle logic
```

## Achievements

| Achievement | Requirement |
|---|---|
| First Flash | Complete your first study session |
| On Fire | Maintain a 3-day streak |
| Week Warrior | Maintain a 7-day streak |
| Bookworm | Study 50 cards in total |
| Century Club | Study 100 cards in total |
| Scholar | Reach Level 5 |
| Champion | Reach Level 10 |
| Deck Builder | Create 3 decks |
| Sharp Shooter | Score 90%+ accuracy in a session of 10+ cards |
| Speed Studier | Complete a 5+ card session in under 3 minutes |

## Categories

General Knowledge, Language, Technology, Mathematics, Science, History, Geography, Literature, Music, Film & TV, Sports, Business, Medicine, Philosophy, Psychology, Gaming, Food & Cooking, Nature, Art & Design, Law & Politics

---

Built for HackathonX by njkarp06-design
