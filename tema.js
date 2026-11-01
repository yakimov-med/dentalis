// Тема: по умолчанию — как в системе; кнопка #tema переключает светлую и тёмную и запоминает выбор в этом браузере.
// Подключается в <head> обычным скриптом: сохранённая тема ставится до отрисовки, без вспышки.
(() => {
  const koren = document.documentElement;
  const sistema = matchMedia('(prefers-color-scheme: dark)');
  try {
    const t = localStorage.getItem('tema');
    if (t === 'light' || t === 'dark') koren.dataset.theme = t;
  } catch (e) { /* хранилище закрыто — остаётся тема системы */ }
  const temnaya = () => (koren.dataset.theme || (sistema.matches ? 'dark' : 'light')) === 'dark';
  const SOLNCE = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  const LUNA = '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>';
  function knopka() {
    const b = document.getElementById('tema');
    if (!b) return;
    const obnovit = () => {
      const t = temnaya(); // на кнопке — тема, в которую переключит
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${t ? SOLNCE : LUNA}</svg>`;
      b.title = t ? 'Светлая тема' : 'Тёмная тема';
      b.setAttribute('aria-label', b.title);
    };
    obnovit();
    b.addEventListener('click', () => {
      koren.dataset.theme = temnaya() ? 'light' : 'dark';
      try { localStorage.setItem('tema', koren.dataset.theme); } catch (e) { /* выбор живёт до перезагрузки */ }
      obnovit();
    });
    sistema.addEventListener('change', obnovit);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', knopka);
  else knopka();
})();
