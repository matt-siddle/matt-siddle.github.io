/* ═══ Pursuit Weights & Cardio LP, shared site JS ═══ */

document.addEventListener('DOMContentLoaded', function () {

  /* ── Mobile nav ── */
  var hamburger = document.querySelector('.nav-hamburger');
  var navLinks = document.querySelector('.nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function () {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
  }

  /* ── Scroll reveal ── */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ── FAQ accordion ── */
  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var answer = item.querySelector('.faq-answer');
      var open = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(function (i) {
        i.classList.remove('active');
        i.querySelector('.faq-answer').style.maxHeight = null;
      });
      if (!open) {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  /* ── Reviews marquee: duplicate cards for a seamless loop ── */
  document.querySelectorAll('.marquee-track').forEach(function (track) {
    var cards = Array.prototype.slice.call(track.children);
    cards.forEach(function (c) { track.appendChild(c.cloneNode(true)); });
  });

  /* ── UTM passthrough (landing CTA → checkout) ── */
  var params = new URLSearchParams(window.location.search);
  var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'rate'];
  function carryParams(href) {
    var carried = [];
    utmKeys.forEach(function (k) { if (params.get(k)) carried.push(k + '=' + encodeURIComponent(params.get(k))); });
    if (!carried.length) return href;
    return href + (href.indexOf('?') > -1 ? '&' : '?') + carried.join('&');
  }
  document.querySelectorAll('[data-checkout-link]').forEach(function (a) {
    var base = a.getAttribute('href').split('?')[0];
    var rate = a.getAttribute('data-rate');
    var href = base;
    if (rate) href += '?rate=' + encodeURIComponent(rate);
    a.setAttribute('href', carryParams(href));
  });

  /* ─────────────── CHECKOUT ─────────────── */
  var checkoutForm = document.getElementById('checkoutForm');
  if (!checkoutForm) return;

  var RATES = {
    'weights-cardio': { name: 'Weights & Cardio', price: 11.95, tag: 'No lock-in contracts · 6 weeks free' },
    'full-muaythai':  { name: 'Muay Thai (all-access)', price: 40, tag: 'Adults & kids' },
    'full-bjj':       { name: 'Brazilian Jiu Jitsu', price: 40, tag: 'Adults & kids' },
    'full-hyrox':     { name: 'Hyrox & Mind Body', price: 35, tag: 'Strength + recovery' }
  };

  /* Pre-select rate from URL */
  var urlRate = new URLSearchParams(window.location.search).get('rate');
  if (urlRate && RATES[urlRate]) {
    var pre = checkoutForm.querySelector('input[name="rate"][value="' + urlRate + '"]');
    if (pre) pre.checked = true;
  }

  /* Order summary sync */
  function fmt(n) { return '$' + n.toFixed(2); }
  function updateSummary() {
    var sel = checkoutForm.querySelector('input[name="rate"]:checked');
    var key = sel ? sel.value : 'weights-cardio';
    var r = RATES[key];
    document.getElementById('sumRateName').textContent = r.name;
    document.getElementById('sumRateTag').textContent = r.tag;
    document.getElementById('sumWeekly').textContent = fmt(r.price) + '/wk';
    document.getElementById('sumAfter').textContent = fmt(r.price) + '/week';
  }
  checkoutForm.querySelectorAll('input[name="rate"]').forEach(function (el) {
    el.addEventListener('change', updateSummary);
  });
  updateSummary();

  /* Card number formatting */
  var cardNum = document.getElementById('cardNumber');
  if (cardNum) {
    cardNum.addEventListener('input', function () {
      var v = cardNum.value.replace(/\D/g, '').slice(0, 16);
      cardNum.value = v.replace(/(.{4})/g, '$1 ').trim();
    });
  }
  var cardExp = document.getElementById('cardExpiry');
  if (cardExp) {
    cardExp.addEventListener('input', function () {
      var v = cardExp.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
      cardExp.value = v;
    });
  }
  var cardCvc = document.getElementById('cardCvc');
  if (cardCvc) {
    cardCvc.addEventListener('input', function () {
      cardCvc.value = cardCvc.value.replace(/\D/g, '').slice(0, 4);
    });
  }

  /* Collection date: min = tomorrow */
  var collectDate = document.getElementById('collectDate');
  if (collectDate) {
    var t = new Date();
    t.setDate(t.getDate() + 1);
    collectDate.min = t.toISOString().split('T')[0];
  }

  /* Validation + simulated submit */
  var errBox = document.getElementById('checkoutError');
  function showErr(msg) {
    errBox.textContent = msg;
    errBox.style.display = 'block';
    errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  checkoutForm.addEventListener('submit', function (e) {
    e.preventDefault();
    errBox.style.display = 'none';
    checkoutForm.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });

    var required = checkoutForm.querySelectorAll('[required]');
    var firstBad = null;
    required.forEach(function (el) {
      if (!el.value.trim()) { el.classList.add('invalid'); if (!firstBad) firstBad = el; }
    });

    var email = checkoutForm.querySelector('[name="email"]');
    if (email && email.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value)) {
      email.classList.add('invalid'); if (!firstBad) firstBad = email;
    }
    var num = cardNum ? cardNum.value.replace(/\s/g, '') : '0000';
    if (cardNum && num.length < 15) { cardNum.classList.add('invalid'); if (!firstBad) firstBad = cardNum; }

    if (firstBad) {
      showErr('Please complete the highlighted fields so we can lock in your spot.');
      firstBad.focus();
      return;
    }

    /* Simulated success, no payment is processed */
    var sel = checkoutForm.querySelector('input[name="rate"]:checked');
    var r = RATES[sel ? sel.value : 'weights-cardio'];
    var name = checkoutForm.querySelector('[name="firstName"]').value;
    var dateVal = collectDate ? collectDate.value : '';
    var dateOut = dateVal ? new Date(dateVal + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }) : 'your selected day';

    document.getElementById('confirmName').textContent = name;
    document.getElementById('confirmRate').textContent = r.name + ', ' + fmt(r.price) + '/week';
    document.getElementById('confirmCollect').textContent = dateOut;

    document.getElementById('checkoutBody').style.display = 'none';
    var screen = document.getElementById('confirmScreen');
    screen.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

});
