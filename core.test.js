const test = require('node:test'), assert = require('node:assert'), C = require('./core.js');
test('parseResponse non-json', () => { const r = C.parseResponse('<html>Moved</html>'); assert.equal(r.ok, false); assert.match(r.error, /did not answer/); });
test('parseResponse ok', () => assert.deepEqual(C.parseResponse('{"ok":true,"a":1}'), { ok: true, a: 1 }));
test('unauthorized clears key', () => { const s = C.reduce({ key: 'k', view: 'leads' }, { type: 'unauthorized' }); assert.equal(s.key, ''); assert.equal(s.view, 'login'); });
test('sortLeads urgent first then newest', () => { const L = [{ num: 1, date: '2026-11-07', urgent: false }, { num: 2, date: '2026-11-05', urgent: true }, { num: 3, date: '2026-11-07', urgent: false }]; assert.deepEqual(C.sortLeads(L).map(x => x.num), [2, 3, 1]); });
test('urls', () => { assert.equal(C.telUrl('6785495406'), 'tel:+16785495406'); assert.equal(C.telUrl(''), ''); assert.equal(C.mapsUrl(''), ''); });
test('google maps urls', () => {
  assert.equal(C.mapsUrl('440 Ansley Park Way, Cumming, GA'), 'https://www.google.com/maps/dir/?api=1&destination=440%20Ansley%20Park%20Way%2C%20Cumming%2C%20GA&travelmode=driving');
  assert.equal(C.gmapsAppUrl('64 New Brunswick Ct'), 'comgooglemaps://?daddr=64%20New%20Brunswick%20Ct&directionsmode=driving');
  assert.equal(C.gmapsAppUrl('  '), '');
});
test('money and miles', () => { assert.equal(C.fmtMoney(1234), '$1,234.00'); assert.equal(C.fmtMiles(11.3), '11.3 mi'); assert.equal(C.fmtMiles(null), ''); assert.equal(C.invoiceTotal([{ qty: 2, price: 10.005 }, { qty: '', price: 5 }]), 25.01); });
test('leadPatch then rollback restores', () => { const s0 = { lead: { lead: { num: 22, status: 'Needs contact', statusKey: 'new' } }, pending: {} };
  const s1 = C.reduce(s0, { type: 'leadPatch', num: 22, patch: { status: 'Call back', statusKey: 'callback' } });
  assert.equal(s1.lead.lead.status, 'Call back'); assert.equal(s1.pending[22], true);
  const s2 = C.reduce(s1, { type: 'leadRollback', num: 22 }); assert.equal(s2.lead.lead.status, 'Needs contact'); assert.equal(s2.lead.lead.statusKey, 'new'); assert.equal(s2.pending[22], undefined); });
test('leadPatch marks pending flag and leadSettled clears it', () => { const s1 = C.reduce({ lead: { lead: { num: 5 } }, pending: {} }, { type: 'leadPatch', num: 5, patch: { usd: 180 } });
  assert.equal(s1.pending[5], true); const s2 = C.reduce(s1, { type: 'leadSettled', num: 5 }); assert.equal(s2.pending[5], undefined); assert.equal(s2.lead.lead.usd, 180); assert.deepEqual(C.paymentOptions, ['cash', 'check', 'zelle', 'card', 'square']); });
test('lineValid rejects empty desc and NaN price', () => { assert.equal(C.lineValid({ desc: 'Key', qty: 1, price: 150 }), true); assert.equal(C.lineValid({ desc: '', qty: 1, price: 150 }), false); assert.equal(C.lineValid({ desc: 'Key', qty: 1, price: 'abc' }), false); assert.equal(C.lineValid({ desc: 'Free', qty: 1, price: 0 }), true); });
test('invoice total updates after lines event', () => { const s = C.reduce({ inv: { lines: [{ desc: 'a', qty: 1, price: 10 }] } }, { type: 'lines', lines: [{ desc: 'a', qty: 2, price: 10 }, { desc: 'b', qty: 1, price: 5.5 }] }); assert.equal(s.inv.lines.length, 2); assert.equal(C.invoiceTotal(s.inv.lines), 25.5); });
test('monthLabel', () => { assert.equal(C.monthLabel('2026-11'), 'November 2026'); assert.equal(C.monthLabel('2026-01'), 'January 2026'); });
test('shiftMonth across year', () => { assert.equal(C.shiftMonth('2026-01', -1), '2025-12'); assert.equal(C.shiftMonth('2026-12', 1), '2027-01'); assert.equal(C.shiftMonth('2026-11', -1), '2026-10'); });
test('currentMonth uses local date', () => { const d = new Date(2026, 10, 30, 23, 30); assert.equal(C.currentMonth(d), '2026-11'); assert.equal(C.currentMonth(new Date(2026, 0, 1, 0, 5)), '2026-01'); });
test('fmtPhone handles odd lengths', () => { assert.equal(C.fmtPhone('6785495406'), '(678) 549-5406'); assert.equal(C.fmtPhone('5495406'), '549-5406'); assert.equal(C.fmtPhone(''), ''); assert.equal(C.fmtPhone('16785495406'), '(678) 549-5406'); });
test('needsLeads when box missing or stale', () => { const now = 1000000; assert.equal(C.needsLeads({ leads: {} }, 'open', now), true); assert.equal(C.needsLeads({ leads: { open: { at: now - 1000, leads: [] } } }, 'open', now), false); assert.equal(C.needsLeads({ leads: { open: { at: now - 61000, leads: [] } } }, 'open', now), true); });
test('offline event keeps invoice draft and view', () => { const s = C.reduce({ view: 'invoice', inv: { lines: [{ desc: 'x', qty: 1, price: 5 }] } }, { type: 'offline', on: true }); assert.equal(s.view, 'invoice'); assert.equal(s.inv.lines[0].desc, 'x'); assert.equal(s.offline, true); });
test('unauthorized clears cached leads', () => { const s = C.reduce({ key: 'k', leads: { open: { at: 1, leads: [{ num: 1 }] } } }, { type: 'unauthorized' }); assert.deepEqual(s.leads, {}); });
test('statusText shows visit time for scheduled leads', () => {
  assert.equal(C.statusText({ status: 'Scheduled', statusKey: 'scheduled', visit: 'Mon 11/16, 12:00 PM' }), 'Scheduled · Mon 11/16, 12:00 PM');
  assert.equal(C.statusText({ status: 'Scheduled', statusKey: 'scheduled', visit: '' }), 'Scheduled · no time set');
  assert.equal(C.statusText({ status: 'Needs contact', statusKey: 'new', visit: 'Mon 11/16' }), 'Needs contact');
  assert.equal(C.statusText({ status: 'Done', statusKey: 'done' }), 'Done');
  assert.equal(C.statusText({ status: 'Scheduled', statusKey: 'scheduled' }), 'Scheduled'); });
test('dayOptions: today, yesterday, then weekday dates for a week', () => {
  const now = new Date(2026, 10, 15, 19, 43).getTime();   // Sun Nov 15 2026, local time
  const o = C.dayOptions(now);
  assert.equal(o.length, 7);
  assert.deepEqual(o[0], { ymd: '2026-11-15', label: 'Today' });
  assert.deepEqual(o[1], { ymd: '2026-11-14', label: 'Yesterday' });
  assert.deepEqual(o[2], { ymd: '2026-11-13', label: 'Fri 11/13' });
  assert.deepEqual(o[6], { ymd: '2026-11-09', label: 'Mon 11/9' }); });
test('leadsKey separates days of the Today tab', () => {
  assert.equal(C.leadsKey('open', '2026-11-14'), 'open');
  assert.equal(C.leadsKey('today', ''), 'today');
  assert.equal(C.leadsKey('today', '2026-11-14'), 'today:2026-11-14'); });
test('shiftDay across month and year', () => { assert.equal(C.shiftDay('2026-11-01', -1), '2026-10-31'); assert.equal(C.shiftDay('2026-12-31', 1), '2027-01-01'); assert.equal(C.shiftDay('2026-11-16', 0), '2026-11-16'); assert.equal(C.shiftDay('bad', 1), ''); });
test('currentDay uses local date', () => { assert.equal(C.currentDay(new Date(2026, 10, 16, 23, 50)), '2026-11-16'); assert.equal(C.currentDay(new Date(2026, 0, 1, 0, 5)), '2026-01-01'); });
test('dayLabel: Today, Yesterday, then weekday date', () => { const now = new Date(2026, 10, 16, 10); assert.equal(C.dayLabel('2026-11-16', now), 'Today'); assert.equal(C.dayLabel('2026-11-15', now), 'Yesterday'); assert.equal(C.dayLabel('2026-11-13', now), 'Fri 11/13'); assert.equal(C.dayLabel('2025-12-31', now), 'Wed 12/31/2025'); });
test('daySummary: payments count and miles', () => { assert.equal(C.daySummary([{ kind: 'income' }, { kind: 'income' }, { kind: 'expense' }, { kind: 'miles' }], 88.4), '2 payments · 88.4 mi'); assert.equal(C.daySummary([{ kind: 'income' }], 0), '1 payment'); assert.equal(C.daySummary([], 0), 'No payments yet'); });
test('checkLine: lead number, car, date', () => { const now = new Date(2026, 10, 18, 10); assert.equal(C.checkLine({ num: 35, title: '2020 Lexus RX · key programming', date: '2026-11-16' }, now), '#35 · 2020 Lexus RX · key programming · Mon 11/16'); assert.equal(C.checkLine({ num: 0, title: 'Check', date: '2026-11-18' }, now), 'Check · Today'); });
test('jobKeyLine: key and cost, estimate marked, no key reason', () => {
  assert.equal(C.jobKeyLine({ key: 'SUPALAND Ford flip', unit: 16.03, qty: 1, cost: 16.03, est: false, auto: true }), 'SUPALAND Ford flip · $16.03');
  assert.equal(C.jobKeyLine({ key: 'Remote key (average)', unit: 8.93, qty: 2, cost: 17.86, est: true }), 'Remote key (average) · ~$8.93 × 2');
  assert.equal(C.jobKeyLine({ key: '', why: 'lockout' }), 'No key · lockout');
  assert.equal(C.jobKeyLine({ key: '', why: '' }), 'No key'); });
test('jobsSummary: paid, keys, left', () => {
  assert.equal(C.jobsSummary({ paid: 1926, keys: 131.47, net: 1794.53, est: true }), 'Paid $1,926.00 · Keys ~$131.47 · Left $1,794.53');
  assert.equal(C.jobsSummary({ paid: 250, keys: 16.03, net: 233.97, est: false }), 'Paid $250.00 · Keys $16.03 · Left $233.97'); });
test('makeWord: make from the vehicle', () => { assert.equal(C.makeWord('2019 Ford Ranger'), 'Ford'); assert.equal(C.makeWord('Honda Ridgeline'), 'Honda'); assert.equal(C.makeWord('2016 Chevy Colorado'), 'Chevrolet'); assert.equal(C.makeWord(''), ''); });
test('filterStock: every word must match, in stock first', () => {
  const items = [{ name: 'Ford 4 Button Remote Head Key 164-R7976', qty: 0 }, { name: 'SUPALAND Ford 3-button flip key fob, N5F-A08TAA', qty: 1 }, { name: 'Honda Smart Key', qty: 2 }];
  assert.deepEqual(C.filterStock(items, 'ford').map(i => i.qty), [1, 0]);
  assert.deepEqual(C.filterStock(items, 'ford flip').map(i => i.name), ['SUPALAND Ford 3-button flip key fob, N5F-A08TAA']);
  assert.deepEqual(C.filterStock(items, 'n5fa08').length, 1);
  assert.equal(C.filterStock(items, '').length, 3); });
