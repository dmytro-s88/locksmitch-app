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
  C.mapsUrl = function (address) { const a = String(address || '').trim(); return a ? 'https://maps.apple.com/?daddr=' + encodeURIComponent(a) : ''; };

  C.fmtMoney = function (n) { const v = Number(n) || 0; return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  C.fmtMiles = function (n) { return n === null || n === undefined || n === '' || isNaN(Number(n)) ? '' : (Math.round(Number(n) * 10) / 10) + ' mi'; };
  C.invoiceTotal = function (lines) {
    return Math.round((lines || []).reduce(function (s, L) { return s + (Number(L.qty) || 1) * (Number(L.price) || 0); }, 0) * 100) / 100;
  };
  C.paymentOptions = ['cash', 'zelle', 'card', 'square'];
  C.statusClass = function (key) { return 'st-' + (/^(site|new|pending|callback|scheduled|done|lost|spam)$/.test(key) ? key : 'new'); };

  /** State transitions. Pure: returns a new state object. */
  C.reduce = function (state, ev) {
    const s = Object.assign({}, state || {});
    switch (ev && ev.type) {
      case 'leads': s.leads = Object.assign({}, s.leads || {}); s.leads[ev.filter] = { at: ev.at || Date.now(), leads: C.sortLeads(ev.leads) }; return s;
      case 'unauthorized': s.key = ''; s.view = 'login'; s.lead = null; return s;
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
