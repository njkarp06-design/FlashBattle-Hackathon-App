const express = require('express');
const { db, calcLevel, xpForNextLevel } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { ALL_ACHIEVEMENTS } = require('../utils/achievements');
const { CATEGORIES, CATEGORY_ICONS, catSlug } = require('../utils/constants');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.session.userId });
  const decks = await db.decks.findAsync({ userId: req.session.userId }).sort({ updatedAt: -1 });
  const masteryRecords = await db.cardProgress.findAsync({ userId: req.session.userId });
  const masteryMap = Object.fromEntries(masteryRecords.map(m => [m.deckId, m]));
  res.render('decks/index', { user, decks, categories: CATEGORIES, categoryIcons: CATEGORY_ICONS, catSlug, masteryMap });
});

router.get('/new', requireAuth, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.session.userId });
  res.render('decks/new', { user, categories: CATEGORIES, categoryIcons: CATEGORY_ICONS, catSlug, error: null });
});

router.post('/new', requireAuth, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.session.userId });
  const { title, description, category, isPublic } = req.body;

  if (!title || title.trim().length < 2) {
    return res.render('decks/new', { user, categories: CATEGORIES, categoryIcons: CATEGORY_ICONS, catSlug, error: 'Deck title must be at least 2 characters.' });
  }

  const deck = await db.decks.insertAsync({
    userId: req.session.userId,
    title: title.trim(),
    description: description ? description.trim() : '',
    category: CATEGORIES.includes(category) ? category : 'General Knowledge',
    isPublic: isPublic === 'on',
    cardCount: 0,
    playCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Check deck_builder achievement
  const deckCount = await db.decks.countAsync({ userId: req.session.userId });
  if (deckCount >= 3) {
    const deckUser = await db.users.findOneAsync({ _id: req.session.userId });
    const achs = deckUser.achievements || [];
    if (!achs.includes('deck_builder')) {
      await db.users.updateAsync({ _id: req.session.userId }, { $set: { achievements: [...achs, 'deck_builder'] } });
    }
  }

  res.redirect(`/decks/${deck._id}/edit`);
});

router.get('/:id', requireAuth, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.session.userId });
  const deck = await db.decks.findOneAsync({ _id: req.params.id });
  if (!deck) return res.redirect('/decks');

  const isOwner = deck.userId === req.session.userId;
  if (!deck.isPublic && !isOwner) return res.redirect('/library');

  const cards = await db.cards.findAsync({ deckId: deck._id }).sort({ position: 1 });
  const deckOwner = await db.users.findOneAsync({ _id: deck.userId });

  res.render('decks/show', { user, deck, cards, deckOwner, isOwner, categoryIcons: CATEGORY_ICONS, catSlug });
});

router.get('/:id/edit', requireAuth, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.session.userId });
  const deck = await db.decks.findOneAsync({ _id: req.params.id, userId: req.session.userId });
  if (!deck) return res.redirect('/decks');

  const cards = await db.cards.findAsync({ deckId: deck._id }).sort({ position: 1 });
  res.render('decks/edit', { user, deck, cards, categories: CATEGORIES, categoryIcons: CATEGORY_ICONS, catSlug, error: null, query: req.query });
});

router.post('/:id/update', requireAuth, async (req, res) => {
  const deck = await db.decks.findOneAsync({ _id: req.params.id, userId: req.session.userId });
  if (!deck) return res.redirect('/decks');

  const { title, description, category, isPublic } = req.body;
  await db.decks.updateAsync(
    { _id: deck._id },
    { $set: { title: title.trim(), description: (description || '').trim(), category, isPublic: isPublic === 'on', updatedAt: new Date() } }
  );
  res.redirect(`/decks/${deck._id}/edit`);
});

router.post('/:id/cards/add', requireAuth, async (req, res) => {
  const deck = await db.decks.findOneAsync({ _id: req.params.id, userId: req.session.userId });
  if (!deck) return res.json({ error: 'Not found' });

  const { front, back } = req.body;
  if (!front || !back || !front.trim() || !back.trim()) {
    return res.json({ error: 'Both sides of the card are required.' });
  }

  const count = await db.cards.countAsync({ deckId: deck._id });
  const card = await db.cards.insertAsync({
    deckId: deck._id,
    front: front.trim(),
    back: back.trim(),
    position: count,
  });

  await db.decks.updateAsync({ _id: deck._id }, { $set: { cardCount: count + 1, updatedAt: new Date() } });

  res.json({ success: true, card });
});

router.post('/:id/cards/:cardId/delete', requireAuth, async (req, res) => {
  const deck = await db.decks.findOneAsync({ _id: req.params.id, userId: req.session.userId });
  if (!deck) return res.json({ error: 'Not found' });

  await db.cards.removeAsync({ _id: req.params.cardId, deckId: deck._id });
  const count = await db.cards.countAsync({ deckId: deck._id });
  await db.decks.updateAsync({ _id: deck._id }, { $set: { cardCount: count, updatedAt: new Date() } });

  res.json({ success: true });
});

router.post('/:id/delete', requireAuth, async (req, res) => {
  const deck = await db.decks.findOneAsync({ _id: req.params.id, userId: req.session.userId });
  if (!deck) return res.redirect('/decks');

  await db.cards.removeAsync({ deckId: deck._id }, { multi: true });
  await db.decks.removeAsync({ _id: deck._id });
  res.redirect('/decks');
});

router.get('/:id/study', requireAuth, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.session.userId });
  const deck = await db.decks.findOneAsync({ _id: req.params.id });
  if (!deck) return res.redirect('/decks');

  const isOwner = deck.userId === req.session.userId;
  if (!deck.isPublic && !isOwner) return res.redirect('/library');

  const cards = await db.cards.findAsync({ deckId: deck._id }).sort({ position: 1 });
  if (cards.length === 0) return res.redirect(`/decks/${deck._id}`);

  res.render('study', { user, deck, cards: JSON.stringify(cards).replace(/</g, '\\u003c') });
});

router.post('/:id/study/complete', requireAuth, async (req, res) => {
  const deck = await db.decks.findOneAsync({ _id: req.params.id });
  if (!deck) return res.json({ error: 'Not found' });

  const { cardsStudied, cardsCorrect, durationSeconds, cardResults } = req.body;
  const studiedNum = parseInt(cardsStudied) || 0;
  const correctNum = parseInt(cardsCorrect) || 0;
  const durationNum = parseInt(durationSeconds) || 0;

  // Daily challenge bonus XP
  const today = new Date().toISOString().split('T')[0];
  const publicDecks = await db.decks.findAsync({ isPublic: true });
  let bonusXp = 0;
  if (publicDecks.length > 0) {
    const dateHash = today.split('-').reduce((a, b) => parseInt(a) + parseInt(b), 0);
    const dailyDeck = publicDecks[Math.abs(dateHash) % publicDecks.length];
    if (dailyDeck && dailyDeck._id === deck._id) {
      const alreadyDone = await db.studySessions.findOneAsync({
        userId: req.session.userId, deckId: deck._id,
        completedAt: { $gte: new Date(today) }
      });
      if (!alreadyDone) bonusXp = 50;
    }
  }

  const xpEarned = studiedNum * 5 + correctNum * 10 + bonusXp;

  await db.studySessions.insertAsync({
    userId: req.session.userId,
    deckId: deck._id,
    cardsStudied: studiedNum,
    cardsCorrect: correctNum,
    xpEarned,
    durationSeconds: durationNum,
    completedAt: new Date(),
  });

  const user = await db.users.findOneAsync({ _id: req.session.userId });
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let newStreak = user.streak;
  if (user.lastStudyDate === yesterday) newStreak = user.streak + 1;
  else if (user.lastStudyDate !== today) newStreak = 1;

  const newXp = user.xp + xpEarned;
  const newLevel = calcLevel(newXp);

  // Achievement checking
  const existingAchievements = user.achievements || [];
  const newAchievementIds = [];

  const sessionCount = await db.studySessions.countAsync({ userId: req.session.userId });
  if (sessionCount >= 1 && !existingAchievements.includes('first_flash')) newAchievementIds.push('first_flash');
  if (newStreak >= 3 && !existingAchievements.includes('streak_3')) newAchievementIds.push('streak_3');
  if (newStreak >= 7 && !existingAchievements.includes('streak_7')) newAchievementIds.push('streak_7');
  if (newLevel >= 5 && !existingAchievements.includes('scholar')) newAchievementIds.push('scholar');
  if (newLevel >= 10 && !existingAchievements.includes('champion')) newAchievementIds.push('champion');

  const allSessions = await db.studySessions.findAsync({ userId: req.session.userId });
  const totalCardsStudied = allSessions.reduce((s, r) => s + (r.cardsStudied || 0), 0);
  if (totalCardsStudied >= 50 && !existingAchievements.includes('cards_50')) newAchievementIds.push('cards_50');
  if (totalCardsStudied >= 100 && !existingAchievements.includes('cards_100')) newAchievementIds.push('cards_100');

  const accuracy = studiedNum >= 10 ? correctNum / studiedNum : 0;
  if (accuracy >= 0.9 && studiedNum >= 10 && !existingAchievements.includes('accurate')) newAchievementIds.push('accurate');
  if (durationNum > 0 && durationNum <= 180 && studiedNum >= 5 && !existingAchievements.includes('speed_study')) newAchievementIds.push('speed_study');

  const updatedAchievements = [...existingAchievements, ...newAchievementIds];

  await db.users.updateAsync(
    { _id: req.session.userId },
    { $set: { xp: newXp, level: newLevel, streak: newStreak, lastStudyDate: today, achievements: updatedAchievements } }
  );

  const newAchievementsData = ALL_ACHIEVEMENTS.filter(a => newAchievementIds.includes(a.id));

  // Update card mastery tracking
  if (Array.isArray(cardResults) && cardResults.length > 0) {
    let progress = await db.cardProgress.findOneAsync({ userId: req.session.userId, deckId: deck._id });
    const masteredSet = new Set(progress ? progress.masteredCardIds : []);
    const studiedSet = new Set(progress ? progress.studiedCardIds : []);
    for (const r of cardResults) {
      if (!r.cardId) continue;
      studiedSet.add(r.cardId);
      if (r.correct) masteredSet.add(r.cardId);
    }
    await db.cardProgress.updateAsync(
      { userId: req.session.userId, deckId: deck._id },
      { $set: { userId: req.session.userId, deckId: deck._id, masteredCardIds: [...masteredSet], studiedCardIds: [...studiedSet], updatedAt: new Date() } },
      { upsert: true }
    );
  }

  res.json({ success: true, xpEarned, newXp, newLevel, newStreak, newAchievements: newAchievementsData, bonusXp });
});

// Bulk import cards
router.post('/:id/bulk-import', requireAuth, async (req, res) => {
  const deck = await db.decks.findOneAsync({ _id: req.params.id, userId: req.session.userId });
  if (!deck) return res.redirect('/decks');

  const { bulkText, delimiter } = req.body;
  if (!bulkText || !bulkText.trim()) return res.redirect(`/decks/${deck._id}/edit`);

  const sep = delimiter === 'tab' ? '\t' : (delimiter === 'colon' ? ':' : '|');
  const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
  let added = 0;
  let startPos = await db.cards.countAsync({ deckId: deck._id });

  for (const line of lines) {
    const idx = line.indexOf(sep);
    if (idx < 1) continue;
    const front = line.slice(0, idx).trim();
    const back = line.slice(idx + sep.length).trim();
    if (!front || !back) continue;
    await db.cards.insertAsync({ deckId: deck._id, front, back, position: startPos++ });
    added++;
  }

  if (added > 0) {
    await db.decks.updateAsync({ _id: deck._id }, { $set: { cardCount: startPos, updatedAt: new Date() } });
  }

  res.redirect(`/decks/${deck._id}/edit?imported=${added}`);
});

module.exports = router;
