let cards = typeof CARDS !== 'undefined' ? [...CARDS] : [];
let current = 0;
let isFlipped = false;
let correct = 0;
let wrong = 0;
let startTime = Date.now();
let studyMode = 'flip'; // 'flip' or 'type'
let typingAnswered = false;
let cardResults = []; // {cardId, correct}
let markedCards = new Set(); // tracks indices already marked to prevent double-counting
let dotResults = {}; // index -> true/false, for coloring dots after answer

function setMode(mode) {
  studyMode = mode;
  document.getElementById('flipModeBtn').classList.toggle('active', mode === 'flip');
  document.getElementById('typeModeBtn').classList.toggle('active', mode === 'type');

  if (mode === 'flip') {
    document.getElementById('flashcard').style.display = 'block';
    document.getElementById('typingArea').style.display = 'none';
  } else {
    document.getElementById('flashcard').style.display = 'none';
    document.getElementById('typingArea').style.display = 'flex';
    document.getElementById('studyControls').style.display = 'none';
    showTypingCard(current);
    document.getElementById('typeAnswer').focus();
  }
}

function init() {
  cards = shuffle(cards);
  document.getElementById('totalCards').textContent = cards.length;
  showCard(0);
  renderDots();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showCard(index) {
  if (index >= cards.length) { showComplete(); return; }

  current = index;
  isFlipped = false;
  typingAnswered = false;

  const card = cards[index];

  // Flip mode
  document.getElementById('frontText').textContent = card.front;
  document.getElementById('backText').textContent = card.back;
  document.getElementById('flashcardInner').classList.remove('flipped');
  document.getElementById('studyControls').style.display = 'none';
  document.getElementById('currentCard').textContent = index + 1;

  // Typing mode
  showTypingCard(index);

  const fill = (index / cards.length) * 100;
  document.getElementById('studyProgressFill').style.width = fill + '%';

  document.getElementById('prevBtn').disabled = index === 0;
  document.getElementById('nextBtn').disabled = studyMode === 'flip';

  updateDots(index);
}

function showTypingCard(index) {
  if (index >= cards.length) return;
  const card = cards[index];
  const frontEl = document.getElementById('typeFrontText');
  if (frontEl) frontEl.textContent = card.front;
  const input = document.getElementById('typeAnswer');
  if (input) { input.value = ''; input.disabled = false; }
  const fb = document.getElementById('typingFeedback');
  if (fb) fb.style.display = 'none';
  typingAnswered = false;
}

function checkTypedAnswer() {
  if (typingAnswered) {
    // Already answered — advance
    showCard(current + 1);
    if (studyMode === 'type') {
      setTimeout(() => document.getElementById('typeAnswer')?.focus(), 50);
    }
    return;
  }

  const input = document.getElementById('typeAnswer');
  const typed = input.value.trim();
  const correctAnswer = cards[current].back.trim();

  if (!typed) return;

  typingAnswered = true;
  input.disabled = true;

  const isCorrect = typed.toLowerCase() === correctAnswer.toLowerCase();

  if (!markedCards.has(current)) {
    markedCards.add(current);
    dotResults[current] = isCorrect;
    const card = cards[current];
    if (card && card._id) cardResults.push({ cardId: card._id, correct: isCorrect });
    if (isCorrect) correct++; else wrong++;
    document.getElementById('correctCount').textContent = correct;
    document.getElementById('wrongCount').textContent = wrong;
    updateDots(current);
  }

  const fb = document.getElementById('typingFeedback');
  fb.style.display = 'block';
  if (isCorrect) {
    fb.className = 'typing-feedback correct';
    fb.textContent = '✓ Correct!';
  } else {
    fb.className = 'typing-feedback wrong';
    fb.textContent = `✗ Answer: ${correctAnswer}`;
    shakeInput();
  }

  document.getElementById('nextBtn').disabled = false;

  // Auto-advance after 1.5s
  setTimeout(() => {
    showCard(current + 1);
    if (studyMode === 'type') {
      setTimeout(() => document.getElementById('typeAnswer')?.focus(), 50);
    }
  }, 1500);
}

function flipCard() {
  if (studyMode !== 'flip') return;
  if (isFlipped) return;
  isFlipped = true;
  document.getElementById('flashcardInner').classList.add('flipped');
  document.getElementById('studyControls').style.display = 'flex';
  document.getElementById('nextBtn').disabled = false;
}

function flashFeedback(isCorrect) {
  const inner = document.getElementById('flashcardInner');
  if (!inner) return;
  inner.classList.remove('flash-correct', 'flash-wrong');
  void inner.offsetWidth;
  inner.classList.add(isCorrect ? 'flash-correct' : 'flash-wrong');
  setTimeout(() => inner.classList.remove('flash-correct', 'flash-wrong'), 600);
}

function shakeInput() {
  const input = document.getElementById('typeAnswer');
  if (!input) return;
  input.classList.remove('shake');
  void input.offsetWidth;
  input.classList.add('shake');
  setTimeout(() => input.classList.remove('shake'), 500);
}

function markAnswer(isCorrect) {
  if (!markedCards.has(current)) {
    markedCards.add(current);
    dotResults[current] = isCorrect;
    const card = cards[current];
    if (card && card._id) cardResults.push({ cardId: card._id, correct: isCorrect });
    if (isCorrect) correct++; else wrong++;
    document.getElementById('correctCount').textContent = correct;
    document.getElementById('wrongCount').textContent = wrong;
    updateDots(current);
  }
  flashFeedback(isCorrect);
  setTimeout(() => showCard(current + 1), 350);
}

function prevCard() {
  if (current > 0) showCard(current - 1);
}

function nextCard() {
  if (studyMode === 'flip' && !isFlipped) {
    flipCard();
    return;
  }
  showCard(current + 1);
}

function renderDots() {
  const container = document.getElementById('studyDots');
  container.innerHTML = '';
  const max = Math.min(cards.length, 12);
  for (let i = 0; i < max; i++) {
    const dot = document.createElement('div');
    dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:var(--border);transition:background 0.3s,transform 0.2s;flex-shrink:0;';
    container.appendChild(dot);
  }
}

function updateDots(index) {
  const dots = document.querySelectorAll('#studyDots div');
  dots.forEach((d, i) => {
    if (i === index) {
      d.style.background = 'var(--accent)';
      d.style.transform = 'scale(1.4)';
    } else if (i in dotResults) {
      d.style.background = dotResults[i] ? 'var(--success)' : 'var(--danger)';
      d.style.transform = 'scale(1)';
    } else if (i < index) {
      d.style.background = 'var(--primary)';
      d.style.transform = 'scale(1)';
    } else {
      d.style.background = 'var(--border)';
      d.style.transform = 'scale(1)';
    }
  });
}

async function showComplete() {
  document.getElementById('studyArea').style.display = 'none';
  const completeEl = document.getElementById('studyComplete');
  completeEl.style.display = 'flex';

  const total = cards.length;
  const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
  const xpEarned = total * 5 + correct * 10;
  const duration = Math.round((Date.now() - startTime) / 1000);

  const iconEl = document.getElementById('completeIcon');
  const titleEl = document.getElementById('completeTitle');
  if (acc >= 90) {
    if (iconEl) iconEl.textContent = '🌟';
    if (titleEl) titleEl.textContent = 'Outstanding!';
  } else if (acc >= 70) {
    if (iconEl) iconEl.textContent = '🎉';
    if (titleEl) titleEl.textContent = 'Session Complete!';
  } else if (acc >= 50) {
    if (iconEl) iconEl.textContent = '💪';
    if (titleEl) titleEl.textContent = 'Keep It Up!';
  } else {
    if (iconEl) iconEl.textContent = '📚';
    if (titleEl) titleEl.textContent = 'Practice Makes Perfect!';
  }

  document.getElementById('finalCorrect').textContent = correct;
  document.getElementById('finalWrong').textContent = wrong;
  const accEl = document.getElementById('finalAcc');
  accEl.textContent = acc + '%';
  accEl.style.color = acc >= 80 ? 'var(--success)' : acc >= 60 ? 'var(--warning)' : 'var(--danger)';
  document.getElementById('finalXp').textContent = '+' + xpEarned + ' XP';

  try {
    const res = await fetch(`/decks/${DECK_ID}/study/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardsStudied: total, cardsCorrect: correct, durationSeconds: duration, cardResults }),
    });
    const data = await res.json();

    if (data.bonusXp > 0) {
      const bonusArea = document.getElementById('bonusXpArea');
      if (bonusArea) bonusArea.style.display = 'block';
      document.getElementById('finalXp').textContent = '+' + data.xpEarned + ' XP';
    }

    if (data.newAchievements && data.newAchievements.length > 0) {
      const area = document.getElementById('newAchievementsArea');
      const list = document.getElementById('newAchievementsList');
      if (area && list) {
        area.style.display = 'block';
        data.newAchievements.forEach(a => {
          const span = document.createElement('span');
          span.style.cssText = 'display:inline-block;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:4px;padding:0.3rem 0.75rem;margin:0.25rem;font-size:0.85rem;font-weight:700;color:var(--warning)';
          span.textContent = a.icon + ' ' + a.name;
          list.appendChild(span);
        });
      }
    }
  } catch (e) {}
}

function restartStudy() {
  correct = 0; wrong = 0; startTime = Date.now(); cardResults = []; markedCards = new Set(); dotResults = {};
  document.getElementById('correctCount').textContent = 0;
  document.getElementById('wrongCount').textContent = 0;
  document.getElementById('studyArea').style.display = 'flex';
  document.getElementById('studyComplete').style.display = 'none';
  cards = shuffle(cards);
  renderDots();
  showCard(0);
}

document.addEventListener('keydown', e => {
  if (studyMode === 'type') {
    if (e.key === 'Enter' && !typingAnswered) checkTypedAnswer();
    return;
  }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!isFlipped) flipCard(); }
  else if (e.key === 'ArrowRight') nextCard();
  else if (e.key === 'ArrowLeft') prevCard();
  else if (e.key === 'ArrowUp' && isFlipped) markAnswer(true);
  else if (e.key === 'ArrowDown' && isFlipped) markAnswer(false);
});

document.getElementById('typeAnswer')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); checkTypedAnswer(); }
});

if (cards.length > 0) init();
