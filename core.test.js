const test = require('node:test'), assert = require('node:assert'), C = require('./core.js');
test('parseResponse non-json', () => { const r = C.parseResponse('<html>Moved</html>'); assert.equal(r.ok, false); assert.match(r.error, /did not answer/); });
test('parseResponse ok', () => assert.deepEqual(C.parseResponse('{"ok":true,"a":1}'), { ok: true, a: 1 }));
test('unauthorized clears key', () => { const s = C.reduce({ key: 'k', view: 'leads' }, { type: 'unauthorized' }); assert.equal(s.key, ''); assert.equal(s.view, 'login'); });
test('sortLeads urgent first then newest', () => { const L = [{ num: 1, date: '2026-11-07', urgent: false }, { num: 2, date: '2026-11-05', urgent: true }, { num: 3, date: '2026-11-07', urgent: false }]; assert.deepEqual(C.sortLeads(L).map(x => x.num), [2, 3, 1]); });
test('urls', () => { assert.equal(C.telUrl('6785495406'), 'tel:+16785495406'); assert.equal(C.telUrl(''), ''); assert.equal(C.mapsUrl(''), ''); assert.match(C.mapsUrl('440 Ansley Park Way, Cumming, GA'), /^https:\/\/maps\.apple\.com\/\?daddr=440%20Ansley/); });
test('money and miles', () => { assert.equal(C.fmtMoney(1234), '$1,234.00'); assert.equal(C.fmtMiles(11.3), '11.3 mi'); assert.equal(C.fmtMiles(null), ''); assert.equal(C.invoiceTotal([{ qty: 2, price: 10.005 }, { qty: '', price: 5 }]), 25.01); });
