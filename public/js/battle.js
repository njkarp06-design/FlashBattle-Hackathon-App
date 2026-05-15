const socket = io();

let myScore = 0;
let timeLeft = 15;
let timerInterval = null;
let hasAnswered = false;
let totalQuestions = 0;

socket.emit('join-battle', {
  code: ROOM_CODE,
  userId: USER_ID,
  username: USERNAME,
  avatarColor: AVATAR_COLOR,
});

socket.on('room-update', ({ players }) => {
  renderPlayers(players);
  if (IS_HOST) {
    const btn = document.getElementById('startBtn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = `Start Battle (${players.length} player${players.length !== 1 ? 's' : ''})`;
    }
  }
});

socket.on('game-start', ({ totalQuestions: tq }) => {
  totalQuestions = tq;
  showScreen('gameScreen');
});

socket.on('question', ({ index, total, front, options, timeLimit }) => {
  hasAnswered = false;
  document.getElementById('questionCounter').textContent = `Question ${index + 1} of ${total}`;
  document.getElementById('questionText').textContent = front;
  document.getElementById('answerResult').style.display = 'none';

  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'battle-option';
    btn.innerHTML = `<span class="option-letter">${letters[i]}</span>${escHtml(opt)}`;
    btn.onclick = () => submitAnswer(opt, btn, options);
    grid.appendChild(btn);
  });

  startTimer(timeLimit);
});

socket.on('answer-result', ({ correct, correctAnswer, points, totalScore }) => {
  myScore = totalScore;
  document.getElementById('myScore').textContent = myScore;

  const result = document.getElementById('answerResult');
  document.getElementById('resultIcon').textContent = correct ? '✅' : '❌';
  document.getElementById('resultText').textContent = correct ? 'Correct!' : `Correct answer: ${correctAnswer}`;
  document.getElementById('resultPts').textContent = points > 0 ? `+${points} pts` : 'No points';
  result.style.display = 'block';
});

socket.on('time-up', ({ correctAnswer }) => {
  stopTimer();
  disableOptions();
  highlightCorrect(correctAnswer);
  if (!hasAnswered) {
    const result = document.getElementById('answerResult');
    document.getElementById('resultIcon').textContent = '⏰';
    document.getElementById('resultText').textContent = `Time's up! Answer: ${correctAnswer}`;
    document.getElementById('resultPts').textContent = '+0 pts';
    result.style.display = 'block';
  }
});

socket.on('leaderboard-update', ({ leaderboard }) => {
  showScreen('leaderboardScreen');
  renderLeaderboard(leaderboard, 'midLeaderboard', false);
});

socket.on('game-over', ({ leaderboard }) => {
  stopTimer();
  showScreen('gameOverScreen');
  renderLeaderboard(leaderboard, 'finalLeaderboard', true);
});

socket.on('error', ({ message }) => {
  alert(message);
  window.location.href = '/battle';
});

function startGame() {
  socket.emit('start-game', { code: ROOM_CODE, userId: USER_ID });
}

function submitAnswer(answer, btn, allOptions) {
  if (hasAnswered) return;
  hasAnswered = true;
  stopTimer();
  disableOptions();

  socket.emit('submit-answer', { code: ROOM_CODE, userId: USER_ID, answer, timeLeft });
}

function startTimer(seconds) {
  timeLeft = seconds;
  stopTimer();
  updateTimer(seconds);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer(timeLeft);
    if (timeLeft <= 0) {
      stopTimer();
      if (!hasAnswered) {
        hasAnswered = true;
        disableOptions();
      }
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimer(val) {
  const el = document.getElementById('battleTimer');
  const circle = document.getElementById('timerCircle');
  if (!el || !circle) return;

  el.textContent = val;
  el.style.color = val <= 5 ? 'var(--danger)' : val <= 10 ? 'var(--warning)' : 'var(--text)';

  const pct = val / 15;
  const circumference = 94.2;
  circle.style.strokeDashoffset = circumference * (1 - pct);
  circle.style.stroke = val <= 5 ? 'var(--danger)' : val <= 10 ? 'var(--warning)' : 'var(--primary)';
}

function disableOptions() {
  document.querySelectorAll('.battle-option').forEach(b => b.disabled = true);
}

function highlightCorrect(correctAnswer) {
  document.querySelectorAll('.battle-option').forEach(btn => {
    const text = btn.textContent.trim().replace(/^[ABCD]/, '').trim();
    if (text === correctAnswer) btn.classList.add('correct');
  });
}

function showScreen(id) {
  ['waitingScreen', 'gameScreen', 'leaderboardScreen', 'gameOverScreen'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = s === id ? 'block' : 'none';
  });
}

function renderPlayers(players) {
  const grid = document.getElementById('playersList');
  if (!grid) return;
  grid.innerHTML = '';
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player-slot';
    div.innerHTML = `
      <div class="player-avatar" style="background:${p.avatarColor}">${p.username.charAt(0).toUpperCase()}</div>
      <span class="player-name">${escHtml(p.username)}</span>
      ${p.isHost ? '<span class="player-host-badge">Host</span>' : ''}
    `;
    grid.appendChild(div);
  });
}

function renderLeaderboard(leaderboard, containerId, isFinal) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const medals = ['🥇', '🥈', '🥉'];

  leaderboard.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = isFinal
      ? `final-lb-row${i === 0 ? ' winner' : ''}`
      : 'lb-row';

    if (isFinal) {
      row.innerHTML = `
        <div class="final-lb-rank">${i < 3 ? medals[i] : '#' + (i + 1)}</div>
        <div class="final-lb-avatar" style="background:${p.avatarColor}">${p.username.charAt(0).toUpperCase()}</div>
        <div class="final-lb-info">
          <div class="final-lb-name">${escHtml(p.username)}${p.userId === USER_ID ? ' <span style="color:var(--primary)">(you)</span>' : ''}</div>
          <div class="final-lb-sub">${p.correct}/${p.total} correct</div>
        </div>
        <div class="final-lb-score">${p.score}</div>
      `;
    } else {
      row.innerHTML = `
        <div class="lb-row-rank">${i < 3 ? medals[i] : '#' + (i + 1)}</div>
        <div class="lb-row-avatar" style="background:${p.avatarColor}">${p.username.charAt(0).toUpperCase()}</div>
        <div class="lb-row-name">${escHtml(p.username)}${p.userId === USER_ID ? ' (you)' : ''}</div>
        <div class="lb-row-score">${p.score}</div>
      `;
    }
    container.appendChild(row);
  });
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.querySelector('.btn-copy');
    if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => btn.textContent = '📋 Copy', 2000); }
  });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
