// LocksMitch app: screens and bot calls. Logic without DOM lives in core.js (window.LMCore).
(function () {
  'use strict';
  const C = window.LMCore;
  const API = 'https://script.google.com/macros/s/AKfycbynxb1ruxrGOtdWw-uGXRYzHs_Pz7L-ad5lc9KdyqKUzbRcSfJ1-L97VLvmfUbY_cZh/exec';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };

  let state = { key: store.get('lm_key', ''), view: 'login', filter: 'open', leads: {}, lead: null, offline: false, busy: false, pending: {}, prev: {}, sheet: false };
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
    const pend = state.pending && state.pending[L.num];
    $('leadActions').innerHTML = '<div class="actgrid">' +
      (L.statusKey !== 'done' ? '<button class="done" data-act="done"' + (pend ? ' disabled' : '') + '>' + (pend ? '<span class="spin"></span>' : '&#10003; Done') + '</button>' : '') +
      '<button data-act="callback">&#9742; Call back</button><button data-act="scheduled">&#128197; Scheduled</button>' +
      '<button data-act="price">&#36; Price</button><button data-act="note">&#9998; Note</button>' +
      '<button data-act="confirm"' + (L.phone ? '' : ' disabled') + '>&#9993; Confirm text</button><button data-act="thanks"' + (L.phone ? '' : ' disabled') + '>&#9993; Thank-you text</button>' +
      '<button data-act="lost" class="danger">&#10005; Lost</button><button data-act="invoice" disabled>&#129534; Invoice</button></div>';
    if (!state.sheet) $('sheet').hidden = true;
  }

  // ---------- action sheets ----------
  function sheet(html) { const el = $('sheet'); el.innerHTML = html; el.hidden = false; state.sheet = true; el.scrollIntoView({ block: 'nearest' }); }
  function closeSheet() { $('sheet').hidden = true; $('sheet').innerHTML = ''; state.sheet = false; }
  const chips = (name, opts, on) => '<div class="chips" data-chips="' + name + '">' + opts.map(o => '<button type="button" data-v="' + o + '" class="' + (o === on ? 'on' : '') + '">' + o.charAt(0).toUpperCase() + o.slice(1) + '</button>').join('') + '</div>';
  const chipVal = name => { const b = document.querySelector('[data-chips="' + name + '"] button.on'); return b ? b.dataset.v : ''; };

  /** Optimistic lead action: patch now, call the bot, reload the card on success, roll back on error. */
  async function leadAction(action, params, patch, okMsg) {
    const num = state.lead.lead.num;
    dispatch({ type: 'leadPatch', num: num, patch: patch || {} });
    closeSheet();
    const r = await call(action, Object.assign({ num: num }, params));
    if (r.ok) { dispatch({ type: 'leadSettled', num: num }); toast(okMsg || (r.text ? r.text.split('\n')[0] : 'Saved')); ['open', 'today', 'done'].forEach(f => store.del('lm_leads_' + f)); state.leads = {}; openLead(num); }
    else { dispatch({ type: 'leadRollback', num: num }); if (!C.isUnauthorized(r)) toast(r.error || 'Not saved', true); }
  }

  function openActionSheet(act) {
    const L = state.lead.lead;
    if (act === 'done') sheet('<h3>Done: how much did you get?</h3><div class="row"><input id="amt" type="number" inputmode="decimal" step="0.01" placeholder="Amount $" value="' + (L.quoted || '') + '"></div>' + chips('pay', C.paymentOptions, 'cash') +
      (L.colleague ? '<label class="chk"><input type="checkbox" id="coll" checked> Colleague did this job (your share is counted, not income)</label>' : '') +
      '<div class="row"><button class="secondary" data-close="1">Cancel</button><button class="primary" id="goDone">Record</button></div>');
    else if (act === 'callback' || act === 'scheduled' || act === 'lost') sheet('<h3>' + { callback: 'Call back', scheduled: 'Scheduled', lost: 'Lost' }[act] + '</h3><input id="nt" placeholder="' + (act === 'scheduled' ? 'When, e.g. tomorrow 10 am' : 'Note (optional)') + '"><div class="row"><button class="secondary" data-close="1">Cancel</button><button class="primary" id="goStatus" data-st="' + act + '">Save</button></div>');
    else if (act === 'note') sheet('<h3>Note</h3><textarea id="nt" rows="3" placeholder="What to remember"></textarea><div class="row"><button class="secondary" data-close="1">Cancel</button><button class="primary" id="goNote">Save</button></div>');
    else if (act === 'price') sheet('<h3>Price for the customer</h3><div class="row"><input id="pr" type="number" inputmode="numeric" placeholder="Price $" value="' + (L.quoted || '') + '"></div><div class="row"><button class="secondary" data-close="1">Cancel</button><button class="secondary" id="goQuote">Save only</button><button class="primary" id="goPricePreview">Preview text</button></div>');
    else if (act === 'confirm' || act === 'thanks') smsPreview(act, 0);
  }
  async function smsPreview(kind, price) {
    setBusy(true);
    const r = await call('leadSms', { num: state.lead.lead.num, kind: kind, price: price || 0, send: false });
    setBusy(false);
    if (!r.ok) { if (!C.isUnauthorized(r)) toast(r.error || 'No text', true); return; }
    sheet('<h3>' + (r.already ? 'Already sent earlier' : 'Text to (' + r.phone.slice(0, 3) + ') ' + r.phone.slice(3, 6) + '-' + r.phone.slice(6)) + '</h3><div class="preview">' + esc(r.text) + '</div>' +
      '<div class="row"><button class="secondary" data-close="1">Cancel</button>' + (r.already ? '' : '<button class="primary" id="goSend" data-kind="' + kind + '" data-price="' + (price || 0) + '">Send</button>') + '</div>');
  }
  async function smsSend(kind, price) {
    const num = state.lead.lead.num;
    closeSheet(); setBusy(true);
    const r = await call('leadSms', { num: num, kind: kind, price: price || 0, send: true });
    setBusy(false);
    if (r.ok && r.sent) { toast('Text sent'); if (kind === 'price') { ['open', 'today', 'done'].forEach(f => store.del('lm_leads_' + f)); state.leads = {}; openLead(num); } }
    else if (!C.isUnauthorized(r)) toast((r.error || 'Not sent') + '. Send it yourself:\n' + (r.text || ''), true);
  }

  $('leadActions').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (b && !b.disabled) openActionSheet(b.dataset.act); });
  $('sheet').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.close) return closeSheet();
    if (t.closest('[data-chips]')) { t.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === t)); return; }
    const L = state.lead.lead;
    if (t.id === 'goDone') { const amt = Number($('amt').value); if (!(amt > 0)) { toast('Enter the amount', true); return; } const pay = chipVal('pay'); const coll = $('coll') && $('coll').checked;
      return leadAction('leadDone', { amount: amt, payment: pay, colleague: coll ? 'colleague' : '' }, { status: 'Done', statusKey: 'done', usd: coll ? L.usd : amt }, 'Recorded ' + C.fmtMoney(amt)); }
    if (t.id === 'goStatus') { const st = t.dataset.st, lab = { callback: ['Call back', 'callback'], scheduled: ['Scheduled', 'scheduled'], lost: ['Lost', 'lost'] }[st]; return leadAction('leadStatus', { status: st, note: $('nt').value.trim() }, { status: lab[0], statusKey: lab[1] }); }
    if (t.id === 'goNote') { const nt = $('nt').value.trim(); if (!nt) { toast('Write something first', true); return; } return leadAction('leadNote', { note: nt }, {}, 'Note saved'); }
    if (t.id === 'goQuote') { const pr = Number($('pr').value); if (!(pr > 0)) { toast('Enter the price', true); return; } return leadAction('leadQuote', { price: pr }, { quoted: pr }, 'Quoted ' + C.fmtMoney(pr)); }
    if (t.id === 'goPricePreview') { const pr = Number($('pr').value); if (!(pr > 0)) { toast('Enter the price', true); return; } return smsPreview('price', pr); }
    if (t.id === 'goSend') return smsSend(t.dataset.kind, Number(t.dataset.price) || 0);
  });

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
  $('back').addEventListener('click', () => { closeSheet(); state.lead = null; state.view = 'leads'; render(); });
  $('refresh').addEventListener('click', () => { if (state.view === 'lead' && state.lead) openLead(state.lead.lead.num); else if (state.view === 'leads') loadLeads(state.filter, true); });
  $('nav').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; state.view = b.dataset.go; render(); if (state.view === 'leads') loadLeads(state.filter, false); });
  window.addEventListener('online', () => dispatch({ type: 'offline', on: false }));
  window.addEventListener('offline', () => dispatch({ type: 'offline', on: true }));

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
  if (state.key) loadLeads('open', false);
})();
