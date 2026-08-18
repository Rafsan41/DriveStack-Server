/* Vehicle Rental API console — progressive enhancement only.
   The page is fully readable without JS; this adds live health, filtering,
   search and click-to-copy. No inline handlers or inline styles (CSP-safe). */
(function () {
  'use strict';

  /* ---------- live /health status pill ---------- */
  const pill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');

  function setStatus(state, text) {
    if (!pill || !statusText) return;
    pill.classList.remove('status-pill--ok', 'status-pill--down', 'status-pill--checking');
    pill.classList.add('status-pill--' + state);
    statusText.textContent = text;
  }

  async function ping() {
    try {
      const res = await fetch('/health', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('status ' + res.status);
      const body = await res.json();
      const env = body && body.data && body.data.environment ? body.data.environment : 'online';
      setStatus('ok', 'API online · ' + env);
    } catch (_err) {
      setStatus('down', 'API offline');
    }
  }
  ping();
  setInterval(ping, 15000);

  /* ---------- method filter + text search ---------- */
  const cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  const chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  const search = document.getElementById('search');
  const emptyMsg = document.getElementById('empty');
  const groups = Array.prototype.slice.call(document.querySelectorAll('.group'));

  let activeMethod = 'ALL';
  let query = '';

  function applyFilters() {
    let visible = 0;

    cards.forEach(function (card) {
      const method = card.getAttribute('data-method') || '';
      const path = (card.getAttribute('data-path') || '').toLowerCase();
      const text = (card.textContent || '').toLowerCase();

      const methodOk = activeMethod === 'ALL' || method === activeMethod;
      const queryOk = query === '' || path.indexOf(query) !== -1 || text.indexOf(query) !== -1;
      const show = methodOk && queryOk;

      card.classList.toggle('hide', !show);
      if (show) visible += 1;
    });

    // Hide a whole group when none of its cards are visible.
    groups.forEach(function (group) {
      const anyVisible = group.querySelector('.card:not(.hide)') !== null;
      group.classList.toggle('hide', !anyVisible);
    });

    if (emptyMsg) emptyMsg.hidden = visible !== 0;
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) {
        c.classList.remove('chip--active');
      });
      chip.classList.add('chip--active');
      activeMethod = chip.getAttribute('data-filter') || 'ALL';
      applyFilters();
    });
  });

  if (search) {
    search.addEventListener('input', function () {
      query = search.value.trim().toLowerCase();
      applyFilters();
    });
  }

  /* ---------- click / keyboard to copy the path ---------- */
  function flashCopied(card) {
    card.classList.add('copied');
    setTimeout(function () {
      card.classList.remove('copied');
    }, 1500);
  }

  function copyPath(card) {
    const path = card.getAttribute('data-path');
    if (!path) return;
    const full = window.location.origin + path;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(full).then(
        function () {
          flashCopied(card);
        },
        function () {
          flashCopied(card);
        },
      );
    } else {
      flashCopied(card);
    }
  }

  cards.forEach(function (card) {
    card.addEventListener('click', function () {
      copyPath(card);
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copyPath(card);
      }
    });
  });
})();
