const { db, calcLevel } = require('./database/db');

const activeRooms = new Map();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function buildQuestions(deckId) {
  const cards = await db.cards.findAsync({ deckId });
  if (cards.length < 4) return null;

  const shuffled = shuffle(cards);
  const questions = shuffled.slice(0, Math.min(10, shuffled.length));

  return questions.map(card => {
    const wrongPool = cards.filter(c => c._id !== card._id);
    const wrongs = shuffle(wrongPool).slice(0, 3).map(c => c.back);
    const options = shuffle([card.back, ...wrongs]);
    return {
      front: card.front,
      correctAnswer: card.back,
      options,
    };
  });
}

function initSocket(io) {
  io.on('connection', socket => {
    let currentRoom = null;
    let currentUser = null;

    socket.on('join-battle', async ({ code, userId, username, avatarColor }) => {
      const room = await db.battleRooms.findOneAsync({ code });
      if (!room || room.status === 'finished') {
        socket.emit('error', { message: 'Room not found or game already ended.' });
        return;
      }

      currentRoom = code;
      currentUser = { userId, username, avatarColor, score: 0, answers: [] };

      socket.join(code);

      if (!activeRooms.has(code)) {
        activeRooms.set(code, {
          hostId: room.hostId,
          deckId: room.deckId,
          players: new Map(),
          questions: null,
          currentQ: 0,
          questionTimer: null,
          status: 'waiting',
          answeredThisRound: new Set(),
        });
      }

      const roomState = activeRooms.get(code);
      roomState.players.set(userId, { ...currentUser, socketId: socket.id });

      const playerList = [...roomState.players.values()].map(p => ({
        userId: p.userId,
        username: p.username,
        avatarColor: p.avatarColor,
        score: p.score,
        isHost: p.userId === roomState.hostId,
      }));

      io.to(code).emit('room-update', { players: playerList, status: roomState.status });
    });

    socket.on('start-game', async ({ code, userId }) => {
      const roomState = activeRooms.get(code);
      if (!roomState || roomState.hostId !== userId) return;
      if (roomState.players.size < 1) {
        socket.emit('error', { message: 'Need at least 1 player to start.' });
        return;
      }

      const questions = await buildQuestions(roomState.deckId);
      if (!questions) {
        socket.emit('error', { message: 'Not enough cards in this deck.' });
        return;
      }

      roomState.questions = questions;
      roomState.currentQ = 0;
      roomState.status = 'playing';
      roomState.answeredThisRound = new Set();

      await db.battleRooms.updateAsync({ code }, { $set: { status: 'playing' } });

      io.to(code).emit('game-start', { totalQuestions: questions.length });
      await sendQuestion(io, code, roomState);
    });

    socket.on('submit-answer', async ({ code, userId, answer, timeLeft }) => {
      const roomState = activeRooms.get(code);
      if (!roomState || roomState.status !== 'playing') return;
      if (roomState.answeredThisRound.has(userId)) return;

      roomState.answeredThisRound.add(userId);

      const q = roomState.questions[roomState.currentQ];
      const isCorrect = answer === q.correctAnswer;
      const points = isCorrect ? Math.round(100 + timeLeft * 6) : 0;

      const player = roomState.players.get(userId);
      if (player) {
        player.score += points;
        player.answers.push({ correct: isCorrect, points });
      }

      socket.emit('answer-result', {
        correct: isCorrect,
        correctAnswer: q.correctAnswer,
        points,
        totalScore: player ? player.score : 0,
      });

      if (roomState.answeredThisRound.size >= roomState.players.size) {
        if (roomState.questionTimer) clearTimeout(roomState.questionTimer);
        await advanceQuestion(io, code, roomState);
      }
    });

    socket.on('disconnect', () => {
      if (!currentRoom || !currentUser) return;
      const roomState = activeRooms.get(currentRoom);
      if (!roomState) return;

      roomState.players.delete(currentUser.userId);

      if (roomState.players.size === 0) {
        activeRooms.delete(currentRoom);
        return;
      }

      const playerList = [...roomState.players.values()].map(p => ({
        userId: p.userId,
        username: p.username,
        avatarColor: p.avatarColor,
        score: p.score,
        isHost: p.userId === roomState.hostId,
      }));

      io.to(currentRoom).emit('room-update', { players: playerList, status: roomState.status });
    });
  });
}

async function sendQuestion(io, code, roomState) {
  const q = roomState.questions[roomState.currentQ];
  const TIME_PER_QUESTION = 15;

  roomState.answeredThisRound = new Set();

  io.to(code).emit('question', {
    index: roomState.currentQ,
    total: roomState.questions.length,
    front: q.front,
    options: q.options,
    timeLimit: TIME_PER_QUESTION,
  });

  roomState.questionTimer = setTimeout(async () => {
    io.to(code).emit('time-up', { correctAnswer: q.correctAnswer });
    await advanceQuestion(io, code, roomState);
  }, (TIME_PER_QUESTION + 2) * 1000);
}

async function advanceQuestion(io, code, roomState) {
  await new Promise(r => setTimeout(r, 2500));

  roomState.currentQ++;

  if (roomState.currentQ >= roomState.questions.length) {
    await endGame(io, code, roomState);
  } else {
    const leaderboard = getLeaderboard(roomState);
    io.to(code).emit('leaderboard-update', { leaderboard });
    await new Promise(r => setTimeout(r, 1500));
    await sendQuestion(io, code, roomState);
  }
}

async function endGame(io, code, roomState) {
  roomState.status = 'finished';
  await db.battleRooms.updateAsync({ code }, { $set: { status: 'finished' } });

  const leaderboard = getLeaderboard(roomState);

  await db.decks.updateAsync({ _id: roomState.deckId }, { $inc: { playCount: 1 } });

  const winnerId = leaderboard[0]?.userId;
  for (const [userId, player] of roomState.players) {
    const xpEarned = Math.round(player.score * 0.1) + (userId === winnerId ? 100 : 25);
    const user = await db.users.findOneAsync({ _id: userId });
    if (user) {
      const newXp = user.xp + xpEarned;
      await db.users.updateAsync(
        { _id: userId },
        { $set: { xp: newXp, level: calcLevel(newXp) } }
      );
    }
  }

  io.to(code).emit('game-over', { leaderboard });
  activeRooms.delete(code);
}

function getLeaderboard(roomState) {
  return [...roomState.players.values()]
    .map(p => ({
      userId: p.userId,
      username: p.username,
      avatarColor: p.avatarColor,
      score: p.score,
      correct: p.answers.filter(a => a.correct).length,
      total: p.answers.length,
    }))
    .sort((a, b) => b.score - a.score);
}

module.exports = { initSocket };
