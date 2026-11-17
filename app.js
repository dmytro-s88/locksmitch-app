// LocksMitch app: screens and bot calls. Logic without DOM lives in core.js (window.LMCore).
(function () {
  'use strict';
  const C = window.LMCore;
  const API = 'https://script.google.com/macros/s/AKfycbynxb1ruxrGOtdWw-uGXRYzHs_Pz7L-ad5lc9KdyqKUzbRcSfJ1-L97VLvmfUbY_cZh/exec';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };

  let state = { key: store.get('lm_key', ''), view: 'login', filter: 'open', day: '', leads: {}, lead: null, offline: false, busy: false, pending: {}, prev: {}, sheet: false };
  ['open', 'today', 'done'].forEach(f => { const c = store.get('lm_leads_' + f, null); if (c) state.leads[f] = c; });
  state.view = state.key ? 'leads' : 'login';

  function dispatch(ev) { state = C.reduce(state, ev); if (ev.type === 'lines') { renderInvoice(); return; } if (ev.type === 'offline') { $('offline').hidden = !state.offline; return; }   // не перерисовываем: иначе теряются набранные строки чека и форма расхода
    if (ev.type === 'unauthorized') { store.del('lm_key'); ['open', 'today', 'done'].forEach(f => store.del('lm_leads_' + f)); } if (ev.type === 'key') store.set('lm_key', state.key); if (ev.type === 'leads' && ev.filter.indexOf(':') < 0) store.set('lm_leads_' + ev.filter, state.leads[ev.filter]); /* прошлые дни Today не храним */ render(); }

  /** One call to the bot. Plain POST with a JSON string body: no headers, so no CORS preflight. */
  async function call(action, params) {
    const body = JSON.stringify(Object.assign({ action: action, key: state.key }, params || {}));
    let text; setBusy(true);
    try { const r = await fetch(API, { method: 'POST', body: body, redirect: 'follow' }); text = await r.text(); dispatch({ type: 'offline', on: false }); }
    catch (e) { dispatch({ type: 'offline', on: true }); return { ok: false, error: 'No connection' }; }
    finally { setBusy(false); }
    const resp = C.parseResponse(text);
    if (C.isUnauthorized(resp)) { dispatch({ type: 'unauthorized' }); toast('Signed out. Send /app to the bot for a new code.', true); }
    return resp;
  }

  function copyText(t) {
    const legacy = () => { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length); let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} ta.remove(); return ok; };
    return navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).then(() => true, () => legacy()) : Promise.resolve(legacy());
  }
  let toastT = 0;
  function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, bad ? 5000 : 2500); }
  let busyN = 0;
  function setBusy(on) { busyN = Math.max(0, busyN + (on ? 1 : -1)); state.busy = busyN > 0; $('bar').hidden = !state.busy; $('refresh').innerHTML = state.busy ? '<span class="spin"></span>' : '&#8635;'; }
  /** Spinner inside the pressed button while fn runs; the button is disabled meanwhile */
  async function withBtn(btn, fn) { if (btn) { btn.classList.add('loading'); btn.disabled = true; } try { return await fn(); } finally { if (btn && btn.isConnected) { btn.classList.remove('loading'); btn.disabled = false; } } }

  // ---------- screens ----------
  function render() {
    document.querySelectorAll('section[data-view]').forEach(s => { s.hidden = s.dataset.view !== state.view; });
    $('back').hidden = state.view !== 'lead' && state.view !== 'invoice';
    $('refresh').hidden = state.view === 'login';
    $('offline').hidden = !state.offline;
    $('nav').hidden = state.view === 'login';
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === (state.view === 'lead' || state.view === 'invoice' ? 'leads' : state.view)));
    $('title').textContent = state.view === 'lead' && state.lead ? '#' + state.lead.lead.num + (state.lead.lead.name ? ' ' + state.lead.lead.name : '') : state.view === 'invoice' ? (state.inv && state.inv.number ? (state.inv.type === 'estimate' ? 'Estimate ' : 'Invoice ') + state.inv.number : 'New invoice') : state.view === 'money' ? 'Money' : 'LocksMitch';
    if (state.view === 'leads') renderLeads();
    if (state.view === 'lead') renderLead();
    if (state.view === 'invoice') renderInvoice();
    if (state.view === 'money') renderMoney();
  }

  function renderLeads() {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.filter === state.filter));
    const days = C.dayOptions(Date.now()), dayOpt = days.find(d => d.ymd === state.day);
    if (state.day && !dayOpt) state.day = '';   // выбранный день ушёл из недели (приложение открыто с вчера)
    document.querySelector('#tabs button[data-filter="today"]').textContent = (dayOpt ? dayOpt.label : 'Today') + (state.filter === 'today' ? ' \u25BE' : '');
    const box = state.leads[C.leadsKey(state.filter, state.day)], leads = box ? box.leads : [];
    $('leadList').innerHTML = leads.map(L => '<li data-num="' + L.num + '" class="' + (L.urgent ? 'urgent' : '') + '">' +
      '<div class="row1"><b>#' + L.num + (L.name ? ' ' + esc(L.name) : '') + '</b><span class="pill ' + C.statusClass(L.statusKey) + '">' + esc(C.statusText(L)) + '</span></div>' +
      '<div>' + esc([L.vehicle, L.service].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="sub">' + esc([L.city || (L.address ? 'address on card' : 'no address'), L.source, L.date, L.quoted ? 'quoted ' + C.fmtMoney(L.quoted) : '', L.usd ? C.fmtMoney(L.usd) : '', L.colleague ? 'colleague job' : '', L.spanish ? 'Spanish' : ''].filter(Boolean).join(' · ')) + '</div></li>').join('');
    $('leadsEmpty').hidden = leads.length > 0;
  }

  function renderLead() {
    const d = state.lead; if (!d) return;
    const L = d.lead, tel = C.telUrl(L.phone), sms = C.smsUrl(L.phone), map = C.mapsUrl(L.address);
    const act = (href, ico, label) => href ? '<a href="' + esc(href) + '"><span class="ico">' + ico + '</span>' + label + '</a>' : '<button disabled><span class="ico">' + ico + '</span>' + label + '</button>';
    $('leadCard').innerHTML =
      '<div class="card"><div class="row1"><h2>' + esc([L.vehicle, L.service].filter(Boolean).join(' · ') || 'No vehicle') + '</h2><span class="pill ' + C.statusClass(L.statusKey) + '">' + esc(C.statusText(L)) + '</span></div>' +
      (L.address ? '<div class="addr" data-copy="' + esc(L.address) + '" title="Tap to copy">' + esc(L.address) + ' <span class="copyico">&#10697;</span>' + (d.miles !== null && d.miles !== undefined ? ' <span class="muted">· ' + C.fmtMiles(d.miles) + '</span>' : '') + '</div>' : '<div class="muted">No address</div>') +
      '<div class="sub">' + esc([L.visit ? 'Visit: ' + L.visit : '', L.source, L.date, C.fmtPhone(L.phone), L.colleague ? 'colleague job' : '', L.spanish ? 'Spanish' : ''].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="actions3">' + act(tel, '&#9742;', 'Call') + act(sms, '&#9993;', 'Text') + act(map, '&#10148;', 'Go').replace('<a ', '<a data-go="1" ') + '</div>' +
      ((L.quoted || L.usd || L.verdict || L.estimate) ? '<div class="card"><div class="lab">Job</div>' + [L.verdict ? esc(L.verdict) : '', L.estimate ? 'Estimate: ' + esc(L.estimate) : '', L.quoted ? 'Quoted to customer: ' + C.fmtMoney(L.quoted) : '', L.usd ? 'Received: ' + C.fmtMoney(L.usd) : ''].filter(Boolean).join('<br>') + '</div>' : '') +
      (d.priceText ? '<div class="card"><div class="lab">Suggested price</div><pre class="notes">' + esc(d.priceText.replace(/^.*\n/, '')) + '</pre></div>' : '') +
      (d.invoices && d.invoices.length ? '<div class="card"><div class="lab">Invoices</div>' + d.invoices.map(i => '<div class="row1" data-inv="' + esc(i.number) + '" style="cursor:pointer;padding:6px 0"><span>' + esc(i.type === 'estimate' ? 'Estimate ' : 'Invoice ') + esc(i.number) + (i.paid ? ' · paid ' + esc(i.paid.method) : '') + '</span><b>' + C.fmtMoney(i.total) + ' &#8250;</b></div>').join('') + '</div>' : '') +
      (L.notes ? '<div class="card"><div class="lab">Notes</div><pre class="notes">' + esc(L.notes.replace(/;\s*/g, '\n')) + '</pre></div>' : '');
    const pend = state.pending && state.pending[L.num];
    $('leadActions').innerHTML = '<div class="actgrid">' +
      (L.statusKey !== 'done' ? '<button class="done" data-act="done"' + (pend ? ' disabled' : '') + '>' + (pend ? '<span class="spin"></span>' : '&#10003; Done') + '</button>' : '') +
      '<button data-act="callback">&#9742; Call back</button><button data-act="scheduled">&#128197; Scheduled</button>' +
      '<button data-act="thinking">&#129300; Thinking</button><button data-act="parts">&#128230; Waiting for keys</button>' +
      '<button data-act="price">&#36; Price</button><button data-act="note">&#9998; Note</button>' +
      '<button data-act="confirm"' + (L.phone ? '' : ' disabled') + '>&#9993; Confirm text</button><button data-act="thanks"' + (L.phone ? '' : ' disabled') + '>&#9993; Thank-you text</button>' +
      '<button data-act="lost" class="danger">&#10005; Lost</button><button data-act="invoice">&#129534; Invoice</button></div>';
    if (!state.sheet) $('sheet').hidden = true;
  }

  // ---------- action sheets ----------
  function sheet(html) { const el = $('sheet'); el.innerHTML = html; el.hidden = false; state.sheet = true; el.scrollIntoView({ block: 'nearest' }); }
  function closeSheet() { $('sheet').hidden = true; $('sheet').innerHTML = ''; state.sheet = false; }
  const chips = (name, opts, on) => '<div class="chips" data-chips="' + name + '">' + opts.map(o => '<button type="button" data-v="' + o + '" class="' + (o === on ? 'on' : '') + '">' + o.charAt(0).toUpperCase() + o.slice(1) + '</button>').join('') + '</div>';
  const chipVal = name => { const b = document.querySelector('[data-chips="' + name + '"] button.on'); return b ? b.dataset.v : ''; };

  /** Optimistic lead action: patch now, call the bot, reload the card on success, roll back on error. */
  async function leadAction(action, params, patch, okMsg, btn) {
    const num = state.lead.lead.num;
    if (btn) { btn.classList.add('loading'); btn.disabled = true; }
    dispatch({ type: 'leadPatch', num: num, patch: patch || {} });
    closeSheet();
    const r = await call(action, Object.assign({ num: num }, params));
    if (r.ok) { dispatch({ type: 'leadSettled', num: num }); toast(okMsg || (r.text ? r.text.split('\n')[0] : 'Saved')); ['open', 'today', 'done'].forEach(f => store.del('lm_leads_' + f)); state.leads = {}; openLead(num); }
    else { dispatch({ type: 'leadRollback', num: num }); if (!C.isUnauthorized(r)) toast(r.error || 'Not saved', true); }
  }

  function openActionSheet(act) {
    const L = state.lead.lead;
    if (act === 'done') sheet('<h3>Done: how much did you get?</h3><div class="row"><input id="amt" type="number" inputmode="decimal" step="0.01" placeholder="Amount $" value="' + (L.quoted || '') + '"></div>' + chips('pay', C.paymentOptions, 'cash') +
      (L.colleague ? '<div class="sub">Colleague job: your share is counted, not income.</div>' : '') +
      '<div class="row"><button class="secondary" data-close="1">Cancel</button><button class="primary" id="goDone">Record</button></div>');
    else if (act === 'callback' || act === 'scheduled' || act === 'lost' || act === 'thinking' || act === 'parts') sheet('<h3>' + { callback: 'Call back', scheduled: 'Scheduled', lost: 'Lost', thinking: 'Customer is thinking', parts: 'Waiting for keys' }[act] + '</h3><input id="nt" placeholder="' + (act === 'scheduled' ? 'When, e.g. tomorrow 10 am' : 'Note (optional)') + '"><div class="row"><button class="secondary" data-close="1">Cancel</button><button class="primary" id="goStatus" data-st="' + act + '">Save</button></div>');
    else if (act === 'note') sheet('<h3>Note</h3><textarea id="nt" rows="3" placeholder="What to remember"></textarea><div class="row"><button class="secondary" data-close="1">Cancel</button><button class="primary" id="goNote">Save</button></div>');
    else if (act === 'price') sheet('<h3>Price for the customer</h3><div class="row"><input id="pr" type="number" inputmode="numeric" placeholder="Price $" value="' + (L.quoted || '') + '"></div><div class="row"><button class="secondary" data-close="1">Cancel</button><button class="secondary" id="goQuote">Save only</button><button class="primary" id="goPricePreview">Preview text</button></div>');
    else if (act === 'confirm' || act === 'thanks') smsPreview(act, 0);
    else if (act === 'invoice') openInvoiceDraft();
  }
  async function smsPreview(kind, price) {
    const r = await call('leadSms', { num: state.lead.lead.num, kind: kind, price: price || 0, send: false });
    if (!r.ok) { if (!C.isUnauthorized(r)) toast(r.error || 'No text', true); return; }
    sheet('<h3>' + (r.already ? 'Already sent earlier' : 'Text to ' + C.fmtPhone(r.phone)) + '</h3><div class="preview">' + esc(r.text) + '</div>' +
      '<div class="row"><button class="secondary" data-close="1">Cancel</button>' + (r.already ? '' : '<button class="primary" id="goSend" data-kind="' + kind + '" data-price="' + (price || 0) + '">Send</button>') + '</div>');
  }
  async function smsSend(kind, price) {
    const num = state.lead.lead.num;
    closeSheet();
    const r = await call('leadSms', { num: num, kind: kind, price: price || 0, send: true });
    if (r.ok && r.sent) { toast('Text sent'); if (kind === 'price') { ['open', 'today', 'done'].forEach(f => store.del('lm_leads_' + f)); state.leads = {}; openLead(num); } }
    else if (!C.isUnauthorized(r)) { toast(r.error || 'Not sent', true); if (r.text) sheet('<h3>Not sent. Send it yourself:</h3><div class="preview">' + esc(r.text) + '</div><div class="row"><button class="secondary" data-close="1">Close</button>' + (C.smsUrl(state.lead.lead.phone) ? '<a class="primary" style="display:flex;align-items:center;justify-content:center;text-decoration:none;border-radius:10px" href="' + esc(C.smsUrl(state.lead.lead.phone) + '&body=' + encodeURIComponent(r.text)) + '">Open Messages</a>' : '') + '</div>'); }
  }

  $('leadActions').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return; const act = b.dataset.act; if (act === 'confirm' || act === 'thanks') withBtn(b, () => smsPreview(act, 0)); else if (act === 'invoice') withBtn(b, openInvoiceDraft); else openActionSheet(act); });
  $('sheet').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.close) return closeSheet();
    if (t.closest('[data-chips]')) { t.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === t)); return; }
    const L = state.lead.lead;
    const B = t;
    if (t.id === 'goDone') { const amt = Number($('amt').value); if (!(amt > 0)) { toast('Enter the amount', true); return; } const pay = chipVal('pay'); const coll = !!L.colleague;
      return leadAction('leadDone', { amount: amt, payment: pay, colleague: coll ? 'colleague' : '' }, { status: 'Done', statusKey: 'done', usd: coll ? L.usd : amt }, 'Recorded ' + C.fmtMoney(amt), B); }
    if (t.id === 'goStatus') { const st = t.dataset.st, lab = { callback: ['Call back', 'callback'], scheduled: ['Scheduled', 'scheduled'], lost: ['Lost', 'lost'], thinking: ['Customer thinking', 'thinking'], parts: ['Waiting for keys', 'parts'] }[st]; return leadAction('leadStatus', { status: st, note: $('nt').value.trim() }, { status: lab[0], statusKey: lab[1] }, '', B); }
    if (t.id === 'goNote') { const nt = $('nt').value.trim(); if (!nt) { toast('Write something first', true); return; } return leadAction('leadNote', { note: nt }, {}, 'Note saved', B); }
    if (t.id === 'goQuote') { const pr = Number($('pr').value); if (!(pr > 0)) { toast('Enter the price', true); return; } return leadAction('leadQuote', { price: pr }, { quoted: pr }, 'Quoted ' + C.fmtMoney(pr), B); }
    if (t.id === 'goPricePreview') { const pr = Number($('pr').value); if (!(pr > 0)) { toast('Enter the price', true); return; } return withBtn(B, () => smsPreview('price', pr)); }
    if (t.id === 'goSend') return withBtn(B, () => smsSend(t.dataset.kind, Number(t.dataset.price) || 0));
  });

  // ---------- data ----------
  async function loadLeads(filter, force) {
    const box = state.leads[C.leadsKey(filter, filter === 'today' ? state.day : '')];
    if (!force && box && Date.now() - box.at < 60000) return;
    $('main').classList.add('dim');
    try { await loadLeadsInner(filter); } finally { $('main').classList.remove('dim'); }
  }
  async function loadLeadsInner(filter) {
    const day = filter === 'today' ? state.day : '';
    const r = await call('leads', { filter: filter, day: day });
    if (r.ok) dispatch({ type: 'leads', filter: C.leadsKey(filter, day), leads: r.leads, at: Date.now() });
    else if (!C.isUnauthorized(r)) toast(r.error || 'Could not load leads', true);
  }
  async function openLead(num) {
    const r = await call('lead', { num: num });
    if (r.ok) dispatch({ type: 'lead', lead: r }); else if (!C.isUnauthorized(r)) toast(r.error || 'Could not open the lead', true);
  }

  // ---------- invoice ----------
  function lineRow(L, i) { return '<div class="line" data-i="' + i + '"><input data-f="desc" placeholder="Description" value="' + esc(L.desc) + '"><input data-f="qty" type="number" inputmode="numeric" min="1" value="' + esc(L.qty || 1) + '"><input data-f="price" type="number" inputmode="decimal" step="0.01" placeholder="$" value="' + esc(L.price === 0 ? 0 : (L.price || '')) + '"><button class="x" data-del="' + i + '" aria-label="Remove line">&#10005;</button></div>'; }
  function renderInvoice() {
    const inv = state.inv; if (!inv) return;
    const box = $('invoiceBox');
    if (!inv.number) {   // draft: editable lines
      box.innerHTML = '<div class="card"><div class="lab">Customer</div><div><b>' + esc(inv.name || 'No name') + '</b>' + (inv.vehicle ? ' · ' + esc(inv.vehicle) : '') + '</div></div>' +
        '<div class="card"><div class="lab">Lines</div><div class="lines" id="lines">' + inv.lines.map(lineRow).join('') + '</div><button class="secondary" id="addLine" style="margin-top:8px;width:100%">+ Add line</button>' +
        '<div class="total"><span>Total</span><span id="invTotal">' + C.fmtMoney(C.invoiceTotal(inv.lines)) + '</span></div></div>' +
        '<div class="btnrow stack"><button id="mkInvoice" class="primary">Create invoice</button></div><div class="btnrow two"><button id="mkEstimate">Create estimate</button><button data-close="inv">Cancel</button></div>';
      return;
    }
    const kind = inv.type === 'estimate' ? 'Estimate' : 'Invoice';
    box.innerHTML = '<div class="card"><div class="row1"><h2>' + kind + ' ' + esc(inv.number) + '</h2>' + (inv.paid ? '<span class="paidmark">PAID · ' + esc(inv.paid.method) + '</span>' : '') + '</div><div>' + esc(inv.name || '') + (inv.vehicle ? ' · ' + esc(inv.vehicle) : '') + '</div>' +
      inv.lines.map(L => '<div class="row1" style="padding:4px 0"><span>' + esc(L.desc) + (Number(L.qty) > 1 ? ' × ' + esc(L.qty) : '') + '</span><span>' + C.fmtMoney((Number(L.qty) || 1) * Number(L.price)) + '</span></div>').join('') +
      '<div class="total"><span>Total</span><span>' + C.fmtMoney(inv.total) + '</span></div></div>' +
      '<div class="btnrow">' + (inv.pdfUrl ? '<a href="' + esc(inv.pdfUrl) + '" target="_blank" rel="noopener">&#128196; PDF</a>' : '<button disabled>PDF</button>') + '<a href="' + esc(inv.signUrl) + '" target="_blank" rel="noopener">&#9998; Sign</a><a href="' + esc(inv.printUrl) + '" target="_blank" rel="noopener">&#128424; Print</a></div>' +
      (inv.type !== 'estimate' && !inv.paid ? '<div class="card"><div class="lab">Mark paid</div><div class="btnrow four"><button data-paid="cash" class="primary">Cash</button><button data-paid="check">Check</button><button data-paid="zelle">Zelle</button><button data-paid="card">Card</button></div><div class="sub">Square card payments are picked up automatically.</div></div>' : '') +
      '<p class="sub">Sign and Print links work for 2 hours; reopen the invoice for fresh ones.</p>';
  }
  function readLines() { return Array.from(document.querySelectorAll('#lines .line')).map(r => ({ desc: r.querySelector('[data-f="desc"]').value.trim(), qty: Number(r.querySelector('[data-f="qty"]').value) || 1, price: r.querySelector('[data-f="price"]').value === '' ? '' : Number(r.querySelector('[data-f="price"]').value) })); }
  async function openInvoiceDraft() {
    const r = await call('invoiceDraft', { num: state.lead.lead.num });
    if (!r.ok) { if (!C.isUnauthorized(r)) toast(r.error || 'Could not start an invoice', true); return; }
    state.inv = { number: '', name: r.draft.name, vehicle: r.draft.vehicle, lines: r.draft.lines.length ? r.draft.lines : [{ desc: '', qty: 1, price: '' }] };
    state.view = 'invoice'; render();
  }
  async function openInvoice(number) {
    const r = await call('invoiceGet', { number: number });
    if (!r.ok) { if (!C.isUnauthorized(r)) toast(r.error || 'Could not open the invoice', true); return; }
    state.inv = r.invoice; state.view = 'invoice'; render();
  }
  async function createInvoice(type) {
    const lines = readLines();
    if (!lines.length || !lines.every(C.lineValid)) { toast('Every line needs a description and a price', true); return; }
    $('mkInvoice').disabled = true; $('mkEstimate').disabled = true;
    const r = await call('invoiceCreate', { num: state.lead.lead.num, lines: lines, type: type });
    if (!r.ok) { if (!C.isUnauthorized(r)) toast(r.error || 'Could not create', true); if ($('mkInvoice')) { $('mkInvoice').disabled = false; $('mkEstimate').disabled = false; } return; }
    toast((type === 'estimate' ? 'Estimate ' : 'Invoice ') + r.invoice.number + ' created, PDF is in Telegram too');
    state.inv = r.invoice; render();
  }
  async function invoicePaid(method) {
    const number = state.inv.number;
    document.querySelectorAll('#invoiceBox [data-paid]').forEach(b => { b.disabled = true; });
    const r = await call('invoicePaid', { number: number, method: method });
    if (!r.ok) { if (!C.isUnauthorized(r)) toast(r.error || 'Not saved', true); return; }
    toast(r.text ? r.text.split('\n')[0] : 'Paid'); ['open', 'today', 'done'].forEach(f => store.del('lm_leads_' + f)); state.leads = {};
    state.inv = r.invoice; render();   // repeated:true тоже приходит сюда с первым текстом и тем же чеком
  }
  $('invoiceBox').addEventListener('click', e => {
    const t = e.target.closest('button, a'); if (!t || t.tagName === 'A') return;
    if (t.id === 'addLine') { dispatch({ type: 'lines', lines: readLines().concat([{ desc: '', qty: 1, price: '' }]) }); return; }
    if (t.dataset.del !== undefined) { const L = readLines(); L.splice(Number(t.dataset.del), 1); dispatch({ type: 'lines', lines: L.length ? L : [{ desc: '', qty: 1, price: '' }] }); return; }
    if (t.id === 'mkInvoice') return withBtn(t, () => createInvoice('invoice'));
    if (t.id === 'mkEstimate') return withBtn(t, () => createInvoice('estimate'));
    if (t.dataset.close === 'inv') { state.inv = null; state.view = 'lead'; render(); return; }
    if (t.dataset.paid) return withBtn(t, () => invoicePaid(t.dataset.paid));
  });
  $('invoiceBox').addEventListener('input', e => { if (e.target.closest('#lines') && $('invTotal')) { const L = readLines(); if (state.inv) state.inv.lines = L; $('invTotal').textContent = C.fmtMoney(C.invoiceTotal(L)); } });   // набранное живёт в state: перерисовка не стирает

  // ---------- money ----------
  function moneyDefaults() {
    if (!state.month) state.month = C.currentMonth();
    if (!state.moneyMode) state.moneyMode = 'day';   // Дима 2026-11-16: сначала видно, сколько заработано сегодня
    if (!state.moneyDay) state.moneyDay = C.currentDay();
  }
  function renderMoney() {
    moneyDefaults();
    const m = state.money, box = $('moneyBox'), month = state.month, isDay = state.moneyMode === 'day', day = state.moneyDay;
    const tile = (lab, val, cls) => '<div class="tile"><div class="lab">' + lab + '</div><div class="val ' + (cls || '') + '">' + val + '</div></div>';
    let html = '<div class="tabs"><button data-mode="day" class="' + (isDay ? 'on' : '') + '">Day</button><button data-mode="month" class="' + (isDay ? '' : 'on') + '">Month</button></div>';
    html += isDay
      ? '<div class="mhead"><button class="iconbtn" data-d="-1" aria-label="Previous day">&#8249;</button><b>' + C.dayLabel(day) + '</b><button class="iconbtn" data-d="1" aria-label="Next day"' + (day >= C.currentDay() ? ' disabled' : '') + '>&#8250;</button></div>'
      : '<div class="mhead"><button class="iconbtn" data-m="-1" aria-label="Previous month">&#8249;</button><b>' + C.monthLabel(month) + '</b><button class="iconbtn" data-m="1" aria-label="Next month">&#8250;</button></div>';
    if (!m) { html += '<p class="muted">Loading…</p>'; box.innerHTML = html; return; }
    if (isDay) html += '<div class="today"><div class="lab">Earned</div><div class="big">' + C.fmtMoney(m.income) + '</div><div class="muted">' + esc(C.daySummary(m.recent, m.miles)) + '</div></div>';
    html += '<div class="tiles">' + tile('Income', C.fmtMoney(m.income)) + tile('Expenses', C.fmtMoney(m.expenses)) + tile('Profit', C.fmtMoney(m.profit), m.profit >= 0 ? 'pos' : 'neg') + tile('Miles', C.fmtMiles(m.miles) || '0 mi') + '</div>';
    if (m.checks && m.checks.length) html += '<div class="card checks"><div class="lab">Checks not cashed</div>' + m.checks.map(c => '<div class="row1 chk"><span>' + esc(C.checkLine(c)) + '</span><b>' + C.fmtMoney(c.amount) + '</b><button data-cash="' + c.row + '" data-amt="' + c.amount + '">Cashed</button></div>').join('') + (m.checks.length > 1 ? '<div class="total"><span>Total</span><span>' + C.fmtMoney(m.checksTotal) + '</span></div>' : '') + '</div>';
    if (m.jobs && m.jobs.length) html += '<div class="card jobs"><div class="lab">Jobs · costs</div><div class="sub jsum">' + esc(C.jobsSummary(m.jobsTotals)) + '</div>' + m.jobs.map(j => '<div class="job' + (state.keyEdit && state.keyEdit.num === j.num ? ' open' : '') + '" data-job="' + j.num + '"><div class="row1"><span>#' + j.num + ' · ' + esc(j.title) + '</span><b>' + C.fmtMoney(j.net) + '</b></div><div class="sub">🔑 ' + esc(C.jobKeyLine(j)) + (j.auto && j.key ? ' <span class="auto">auto</span>' : '') + ' · paid ' + C.fmtMoney(j.paid) + '</div>' + (C.jobExtrasLine(j) ? '<div class="sub">🧾 ' + esc(C.jobExtrasLine(j)) + '</div>' : '') + (state.keyEdit && state.keyEdit.num === j.num ? keySheetHtml() : '') + '</div>').join('') + '<div class="sub" style="margin-top:6px">Tap a job to fix the key. Profit above already counts keys and job costs (PIN codes) as expenses on the day you paid.</div></div>';
    if (m.owedTotal && !isDay) html += '<div class="card"><div class="lab">Colleagues owe you</div>' + m.owed.map(o => '<div class="row1"><span>#' + o.num + (o.name ? ' ' + esc(o.name) : '') + (o.who ? ' · ' + esc(o.who) : '') + '</span><b>' + C.fmtMoney(o.expect) + '</b></div>').join('') + '<div class="total"><span>Total</span><span>' + C.fmtMoney(m.owedTotal) + '</span></div></div>';
    html += '<div class="btnrow stack"><button class="primary" id="addExp">+ Expense</button></div><div id="expSheet"></div>';
    html += '<div class="lab" style="margin:8px 2px 6px;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.05em">' + (isDay ? 'This day' : 'Latest') + '</div>';
    html += m.recent.length ? '<div class="ops">' + m.recent.map(o => '<div class="op"><div class="t"><div>' + esc(o.title) + '</div><div>' + esc([o.date, o.note].filter(Boolean).join(' · ').slice(0, 80)) + (o.check ? ' <span class="ck ' + (o.check === 'cashed' ? 'cashed' : 'uncashed') + '">' + (o.check === 'cashed' ? 'check cashed' : 'check not cashed') + '</span>' : '') + '</div></div><div class="a ' + (o.kind === 'income' ? 'in' : o.kind === 'miles' ? 'mi' : '') + '">' + (o.kind === 'miles' ? C.fmtMiles(o.amount) : (o.kind === 'income' ? '+' : '-') + C.fmtMoney(o.amount)) + '</div></div>').join('') + '</div>' : '<p class="muted">' + (isDay ? 'Nothing recorded this day.' : 'No entries this month.') + '</p>';
    box.innerHTML = html;
  }
  // ---------- ключ по работе (Дима 2026-11-16) ----------
  function keyListHtml() {
    const k = state.keyEdit; if (!k) return '';
    if (!k.items) return '<p class="muted">Loading stock…</p>';
    const list = C.filterStock(k.items, k.q).slice(0, 40);
    let html = list.map((it, i) => '<button class="kitem' + (it.name === k.sel ? ' on' : '') + '" data-kitem="' + i + '"><span>' + esc(it.name) + '</span><span class="muted">' + it.qty + ' pcs · ' + (it.est ? '~' : '') + C.fmtMoney(it.unit) + '</span></button>').join('');
    if (k.q.trim() && !list.length) html += '<button class="kitem' + (k.sel === k.q.trim() ? ' on' : '') + '" data-kcustom="1"><span>Not in stock: “' + esc(k.q.trim()) + '”</span></button>';
    k.shown = list;
    return html;
  }
  function keySheetHtml() {
    const k = state.keyEdit;
    return '<div class="sheet ksheet"><input id="kq" placeholder="Search stock: Ford, N5F, flip…" value="' + esc(k.q) + '" autocomplete="off"><div class="klist" id="klist">' + keyListHtml() + '</div>' +
      '<div class="row"><label class="fld">Cost per key $<input id="kunit" type="number" inputmode="decimal" step="0.01" value="' + (k.unit === '' ? '' : esc(String(k.unit))) + '"></label><label class="fld">Keys<input id="kqty" type="number" inputmode="numeric" min="1" max="10" value="' + k.qty + '"></label></div>' +
      '<label class="chk"><input id="ktake" type="checkbox"' + (k.take ? ' checked' : '') + '> Take from stock (−' + k.qty + ')</label>' +
      '<div class="row"><button class="secondary" data-knone="1">No key</button><button class="secondary" data-kclose="1">Cancel</button><button class="primary" data-ksave="1">Save</button></div></div>';
  }
  async function openKey(num) {
    if (state.keyEdit && state.keyEdit.num === num) { state.keyEdit = null; render(); return; }
    const j = (state.money.jobs || []).filter(x => x.num === num)[0]; if (!j) return;
    const guessed = j.key && !/\(average\)$/.test(j.key);
    state.keyEdit = { num: num, q: guessed ? '' : C.makeWord(String(j.title).split(' · ')[0]), sel: guessed ? j.key : '', unit: j.key ? j.unit : '', qty: j.qty || 1, take: true, items: null };
    render();
    const r = await call('jobKeyOptions', { num: num });
    if (!state.keyEdit || state.keyEdit.num !== num) return;
    if (r.ok) { state.keyEdit.items = r.items; if (state.keyEdit.sel && !state.keyEdit.q) state.keyEdit.q = C.makeWord(r.vehicle || String(j.title).split(' · ')[0]); if (r.saved && r.saved.off > 0) state.keyEdit.take = true; render(); }
    else { state.keyEdit = null; render(); if (!C.isUnauthorized(r)) toast(r.error || 'Could not load stock', true); }
  }
  async function saveKey(btn, none) {
    const k = state.keyEdit; if (!k) return;
    const body = { num: k.num };
    if (none) body.none = true;
    else {
      if (!k.sel) { toast('Pick a key from the list', true); return; }
      const unit = Number(k.unit); if (k.unit === '' || !(unit >= 0)) { toast('Enter the key cost', true); return; }
      Object.assign(body, { name: k.sel, unit: unit, qty: Math.max(1, Number(k.qty) || 1), take: !!k.take && (k.items || []).some(it => it.name === k.sel) });
    }
    const r = await withBtn(btn, () => call('jobKeySet', body));
    if (r.ok) { state.keyEdit = null; toast(r.text || 'Saved'); loadMoney(); } else if (!C.isUnauthorized(r)) toast(r.error || 'Not saved', true);
  }
  $('moneyBox').addEventListener('input', e => {
    const k = state.keyEdit; if (!k) return;
    if (e.target.id === 'kq') { k.q = e.target.value; $('klist').innerHTML = keyListHtml(); }
    else if (e.target.id === 'kunit') k.unit = e.target.value;
    else if (e.target.id === 'kqty') { k.qty = Math.max(1, Math.min(10, Number(e.target.value) || 1)); }
    else if (e.target.id === 'ktake') k.take = e.target.checked;
  });
  $('moneyBox').addEventListener('click', e => {
    if (e.target.closest('.ksheet')) return;
    const row = e.target.closest('[data-job]'); if (row) openKey(Number(row.dataset.job));
  });
  async function loadMoney(month) {
    if (month) state.month = month;
    moneyDefaults();
    const ask = state.moneyMode === 'day' ? { day: state.moneyDay } : { month: state.month }, key = JSON.stringify(ask);
    state.moneyKey = key; state.money = null; state.keyEdit = null; render();
    const r = await call('money', ask);
    if (state.moneyKey !== key) return;   // пока грузилось, переключили день/месяц
    if (r.ok) { state.money = r; render(); } else if (!C.isUnauthorized(r)) toast(r.error || 'Could not load', true);
  }
  async function ensureMeta() { if (state.meta) return state.meta; const r = await call('meta'); if (r.ok) state.meta = r; return state.meta; }
  async function expenseSheet() {
    const meta = await ensureMeta(); if (!meta) { toast('Could not load categories', true); return; }
    const opts = list => list.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
    $('expSheet').innerHTML = '<div class="sheet"><h3>New expense</h3>' + chips('scope', ['business', 'personal'], 'business') +
      '<div class="row"><input id="exAmt" type="number" inputmode="decimal" step="0.01" placeholder="Amount $"><input id="exVendor" placeholder="Where (store, service)"></div>' +
      '<select id="exCat" data-b="' + esc(JSON.stringify(meta.categories)) + '" data-p="' + esc(JSON.stringify(meta.personalCategories)) + '">' + opts(meta.categories) + '</select>' +
      '<input id="exDesc" placeholder="What (optional)"><div class="row"><button class="secondary" data-close="exp">Cancel</button><button class="primary" id="goExp">Save</button></div></div>';
  }
  $('moneyBox').addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.m) return loadMoney(C.shiftMonth(state.month, Number(t.dataset.m)));
    if (t.dataset.d) { const nd = C.shiftDay(state.moneyDay, Number(t.dataset.d)); if (nd > C.currentDay()) return; state.moneyDay = nd; return loadMoney(); }
    if (t.dataset.mode) { if (t.dataset.mode === state.moneyMode) { if (t.dataset.mode === 'day' && state.moneyDay !== C.currentDay()) { state.moneyDay = C.currentDay(); return loadMoney(); } return; } state.moneyMode = t.dataset.mode; if (state.moneyMode === 'day') state.moneyDay = C.currentDay(); return loadMoney(); }
    if (t.dataset.kitem !== undefined && state.keyEdit) { const it = (state.keyEdit.shown || [])[Number(t.dataset.kitem)]; if (it) { state.keyEdit.sel = it.name; state.keyEdit.unit = it.unit; render(); } return; }
    if (t.dataset.kcustom && state.keyEdit) { state.keyEdit.sel = state.keyEdit.q.trim(); state.keyEdit.take = false; render(); return; }
    if (t.dataset.kclose) { state.keyEdit = null; render(); return; }
    if (t.dataset.knone) return saveKey(t, true);
    if (t.dataset.ksave) return saveKey(t, false);
    if (t.dataset.cash) {
      const r = await withBtn(t, () => call('checkCashed', { row: Number(t.dataset.cash), amount: Number(t.dataset.amt) }));
      if (r.ok) { toast(r.text || 'Check cashed'); loadMoney(); } else if (!C.isUnauthorized(r)) toast(r.error || 'Not saved', true);
      return;
    }
    if (t.id === 'addExp') return withBtn(t, expenseSheet);
    if (t.dataset.close === 'exp') { $('expSheet').innerHTML = ''; return; }
    if (t.closest('[data-chips="scope"]')) { t.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === t)); const sel = $('exCat'), list = JSON.parse(sel.dataset[t.dataset.v === 'personal' ? 'p' : 'b']); sel.innerHTML = list.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join(''); return; }
    if (t.id === 'goExp') {
      const amt = Number($('exAmt').value), vendor = $('exVendor').value.trim();
      if (!(amt > 0)) { toast('Enter the amount', true); return; } if (!vendor) { toast('Where was it?', true); return; }
      const r = await withBtn(t, () => call('expenseAdd', { amount: amt, vendor: vendor, category: $('exCat').value, scope: chipVal('scope'), description: $('exDesc').value.trim() }));
        if (r.ok) { toast(r.text ? r.text.split('\n')[0] : 'Saved'); loadMoney(); } else { t.disabled = false; if (!C.isUnauthorized(r)) toast(r.error || 'Not saved', true); }
    }
  });

  // ---------- events ----------
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('code').value.replace(/\D/g, '');
    $('loginErr').hidden = true;
    if (code.length !== 6) { $('loginErr').textContent = 'Enter the 6-digit code from the bot.'; $('loginErr').hidden = false; return; }
    const r = await call('auth', { code: code });
    if (r.ok && r.key) { $('code').value = ''; dispatch({ type: 'key', key: r.key }); loadLeads('open', true); }
    else { $('loginErr').textContent = r.error || 'Could not sign in'; $('loginErr').hidden = false; }
  });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.filter === 'today' && state.filter === 'today' && $('dayMenu').hidden) {   // второй тап по Today: выбрать день недели
      $('dayMenu').innerHTML = C.dayOptions(Date.now()).map((d, i) => '<button data-day="' + (i ? d.ymd : '') + '" class="' + ((i ? d.ymd : '') === state.day ? 'on' : '') + '">' + d.label + '</button>').join(''); $('dayMenu').hidden = false; return; }
    $('dayMenu').hidden = true; state.filter = b.dataset.filter; render(); loadLeads(state.filter, false); });
  $('dayMenu').addEventListener('click', e => { const b = e.target.closest('button[data-day]'); if (!b) return; $('dayMenu').hidden = true; state.day = b.dataset.day; render(); loadLeads('today', false); });
  $('leadList').addEventListener('click', e => { const li = e.target.closest('li'); if (!li || li.classList.contains('loading')) return; li.classList.add('loading'); openLead(Number(li.dataset.num)).finally(() => li.classList.remove('loading')); });
  $('back').addEventListener('click', () => { closeSheet(); if (state.view === 'invoice' && state.lead) { state.view = 'lead'; render(); openLead(state.lead.lead.num); return; } state.lead = null; state.view = 'leads'; render(); if (C.needsLeads(state, C.leadsKey(state.filter, state.filter === 'today' ? state.day : ''), Date.now())) loadLeads(state.filter, true); });
  $('leadCard').addEventListener('click', e => {
    const r = e.target.closest('[data-inv]'); if (r) { openInvoice(r.dataset.inv); return; }
    const c = e.target.closest('[data-copy]'); if (c) { copyText(c.dataset.copy).then(ok => toast(ok ? 'Address copied' : 'Could not copy', !ok)); return; }
    const g = e.target.closest('a[data-go]');
    // iPhone: open the Google Maps app by its own scheme (a web link from the home-screen app would stay in the browser).
    // No timed fallback: iOS may first ask "Open in Google Maps?", and a timer would also open the web page behind it.
    if (g && /iPhone|iPad|iPod/.test(navigator.userAgent) && state.lead) { e.preventDefault(); location.href = C.gmapsAppUrl(state.lead.lead.address); }
  });
  $('refresh').addEventListener('click', () => { if (state.view === 'lead' && state.lead) openLead(state.lead.lead.num); else if (state.view === 'leads') loadLeads(state.filter, true); else if (state.view === 'money') loadMoney(); else if (state.view === 'invoice' && state.inv && state.inv.number) openInvoice(state.inv.number); });
  $('nav').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; closeSheet(); state.view = b.dataset.go; render(); if (state.view === 'leads') loadLeads(state.filter, false); if (state.view === 'money') loadMoney(); });
  window.addEventListener('online', () => dispatch({ type: 'offline', on: false }));
  window.addEventListener('offline', () => dispatch({ type: 'offline', on: true }));

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
  if (state.key) loadLeads('open', false);
})();
