(() => {
  'use strict';
  const page = document.body.dataset.manual;
  if (!page) return;
  const key = `pixelforge:manual:${page}:completed`;
  const checks = [...document.querySelectorAll('.chapter-check')];
  const bar = document.getElementById('progressBar');
  const label = document.getElementById('progressText');
  const navLinks = [...document.querySelectorAll('.chapter-nav a')];
  let completed = [];
  try { completed = JSON.parse(localStorage.getItem(key) || '[]'); } catch { completed = []; }
  if (!Array.isArray(completed)) completed = [];
  function update() {
    const done = checks.filter(c => c.checked).length;
    if (bar) bar.style.width = `${checks.length ? done / checks.length * 100 : 0}%`;
    if (label) label.textContent = `${done} de ${checks.length} completados`;
    try { localStorage.setItem(key, JSON.stringify(checks.filter(c=>c.checked).map(c=>Number(c.dataset.check)))); } catch { /* almacenamiento local opcional */ }
  }
  checks.forEach(c => { c.checked = completed.includes(Number(c.dataset.check)); c.addEventListener('change', update); });
  update();
  document.getElementById('resetProgress')?.addEventListener('click', () => {
    if (!window.confirm('¿Reiniciar el progreso de este manual en este navegador?')) return;
    checks.forEach(c => c.checked = false); update();
  });
  const search = document.getElementById('chapterSearch');
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLocaleLowerCase('es');
    navLinks.forEach(a => { a.hidden = q && !a.textContent.toLocaleLowerCase('es').includes(q); });
  });
  document.querySelectorAll('.copy-code').forEach(button => {
    button.addEventListener('click', async () => {
      const code = button.parentElement.querySelector('code')?.innerText || '';
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = 'Copiado';
      } catch {
        button.textContent = 'No se pudo copiar';
      }
      window.setTimeout(() => button.textContent = 'Copiar código', 1600);
    });
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
      });
    }, { rootMargin: '-15% 0px -70% 0px' });
    document.querySelectorAll('.manual-chapter').forEach(section => observer.observe(section));
  }
})();
