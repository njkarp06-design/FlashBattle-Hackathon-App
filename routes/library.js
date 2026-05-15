const express = require('express');
const { db } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { CATEGORIES, CATEGORY_ICONS, catSlug } = require('../utils/constants');
const router = express.Router();

const LIBRARY_CATEGORIES = ['All', ...CATEGORIES];

router.get('/', requireAuth, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.session.userId });
  const { category, search } = req.query;

  let query = { isPublic: true };
  if (category && category !== 'All') query.category = category;

  let decks = await db.decks.findAsync(query).sort({ playCount: -1 });

  if (search) {
    const term = search.toLowerCase();
    decks = decks.filter(
      d => d.title.toLowerCase().includes(term) || (d.description || '').toLowerCase().includes(term)
    );
  }

  const ownerIds = [...new Set(decks.map(d => d.userId))];
  const owners = await db.users.findAsync({ _id: { $in: ownerIds } });
  const ownerMap = Object.fromEntries(owners.map(o => [o._id, o]));

  res.render('library', { user, decks, ownerMap, categories: LIBRARY_CATEGORIES, categoryIcons: CATEGORY_ICONS, catSlug, activeCategory: category || 'All', search: search || '' });
});

router.post('/:deckId/copy', requireAuth, async (req, res) => {
  const source = await db.decks.findOneAsync({ _id: req.params.deckId, isPublic: true });
  if (!source) return res.redirect('/library');

  const sourceCards = await db.cards.findAsync({ deckId: source._id }).sort({ position: 1 });

  const copy = await db.decks.insertAsync({
    userId: req.session.userId,
    title: `${source.title} (copy)`,
    description: source.description,
    category: source.category,
    isPublic: false,
    cardCount: sourceCards.length,
    playCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  for (const card of sourceCards) {
    await db.cards.insertAsync({
      deckId: copy._id,
      front: card.front,
      back: card.back,
      position: card.position,
    });
  }

  res.redirect(`/decks/${copy._id}`);
});

module.exports = router;
