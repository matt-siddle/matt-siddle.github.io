/* Pursuit competition: the referral interface and its local mock.

   THE INTERFACE (what the backend has to provide; base URL = site.json "comp_api", printed on the pages as data-comp-api)

   1. Enter      POST {comp_api}/entries          Content-Type: application/json
                 body: the lead row built by js/site.js (form_key, site, campaign, club, club_key, first_name, last_name,
                       email, phone, consent, referred_by, landing_url, page_url, fbclid, fbc, fbp, gclid, utm_*,
                       user_agent, event_id, tag_captured, website)
                       referred_by = the ref code from the ?ref= on the entry page URL, or null
                 200:  { "ref_code": "k3x9q2a", "entries": 1, "referrals": 0 }
                 Rules: one entrant per email per competition (a repeat POST returns the same ref_code, no new entry);
                        a valid referred_by adds a referral to that entrant; an entrant cannot refer themselves;
                        a filled "website" field is a bot: return 200 with a throwaway code and store nothing.

   2. Count      GET  {comp_api}/entries/{ref_code}
                 200:  { "ref_code": "k3x9q2a", "entries": 3, "referrals": 2 }      404 when the code is unknown
                 No personal details in this response: the code is in a shareable URL.

   3. Share link Formed in the browser, not returned by the API:
                 {entry page URL}?ref={ref_code}&utm_source=share&utm_medium=referral&utm_campaign={campaign}
                 The entry page URL is the folder above the extra-entries page. ref_code: letters, digits, "-" or "_", 40 max.

   4. After entering, the browser goes to {entry page}/thank-you/?code={ref_code}. The code is also kept in localStorage
      ("pursuit_comp_code:{form_key}") so the page still works when it is reopened without the query string.

   THE MOCK: when comp_api is empty or the page is in preview mode, the same two calls run against localStorage
   ("pursuit_comp_mock:{form_key}") in this browser only. Entering through someone's link in the same browser adds a
   referral to them, so the whole flow can be clicked through. Nothing leaves the browser. */
(function () {
  function storeKey(formKey) { return 'pursuit_comp_mock:' + formKey; }
  function load(formKey) { try { return JSON.parse(window.localStorage.getItem(storeKey(formKey))) || {}; } catch (e) { return {}; } }
  function save(formKey, data) { try { window.localStorage.setItem(storeKey(formKey), JSON.stringify(data)); } catch (e) {} }
  function newCode() { var s = '', a = 'abcdefghjkmnpqrstuvwxyz23456789'; for (var i = 0; i < 7; i++) s += a.charAt(Math.floor(Math.random() * a.length)); return s; }
  function count(entry, perFriend) { return { ref_code: entry.ref_code, entries: 1 + entry.referrals * perFriend, referrals: entry.referrals }; }

  var mock = {
    enter: function (row, perFriend) {
      var data = load(row.form_key), email = String(row.email || '').toLowerCase(), code = null;
      Object.keys(data).forEach(function (k) { if (data[k].email === email) code = k; });
      if (!code) {
        code = newCode();
        data[code] = { ref_code: code, email: email, referrals: 0 };
        if (row.referred_by && data[row.referred_by] && data[row.referred_by].email !== email) data[row.referred_by].referrals += 1;
        save(row.form_key, data);
      }
      return Promise.resolve(count(data[code], perFriend));
    },
    get: function (formKey, code, perFriend) {
      var entry = load(formKey)[code];
      return entry ? Promise.resolve(count(entry, perFriend)) : Promise.reject(new Error('unknown code'));
    }
  };

  function json(res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); }
  function remember(formKey, code) { try { window.localStorage.setItem('pursuit_comp_code:' + formKey, code); } catch (e) {} }
  function recall(formKey) { try { return window.localStorage.getItem('pursuit_comp_code:' + formKey); } catch (e) { return null; } }

  window.PursuitComp = {
    enter: function (api, row, preview) {
      var perFriend = parseInt((document.getElementById('leadForm') || document.body).getAttribute('data-per-friend'), 10) || 1;
      var p = (!api || preview) ? mock.enter(row, perFriend)
        : fetch(api.replace(/\/$/, '') + '/entries', { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) }).then(json);
      return p.then(function (res) { if (!res || !res.ref_code) throw new Error('no ref_code'); remember(row.form_key, res.ref_code); return res; });
    },
    get: function (api, formKey, code, preview, perFriend) {
      return (!api || preview) ? mock.get(formKey, code, perFriend)
        : fetch(api.replace(/\/$/, '') + '/entries/' + encodeURIComponent(code), { mode: 'cors' }).then(json);
    }
  };

  /* ── Extra-entries page ── */
  var card = document.getElementById('shareCard');
  if (!card) return;
  var here = window.location;
  var qs = new URLSearchParams(here.search);
  var host = here.hostname;
  var preview = qs.get('preview') === '1' || here.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  var api = card.getAttribute('data-comp-api');
  var formKey = card.getAttribute('data-campaign');
  var perFriend = parseInt(card.getAttribute('data-per-friend'), 10) || 1;
  var code = (qs.get('code') || recall(formKey) || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

  if (!code) {
    card.querySelector('.share-card__found').hidden = true;
    card.querySelector('.share-card__missing').hidden = false;
    return;
  }
  remember(formKey, code);

  var entry = new URL(card.getAttribute('data-entry-url'), here.href.split(/[?#]/)[0]);
  if (here.protocol === 'file:') entry.pathname += 'index.html';
  entry.searchParams.set('ref', code);
  entry.searchParams.set('utm_source', 'share');
  entry.searchParams.set('utm_medium', 'referral');
  entry.searchParams.set('utm_campaign', card.getAttribute('data-utm-campaign'));
  if (qs.get('preview') === '1') entry.searchParams.set('preview', '1');
  var link = entry.toString();
  var msg = card.getAttribute('data-message').replace('{link}', link);

  var input = document.getElementById('shareLink');
  input.value = link;
  input.addEventListener('focus', function () { input.select(); });
  document.getElementById('shareSms').href = 'sms:?&body=' + encodeURIComponent(msg);
  document.getElementById('shareWa').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  document.getElementById('shareFb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link);
  var done = document.getElementById('shareDone');
  document.getElementById('shareCopy').addEventListener('click', function () {
    var ok = function () { done.textContent = card.getAttribute('data-copied'); };
    var fallback = function () { input.focus(); input.select(); try { if (document.execCommand('copy')) ok(); } catch (e) {} };
    try { navigator.clipboard.writeText(link).then(ok, fallback); } catch (e) { fallback(); }
  });

  function refresh() {
    window.PursuitComp.get(api, formKey, code, preview, perFriend).then(function (res) {
      document.getElementById('countEntries').textContent = res.entries;
      document.getElementById('countFriends').textContent = res.referrals;
    }, function () {});
  }
  document.getElementById('countRefresh').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  refresh();
})();
