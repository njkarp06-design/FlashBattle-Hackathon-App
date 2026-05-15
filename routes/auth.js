const express = require('express');
const bcrypt = require('bcryptjs');
const { db, calcLevel } = require('../database/db');
const { redirectIfAuth } = require('../middleware/auth');
const { AVATAR_COLORS } = require('../utils/constants');
const router = express.Router();

router.get('/login', redirectIfAuth, (req, res) => {
  res.render('auth/login', { error: null, next: req.query.next || '/dashboard' });
});

router.post('/login', redirectIfAuth, async (req, res) => {
  const { username, password, next } = req.body;
  if (!username || !password) {
    return res.render('auth/login', { error: 'Please fill in all fields.', next: next || '/dashboard' });
  }
  try {
    const user = await db.users.findOneAsync({ username: username.trim() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.render('auth/login', { error: 'Invalid username or password.', next: next || '/dashboard' });
    }
    req.session.userId = user._id;
    req.session.username = user.username;
    const safePath = (next && next.startsWith('/') && !next.startsWith('//')) ? next : '/dashboard';
    res.redirect(safePath);
  } catch (err) {
    console.error(err);
    res.render('auth/login', { error: 'Something went wrong. Try again.', next: next || '/dashboard' });
  }
});

router.get('/register', redirectIfAuth, (req, res) => {
  res.render('auth/register', { error: null, avatarColors: AVATAR_COLORS });
});

router.post('/register', redirectIfAuth, async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password || !confirmPassword) {
    return res.render('auth/register', { error: 'Please fill in all fields.', avatarColors: AVATAR_COLORS });
  }
  if (username.trim().length < 2) {
    return res.render('auth/register', { error: 'Username must be at least 2 characters.', avatarColors: AVATAR_COLORS });
  }
  if (username.trim().length > 30) {
    return res.render('auth/register', { error: 'Username must be 30 characters or fewer.', avatarColors: AVATAR_COLORS });
  }
  if (password.length < 6) {
    return res.render('auth/register', { error: 'Password must be at least 6 characters.', avatarColors: AVATAR_COLORS });
  }
  if (password !== confirmPassword) {
    return res.render('auth/register', { error: 'Passwords do not match.', avatarColors: AVATAR_COLORS });
  }

  try {
    const existingUser = await db.users.findOneAsync({ username: username.trim() });
    if (existingUser) {
      return res.render('auth/register', { error: 'Username already taken.', avatarColors: AVATAR_COLORS });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const colorHexes = AVATAR_COLORS.map(c => c.hex);
    const chosenColor = req.body.avatarColor;
    const avatarColor = colorHexes.includes(chosenColor) ? chosenColor : colorHexes[Math.floor(Math.random() * colorHexes.length)];

    const user = await db.users.insertAsync({
      username: username.trim(),
      passwordHash,
      xp: 0,
      level: 1,
      streak: 0,
      lastStudyDate: null,
      avatarColor,
      createdAt: new Date(),
    });

    req.session.userId = user._id;
    req.session.username = user.username;
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    if (err.errorType === 'uniqueViolated') {
      return res.render('auth/register', { error: 'Username already taken.', avatarColors: AVATAR_COLORS });
    }
    res.render('auth/register', { error: 'Something went wrong. Try again.', avatarColors: AVATAR_COLORS });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
