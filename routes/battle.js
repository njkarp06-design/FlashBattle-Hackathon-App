const express = require('express');
const { db } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.get('/', requireAuth, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.session.userId });
  const myDecks = await db.decks.findAsync({ userId: req.session.userId }).sort({ updatedAt: -1 });
  const publicDecks = await db.decks.findAsync({ isPublic: true }).sort({ playCount: -1 }).limit(10);
  res.render('battle/lobby', { user, myDecks, publicDecks, error: req.query.error || null });
});

router.post('/create', requireAuth, async (req, res) => {
  const { deckId } = req.body;
  const deck = await db.decks.findOneAsync({ _id: deckId });
  if (!deck) return res.redirect('/battle?error=Deck+not+found');

  const cards = await db.cards.findAsync({ deckId }).sort({ position: 1 });
  if (cards.length < 4) return res.redirect('/battle?error=Deck+needs+at+least+4+cards+to+battle');

  let code;
  let attempts = 0;
  do {
    code = generateCode();
    const exists = await db.battleRooms.findOneAsync({ code, status: { $ne: 'finished' } });
    if (!exists) break;
    attempts++;
  } while (attempts < 10);

  await db.battleRooms.insertAsync({
    code,
    hostId: req.session.userId,
    deckId,
    deckTitle: deck.title,
    status: 'waiting',
    currentQuestion: 0,
    createdAt: new Date(),
  });

  res.redirect(`/battle/${code}`);
});

router.post('/join', requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.redirect('/battle?error=Enter+a+room+code');

  const room = await db.battleRooms.findOneAsync({ code: code.toUpperCase().trim(), status: 'waiting' });
  if (!room) return res.redirect('/battle?error=Room+not+found+or+game+already+started');

  res.redirect(`/battle/${code.toUpperCase().trim()}`);
});

router.get('/:code', requireAuth, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.session.userId });
  const room = await db.battleRooms.findOneAsync({ code: req.params.code.toUpperCase() });
  if (!room) return res.redirect('/battle?error=Room+not+found');

  if (room.status === 'finished') return res.redirect('/battle?error=That+game+has+already+ended');

  const deck = await db.decks.findOneAsync({ _id: room.deckId });
  const cardCount = await db.cards.countAsync({ deckId: room.deckId });

  res.render('battle/room', {
    user,
    room,
    deck,
    cardCount,
    isHost: room.hostId === req.session.userId,
  });
});

module.exports = router;
