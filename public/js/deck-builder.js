async function addCard(deckId) {
  const front = document.getElementById('newFront').value.trim();
  const back = document.getElementById('newBack').value.trim();
  const errorEl = document.getElementById('addCardError');

  errorEl.style.display = 'none';

  if (!front || !back) {
    errorEl.textContent = 'Both front and back are required.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`/decks/${deckId}/cards/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ front, back }),
    });
    const data = await res.json();

    if (data.error) {
      errorEl.textContent = data.error;
      errorEl.style.display = 'block';
      return;
    }

    document.getElementById('newFront').value = '';
    document.getElementById('newBack').value = '';
    document.getElementById('newFront').focus();

    document.getElementById('emptyCards')?.remove();

    const list = document.getElementById('cardsList');
    const item = document.createElement('div');
    item.className = 'card-item';
    item.id = `card-${data.card._id}`;
    item.innerHTML = `
      <div class="card-item-sides">
        <div class="card-item-front"><span class="card-item-label">Front</span>${escHtml(data.card.front)}</div>
        <div class="card-item-sep">⇄</div>
        <div class="card-item-back"><span class="card-item-label">Back</span>${escHtml(data.card.back)}</div>
      </div>
      <button class="btn-delete-card" onclick="deleteCard('${deckId}', '${data.card._id}')" title="Delete card">✕</button>
    `;
    item.style.animation = 'none';
    item.style.opacity = '0';
    list.appendChild(item);
    requestAnimationFrame(() => {
      item.style.transition = 'opacity 0.3s';
      item.style.opacity = '1';
    });
  } catch (err) {
    errorEl.textContent = 'Failed to add card. Please try again.';
    errorEl.style.display = 'block';
  }
}

async function deleteCard(deckId, cardId) {
  if (!confirm('Delete this card?')) return;
  try {
    const res = await fetch(`/decks/${deckId}/cards/${cardId}/delete`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      const el = document.getElementById(`card-${cardId}`);
      if (el) {
        el.style.transition = 'opacity 0.3s, transform 0.3s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(10px)';
        setTimeout(() => el.remove(), 300);
      }
    }
  } catch (err) {
    alert('Failed to delete card.');
  }
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.getElementById('newFront')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('newBack')?.focus(); }
});
document.getElementById('newBack')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const deckId = window.location.pathname.split('/')[2];
    addCard(deckId);
  }
});
