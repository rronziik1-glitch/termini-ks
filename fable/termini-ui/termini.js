/*!
 * termini.js · prototype behaviour for the Termini mock-ups (no dependencies).
 * This is NOT app code. It only makes the static screens clickable so the flows
 * can be judged on a phone. In React each helper becomes component state:
 *
 *   data-icon="name"                 → <Icon name> (Lucide, 24px, stroke 1.75)
 *   data-step="n" + T.go(n)          → step state in <BookingFlow> / <Onboarding>
 *   data-select (group) > data-option → single-choice state (chips, days, slots, rows)
 *   role="switch"                    → <Switch checked onChange>
 *   data-sheet-open="id" / data-sheet-close → <Sheet open onClose>
 *   T.toast('text', 'Zhbëj')         → <Toast>
 *   <select data-time="09:00">        → <TimeSelect value step> (24-hour, options every data-time-step minutes)
 *   data-view="name" + data-view-open → a route per view (settings sub-screens)
 *
 * URL helpers for review and screenshots:  ?step=2  ?sheet=booking  ?theme=dark  ?view=orari
 */
(function () {
  'use strict';
  var T = (window.T = {});
  var doc = document;
  var qs = new URLSearchParams(location.search);
  function all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  T.all = all;
  T.param = function (k) { return qs.get(k); };

  if (qs.get('theme')) doc.documentElement.setAttribute('data-theme', qs.get('theme'));

  /* ------------------------------------------------------------------ icons */
  var S = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  var P = {
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    'calendar-plus': '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.12 8.12 12 12M20 4 8.12 15.88M14.8 14.8 20 20"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17 20h4v-3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    navigation: '<path d="m3 11 19-9-9 19-2-8-8-2Z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    move: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15v4M17 17h4M5 3v3M3.5 4.5h3"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'
  };
  var WA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24ZM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.13.17 1.76 2.67 4.25 3.74.59.26 1.05.41 1.41.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.14-1.18-.06-.1-.23-.16-.48-.29-.25-.12-1.47-.72-1.69-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23a7.4 7.4 0 0 1-1.38-1.72c-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43l-.48-.01Z"/></svg>';
  T.icons = function (root) {
    all('[data-icon]', root).forEach(function (el) {
      var name = el.getAttribute('data-icon');
      el.innerHTML = name === 'whatsapp' ? WA : '<svg viewBox="0 0 24 24" ' + S + ' aria-hidden="true">' + (P[name] || '') + '</svg>';
      el.classList.add('icon');
      el.setAttribute('aria-hidden', 'true');
      el.removeAttribute('data-icon');
    });
  };

  /* ------------------------------------------------------------------ steps */
  var current = 1;
  T.step = function () { return current; };
  T.go = function (n, opts) {
    n = Number(n);
    var steps = all('[data-step]');
    if (!steps.length) return;
    doc.body.classList.toggle('is-back', n < current);
    steps.forEach(function (s) { s.classList.toggle('is-active', Number(s.getAttribute('data-step')) === n); });
    all('.steps span').forEach(function (b, i) { b.classList.toggle('is-done', i < n); });
    all('[data-show-step]').forEach(function (el) {
      el.hidden = el.getAttribute('data-show-step').split(',').map(Number).indexOf(n) < 0;
    });
    current = n;
    if (!opts || opts.scroll !== false) window.scrollTo(0, 0);
    var h = doc.querySelector('[data-step].is-active h1, [data-step].is-active h2');
    if (h && opts !== 'init') { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    doc.dispatchEvent(new CustomEvent('t:step', { detail: n }));
  };

  /* ----------------------------------------------------------------- sheets */
  var scrim, lastTrigger;
  T.open = function (id, trigger) {
    var sheet = doc.getElementById(id);
    if (!sheet) return;
    if (!scrim) {
      scrim = doc.createElement('div'); scrim.className = 'scrim';
      scrim.addEventListener('click', T.close); doc.body.appendChild(scrim);
    }
    lastTrigger = trigger || doc.activeElement;
    all('.sheet.is-open').forEach(function (s) { s.classList.remove('is-open'); });
    sheet.classList.add('is-open'); scrim.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    var f = sheet.querySelector('[autofocus], .sheet__title');
    if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
  };
  T.close = function () {
    all('.sheet.is-open').forEach(function (s) { s.classList.remove('is-open'); s.setAttribute('aria-hidden', 'true'); });
    if (scrim) scrim.classList.remove('is-open');
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus({ preventScroll: true });
  };

  /* ------------------------------------------------------------------ toast */
  var toastEl, toastTimer;
  T.toast = function (text, action) {
    if (!toastEl) { toastEl = doc.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); doc.body.appendChild(toastEl); }
    toastEl.innerHTML = '';
    var span = doc.createElement('span'); span.textContent = text; toastEl.appendChild(span);
    if (action) { var b = doc.createElement('button'); b.className = 'toast__action'; b.textContent = action; toastEl.appendChild(b); }
    toastEl.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-open'); }, action ? 6000 : 4000);
  };

  /* ----------------------------------------------------------- delegation */
  doc.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : e.target.parentElement;
    if (!t) return;
    var el;
    if ((el = t.closest('[data-option]'))) {
      var group = el.closest('[data-select]');
      if (group) {
        all('[data-option]', group).forEach(function (o) {
          if (o.closest('[data-select]') !== group) return;
          o.classList.toggle('is-selected', o === el);
          o.setAttribute('aria-pressed', o === el ? 'true' : 'false');
        });
        group.dispatchEvent(new CustomEvent('t:select', { bubbles: true, detail: { value: el.getAttribute('data-option'), el: el } }));
      }
    }
    if ((el = t.closest('[role="switch"]'))) {
      var on = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', on ? 'true' : 'false');
      var host = el.closest('[data-toggles]');
      if (host) host.classList.toggle('is-off', !on);
      el.dispatchEvent(new CustomEvent('t:toggle', { bubbles: true, detail: on }));
    }
    if ((el = t.closest('[data-view-open]'))) { e.preventDefault(); T.view(el.getAttribute('data-view-open')); }
    if ((el = t.closest('[data-go]'))) { e.preventDefault(); T.go(el.getAttribute('data-go')); }
    if ((el = t.closest('[data-sheet-open]'))) { e.preventDefault(); T.open(el.getAttribute('data-sheet-open'), el); }
    if ((el = t.closest('[data-sheet-close]'))) { e.preventDefault(); T.close(); }
    if ((el = t.closest('[data-toast]'))) { e.preventDefault(); T.toast(el.getAttribute('data-toast'), el.getAttribute('data-toast-action')); }
  });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') T.close(); });

  /* code input: auto-advance */
  doc.addEventListener('input', function (e) {
    var box = e.target.closest && e.target.closest('.code input');
    if (box && box.value && box.nextElementSibling) box.nextElementSibling.focus();
  });

  /* ------------------------------------------------------- time selects */
  T.times = function (root) {
    all('select[data-time]', root).forEach(function (sel) {
      if (sel.options.length) return;
      var value = sel.getAttribute('data-time'), step = Number(sel.getAttribute('data-time-step') || 30);
      for (var m = 5 * 60; m <= 24 * 60; m += step) {
        var t = m === 24 * 60 ? '24:00' : ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2);
        var o = doc.createElement('option'); o.textContent = t; o.value = t; if (t === value) o.selected = true;
        sel.appendChild(o);
      }
    });
  };

  /* ------------------------------------------------------------------ views */
  T.view = function (name, init) {
    var views = all('[data-view]');
    if (!views.length) return;
    doc.body.classList.toggle('is-back', name === 'main');
    views.forEach(function (v) { v.classList.toggle('is-active', v.getAttribute('data-view') === name); });
    all('[data-show-view]').forEach(function (el) { el.hidden = el.getAttribute('data-show-view').split(',').indexOf(name) < 0; });
    if (!init) window.scrollTo(0, 0);
    doc.dispatchEvent(new CustomEvent('t:view', { detail: name }));
  };

  /* ------------------------------------------------------------------- init */
  function init() {
    T.icons();
    T.times();
    if (doc.querySelector('[data-view]')) T.view(qs.get('view') || 'main', true);
    if (doc.querySelector('[data-step]')) T.go(qs.get('step') || 1, 'init');
    if (qs.get('sheet')) T.open(qs.get('sheet'));
    doc.dispatchEvent(new CustomEvent('t:ready'));
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
