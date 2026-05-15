const express = require('express');
const { db, calcLevel, xpForNextLevel } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { ALL_ACHIEVEMENTS } = require('../utils/achievements');
const { AVATAR_COLORS, CATEGORY_ICONS, catSlug } = require('../utils/constants');
const router = express.Router();

router.post('/avatar', requireAuth, async (req, res) => {
  const { color } = req.body;
  const validColors = AVATAR_COLORS.map(c => c.hex);
  if (!validColors.includes(color)) {
    return res.redirect('/profile');
  }
  await db.users.updateAsync({ _id: req.session.userId }, { $set: { avatarColor: color } });
  res.redirect('/profile');
});

router.get('/', requireAuth, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.session.userId });
  await renderProfile(req, res, user, user, true);
});

router.get('/:username', requireAuth, async (req, res) => {
  const viewer = await db.users.findOneAsync({ _id: req.session.userId });
  const profile = await db.users.findOneAsync({ username: req.params.username });
  if (!profile) return res.redirect('/leaderboard');
  await renderProfile(req, res, viewer, profile, profile._id === req.session.userId);
});

async function renderProfile(req, res, viewer, profile, isOwn) {
  const decks = await db.decks.findAsync({ userId: profile._id, isPublic: true }).sort({ updatedAt: -1 });
  const ownDecks = isOwn ? await db.decks.findAsync({ userId: profile._id }).sort({ updatedAt: -1 }) : decks;

  const sessions = await db.studySessions.findAsync({ userId: profile._id }).sort({ completedAt: -1 }).limit(10);
  const totalStudied = sessions.reduce((sum, s) => sum + (s.cardsStudied || 0), 0);
  const totalCorrect = sessions.reduce((sum, s) => sum + (s.cardsCorrect || 0), 0);
  const accuracy = totalStudied > 0 ? Math.round((totalCorrect / totalStudied) * 100) : 0;

  const nextLevelXp = xpForNextLevel(profile.level);
  const currentLevelXp = xpForNextLevel(profile.level - 1);
  const progress = Math.min(100, Math.round(((profile.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));

  const rank = await db.users.countAsync({ xp: { $gt: profile.xp } });

  res.render('profile', {
    user: viewer,
    profile,
    decks: isOwn ? ownDecks : decks,
    isOwn,
    totalStudied,
    accuracy,
    progress,
    rank: rank + 1,
    nextLevelXp,
    recentSessions: sessions.slice(0, 5),
    allAchievements: ALL_ACHIEVEMENTS,
    avatarColors: AVATAR_COLORS,
    categoryIcons: CATEGORY_ICONS,
    catSlug,
  });
}

module.exports = router;
