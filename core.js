// LocksMitch app: logic without DOM. Tested in Node (core.test.js), used in the browser as window.LMCore.
(function () {
  'use strict';
  const C = {};

  /** Bot answer text → object. Apps Script sometimes answers with an HTML page (redirect, error): that is "no answer", not a crash. */
  C.parseResponse = function (text) {
    try {
      const o = JSON.parse(String(text || ''));
      if (!o || typeof o !== 'object') return { ok: false, error: 'Bot did not answer' };
      return o;
    } catch (e) { return { ok: false, error: 'Bot did not answer' }; }
  };
  C.isUnauthorized = function (resp) { return !!resp && resp.ok === false && resp.error === 'unauthorized'; };

  /** Urgent first, then newest date, then higher number. Stable. */
  C.sortLeads = function (leads) {
    return (leads || []).slice().sort(function (a, b) {
      return ((b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)) || String(b.date || '').localeCompare(String(a.date || '')) || ((b.num || 0) - (a.num || 0));
    });
  };

  const digits10 = function (p) { const d = String(p || '').replace(/\D/g, ''); return d.length === 11 && d[0] === '1' ? d.slice(1) : d.length === 10 ? d : ''; };
  C.telUrl = function (phone) { const d = digits10(phone); return d ? 'tel:+1' + d : ''; };
  C.smsUrl = function (phone) { const d = digits10(phone); return d ? 'sms:+1' + d : ''; };
  // Google Maps: the https link works everywhere (Android opens the app); on iPhone the app is opened by its own scheme.
  C.mapsUrl = function (address) { const a = String(address || '').trim(); return a ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(a) + '&travelmode=driving' : ''; };
  C.gmapsAppUrl = function (address) { const a = String(address || '').trim(); return a ? 'comgooglemaps://?daddr=' + encodeURIComponent(a) + '&directionsmode=driving' : ''; };

  C.fmtMoney = function (n) { const v = Number(n) || 0; return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  C.fmtMiles = function (n) { return n === null || n === undefined || n === '' || isNaN(Number(n)) ? '' : (Math.round(Number(n) * 10) / 10) + ' mi'; };
  C.invoiceTotal = function (lines) {
    return Math.round((lines || []).reduce(function (s, L) { return s + (Number(L.qty) || 1) * (Number(L.price) || 0); }, 0) * 100) / 100;
  };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  C.monthLabel = function (ym) { const m = /^(\d{4})-(\d{2})$/.exec(String(ym || '')); return m ? MONTHS[Number(m[2]) - 1] + ' ' + m[1] : ''; };
  C.shiftMonth = function (ym, delta) { const m = /^(\d{4})-(\d{2})$/.exec(String(ym || '')); if (!m) return ''; let y = Number(m[1]), mo = Number(m[2]) - 1 + delta; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + '-' + ('0' + (mo + 1)).slice(-2); };
  C.currentMonth = function (d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); };
  // Money "Today" tab (Dima 2026-11-16): one day at a time, 'YYYY-MM-DD' in local time. Pure.
  const ymdOf = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  C.currentDay = function (d) { return ymdOf(d || new Date()); };
  C.shiftDay = function (ymd, delta) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '')); return m ? ymdOf(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta)) : ''; };
  C.dayLabel = function (ymd, now) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '')); if (!m) return '';
    const today = C.currentDay(now || new Date());
    if (ymd === today) return 'Today'; if (ymd === C.shiftDay(today, -1)) return 'Yesterday';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate() + (m[1] === today.slice(0, 4) ? '' : '/' + m[1]);
  };
  /** One uncashed check in the Money card: '#35 · car · service · Mon 11/16'. Pure. */
  C.checkLine = function (c, now) { return [c.num ? '#' + c.num : '', c.title || 'Check', C.dayLabel(c.date, now)].filter(Boolean).join(' · '); };
  C.daySummary = function (recent, miles) {
    const n = (recent || []).filter(function (o) { return o.kind === 'income'; }).length;
    return [n ? n + (n === 1 ? ' payment' : ' payments') : 'No payments yet', Number(miles) > 0 ? C.fmtMiles(miles) : ''].filter(Boolean).join(' · ');
  };
  // Ключ по работе (Дима 2026-11-16): бот угадывает ключ и цену, Дима правит только ошибки. Pure.
  C.jobKeyLine = function (j) {
    if (!j || !j.key) return 'No key' + (j && j.why ? ' · ' + j.why : '');
    const kit = (j.kit || []).map(function (x) { return ' + ' + (/chip/i.test(x.name) ? 'chip' : /blade/i.test(x.name) ? 'blade' : x.name) + ' ' + (x.est ? '~' : '') + C.fmtMoney(x.unit); }).join('');
    const keyEst = j.keyEst !== undefined ? j.keyEst : j.est;   // est у работы учитывает и мелочь; keyEst — только сам ключ (бот v274)
    return j.key + ' · ' + (keyEst ? '~' : '') + C.fmtMoney(j.unit) + kit + (j.qty > 1 ? ' × ' + j.qty : '');
  };
  C.jobsSummary = function (t) { t = t || {}; return 'Paid ' + C.fmtMoney(t.paid) + ' · Keys ' + (t.est ? '~' : '') + C.fmtMoney(t.keys) + (Number(t.other) > 0 ? ' · Other ' + C.fmtMoney(t.other) : '') + ' · Left ' + C.fmtMoney(t.net); };
  // VIN и PIN лида для карточки (бот v273)
  C.leadCodes = function (L) { L = L || {}; return [['VIN', L.vin], ['PIN', L.pin]].filter(function (x) { return x[1]; }).map(function (x) { return { lab: x[0], val: String(x[1]) }; }); };
  // прочие расходы работы (PIN-код и т.п., расходы с «лид #N»)
  C.jobExtrasLine = function (j) { return ((j && j.extras) || []).map(function (x) { return (x.vendor || 'Cost') + ' ' + C.fmtMoney(x.amount); }).join(' · '); };
  const MAKE_ALIAS = { chevy: 'Chevrolet', vw: 'Volkswagen', benz: 'Mercedes', mercedes: 'Mercedes' };
  C.makeWord = function (vehicle) { const w = String(vehicle || '').replace(/\b(19|20)\d{2}\b/g, ' ').trim().split(/\s+/)[0] || ''; return MAKE_ALIAS[w.toLowerCase()] || w; };
  C.filterStock = function (items, query) {
    const flat = x => String(x || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
    const words = flat(query).trim().split(' ').filter(Boolean);
    return (items || []).filter(function (it) { const f = ' ' + flat(it.name) + ' ', g = f.replace(/ /g, ''); return words.every(function (w) { return f.indexOf(' ' + w) >= 0 || (w.length >= 4 && g.indexOf(w) >= 0); }); })
      .map(function (it, i) { return { it: it, i: i }; }).sort(function (a, b) { return ((b.it.qty > 0) - (a.it.qty > 0)) || (a.i - b.i); }).map(function (x) { return x.it; });
  };
  C.fmtPhone = function (p) { const d = String(p || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1'); if (d.length === 10) return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6); if (d.length === 7) return d.slice(0, 3) + '-' + d.slice(3); return d; };
  C.needsLeads = function (state, filter, now) { const box = state && state.leads && state.leads[filter]; return !box || (now - (box.at || 0)) >= 60000; };
  C.paymentOptions = ['cash', 'check', 'zelle', 'card', 'square'];
  C.lineValid = function (L) { return !!(L && String(L.desc || '').trim()) && !isNaN(Number(L.price)) && String(L.price) !== '' && Number(L.price) >= 0; };
  /** Days for the Today tab picker: Today, Yesterday, then 'Fri 11/13' back to 6 days ago (local time). Pure. */
  C.dayOptions = function (now) {
    const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], out = [], base = new Date(now);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
      const ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      out.push({ ymd: ymd, label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : W[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate() });
    }
    return out;
  };
  /** Cache key for a lead list: each day of the Today tab is kept apart. Pure. */
  C.leadsKey = function (filter, day) { return filter === 'today' && day ? 'today:' + day : filter; };
  /** Status label for the pill: scheduled leads show when (Dima 2026-11-15). Pure. */
  C.statusText = function (L) {
    if (!L || L.statusKey !== 'scheduled' || L.visit === undefined) return (L && L.status) || '';   // undefined: bot not yet sending visit
    return (L.status || 'Scheduled') + ' · ' + (L.visit || 'no time set');
  };
  C.statusClass = function (key) { return 'st-' + (/^(site|new|pending|thinking|parts|callback|scheduled|done|lost|spam)$/.test(key) ? key : 'new'); };

  // ---------- оплата по лиду (Дима 2026-11-20) ----------
  /** A done lead with no payment recorded: the card shows "Add payment". Colleague jobs and "no charge" jobs are not asked. Pure. */
  C.needsPayment = function (L) { return !!L && L.statusKey === 'done' && !(Number(L.usd) > 0) && !L.colleague && !L.noCharge; };
  C.unpaidLine = function (u, now) { return ['#' + u.num + (u.name ? ' ' + u.name : ''), u.title, C.dayLabel(u.date, now)].filter(Boolean).join(' \u00b7 '); };
  C.payAmount = function (v) { const t = String(v == null ? '' : v).trim(), n = Number(t); return t !== '' && isFinite(n) && n > 0 ? n : null; };
  /** Jobs to pick for "+ Income": done but not paid first, then open leads. Pure. */
  C.incomeChoices = function (unpaid, open) {
    const seen = {}, out = [];
    (unpaid || []).forEach(function (u) { seen[u.num] = 1; out.push({ num: u.num, label: ['#' + u.num + (u.name ? ' ' + u.name : ''), u.title].filter(Boolean).join(' \u00b7 '), quoted: Number(u.quoted) || 0, done: true, colleague: false }); });
    (open || []).forEach(function (L) { if (seen[L.num]) return; seen[L.num] = 1; out.push({ num: L.num, label: ['#' + L.num + (L.name ? ' ' + L.name : ''), L.vehicle, L.service].filter(Boolean).join(' \u00b7 '), quoted: Number(L.quoted) || 0, done: false, colleague: !!L.colleague }); });
    return out;
  };

  /** State transitions. Pure: returns a new state object. */
  C.reduce = function (state, ev) {
    const s = Object.assign({}, state || {});
    switch (ev && ev.type) {
      case 'leads': s.leads = Object.assign({}, s.leads || {}); s.leads[ev.filter] = { at: ev.at || Date.now(), leads: C.sortLeads(ev.leads) }; return s;
      case 'unauthorized': s.key = ''; s.view = 'login'; s.lead = null; s.leads = {}; return s;
      case 'offline': s.offline = !!ev.on; return s;
      case 'key': s.key = ev.key || ''; s.view = s.key ? 'leads' : 'login'; return s;
      case 'view': s.view = ev.view; return s;
      case 'lead': s.lead = ev.lead; s.view = 'lead'; return s;
      case 'leadPatch': {   // optimistic: apply the patch, remember the previous values for rollback
        if (!s.lead || !s.lead.lead || s.lead.lead.num !== ev.num) return s;
        const prev = {}; Object.keys(ev.patch || {}).forEach(function (k) { prev[k] = s.lead.lead[k]; });
        s.lead = Object.assign({}, s.lead, { lead: Object.assign({}, s.lead.lead, ev.patch) });
        s.pending = Object.assign({}, s.pending || {}); s.pending[ev.num] = true;
        s.prev = Object.assign({}, s.prev || {}); s.prev[ev.num] = Object.assign({}, s.prev[ev.num] || {}, prev);
        return s;
      }
      case 'leadRollback': {
        const prev = (s.prev || {})[ev.num];
        if (s.lead && s.lead.lead && s.lead.lead.num === ev.num && prev) s.lead = Object.assign({}, s.lead, { lead: Object.assign({}, s.lead.lead, prev) });
        s.pending = Object.assign({}, s.pending || {}); delete s.pending[ev.num];
        s.prev = Object.assign({}, s.prev || {}); delete s.prev[ev.num];
        return s;
      }
      case 'lines': s.inv = Object.assign({}, s.inv || {}, { lines: (ev.lines || []).slice() }); return s;
      case 'leadSettled': {
        s.pending = Object.assign({}, s.pending || {}); delete s.pending[ev.num];
        s.prev = Object.assign({}, s.prev || {}); delete s.prev[ev.num];
        return s;
      }
      default: return s;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  if (typeof window !== 'undefined') window.LMCore = C;
})();
