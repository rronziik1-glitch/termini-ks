/*!
 * fg.js · Faqja Gati template runtime (no dependencies, no build step)
 *
 * 1. FG.derive(content)        → copy of the content with computed links (WhatsApp, tel, map, booking…)
 * 2. FG.fill(document, content) → writes the content into the HTML through data-attributes
 * 3. FG.enhance(document)       → scroll reveal, header state, action bar, lightbox, parallax
 *
 * FG.derive and FG.fill use only standard DOM methods, so the server can run the same code
 * (Node + linkedom/jsdom) to produce static HTML:   const FG = require('./fg.js')
 *
 * Binding attributes (paths are dot paths into the content; a path starting with "." is
 * relative to the current item inside a <template data-each>):
 *
 *   data-t="hero.title"                      text content
 *   data-attr="href:links.whatsapp; title:brand.name"   attributes (removed when the value is empty)
 *   data-if="reviews.items"                  element is removed when the value is empty
 *   data-if="!booking.enabled"               negation
 *   data-img="hero.image"                    on <img>: sets src + alt, or swaps in a tonal placeholder
 *   data-video="hero.video"                  on <video>: sets src + poster, or removes the element
 *   data-icon="whatsapp"                     replaced with an inline SVG icon
 *   <template data-each="services.groups">…</template>   repeated for each item; may be nested
 *       inside:  ".name"  item field   "."  the item itself   ".$n"  position as 01, 02…
 *
 * Interaction attributes (used by FG.enhance):
 *   data-reveal            fades/slides in when scrolled into view (siblings stagger)
 *   data-parallax="0.12"   moves slower than the scroll (hero media)
 *   data-actionbar         sticky bottom bar, shown after the hero
 *   data-lightbox          on a gallery button wrapping an <img>
 */
(function (root, factory) {
  var FG = factory();
  if (typeof module === 'object' && module.exports) module.exports = FG;
  else root.FG = FG;
  if (typeof document !== 'undefined' && root === window) FG.boot();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FG = { version: '1.0.0' };

  var DEFAULT_WA = 'Përshëndetje! Ju shkruaj nga faqja juaj.';
  var DEFAULT_BOOK_WA = 'Përshëndetje! Dua të rezervoj një termin.';
  var DEFAULT_BOOK_LABEL = 'Rezervo termin';

  /* ---------------------------------------------------------------- icons */
  var ICONS = {
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24ZM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.13.17 1.76 2.67 4.25 3.74.59.26 1.05.41 1.41.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.14-1.18-.06-.1-.23-.16-.48-.29-.25-.12-1.47-.72-1.69-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23a7.4 7.4 0 0 1-1.38-1.72c-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43l-.48-.01Z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    'arrow-up-right': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6.06 6.6.87-4.83 4.6 1.2 6.57L12 17.4l-5.87 3.2 1.2-6.56L2.5 9.43l6.6-.87L12 2.5Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m3 7 9 6 9-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };
  FG.icons = ICONS;

  /* -------------------------------------------------------------- helpers */
  function isEmpty(v) {
    if (v === null || v === undefined || v === false || v === '') return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') {
      if ('src' in v && 'alt' in v && Object.keys(v).length <= 2) return !v.src && !v.alt; // image
      return Object.keys(v).length === 0;
    }
    return false;
  }

  function get(obj, path) {
    if (!path) return obj;
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function resolve(path, scope, rootData) {
    path = (path || '').trim();
    if (path === '.') return scope;
    if (path.charAt(0) === '.') return get(scope, path.slice(1));
    return get(rootData, path);
  }

  function enc(s) { return encodeURIComponent(s || ''); }
  function digits(s) { return String(s || '').replace(/\D+/g, ''); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function durationText(min) {
    if (!min && min !== 0) return '';
    min = Number(min);
    if (!isFinite(min) || min <= 0) return '';
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return m ? h + ' orë ' + m + ' min' : h + ' orë';
  }

  function onColor(hex) { // black or white text on a given fill
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '';
    var n = parseInt(m[1], 16);
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L > 0.36 ? '#0c0c0d' : '#ffffff';
  }

  /* --------------------------------------------------------------- derive */
  FG.derive = function (content) {
    var c = JSON.parse(JSON.stringify(content || {}));
    c.meta = c.meta || {}; c.brand = c.brand || {}; c.hero = c.hero || {};
    c.theme = c.theme || {}; c.contact = c.contact || {}; c.location = c.location || {};
    c.booking = c.booking || { enabled: false }; c.services = c.services || { groups: [] };
    c.about = c.about || {}; c.gallery = c.gallery || {}; c.reviews = c.reviews || {};
    c.team = c.team || {}; c.footer = c.footer || {};

    var phone = digits(c.contact.phone);
    var wa = digits(c.contact.whatsapp) || phone;
    var waBase = wa ? 'https://wa.me/' + wa : '';
    function waLink(msg) { return waBase ? waBase + '?text=' + enc(msg) : ''; }

    var place = c.location.mapQuery ||
      [c.brand.name, c.location.address, c.location.city || c.brand.city].filter(Boolean).join(', ');
    var hasTermini = !!(c.booking.enabled && c.booking.url);

    c.booking.label = c.booking.label || DEFAULT_BOOK_LABEL;
    c.contact.phoneDisplay = c.contact.phoneDisplay || (phone ? '+' + phone : '');

    c.links = {
      tel: phone ? 'tel:+' + phone : '',
      whatsapp: waLink(c.contact.whatsappMessage || DEFAULT_WA),
      booking: hasTermini ? c.booking.url : waLink(c.contact.whatsappMessage || DEFAULT_BOOK_WA),
      bookingIsTermini: hasTermini,
      map: place ? 'https://www.google.com/maps/search/?api=1&query=' + enc(place) : '',
      mapEmbed: place ? 'https://www.google.com/maps?q=' + enc(place) + '&z=16&output=embed' : '',
      email: c.contact.email ? 'mailto:' + c.contact.email : '',
      instagram: c.contact.instagram ? 'https://instagram.com/' + String(c.contact.instagram).replace(/^@/, '') : '',
      facebook: c.contact.facebook
        ? (/^https?:/.test(c.contact.facebook) ? c.contact.facebook : 'https://facebook.com/' + c.contact.facebook) : ''
    };
    c.contact.instagramDisplay = c.contact.instagram ? '@' + String(c.contact.instagram).replace(/^@/, '') : '';

    (c.services.groups || []).forEach(function (g) {
      (g.items || []).forEach(function (it) {
        it.durationText = durationText(it.duration);
        it.meta = [it.durationText, it.description].filter(Boolean).join(' · ');
        it.askLink = waLink('Përshëndetje! Më intereson: ' + it.name + (it.price ? ' (' + it.price + ')' : '') + '.');
        it.bookLink = hasTermini ? c.booking.url : waLink('Përshëndetje! Dua të rezervoj: ' + it.name + '.');
      });
    });

    (c.reviews.items || []).forEach(function (r) {
      var n = Math.max(1, Math.min(5, r.rating || 5));
      r.stars = '★★★★★'.slice(0, n);
      r.initial = (r.name || '?').trim().charAt(0).toUpperCase();
    });
    c.reviews.summary = [c.reviews.count, c.reviews.source ? 'në ' + c.reviews.source : ''].filter(Boolean).join(' ');

    c.brand.initial = (c.brand.name || '').trim().charAt(0).toUpperCase();
    c.brand.place = [c.brand.category, c.brand.city].filter(Boolean).join(' · ');
    c.brand.sinceText = c.brand.since ? 'Që nga ' + c.brand.since : '';
    c.location.full = [c.location.address, c.location.city].filter(Boolean).join(', ');
    c.year = String(new Date().getFullYear());
    c.meta.title = c.meta.title || [c.brand.name, c.brand.place].filter(Boolean).join(' · ');
    c.meta.description = c.meta.description || c.hero.subtitle || '';
    return c;
  };

  /* ----------------------------------------------------------------- fill */
  var phCount = 0;

  function placeholder(doc, img, alt) {
    var ph = doc.createElement('span');
    ph.className = (img.className ? img.className + ' ' : '') + 'fg-ph';
    ph.setAttribute('data-ph', String((phCount++ % 6) + 1));
    ph.setAttribute('role', 'img');
    ph.setAttribute('aria-label', alt || 'Foto');
    if (alt) {
      var label = doc.createElement('span');
      label.className = 'fg-ph__label';
      label.textContent = alt;
      ph.appendChild(label);
    }
    return ph;
  }

  function all(node, selector) {
    return Array.prototype.slice.call(node.querySelectorAll(selector));
  }

  function bind(doc, node, scope, data) {
    // 1. conditionals first, so removed branches are never processed
    all(node, '[data-if]').forEach(function (el) {
      if (!el.parentNode) return;
      var expr = el.getAttribute('data-if').trim();
      var neg = expr.charAt(0) === '!';
      var val = resolve(neg ? expr.slice(1) : expr, scope, data);
      var show = neg ? isEmpty(val) : !isEmpty(val);
      if (show) el.removeAttribute('data-if');
      else el.parentNode.removeChild(el);
    });

    // 2. repeats (templates inside a template are handled by the recursive call)
    all(node, 'template[data-each]').forEach(function (tpl) {
      if (!tpl.parentNode) return;
      var list = resolve(tpl.getAttribute('data-each'), scope, data);
      if (Array.isArray(list)) {
        list.forEach(function (item, i) {
          var itemScope = item;
          if (item !== null && typeof item === 'object') {
            itemScope = Object.create(item);
            itemScope.$n = pad2(i + 1);
            itemScope.$i = String(i + 1);
          }
          var frag = tpl.content.cloneNode(true);
          bind(doc, frag, itemScope, data);
          tpl.parentNode.insertBefore(frag, tpl);
        });
      }
      tpl.parentNode.removeChild(tpl);
    });

    // 3. text
    all(node, '[data-t]').forEach(function (el) {
      var v = resolve(el.getAttribute('data-t'), scope, data);
      el.textContent = isEmpty(v) ? '' : String(v);
      el.removeAttribute('data-t');
    });

    // 4. attributes
    all(node, '[data-attr]').forEach(function (el) {
      el.getAttribute('data-attr').split(';').forEach(function (pair) {
        var idx = pair.indexOf(':');
        if (idx < 0) return;
        var name = pair.slice(0, idx).trim();
        var v = resolve(pair.slice(idx + 1), scope, data);
        if (isEmpty(v)) el.removeAttribute(name);
        else el.setAttribute(name, String(v));
      });
      el.removeAttribute('data-attr');
    });

    // 5. images
    all(node, 'img[data-img]').forEach(function (img) {
      var v = resolve(img.getAttribute('data-img'), scope, data) || {};
      img.removeAttribute('data-img');
      if (v.src) {
        img.setAttribute('src', v.src);
        img.setAttribute('alt', v.alt || '');
        if (!img.hasAttribute('loading') && !img.hasAttribute('fetchpriority')) img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
      } else if (img.parentNode) {
        img.parentNode.replaceChild(placeholder(doc, img, v.alt), img);
      }
    });

    // 6. video
    all(node, 'video[data-video]').forEach(function (vid) {
      var v = resolve(vid.getAttribute('data-video'), scope, data) || {};
      vid.removeAttribute('data-video');
      if (v.src) {
        vid.setAttribute('src', v.src);
        if (v.poster) vid.setAttribute('poster', v.poster);
      } else if (vid.parentNode) {
        vid.parentNode.removeChild(vid);
      }
    });

    // 7. icons
    all(node, '[data-icon]').forEach(function (el) {
      var svg = ICONS[el.getAttribute('data-icon')];
      if (svg) el.innerHTML = svg;
      el.classList.add('fg-icon');
      el.setAttribute('aria-hidden', 'true');
      el.removeAttribute('data-icon');
    });
  }

  function jsonLd(c) {
    var data = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: c.brand.name,
      description: c.meta.description || undefined,
      telephone: c.contact.phone ? '+' + digits(c.contact.phone) : undefined,
      address: c.location.address ? {
        '@type': 'PostalAddress',
        streetAddress: c.location.address,
        addressLocality: c.location.city || c.brand.city,
        addressCountry: 'XK'
      } : undefined,
      image: c.hero.image && c.hero.image.src ? c.hero.image.src : undefined,
      sameAs: [c.links.instagram, c.links.facebook].filter(Boolean)
    };
    if (c.reviews.rating && parseInt(c.reviews.count, 10)) {
      data.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: c.reviews.rating,
        reviewCount: parseInt(c.reviews.count, 10)
      };
    }
    // Escape "<" so text like "</script>" in a business name cannot close the JSON-LD block (audit fix).
    return JSON.stringify(data).replace(/</g, '\\u003c');
  }

  /**
   * Write content into the document. Returns the derived content.
   * options.jsonLd (default true) adds a LocalBusiness block for Google.
   */
  FG.fill = function (doc, content, options) {
    options = options || {};
    var c = FG.derive(content);
    var html = doc.documentElement;
    phCount = 0;

    html.setAttribute('lang', c.meta.lang || 'sq');
    if (c.meta.template) html.setAttribute('data-template', c.meta.template);
    if (c.theme.variant) html.setAttribute('data-variant', c.theme.variant);
    if (c.theme.accent) {
      var css = '--accent:' + c.theme.accent + ';--on-accent:' + onColor(c.theme.accent) + ';';
      html.setAttribute('style', (html.getAttribute('style') || '') + css);
    }

    if (c.meta.title) doc.title = c.meta.title;
    var desc = doc.querySelector('meta[name="description"]');
    if (desc && c.meta.description) desc.setAttribute('content', c.meta.description);

    bind(doc, doc.body || doc, c, c);

    if (options.jsonLd !== false && doc.head && c.brand.name) {
      var s = doc.createElement('script');
      s.setAttribute('type', 'application/ld+json');
      s.textContent = jsonLd(c);
      doc.head.appendChild(s);
    }
    html.removeAttribute('data-fg-loading');
    html.setAttribute('data-fg-ready', '');
    return c;
  };

  /* -------------------------------------------------------------- enhance */
  FG.enhance = function (doc) {
    var win = doc.defaultView;
    if (!win) return;
    var html = doc.documentElement;
    var reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    html.classList.add('fg-js');

    // scroll reveal, with a small stagger between neighbouring siblings
    var revealEls = all(doc, '[data-reveal]');
    revealEls.forEach(function (el) {
      var i = 0, prev = el.previousElementSibling;
      while (prev && i < 5) { if (prev.hasAttribute('data-reveal')) i++; prev = prev.previousElementSibling; }
      el.style.setProperty('--fg-delay', i * 70 + 'ms');
    });
    if (reduce || !('IntersectionObserver' in win)) {
      revealEls.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new win.IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
    }

    // header state, action bar, parallax: one rAF-throttled scroll handler
    var bar = doc.querySelector('[data-actionbar]');
    var hero = doc.querySelector('[data-hero]') || doc.querySelector('header + main > section, main > section');
    var parallax = reduce ? [] : all(doc, '[data-parallax]');
    var ticking = false;
    function onScroll() {
      ticking = false;
      var y = win.scrollY || 0;
      html.classList.toggle('fg-scrolled', y > 16);
      if (bar) {
        var limit = hero ? hero.offsetTop + hero.offsetHeight * 0.7 : 400;
        bar.classList.toggle('is-visible', y > limit);
      }
      parallax.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.12;
        if (y < win.innerHeight * 1.5) el.style.transform = 'translate3d(0,' + (y * speed).toFixed(1) + 'px,0)';
      });
    }
    win.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; win.requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    // gallery lightbox
    var boxes = all(doc, '[data-lightbox]');
    if (boxes.length && typeof win.HTMLDialogElement !== 'undefined') {
      var dlg = doc.createElement('dialog');
      dlg.className = 'fg-lightbox';
      dlg.innerHTML = '<button class="fg-lightbox__close" aria-label="Mbyll">' + ICONS.close + '</button><img alt="">';
      doc.body.appendChild(dlg);
      var big = dlg.querySelector('img');
      dlg.addEventListener('click', function () { dlg.close(); });
      boxes.forEach(function (b) {
        var img = b.querySelector('img');
        if (!img) { b.setAttribute('tabindex', '-1'); b.style.cursor = 'default'; return; }
        b.addEventListener('click', function () {
          big.src = img.currentSrc || img.src; big.alt = img.alt;
          dlg.showModal();
        });
      });
    }

    // hero video: play only when allowed
    all(doc, 'video[autoplay]').forEach(function (v) {
      if (reduce) { v.removeAttribute('autoplay'); v.pause(); }
    });

    if (html.hasAttribute('data-fg-preview')) FG.lockPreview(doc);
  };

  /* -------------------------------------------------------------- preview */
  /* Deterrence only. Real protection is on the server (see 01-product-design.md §6.3). */
  FG.lockPreview = function (doc) {
    var win = doc.defaultView;
    all(doc, 'a[href]').forEach(function (a) { a.setAttribute('href', '#'); a.removeAttribute('target'); });
    all(doc, 'iframe').forEach(function (f) { f.removeAttribute('src'); });
    all(doc, 'button, a').forEach(function (el) { el.setAttribute('tabindex', '-1'); el.setAttribute('aria-disabled', 'true'); });
    var ribbon = doc.createElement('div');
    ribbon.className = 'fg-preview-ribbon';
    ribbon.textContent = 'Kjo është parapamje. Butonat aktivizohen pas pagesës.';
    doc.body.appendChild(ribbon);
    ['contextmenu', 'dragstart', 'copy', 'cut', 'selectstart'].forEach(function (ev) {
      doc.addEventListener(ev, function (e) { e.preventDefault(); });
    });
    doc.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); }, true);
    doc.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u', 'c', 'a'].indexOf(k) > -1) e.preventDefault();
      if (k === 'f12') e.preventDefault();
    });
    if (win) win.addEventListener('beforeprint', function () { doc.body.style.display = 'none'; });
  };

  /* ----------------------------------------------------------------- boot */
  /* Demo loader. Order: inline <script id="fg-content" type="application/json">,
     then content.json (needs http://), then window.FG_CONTENT from content.js (works on file://). */
  FG.boot = function () {
    var doc = document;
    function scriptDir() {
      var s = doc.querySelector('script[src*="fg.js"]');
      return s ? s.getAttribute('src').replace(/fg\.js.*$/, '') : '';
    }
    function start(content) {
      if (!content) { doc.documentElement.removeAttribute('data-fg-loading'); return; }
      if (/[?&]preview=1/.test(location.search)) {
        doc.documentElement.setAttribute('data-fg-preview', '');
        var l = doc.createElement('link');
        l.rel = 'stylesheet'; l.href = scriptDir() + 'preview.css';
        doc.head.appendChild(l);
      }
      FG.fill(doc, content);
      FG.enhance(doc);
    }
    function load() {
      if (doc.documentElement.hasAttribute('data-fg-static')) { FG.enhance(doc); return; } // server-rendered page
      var inline = doc.getElementById('fg-content');
      if (inline) { start(JSON.parse(inline.textContent)); return; }
      var fallback = function () { start(window.FG_CONTENT); };
      if (location.protocol === 'file:' || !window.fetch) { fallback(); return; }
      fetch('content.json', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(start)
        .catch(fallback);
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', load);
    else load();
  };

  return FG;
});
