require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');

const { db, seedData, calcLevel, xpForNextLevel } = require('./database/db');
const { initSocket } = require('./socket');

const authRoutes = require('./routes/auth');
const deckRoutes = require('./routes/decks');
const battleRoutes = require('./routes/battle');
const libraryRoutes = require('./routes/library');
const profileRoutes = require('./routes/profile');
const { ALL_ACHIEVEMENTS } = require('./utils/achievements');
const { CATEGORY_ICONS, catSlug } = require('./utils/constants');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'flashbattle-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true },
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

app.use(async (req, res, next) => {
  res.locals.currentPath = req.path;
  if (req.session.userId) {
    try {
      const user = await db.users.findOneAsync({ _id: req.session.userId });
      res.locals.sessionUser = user;
    } catch {
      res.locals.sessionUser = null;
    }
  } else {
    res.locals.sessionUser = null;
  }
  next();
});

app.use('/auth', authRoutes);
app.use('/decks', deckRoutes);
app.use('/battle', battleRoutes);
app.use('/library', libraryRoutes);
app.use('/profile', profileRoutes);

app.get('/', async (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  const userCount = await db.users.countAsync({});
  const deckCount = await db.decks.countAsync({ isPublic: true });
  const sessionCount = await db.studySessions.countAsync({});
  res.render('index', { userCount, deckCount, sessionCount });
});

app.get('/dashboard', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');

  const user = await db.users.findOneAsync({ _id: req.session.userId });
  const decks = await db.decks.findAsync({ userId: req.session.userId }).sort({ updatedAt: -1 }).limit(6);
  const recentSessions = await db.studySessions
    .findAsync({ userId: req.session.userId })
    .sort({ completedAt: -1 })
    .limit(5);

  const deckIds = recentSessions.map(s => s.deckId);
  const sessionDecks = await db.decks.findAsync({ _id: { $in: deckIds } });
  const deckMap = Object.fromEntries(sessionDecks.map(d => [d._id, d]));

  const totalStudied = recentSessions.reduce((s, r) => s + (r.cardsStudied || 0), 0);
  const topDecks = await db.decks.findAsync({ isPublic: true }).sort({ playCount: -1 }).limit(3);

  const nextLevelXp = xpForNextLevel(user.level);
  const currentLevelXp = xpForNextLevel(user.level - 1);
  const xpProgress = Math.min(100, Math.round(((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));

  // Daily challenge
  const today = new Date().toISOString().split('T')[0];
  const publicDecks = await db.decks.findAsync({ isPublic: true });
  let dailyChallenge = null;
  let dailyComplete = false;
  if (publicDecks.length > 0) {
    const dateHash = today.split('-').reduce((a, b) => parseInt(a) + parseInt(b), 0);
    dailyChallenge = publicDecks[Math.abs(dateHash) % publicDecks.length];
    if (dailyChallenge) {
      dailyComplete = !!(await db.studySessions.findOneAsync({
        userId: req.session.userId,
        deckId: dailyChallenge._id,
        completedAt: { $gte: new Date(today) },
      }));
    }
  }

  res.render('dashboard', { user, decks, recentSessions, deckMap, totalStudied, topDecks, xpProgress, nextLevelXp, dailyChallenge, dailyComplete, categoryIcons: CATEGORY_ICONS, catSlug });
});

app.get('/stats', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await db.users.findOneAsync({ _id: req.session.userId });

  const sessions = await db.studySessions
    .findAsync({ userId: req.session.userId })
    .sort({ completedAt: -1 })
    .limit(50);

  // Build 7-day history
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const daySessions = sessions.filter(s =>
      new Date(s.completedAt).toISOString().split('T')[0] === dateStr
    );
    const dayCards = daySessions.reduce((s, r) => s + (r.cardsStudied || 0), 0);
    const dayCorrect = daySessions.reduce((s, r) => s + (r.cardsCorrect || 0), 0);
    days.push({
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      cardsStudied: dayCards,
      xpEarned: daySessions.reduce((s, r) => s + (r.xpEarned || 0), 0),
      accuracy: dayCards > 0 ? Math.round((dayCorrect / dayCards) * 100) : null,
      sessionCount: daySessions.length,
    });
  }

  const totalCardsStudied = sessions.reduce((s, r) => s + (r.cardsStudied || 0), 0);
  const totalXpFromStudy = sessions.reduce((s, r) => s + (r.xpEarned || 0), 0);
  const validSessions = sessions.filter(s => s.cardsStudied > 0);
  const avgAccuracy = validSessions.length > 0
    ? Math.round(validSessions.reduce((s, r) => s + r.cardsCorrect / r.cardsStudied, 0) / validSessions.length * 100)
    : 0;
  const totalTimeMins = Math.round(sessions.reduce((s, r) => s + (r.durationSeconds || 0), 0) / 60);

  const maxCards = Math.max(...days.map(d => d.cardsStudied), 1);

  // Week-over-week trends
  const prevStart = new Date(Date.now() - 14 * 86400000);
  const prevEnd = new Date(Date.now() - 7 * 86400000);
  const prevSessions = await db.studySessions.findAsync({
    userId: req.session.userId,
    completedAt: { $gte: prevStart, $lt: prevEnd },
  });
  const thisWeekCards = days.reduce((s, d) => s + d.cardsStudied, 0);
  const prevWeekCards = prevSessions.reduce((s, r) => s + (r.cardsStudied || 0), 0);
  const thisWeekXp = days.reduce((s, d) => s + d.xpEarned, 0);
  const prevWeekXp = prevSessions.reduce((s, r) => s + (r.xpEarned || 0), 0);
  const prevValid = prevSessions.filter(s => s.cardsStudied > 0);
  const prevAccuracy = prevValid.length > 0
    ? Math.round(prevValid.reduce((s, r) => s + r.cardsCorrect / r.cardsStudied, 0) / prevValid.length * 100)
    : null;
  const trends = {
    cards: prevWeekCards > 0 ? thisWeekCards - prevWeekCards : null,
    xp: prevWeekXp > 0 ? thisWeekXp - prevWeekXp : null,
    accuracy: prevAccuracy !== null ? avgAccuracy - prevAccuracy : null,
    sessions: prevSessions.length > 0 ? sessions.filter(s => {
      const d = new Date(s.completedAt);
      return d >= new Date(Date.now() - 7 * 86400000);
    }).length - prevSessions.length : null,
  };

  res.render('stats', { user, sessions: sessions.slice(0, 15), days, totalCardsStudied, totalXpFromStudy, avgAccuracy, totalTimeMins, maxCards, trends });
});

app.get('/leaderboard', async (req, res) => {
  const user = req.session.userId ? await db.users.findOneAsync({ _id: req.session.userId }) : null;
  const leaders = await db.users.findAsync({}).sort({ xp: -1 }).limit(50);

  let userRank = null;
  if (user) {
    const idx = leaders.findIndex(l => l._id === user._id);
    if (idx >= 0) {
      userRank = idx + 1;
    } else {
      const ahead = await db.users.countAsync({ xp: { $gt: user.xp } });
      userRank = ahead + 1;
    }
  }

  res.render('leaderboard', { user, leaders, userRank });
});

app.use((req, res) => {
  const user = res.locals.sessionUser;
  res.status(404).render('error', { user, code: 404, message: 'Page not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  const user = res.locals.sessionUser;
  res.status(500).render('error', { user, code: 500, message: 'Something went wrong' });
});

initSocket(io);

const PORT = process.env.PORT || 3000;

seedData().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 FlashBattle is live at http://localhost:${PORT}\n`);
  });
}).catch(console.error);
