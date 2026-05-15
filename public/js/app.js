document.getElementById('navToggle')?.addEventListener('click', () => {
  document.getElementById('navMobile')?.classList.toggle('open');
});

document.querySelectorAll('.alert').forEach(el => {
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.5s';
    setTimeout(() => el.remove(), 500);
  }, 5000);
});
