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
  assert.equal(s1.pending[5], true); const s2 = C.reduce(s1, { type: 'leadSettled', num: 5 }); assert.equal(s2.pending[5], undefined); assert.equal(s2.lead.lead.usd, 180); assert.deepEqual(C.paymentOptions, ['cash', 'check', 'zelle', 'card', 'square', 'cashapp', 'venmo']); assert.equal(C.payLabel('cashapp'), 'Cash App'); assert.equal(C.payLabel('zelle'), 'Zelle'); });
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
test('statusClass knows thinking and parts', () => { assert.equal(C.statusClass('thinking'), 'st-thinking'); assert.equal(C.statusClass('parts'), 'st-parts'); assert.equal(C.statusClass('weird'), 'st-new'); });
test('jobKeyLine: kit parts (super chip, blade) shown after the key', () => {
  assert.equal(C.jobKeyLine({ key: 'Xhorse Toyota Flip (Wired)', unit: 7.9, qty: 1, est: false, kit: [{ name: 'Super chip (VVDI Super Chip XT27A)', unit: 1.69 }, { name: 'Blade (TR47)', unit: 0.8 }] }), 'Xhorse Toyota Flip (Wired) · $7.90 + chip $1.69 + blade $0.80');
  assert.equal(C.jobKeyLine({ key: 'X Wired', unit: 8, qty: 2, est: true, kit: [{ name: 'Super chip', unit: 2, est: true }] }), 'X Wired · ~$8.00 + chip ~$2.00 × 2');
  assert.equal(C.jobKeyLine({ key: 'X Wired', unit: 7.9, qty: 1, est: true, keyEst: false, kit: [{ name: 'Super chip', unit: 2, est: true }] }), 'X Wired · $7.90 + chip ~$2.00'); });
test('jobKeyLine: key and cost, estimate marked, no key reason', () => {
  assert.equal(C.jobKeyLine({ key: 'SUPALAND Ford flip', unit: 16.03, qty: 1, cost: 16.03, est: false, auto: true }), 'SUPALAND Ford flip · $16.03');
  assert.equal(C.jobKeyLine({ key: 'Remote key (average)', unit: 8.93, qty: 2, cost: 17.86, est: true }), 'Remote key (average) · ~$8.93 × 2');
  assert.equal(C.jobKeyLine({ key: '', why: 'lockout' }), 'No key · lockout');
  assert.equal(C.jobKeyLine({ key: '', why: '' }), 'No key'); });
test('jobsSummary: other job costs shown only when there are some', () => {
  assert.equal(C.jobsSummary({ paid: 200, keys: 20, other: 42, net: 138, est: false }), 'Paid $200.00 · Keys $20.00 · Other $42.00 · Left $138.00'); });
test('jobExtrasLine: vendor and amount of each job cost', () => {
  assert.equal(C.jobExtrasLine({ extras: [{ vendor: 'AutoCode', amount: 42, what: 'PIN' }, { vendor: 'Keys4Less', amount: 8.5 }] }), 'AutoCode $42.00 · Keys4Less $8.50');
  assert.equal(C.jobExtrasLine({ extras: [] }), ''); assert.equal(C.jobExtrasLine({}), ''); });
test('leadCodes: VIN and PIN rows only when present', () => {
  assert.deepEqual(C.leadCodes({ vin: '3KPF34AD7ME292169', pin: '4821' }), [{ lab: 'VIN', val: '3KPF34AD7ME292169' }, { lab: 'PIN', val: '4821' }]);
  assert.deepEqual(C.leadCodes({ vin: '', pin: '' }), []); assert.deepEqual(C.leadCodes({}), []); });
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
// оплата по лиду (Дима 2026-11-20: «как добавить доход? нет кнопки, надо чтоб по каждому лиду было легко»)
test('needsPayment: a done lead with nothing received', () => {
  assert.equal(C.needsPayment({ statusKey: 'done', usd: 0 }), true);
  assert.equal(C.needsPayment({ statusKey: 'done', usd: 100 }), false);
  assert.equal(C.needsPayment({ statusKey: 'done', usd: 0, colleague: true }), false);
  assert.equal(C.needsPayment({ statusKey: 'done', usd: 0, noCharge: true }), false);
  assert.equal(C.needsPayment({ statusKey: 'scheduled', usd: 0 }), false);
  assert.equal(C.needsPayment(null), false); });
test('unpaidLine: lead number with name, car, day', () => { const now = new Date(2026, 10, 20, 7);
  assert.equal(C.unpaidLine({ num: 60, name: 'Tim', title: '2017 Dodge Ram Truck · lockout', date: '2026-11-20' }, now), '#60 Tim · 2017 Dodge Ram Truck · lockout · Today');
  assert.equal(C.unpaidLine({ num: 36, name: '', title: '', date: '2026-11-13' }, now), '#36 · Fri 11/13'); });
test('payAmount: a positive amount or null', () => {
  assert.equal(C.payAmount('100'), 100); assert.equal(C.payAmount(' 75.50 '), 75.5); assert.equal(C.payAmount(''), null); assert.equal(C.payAmount('0'), null); assert.equal(C.payAmount('-5'), null); assert.equal(C.payAmount('abc'), null); });
test('incomeChoices: unpaid done jobs first, then open leads, no doubles', () => {
  const list = C.incomeChoices([{ num: 60, name: 'Tim', title: 'Ram · lockout', date: '2026-11-20', quoted: 100 }],
    [{ num: 61, name: 'Ann', vehicle: 'Kia Soul', service: 'spare key', quoted: 150, colleague: false, statusKey: 'scheduled' }, { num: 60, name: 'Tim', vehicle: 'Ram', service: 'lockout', statusKey: 'new' }, { num: 62, vehicle: '', service: '', colleague: true, statusKey: 'new' }]);
  assert.deepEqual(list, [{ num: 60, label: '#60 Tim · Ram · lockout', quoted: 100, done: true, colleague: false }, { num: 61, label: '#61 Ann · Kia Soul · spare key', quoted: 150, done: false, colleague: false }, { num: 62, label: '#62', quoted: 0, done: false, colleague: true }]);
  assert.deepEqual(C.incomeChoices(null, null), []); });
// hand-off (Дима 2026-11-20: «когда я отдал другому локсмиту, чтобы у меня этот лид не светился»)
test('canHandoff: any lead that is not lost and has no payment of your own', () => {
  assert.equal(C.canHandoff({ statusKey: 'new', usd: 0 }), true);
  assert.equal(C.canHandoff({ statusKey: 'done', usd: 0 }), true);
  assert.equal(C.canHandoff({ statusKey: 'done', usd: 350 }), false);
  assert.equal(C.canHandoff({ statusKey: 'done', usd: 50, colleague: true }), true);
  assert.equal(C.canHandoff({ statusKey: 'lost', usd: 0 }), false);
  assert.equal(C.canHandoff({ statusKey: 'spam', usd: 0 }), false);
  assert.equal(C.canHandoff(null), false); });
test('handoffWho: a typed name wins over the chip', () => {
  assert.equal(C.handoffWho('Sasha', ''), 'Sasha'); assert.equal(C.handoffWho('Sasha', '  Vlad '), 'Vlad'); assert.equal(C.handoffWho('', ''), ''); assert.equal(C.handoffWho(undefined, null), ''); });
// карточка With colleagues (Дима 2026-11-20: «пусть висит, как будто должен; не факт, что коллега возьмёт»)
test('collLine: who and where the job stands', () => {
  assert.equal(C.collLine({ who: 'Vlad', state: 'waiting', done: false }), 'Vlad · handed off, waiting');
  assert.equal(C.collLine({ who: '', state: 'waiting', done: true }), 'Colleague · done, amount not set');
  assert.equal(C.collLine({ who: 'OZ', state: 'owed', done: true, job: 200, expect: 100 }), 'OZ · owes you ~$100.00 of $200.00'); });
test('collActions: what can be done with a lead that is with a colleague', () => {
  assert.deepEqual(C.collActions({ state: 'waiting', done: false }), { job: true, paid: true, back: true, lost: true, nothing: false });
  assert.deepEqual(C.collActions({ state: 'waiting', done: true }), { job: true, paid: true, back: false, lost: false, nothing: true });
  assert.deepEqual(C.collActions({ state: 'owed', done: true }), { job: true, paid: true, back: false, lost: false, nothing: false }); });
test('collOwedTotal: sum of expected shares', () => { assert.equal(C.collOwedTotal([{ state: 'owed', expect: 100 }, { state: 'waiting', expect: 0 }, { state: 'owed', expect: 62.5 }]), 162.5); assert.equal(C.collOwedTotal(null), 0); });
// Дима 2026-11-20: кнопка «With warranty» должна быть и тогда, когда бот сам гарантию не поставил
test('thanksSwitch: the button offers the opposite of what the text has now', () => {
  assert.deepEqual(C.thanksSwitch('thanks', { warranty: true }), { kind: 'thanksnw', label: 'Without warranty' });
  assert.deepEqual(C.thanksSwitch('thanks', { warranty: false }), { kind: 'thanksw', label: 'With warranty' });
  assert.deepEqual(C.thanksSwitch('thanksw', { warranty: true }), { kind: 'thanksnw', label: 'Without warranty' });
  assert.deepEqual(C.thanksSwitch('thanksnw', { warranty: false }), { kind: 'thanksw', label: 'With warranty' });
  assert.deepEqual(C.thanksSwitch('thanks', {}), { kind: 'thanksnw', label: 'Without warranty' });   // old bot: no warranty field
  assert.deepEqual(C.thanksSwitch('thanksnw', {}), { kind: 'thanks', label: 'With warranty' }); });
test('jobKeyLines: one line per key when a job has several (bot v288)', () => {
  const j = { key: 'Autel Toyota 8A', unit: 26, qty: 2, keyEst: true, kit: [], keys: [{ name: 'Autel Toyota 8A', unit: 26, qty: 2, est: true, kit: [] }, { name: 'Honda smart', unit: 32.62, qty: 1, est: false, kit: [{ name: 'Blade (HON66)', unit: 1 }] }] };
  assert.deepEqual(C.jobKeyLines(j), ['Autel Toyota 8A · ~$26.00 × 2', 'Honda smart · $32.62 + blade $1.00']);
  assert.deepEqual(C.jobKeyLines({ key: 'SUPALAND', unit: 16.03, qty: 1, est: false, keys: [{ name: 'SUPALAND', unit: 16.03, qty: 1 }] }), ['SUPALAND · $16.03']);
  assert.deepEqual(C.jobKeyLines({ key: '', why: 'lockout', keys: [] }), ['No key · lockout']);
  assert.equal(C.savedKeyLine({ name: 'Autel Toyota 8A', unit: 26, qty: 2, est: true, off: 2 }), 'Autel Toyota 8A · ~$26.00 × 2 · from stock'); });
test('mileDeductLine: approximate IRS write-off under the Miles tile (Dima 2026-11-21)', () => {
  assert.equal(C.mileDeductLine({ miles: 113, mileDeduct: 85.88, mileRate: 0.76 }), '≈ $85.88 write-off · 76¢/mi');
  assert.equal(C.mileDeductLine({ miles: 10, mileDeduct: 7.25, mileRate: 0.725 }), '≈ $7.25 write-off · 72.5¢/mi');
  assert.equal(C.mileDeductLine({ miles: 0, mileDeduct: 0, mileRate: 0.76 }), '');
  assert.equal(C.mileDeductLine({ miles: 12 }), ''); });
test('weekStart: Monday of the week (Sunday belongs to the week before)', () => { assert.equal(C.weekStart('2026-11-21'), '2026-11-16'); assert.equal(C.weekStart('2026-11-16'), '2026-11-16'); assert.equal(C.weekStart('2026-11-22'), '2026-11-16'); assert.equal(C.weekStart('2026-11-23'), '2026-11-23'); assert.equal(C.weekStart('2027-01-01'), '2026-12-28'); assert.equal(C.weekStart('bad'), ''); });
test('weekLabel: This week, Last week, then date range', () => { const now = new Date(2026, 10, 21, 10); assert.equal(C.weekLabel('2026-11-16', now), 'This week'); assert.equal(C.weekLabel('2026-11-09', now), 'Last week'); assert.equal(C.weekLabel('2026-11-02', now), 'Nov 2 – 8'); assert.equal(C.weekLabel('2026-10-26', now), 'Oct 26 – Nov 1'); assert.equal(C.weekLabel('2025-12-29', now), 'Dec 29, 2025 – Jan 4, 2026'); });
