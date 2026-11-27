/* Pursuit club-launch pages: shared script (voucher page, competition page and both thank-you pages).

   Lead form contract (same as black-friday-2026/lp/form-spec.md):
   - The live GTM tag "CT - Lead capture (Wix forms)" listens for submit on document (capture phase). On a real submit it
     writes the lead_click_ids row, fires the Meta Lead and posts capi-lead, then pushes {event:'ct_lead_captured', ct_event_id}.
   - This file does not write lead_click_ids. It reuses the tag's event id, builds the full row and sends it on:
       data-mode="lead"  POST to the function in data-endpoint (best effort), then redirect to the thank-you page
       data-mode="comp"  hand the row to PursuitComp (js/comp.js), then redirect with the entrant's code
   - Honeypot: a filled "website" field is stopped at window capture, before the tag sees it, and redirected as if it worked.

   Preview mode: ?preview=1 on the URL, or the page opened from localhost or from disk. In preview mode the submit is
   stopped at window capture (so the GTM tag never records it), nothing is posted anywhere, the row is printed to the
   console and the page goes on to the thank-you page. A red "Preview" marker shows in the corner. */
(function () {
  var FIRST_TOUCH = 'ct_first_touch';
  var doc = document.documentElement;

  function param(url, key) { try { return new URL(url).searchParams.get(key); } catch (e) { return null; } }
  function cookie(name) { var m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)')); return m ? decodeURIComponent(m[2]) : null; }

  var host = window.location.hostname;
  var PREVIEW = param(window.location.href, 'preview') === '1' || window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  window.PursuitPage = { preview: PREVIEW, param: param };
  if (PREVIEW) {
    var rib = document.createElement('div');
    rib.className = 'preview-ribbon';
    rib.textContent = 'Preview: nothing is sent';
    document.body.appendChild(rib);
  }

  /* ── Nav ── */
  var nav = document.getElementById('nav');
  if (nav) window.addEventListener('scroll', function () { nav.classList.toggle('nav--scrolled', window.scrollY > 80); }, { passive: true });

  /* ── Scroll reveal (noscript fallback in the head; no-observer branch here) ── */
  var fadeUps = document.querySelectorAll('.fade-up');
  if (!('IntersectionObserver' in window)) {
    fadeUps.forEach(function (el) { el.classList.add('visible'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    fadeUps.forEach(function (el) { observer.observe(el); });
  }

  /* ── FAQ accordion ── */
  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item'), answer = item.querySelector('.faq-answer'), open = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(function (i) {
        i.classList.remove('active'); i.querySelector('.faq-answer').style.maxHeight = null; i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!open) { item.classList.add('active'); answer.style.maxHeight = answer.scrollHeight + 'px'; btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  /* ── Reviews marquee: duplicate the cards for a seamless loop ── */
  if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    document.querySelectorAll('.marquee-track').forEach(function (track) {
      Array.prototype.slice.call(track.children).forEach(function (c) { var d = c.cloneNode(true); d.setAttribute('aria-hidden', 'true'); track.appendChild(d); });
    });
  }

  /* ── Smooth scroll under the fixed nav; a link to #terms opens the terms ── */
  var termsFull = document.getElementById('terms-full');
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      var id = a.getAttribute('href'); if (id.length < 2) return;
      var t = document.querySelector(id); if (!t) return;
      if (id === '#terms' && termsFull) termsFull.open = true;
      ev.preventDefault(); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
      var toggle = document.getElementById('navToggle'); if (toggle) toggle.checked = false;
    });
  });
  if (termsFull && window.location.hash === '#terms') termsFull.open = true;

  /* ── Countdown to data-target (an ISO instant with the club's UTC offset). At the target the page flips to its
     "after" state (html.is-after). ?state=after or ?state=before forces either for review. ── */
  var cd = document.getElementById('countdown');
  if (cd) {
    var target = Date.parse(cd.getAttribute('data-target'));
    var forced = param(window.location.href, 'state');
    var out = cd.querySelector('[data-cd]');
    var mirrors = document.querySelectorAll('[data-cd-mirror]');
    var tick = function () {
      var after = forced === 'after' || (forced !== 'before' && Date.now() >= target);
      doc.classList.toggle('is-after', after);
      if (!after) {
        var s = Math.max(0, Math.floor((target - Date.now()) / 1000));
        var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
        var text = d + 'd ' + h + 'h ' + m + 'm';
        out.textContent = text;
        mirrors.forEach(function (el) { el.textContent = text; });
        setTimeout(tick, 30000);
      }
    };
    if (!isNaN(target)) { tick(); cd.classList.add('is-on'); }
  }

  /* ── Sticky claim bar: on once the hero copy and the form are both out of view ── */
  var bar = document.getElementById('claimbar');
  var formSec = document.getElementById('form');
  if (bar && formSec) {
    doc.classList.add('has-claimbar');
    var heroCopy = document.querySelector('.hero__copy');
    if (!('IntersectionObserver' in window) || !heroCopy) {
      bar.classList.add('is-on');
    } else {
      var seen = { hero: true, form: false };
      var barObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { seen[e.target === heroCopy ? 'hero' : 'form'] = e.isIntersecting; });
        bar.classList.toggle('is-on', !seen.hero && !seen.form);
      });
      barObs.observe(heroCopy); barObs.observe(formSec);
    }
  }

  /* ── Thank-you pages: the completion event (the script tag carries data-complete-event) ── */
  var me = document.currentScript;
  if (me && me.getAttribute('data-complete-event')) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: me.getAttribute('data-complete-event'), club: param(window.location.href, 'club'), form_key: me.getAttribute('data-form-key') });
  }

  /* ── Lead form ── */
  var form = document.getElementById('leadForm');
  if (!form) return;
  var mode = form.getAttribute('data-mode');
  var btn = form.querySelector('button[type="submit"]');
  var clubField = form.elements.club_key;                       // the one place the club lives

  function val(name) { var el = form.elements[name]; if (!el) return null; var v = el.value; return v && String(v).trim() ? String(v).trim() : null; }
  function landingUrl() { var l = null; try { l = window.localStorage.getItem(FIRST_TOUCH); } catch (e) {} return l || window.location.href; }

  // UTMs and gclid into the hidden fields, from the first-touch URL the click-id tag stores, else this URL
  var landing = landingUrl();
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'].forEach(function (k) {
    var f = form.elements[k]; var v = param(landing, k) || param(window.location.href, k);
    if (f && v) f.value = v;
  });

  // "Claim a voucher for my child" style buttons preselect the "Who is this for?" answer
  document.querySelectorAll('[data-for]').forEach(function (b) {
    b.addEventListener('click', function () { var r = form.querySelector('input[name="for"][value="' + b.getAttribute('data-for') + '"]'); if (r) r.checked = true; });
  });

  function thanksUrl(extra) {
    var rel = form.getAttribute('data-thanks');                 // "thank-you/", relative to this page's folder
    var here = window.location.href.split(/[?#]/)[0];
    if (!/\/$/.test(here) && !/\/[^\/]+\.[a-z0-9]+$/i.test(here)) here += '/';
    var u = new URL(rel, here);
    if (window.location.protocol === 'file:') u.pathname += 'index.html';
    u.searchParams.set('club', clubField.value);
    Object.keys(extra || {}).forEach(function (k) { if (extra[k]) u.searchParams.set(k, extra[k]); });
    if (PREVIEW) u.searchParams.set('preview', '1');
    return u.toString();
  }

  // The tag pushes {event:'ct_lead_captured', ct_event_id} synchronously on this same submit
  var usedIds = {};
  function tagEventId() {
    var dl = window.dataLayer || [];
    for (var i = dl.length - 1; i >= 0; i--) {
      var e = dl[i];
      if (e && e.event === 'ct_lead_captured' && e.ct_event_id && !usedIds[e.ct_event_id]) return e.ct_event_id;
    }
    return null;
  }

  function buildRow(now) {
    var tagId = tagEventId();
    var eventId = tagId || ((window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : String(now) + '-' + Math.random().toString(16).slice(2));
    if (tagId) usedIds[tagId] = true;
    var fbc = cookie('_fbc'), fbclid = param(landing, 'fbclid') || cookie('ct_fbclid');
    if (fbclid && (!fbc || fbc.indexOf(fbclid) === -1)) fbc = 'fb.1.' + now + '.' + fbclid;
    var forEl = form.querySelector('input[name="for"]:checked');
    // The tag's payload shape plus club_key, for, consent, campaign, site, tag_captured (and referred_by on the comp form)
    return {
      form_key: val('form_key'), site: val('site'), campaign: val('campaign'),
      email: val('email'), phone: val('phone'), first_name: val('first_name'), last_name: val('last_name'),
      club: clubField.getAttribute('data-club-name'), club_key: clubField.value,
      for: forEl ? forEl.value : null,
      consent: !!form.elements.consent.checked,
      referred_by: val('referred_by'),
      landing_url: landing, page_url: window.location.href,
      fbclid: fbclid, fbc: fbc, fbp: cookie('_fbp'),
      gclid: param(landing, 'gclid') || cookie('ct_gclid') || param(landing, 'wbraid') || cookie('ct_wbraid') || param(landing, 'gbraid') || cookie('ct_gbraid'),
      utm_source: param(landing, 'utm_source'), utm_medium: param(landing, 'utm_medium'), utm_campaign: param(landing, 'utm_campaign'),
      utm_content: param(landing, 'utm_content'), utm_term: param(landing, 'utm_term'),
      user_agent: navigator.userAgent, event_id: eventId, tag_captured: !!tagId,
      website: val('website')
    };
  }

  /* Competition form: open or not. The button ships disabled in the HTML. */
  var compReady = true;
  if (mode === 'comp') {
    var state = document.getElementById('formState');
    var start = Date.parse(document.body.getAttribute('data-comp-start')), end = Date.parse(document.body.getAttribute('data-comp-end'));
    var forcedState = param(window.location.href, 'state');     // ?state=upcoming | open | closed, for review
    var datesSet = form.getAttribute('data-dates-set') === '1';
    var phase = !datesSet ? 'tbc' : (Date.now() < start ? 'upcoming' : (Date.now() > end ? 'closed' : 'open'));
    if (forcedState === 'upcoming' || forcedState === 'open' || forcedState === 'closed') phase = forcedState;
    var backend = !!form.getAttribute('data-comp-api');
    compReady = PREVIEW ? (phase === 'open' || phase === 'tbc') : (phase === 'open' && backend);
    doc.setAttribute('data-comp-phase', phase);
    btn.disabled = !compReady;
    state.textContent = compReady ? '' : state.getAttribute(phase === 'closed' ? 'data-closed' : 'data-not-open');
    var ref = param(window.location.href, 'ref');
    if (ref && form.elements.referred_by) form.elements.referred_by.value = ref.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  }

  var lastSubmit = 0;
  function handle() {
    var now = Date.now();
    if (now - lastSubmit < 10000) return;                       // 10-second duplicate guard
    lastSubmit = now;
    var row = buildRow(now);
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = form.getAttribute('data-sending') || label;
    if (PREVIEW) { try { console.info('[preview] row that would be sent', row); window.sessionStorage.setItem('pursuit_preview_row', JSON.stringify(row)); } catch (e) {} }

    if (mode === 'comp') {
      window.PursuitComp.enter(form.getAttribute('data-comp-api'), row, PREVIEW).then(function (res) {
        window.location.assign(thanksUrl({ code: res.ref_code }));
      }, function () {
        lastSubmit = 0; btn.disabled = false; btn.textContent = label;
        document.getElementById('formState').textContent = form.getAttribute('data-error');
      });
      return;
    }

    var done = false, finish = function () { if (!done) { done = true; window.location.assign(thanksUrl()); } };
    if (PREVIEW) { setTimeout(finish, 400); return; }
    // Best effort: the redirect never waits more than 1.5 seconds and happens on any failure (keepalive lets the POST finish)
    setTimeout(finish, 1500);
    try {
      fetch(form.getAttribute('data-endpoint'), { method: 'POST', mode: 'cors', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) })
        .then(finish, finish);
    } catch (e) { finish(); }
  }

  // Window capture runs before the GTM tag's document-capture listener: stop bots (honeypot), closed comp forms and every
  // preview submit here so the tag never writes a row for them.
  window.addEventListener('submit', function (ev) {
    if (ev.target !== form) return;
    if (val('website')) { ev.preventDefault(); ev.stopImmediatePropagation(); window.location.assign(thanksUrl()); return; }
    if (!compReady) { ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    if (PREVIEW) { ev.preventDefault(); ev.stopImmediatePropagation(); handle(); }
  }, true);

  form.addEventListener('submit', function (ev) { ev.preventDefault(); handle(); });
})();
