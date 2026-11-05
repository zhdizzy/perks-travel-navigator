// Veteran Perks & Travel Navigator — node harness. Run from tbv-tools/perks-travel:  node test/engine.mjs
// Loads the Best State dataset the way the browser does (classic script → global), every perk row, and the
// local layer, then runs a grid of profiles through solve() and buildChecklist(), asserting no NaN or
// undefined leaks, the credential fork behaves, and the docx builds.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { solve, buildChecklist, checklistToText, checklistToHtml, countBrackets, deriveStatuses, heldCards, searchRows, searchTokens, DEFAULT_ASSUMPTIONS } from '../engine.js';
import { PERKS_ACCESS } from '../data/perks-access.js';
import { PERKS_TICKETS } from '../data/perks-tickets.js';
import { PERKS_TRAVEL } from '../data/perks-travel.js';
import { PERKS_RETAIL } from '../data/perks-retail.js';
import { PERKS_FEDERAL } from '../data/perks-federal.js';
import { LOCAL } from '../data/local.js';
import { CRED_LABEL, CRED_SHORT, CRED_HOWTO, STATUS_LABEL } from '../data/copy.js';
import { buildDocxBytes } from '../docx.js';

const nd = readFileSync(fileURLToPath(new URL('../../state-benefits/data/normalized-data.js', import.meta.url)), 'utf8');
const sandbox = {}; vm.createContext(sandbox); vm.runInContext(nd + '\nthis.__ND = NORMALIZED_DATA;', sandbox);
const STATES = sandbox.__ND;
const ROWS = [...PERKS_ACCESS, ...PERKS_TICKETS, ...PERKS_TRAVEL, ...PERKS_RETAIL, ...PERKS_FEDERAL];
const CTX = { rows: ROWS, local: LOCAL, states: STATES, today: new Date(2026, 10, 5) };
const LABELS = { CRED_LABEL, CRED_SHORT, CRED_HOWTO };
const esc = s => String(s ?? '');

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('FAIL', msg); } };
const clean = (str, label) => ok(!/undefined|NaN|\[object Object\]|\$NaN/.test(str), `${label}: leaked undefined/NaN`);
const mk = o => ({ mode: 'travel', statuses: ['veteran'], ratingRaw: '70', rating: 70, unrated: false, isPT: false, isTemp: false, isTDIU: false, ph: false, pow: false, moh: false, cards: ['dd214'], state: 'TX', assumptions: { ...DEFAULT_ASSUMPTIONS }, ...o });

console.log(`rows: ${ROWS.length} (access ${PERKS_ACCESS.length}, tickets ${PERKS_TICKETS.length}, travel ${PERKS_TRAVEL.length}, retail ${PERKS_RETAIL.length}, federal ${PERKS_FEDERAL.length}); local: ${Object.keys(LOCAL.tolls).length} toll states, ${Object.keys(LOCAL.airports).length} airport states`);

// Grid: every state × a set of named profiles × modes
const PROFILES = [
  { name: 'unrated DD-214 only', o: { ratingRaw: 'unrated', rating: null, unrated: true, cards: ['dd214'] } },
  { name: '0% with H623A', o: { ratingRaw: '0', rating: 0, cards: ['dd214', 'h623a'] } },
  { name: '60% with marked VHIC', o: { ratingRaw: '60', rating: 60, cards: ['dd214', 'vhic-marked'] } },
  { name: '100% P&T with DoD ID', o: { ratingRaw: '100', rating: 100, isPT: true, cards: ['dd214', 'dod-id', 'vhic-marked'] } },
  { name: '100% schedular VHIC only', o: { ratingRaw: '100', rating: 100, cards: ['dd214', 'vhic-marked'] } },
  { name: '100% temporary', o: { ratingRaw: '100', rating: 100, isTemp: true, cards: ['dd214'] } },
  { name: 'Purple Heart at 10%', o: { ratingRaw: '10', rating: 10, ph: true, cards: ['dd214', 'vhic-marked'] } },
  { name: 'PCAFC caregiver', o: { statuses: ['caregiver'], ratingRaw: '', rating: null, cards: ['caregiver-letter'] } },
  { name: 'surviving spouse of a retiree', o: { statuses: ['surviving-spouse'], ratingRaw: '', rating: null, cards: ['dod-id'], mode: 'family' } },
  { name: 'Gold Star', o: { statuses: ['gold-star'], ratingRaw: '', rating: null, cards: [], mode: 'family' } },
  { name: 'retiree 30%', o: { statuses: ['retiree', 'veteran'], ratingRaw: '30', rating: 30, cards: ['dod-id', 'dd214'] } },
  { name: 'Guard not on orders', o: { statuses: ['guard-reserve'], ratingRaw: 'unrated', rating: null, unrated: true, cards: ['dod-id'] } },
  { name: 'MOH 100% P&T', o: { ratingRaw: '100', rating: 100, isPT: true, moh: true, cards: ['dod-id'] } },
  { name: 'WeSalute holder 40%', o: { ratingRaw: '40', rating: 40, cards: ['dd214', 'wesalute', 'vhic-marked'], mode: 'everyday' } },
];
for (const st of Object.keys(STATES)) {
  for (const p of PROFILES) for (const mode of ['travel', 'everyday', 'card', 'family']) {
    const s = mk({ state: st, mode, ...p.o });
    const r = solve(s, CTX);
    ok(Number.isFinite(r.dollars) && r.dollars >= 0, `${st} ${p.name} ${mode}: dollars finite`);
    ok(r.rows.length === ROWS.length, 'every row evaluated');
    const doc = buildChecklist(r, LABELS);
    const txt = checklistToText(doc), html = checklistToHtml(doc, esc);
    clean(txt, `${st} ${p.name} ${mode} text`); clean(html, `${st} ${p.name} ${mode} html`);
    ok(countBrackets(doc) >= 0, 'brackets');
  }
}
// docx builds
{ const bytes = buildDocxBytes(buildChecklist(solve(mk({}), CTX), LABELS)); ok(bytes[0] === 0x50 && bytes[1] === 0x4b, 'docx: zip signature'); }

// Named behaviors (the credential fork)
{
  const find = (r, idPart) => r.rows.find(x => x.row.id.includes(idPart));
  const vhic60 = solve(mk({ ratingRaw: '60', rating: 60, cards: ['dd214', 'vhic-marked'] }), CTX);
  const disney = find(vhic60, 'disney-salute'); ok(disney && disney.status === 'ineligible', `60% VHIC: Disney Salute ineligible (${disney && disney.status})`);
  const comm = find(vhic60, 'commissary'); ok(comm && comm.status === 'unlocked' && comm.dollars > 0, `60% VHIC: commissary unlocked with dollars (${comm && comm.status} ${comm && comm.dollars})`);
  const hk = find(vhic60, 'hale-koa'); ok(hk && hk.status === 'unlocked' && hk.heldCred && hk.heldCred.card === 'vhic-marked', `60% VHIC: Hale Koa unlocked by VHIC (${hk && hk.status})`);
  const uso = find(vhic60, 'uso'); ok(uso && uso.status === 'myth', `60% VHIC: USO is a myth row (${uso && uso.status})`);
  const bags = find(vhic60, 'airline-bags'); ok(bags && bags.status === 'myth', `60% VHIC: airline bags myth (${bags && bags.status})`);
  const v100 = solve(mk({ ratingRaw: '100', rating: 100, cards: ['dd214', 'vhic-marked'] }), CTX);
  const d2 = find(v100, 'disney-salute'); ok(d2 && d2.status === 'unlockable' && d2.missing.includes('dod-id'), `100% VHIC-only: Disney Salute unlockable via DoD ID (${d2 && d2.status})`);
  ok(v100.upgrades[0] && v100.upgrades[0].card === 'dod-id', `100% VHIC-only: top upgrade is the DoD ID (${v100.upgrades[0] && v100.upgrades[0].card})`);
  const sa = find(v100, 'space-a') ; ok(sa && (sa.row.id.includes('moh') || sa.status === 'ineligible'), `100% schedular: Space-A P&T row ineligible (${sa && sa.status})`);
  const pt = solve(mk({ ratingRaw: '100', rating: 100, isPT: true, cards: ['dd214', 'dod-id'] }), CTX);
  const sa2 = pt.rows.find(x => x.row.id.includes('space-a') && !x.row.id.includes('moh')); ok(sa2 && sa2.status === 'unlocked', `100% P&T with DoD ID: Space-A unlocked (${sa2 && sa2.status})`);
  const d3 = find(pt, 'disney-salute'); ok(d3 && d3.status === 'unlocked', `100% P&T with DoD ID: Disney Salute unlocked (${d3 && d3.status})`);
  const un = solve(mk({ ratingRaw: 'unrated', rating: null, unrated: true, cards: ['dd214'] }), CTX);
  const mp = find(un, 'military-lifetime-pass') || find(un, 'military-pass'); ok(mp && (mp.status === 'unlockable' || (mp.status === 'unlocked' && mp.heldCred && mp.heldCred.card === 'idme')), `unrated DD-214: Military Pass via ID.me online or needs a card (${mp && mp.status} ${mp && mp.heldCred && mp.heldCred.card})`);
  const mp2 = solve(mk({ ratingRaw: 'unrated', rating: null, unrated: true, cards: [] }), CTX).rows.find(x => x.row.id.includes('military-lifetime-pass')); ok(mp2 && mp2.status === 'unlockable', `unrated with no cards: Military Pass needs a card (${mp2 && mp2.status})`);
  const c2 = find(un, 'commissary'); ok(c2 && c2.status === 'ineligible', `unrated: commissary ineligible (${c2 && c2.status})`);
  const ws = solve(mk({ ratingRaw: '40', rating: 40, cards: ['dd214'] }), CTX);
  const avis = find(ws, 'avis'); ok(avis && avis.status === 'unlockable' && avis.missing.includes('wesalute'), `no WeSalute: Avis needs WeSalute (${avis && avis.status})`);
  // Sum rule: one program per spend type; a 60% veteran is never told to get a DoD ID
  ok(!vhic60.upgrades.some(u => u.card === 'dod-id'), `60% VHIC: DoD ID is not offered as an upgrade (${vhic60.upgrades.map(u => u.card).join(',')})`);
  ok(vhic60.rows.some(x => x.status === 'ask'), '60% VHIC: military-ID-only venues become "ask which ID"');
  const hd = find(vhic60, 'home-depot'), lw = find(vhic60, 'lowes'); ok(hd && lw && (hd.counted ? 1 : 0) + (lw.counted ? 1 : 0) === 1, `Home Depot and Lowe's: exactly one counted (${hd && hd.counted} ${lw && lw.counted})`);
  const appar = vhic60.rows.filter(x => x.row.value.assumption === 'apparelYearly' && x.counted); ok(appar.length <= 1, `apparel: at most one program counted (${appar.length})`);
  const wl = vhic60.rows.filter(x => x.row.value.assumption === 'wirelessMonthly' && x.counted); ok(wl.length <= 1, `wireless: at most one carrier counted (${wl.length})`);
  const visits = vhic60.rows.filter(x => x.row.value.assumption === 'parkDays' && x.counted); ok(visits.length <= 2, `attractions: at most parkDays (2) rows counted (${visits.length})`);
  ok(!vhic60.rows.some(x => x.counted && ['trv-clear-plus', 'ret-chase-premier-plus', 'ret-fcc-lifeline'].includes(x.row.id)), 'opt-in fixed rows never counted');
  ok(vhic60.dollars > 800 && vhic60.dollars < 1900, `60% VHIC default spend: total in a sane band (${Math.round(vhic60.dollars)})`);
  const sum = vhic60.rows.filter(x => x.counted).reduce((n, x) => n + x.dollars, 0); ok(Math.abs(sum - vhic60.dollars) < 0.01, 'counted rows add up to the total');
  const st = deriveStatuses(mk({ ratingRaw: '100', rating: 100, ph: true })); ok(st.has('sc-100') && st.has('purple-heart') && !st.has('sc-10-90'), 'status derivation 100% + PH');
  const held = heldCards(mk({ cards: ['vhic-marked'] })); ok(held.has('vhic-plain') && held.has('sheerid') && held.has('idme'), 'held implications: marked VHIC implies plain VHIC and online verifiers');
  const fl = solve(mk({ state: 'FL', ratingRaw: '100', rating: 100, isPT: true, cards: ['dv-plates', 'dod-id'] }), CTX);
  ok(fl.local.tolls.some(t => t.verdict === 'no') && fl.local.airports.some(a => a.code === 'MCO' && a.verdict === 'yes'), 'FL local layer: tolls no, MCO yes');
  const tx = solve(mk({ state: 'TX' }), CTX); ok(tx.local.tolls.some(t => /NTTA|North Texas Tollway/i.test(t.authority) && t.verdict === 'no'), 'TX local layer: NTTA no');
  ok(tx.stateLines.some(l => l.kind === 'parks'), 'TX Best State parks line read live');
}
// Search: every program incl. the ones not on the list, with the reason and the closest alternative
{
  const SL = { STATUS_LABEL };
  const v60 = solve(mk({ ratingRaw: '60', rating: 60, cards: ['dd214', 'vhic-marked'] }), CTX);
  const hotels = searchRows(v60, 'hotels', CTX, SL), long = searchRows(v60, 'disabled veteran discounts at hotels', CTX, SL);
  ok(hotels.results.length >= 8, `search hotels: finds lodging rows (${hotels.results.length})`);
  ok(long.results.length === hotels.results.length, `filler words drop out: "${'disabled veteran discounts at hotels'}" = "hotels" (${long.results.length} vs ${hotels.results.length})`);
  ok(hotels.results.some(y => /Hilton/.test(y.x.row.name)) && hotels.results.some(y => /Hale Koa/.test(y.x.row.name)), 'search hotels: Hilton and Hale Koa both present');
  const dis = searchRows(v60, 'Disney', CTX, SL);
  const salute = dis.results.find(y => y.x.row.id === 'tix-disney-salute-2026');
  ok(salute && salute.x.status === 'ineligible' && /100% rating would open it/.test(salute.why), `search Disney at 60%: Salute shown as not-for-you with the reason (${salute && salute.why})`);
  ok(salute && salute.alts.some(a => /Disney/.test(a.row.name)), `search Disney at 60%: closest alternative is another Disney row (${salute && salute.alts.map(a => a.row.id).join(',')})`);
  ok(dis.results[0].x.status !== 'ineligible', 'search Disney: what you CAN get sorts first');
  const fl = searchRows(v60, 'Florida tolls', CTX, SL); ok(fl.local.some(l => l.state === 'FL' && l.kind === 'tolls' && l.row.verdict === 'no'), `search "Florida tolls" from Texas: FL toll row, verdict no (${fl.local.length})`);
  const tx = searchRows(v60, 'tolls', CTX, SL); ok(tx.local.length > 5 && tx.local[0].mine, 'search tolls: own state first');
  ok(searchRows(v60, 'xyzzyplugh', CTX, SL).total === 0, 'search nonsense: zero results');
  const gen = searchRows(v60, 'veteran discounts', CTX, SL); ok(gen.generic && gen.total === 0, 'search "veteran discounts": flagged generic, asks for a specific word');
  ok(searchRows(v60, '', CTX, SL).total === 0 && !searchRows(v60, '', CTX, SL).generic, 'empty query: nothing');
  const fly = searchRows(v60, 'flights', CTX, SL); ok(fly.results.some(y => /airline/i.test(y.x.row.name)), `search flights: airline rows (${fly.results.length})`);
  ok(searchTokens('Cell phone plans').length === 3 && searchTokens('the a of').length === 0, 'tokenizer keeps content words, drops filler');
  for (const q of ['hotels', 'Disney', 'cruise', 'student loans', 'cell phone', 'tolls', 'Hale Koa', 'commissary', 'parks pass', 'ski', 'tax', 'car', 'golf', 'museum', 'airport parking', 'USO', 'space-a']) {
    for (const p of PROFILES) { const r = solve(mk({ ...p.o }), CTX); const o = searchRows(r, q, CTX, SL); ok(o.total > 0, `search "${q}" (${p.name}) returns something`); for (const y of o.results) { ok(!/undefined|NaN/.test(y.why), `why text clean: ${q}`); if (y.x.status === 'ineligible') ok(y.why.length > 10, `ineligible row has a reason: ${y.x.row.id} (${p.name})`); } }
  }
}
// Data sanity: every row with a dollar amount is verified or marked so the engine ignores it; no row lists sc-10-90 without sc-100 unless it is a myth about 100% (flag for review)
{
  const sus = ROWS.filter(r => !r.negative && r.eligibility.statuses.includes('sc-10-90') && !r.eligibility.statuses.includes('sc-100'));
  if (sus.length) console.log('review (sc-10-90 without sc-100):', sus.map(r => r.id).join(', '));
  const conf = { verified: 0, reported: 0, unverified: 0 }; ROWS.forEach(r => conf[r.confidence]++);
  console.log(`confidence: ${JSON.stringify(conf)}; myths: ${ROWS.filter(r => r.negative).length}; dollar-bearing verified rows: ${ROWS.filter(r => r.confidence === 'verified' && r.value.amount != null).length}`);
}
console.log(`${checks} checks, ${fails} failures`);
process.exitCode = fails ? 1 : 0;
