function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function redirectIfAuth(req, res, next) {
  if (req.session.userId) return res.redirect('/dashboard');
  next();
}

module.exports = { requireAuth, redirectIfAuth };
