// LocksMitch app: screens and bot calls. Logic without DOM lives in core.js (window.LMCore).
(function () {
  'use strict';
  const C = window.LMCore;
  const API = 'https://script.google.com/macros/s/AKfycbynxb1ruxrGOtdWw-uGXRYzHs_Pz7L-ad5lc9KdyqKUzbRcSfJ1-L97VLvmfUbY_cZh/exec';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };

  let state = { key: store.get('lm_key', ''), view: 'login', filter: 'open', leads: {}, lead: null, offline: false, busy: false };
  ['open', 'today', 'done'].forEach(f => { const c = store.get('lm_leads_' + f, null); if (c) state.leads[f] = c; });
  state.view = state.key ? 'leads' : 'login';

  function dispatch(ev) { state = C.reduce(state, ev); if (ev.type === 'unauthorized') store.del('lm_key'); if (ev.type === 'key') store.set('lm_key', state.key); if (ev.type === 'leads') store.set('lm_leads_' + ev.filter, state.leads[ev.filter]); render(); }

  /** One call to the bot. Plain POST with a JSON string body: no headers, so no CORS preflight. */
  async function call(action, params) {
    const body = JSON.stringify(Object.assign({ action: action, key: state.key }, params || {}));
    let text;
    try { const r = await fetch(API, { method: 'POST', body: body, redirect: 'follow' }); text = await r.text(); dispatch({ type: 'offline', on: false }); }
    catch (e) { dispatch({ type: 'offline', on: true }); return { ok: false, error: 'No connection' }; }
    const resp = C.parseResponse(text);
    if (C.isUnauthorized(resp)) { dispatch({ type: 'unauthorized' }); toast('Signed out. Send /app to the bot for a new code.', true); }
    return resp;
  }

  let toastT = 0;
  function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, bad ? 5000 : 2500); }
  function setBusy(on) { state.busy = on; $('refresh').innerHTML = on ? '<span class="spin"></span>' : '&#8635;'; }

  // ---------- screens ----------
  function render() {
    document.querySelectorAll('section[data-view]').forEach(s => { s.hidden = s.dataset.view !== state.view; });
    $('back').hidden = state.view !== 'lead';
    $('refresh').hidden = state.view === 'login';
    $('offline').hidden = !state.offline;
    $('nav').hidden = state.view === 'login';
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === (state.view === 'lead' ? 'leads' : state.view)));
    $('title').textContent = state.view === 'lead' && state.lead ? '#' + state.lead.lead.num + (state.lead.lead.name ? ' ' + state.lead.lead.name : '') : state.view === 'money' ? 'Money' : 'LocksMitch';
    if (state.view === 'leads') renderLeads();
    if (state.view === 'lead') renderLead();
  }

  function renderLeads() {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.filter === state.filter));
    const box = state.leads[state.filter], leads = box ? box.leads : [];
    $('leadList').innerHTML = leads.map(L => '<li data-num="' + L.num + '" class="' + (L.urgent ? 'urgent' : '') + '">' +
      '<div class="row1"><b>#' + L.num + (L.name ? ' ' + esc(L.name) : '') + '</b><span class="pill ' + C.statusClass(L.statusKey) + '">' + esc(L.status) + '</span></div>' +
      '<div>' + esc([L.vehicle, L.service].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="sub">' + esc([L.city || (L.address ? 'address on card' : 'no address'), L.source, L.date, L.quoted ? 'quoted ' + C.fmtMoney(L.quoted) : '', L.usd ? C.fmtMoney(L.usd) : '', L.colleague ? 'colleague job' : '', L.spanish ? 'Spanish' : ''].filter(Boolean).join(' · ')) + '</div></li>').join('');
    $('leadsEmpty').hidden = leads.length > 0;
  }

  function renderLead() {
    const d = state.lead; if (!d) return;
    const L = d.lead, tel = C.telUrl(L.phone), sms = C.smsUrl(L.phone), map = C.mapsUrl(L.address);
    const act = (href, ico, label) => href ? '<a href="' + esc(href) + '"><span class="ico">' + ico + '</span>' + label + '</a>' : '<button disabled><span class="ico">' + ico + '</span>' + label + '</button>';
    $('leadCard').innerHTML =
      '<div class="card"><div class="row1"><h2>' + esc([L.vehicle, L.service].filter(Boolean).join(' · ') || 'No vehicle') + '</h2><span class="pill ' + C.statusClass(L.statusKey) + '">' + esc(L.status) + '</span></div>' +
      (L.address ? '<div>' + esc(L.address) + (d.miles !== null && d.miles !== undefined ? ' <span class="muted">· ' + C.fmtMiles(d.miles) + '</span>' : '') + '</div>' : '<div class="muted">No address</div>') +
      '<div class="sub">' + esc([L.source, L.date, L.phone ? '(' + L.phone.slice(0, 3) + ') ' + L.phone.slice(3, 6) + '-' + L.phone.slice(6) : '', L.colleague ? 'colleague job' : '', L.spanish ? 'Spanish' : ''].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="actions3">' + act(tel, '&#9742;', 'Call') + act(sms, '&#9993;', 'Text') + act(map, '&#10148;', 'Go') + '</div>' +
      ((L.quoted || L.usd || L.verdict || L.estimate) ? '<div class="card"><div class="lab">Job</div>' + [L.verdict ? esc(L.verdict) : '', L.estimate ? 'Estimate: ' + esc(L.estimate) : '', L.quoted ? 'Quoted to customer: ' + C.fmtMoney(L.quoted) : '', L.usd ? 'Received: ' + C.fmtMoney(L.usd) : ''].filter(Boolean).join('<br>') + '</div>' : '') +
      (d.priceText ? '<div class="card"><div class="lab">Suggested price</div><pre class="notes">' + esc(d.priceText.replace(/^.*\n/, '')) + '</pre></div>' : '') +
      (d.invoices && d.invoices.length ? '<div class="card"><div class="lab">Invoices</div>' + d.invoices.map(i => '<div class="row1"><span>' + esc(i.type === 'estimate' ? 'Estimate ' : 'Invoice ') + esc(i.number) + (i.paid ? ' · paid ' + esc(i.paid.method) : '') + '</span><b>' + C.fmtMoney(i.total) + '</b></div>' + (i.pdfUrl ? '<a class="sub" href="' + esc(i.pdfUrl) + '" target="_blank" rel="noopener">Open PDF</a>' : '')).join('') + '</div>' : '') +
      (L.notes ? '<div class="card"><div class="lab">Notes</div><pre class="notes">' + esc(L.notes.replace(/;\s*/g, '\n')) + '</pre></div>' : '');
  }

  // ---------- data ----------
  async function loadLeads(filter, force) {
    const box = state.leads[filter];
    if (!force && box && Date.now() - box.at < 60000) return;
    setBusy(true);
    const r = await call('leads', { filter: filter });
    setBusy(false);
    if (r.ok) dispatch({ type: 'leads', filter: filter, leads: r.leads, at: Date.now() });
    else if (!C.isUnauthorized(r)) toast(r.error || 'Could not load leads', true);
  }
  async function openLead(num) {
    setBusy(true);
    const r = await call('lead', { num: num });
    setBusy(false);
    if (r.ok) dispatch({ type: 'lead', lead: r }); else if (!C.isUnauthorized(r)) toast(r.error || 'Could not open the lead', true);
  }

  // ---------- events ----------
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('code').value.replace(/\D/g, '');
    $('loginErr').hidden = true;
    if (code.length !== 6) { $('loginErr').textContent = 'Enter the 6-digit code from the bot.'; $('loginErr').hidden = false; return; }
    setBusy(true);
    const r = await call('auth', { code: code });
    setBusy(false);
    if (r.ok && r.key) { $('code').value = ''; dispatch({ type: 'key', key: r.key }); loadLeads('open', true); }
    else { $('loginErr').textContent = r.error || 'Could not sign in'; $('loginErr').hidden = false; }
  });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.filter = b.dataset.filter; render(); loadLeads(state.filter, false); });
  $('leadList').addEventListener('click', e => { const li = e.target.closest('li'); if (li) openLead(Number(li.dataset.num)); });
  $('back').addEventListener('click', () => { state.lead = null; state.view = 'leads'; render(); });
  $('refresh').addEventListener('click', () => { if (state.view === 'lead' && state.lead) openLead(state.lead.lead.num); else if (state.view === 'leads') loadLeads(state.filter, true); });
  $('nav').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; state.view = b.dataset.go; render(); if (state.view === 'leads') loadLeads(state.filter, false); });
  window.addEventListener('online', () => dispatch({ type: 'offline', on: false }));
  window.addEventListener('offline', () => dispatch({ type: 'offline', on: true }));

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
  if (state.key) loadLeads('open', false);
})();
