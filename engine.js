// Veteran Perks & Travel Navigator — the engine. No DOM in here; shared by the page (script.js) and
// the node harness (test/engine.mjs).
//
// Inputs (s): mode, statuses[] (the user's ticked groups), rating (number|null), unrated, isPT, isTemp,
// isTDIU, ph, pow, moh, cards[] (held), state, assumptions{}. Data (ctx): rows[] (every perk row from
// data/perks-*.js), local (data/local.js), states (NORMALIZED_DATA from Best State, imported by absolute
// path, never forked).
//
// The one idea: a perk is "unlocked today" when the user HOLDS a card on its credential list, and
// "unlockable" when they qualify by status but hold none of the cards. The hero reports both numbers.
// Dollars count only verified, non-myth, unlocked rows with a numeric amount, times the user's own spend
// assumptions, and never a WeSalute-gated row unless WeSalute+ is a held card.

export const DATA_STAMP = 'November 4, 2026';
export const MODES = ['travel', 'everyday', 'card', 'family'];
export const DEFAULT_ASSUMPTIONS = { nightsPerYear: 4, hotelNights: 4, parkDays: 2, groceriesMonthly: 600, improvementYearly: 1000, wirelessMonthly: 100, rentalDays: 0, flightsYearly: 0, airportDays: 0, skiDays: 0, cruiseSpend: 0, newCar: false, apparelYearly: 300, diningYearly: 0 };
export const CARD_ORDER = {
  travel: ['unlocks', 'travel', 'tickets', 'parks', 'road', 'everyday', 'federal', 'bring'],
  everyday: ['unlocks', 'everyday', 'road', 'federal', 'travel', 'tickets', 'parks', 'bring'],
  card: ['unlocks', 'bring', 'travel', 'tickets', 'parks', 'everyday', 'road', 'federal'],
  family: ['unlocks', 'federal', 'travel', 'parks', 'everyday', 'tickets', 'road', 'bring'],
};
// Cards the user can tick, in display order, with the statuses that make each one possible at all.
export const CARD_CHOICES = ['dd214', 'vhic-marked', 'vhic-plain', 'h623a', 'va-letter', 'dod-id', 'idme', 'state-dl-veteran', 'dv-plates', 'caregiver-letter', 'military-pass', 'access-pass', 'wesalute'];
const fmtUSD = n => '$' + Math.round(n).toLocaleString('en-US');
const longDate = d => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/* ─── Status set from the inputs ───────────────────────────────────────── */
export function deriveStatuses(s) {
  const out = new Set();
  const groups = new Set(s.statuses || []);
  const isVet = groups.has('veteran') || groups.has('retiree') || groups.has('guard-reserve') || groups.has('active');
  if (groups.has('active')) out.add('active');
  if (groups.has('retiree')) out.add('retiree');
  if (groups.has('guard-reserve')) out.add('guard-reserve');
  if (groups.has('caregiver')) out.add('caregiver');
  if (groups.has('surviving-spouse')) out.add('surviving-spouse');
  if (groups.has('gold-star')) out.add('gold-star');
  if (groups.has('dod-civilian')) out.add('dod-civilian');
  if (isVet) {
    if (s.unrated || s.rating == null) out.add('veteran-unrated');
    else if (s.rating === 0) out.add('sc-0');
    else if (s.rating >= 100) out.add('sc-100');
    else out.add('sc-10-90');
  }
  if (s.ph) out.add('purple-heart');
  if (s.pow) out.add('pow');
  if (s.moh) out.add('moh');
  return out;
}
export const isServiceConnected = st => st.has('sc-0') || st.has('sc-10-90') || st.has('sc-100');

/* ─── Cards held, with the implications a human would apply ────────────── */
export function heldCards(s) {
  const held = new Set(s.cards || []);
  held.add('none');
  if (held.has('vhic-marked')) held.add('vhic-plain');
  // Online verifiers (ID.me, SheerID) take any of these documents and finish in minutes: count them as held.
  if (held.has('dd214') || held.has('vhic-marked') || held.has('vhic-plain') || held.has('va-letter') || held.has('state-dl-veteran') || held.has('dod-id')) { held.add('sheerid'); if (held.has('idme') || held.has('dd214') || held.has('vhic-marked') || held.has('state-dl-veteran')) held.add('idme'); }
  return held;
}

/* ─── Dollar value of one row for this user ───────────────────────────── */
export function rowDollars(row, s, held) {
  const v = row.value || {};
  if (row.negative || row.confidence !== 'verified' || v.amount == null) return 0;
  if ((row.tags || []).includes('requires-wesalute') && !held.has('wesalute')) return 0;
  const a = s.assumptions || DEFAULT_ASSUMPTIONS;
  const spend = key => { if (!key) return 0; if (key === 'groceriesMonthly' || key === 'wirelessMonthly') return (a[key] || 0) * 12; if (key === 'newCar') return a.newCar ? 1 : 0; return a[key] || 0; };
  let d = 0;
  if (v.type === 'fixed') d = v.assumption ? v.amount * spend(v.assumption) : v.amount;
  else if (v.type === 'percent') d = v.amount * spend(v.assumption);
  else if (v.type === 'per-night' || v.type === 'per-day' || v.type === 'per-use') d = v.amount * spend(v.assumption);
  if (v.cap != null) d = Math.min(d, v.cap);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/* ─── One row ─────────────────────────────────────────────────────────── */
export function evalRow(row, s, ctx, st, held) {
  const today = ctx.today || new Date();
  const e = row.eligibility || { statuses: [] };
  const byStatus = !e.statuses || e.statuses.length === 0 || e.statuses.some(x => st.has(x));
  const byRating = e.minRating == null || (s.rating != null && s.rating >= e.minRating);
  const byPT = !e.ptRequired || !!s.isPT;
  // row.states is WHERE the perk is (a park, a museum, a California rail route), not a residency gate: a Texan can
  // fly to Orlando. It renders as a location note and never blocks eligibility.
  const eligible = byStatus && byRating && byPT;
  const reasons = [];
  if (!byStatus) reasons.push('not for your status group');
  if (byStatus && !byRating) reasons.push(`needs a rating of ${e.minRating}% or more`);
  if (byStatus && byRating && !byPT) reasons.push('needs a permanent and total rating by statute');
  const creds = row.credentials || [];
  const heldCred = creds.find(c => held.has(c.card)) || null;
  const credHeld = creds.length === 0 || !!heldCred;
  const expired = !!(row.validTo && new Date(row.validTo + 'T23:59:59') < today);
  let status;
  if (row.negative) status = (eligible && e.statuses && e.statuses.length) ? 'unlocked' : 'myth'; // a myth with no qualifying group applies to nobody
  else if (!eligible) status = 'ineligible';
  else if (expired) status = 'expired';
  else status = credHeld ? 'unlocked' : 'unlockable';
  const missing = status === 'unlockable' ? creds.map(c => c.card).filter(c => !held.has(c)) : [];
  // "Get the card" only makes sense for a card this person CAN get. A venue that says "military ID" is listed
  // with the DoD ID; a 60% veteran cannot get one, so the row becomes "ask which ID they accept" instead.
  if (status === 'unlockable' && !missing.some(c => canObtain(c, st))) status = 'ask';
  const dollars = status === 'unlocked' ? rowDollars(row, s, held) : 0;
  const bestCred = heldCred || creds[0] || null;
  return { row, status, eligible, reasons, bestCred, heldCred, missing, dollars, expired, counted: false, optIn: false };
}
// Which cards a person with this status set can actually obtain.
export function canObtain(card, st) {
  const sc = isServiceConnected(st);
  switch (card) {
    case 'dod-id': return st.has('sc-100') || st.has('active') || st.has('retiree') || st.has('guard-reserve') || st.has('moh') || st.has('dod-civilian') || st.has('surviving-spouse') || st.has('gold-star');
    case 'caregiver-letter': return st.has('caregiver');
    case 'h623a': return st.has('sc-0');
    case 'vhic-marked': return sc || st.has('purple-heart') || st.has('pow');
    case 'va-letter': case 'dv-plates': case 'access-pass': return sc;
    default: return true;
  }
}
// Fixed-dollar rows that only pay if the person chooses to use them; shown on the row, never in the total.
export const OPT_IN_FIXED = new Set(['trv-clear-plus', 'ret-chase-premier-plus', 'ret-fcc-lifeline', 'trv-tsa-precheck-gold-star']);
// The dollar total: ONE program per spend type (you buy lumber at one store, carry one wireless plan, buy one
// car), the best N attractions for N visits, universal fixed amounts, and nothing opt-in. Marks each row.
export function totalDollars(evaluated, s) {
  const pool = evaluated.filter(x => x.status === 'unlocked' && !x.row.negative && x.dollars > 0);
  const buckets = {};
  for (const x of pool) { const v = x.row.value; const key = OPT_IN_FIXED.has(x.row.id) ? 'opt-in' : (v.assumption || 'fixed:' + x.row.id); (buckets[key] = buckets[key] || []).push(x); }
  let total = 0;
  for (const [key, list] of Object.entries(buckets)) {
    list.sort((a, b) => b.dollars - a.dollars);
    if (key === 'opt-in') { list.forEach(x => { x.counted = false; x.optIn = true; }); continue; }
    if (key === 'parkDays') {
      const visits = Math.max(0, Math.round((s.assumptions && s.assumptions.parkDays) || 0));
      list.forEach(x => { x.dollars = x.row.value.amount; });
      list.sort((a, b) => b.dollars - a.dollars);
      list.forEach((x, i) => { x.counted = i < visits; if (x.counted) total += x.dollars; });
      continue;
    }
    list.forEach((x, i) => { x.counted = i === 0; if (i === 0) total += x.dollars; });
  }
  return total;
}

/* ─── Main solve ──────────────────────────────────────────────────────── */
export function solve(s, ctx) {
  const today = ctx.today || new Date();
  const st = deriveStatuses(s);
  const held = heldCards(s);
  const rows = (ctx.rows || []).map(r => evalRow(r, s, ctx, st, held));
  const byCard = {};
  for (const key of ['unlocks', 'travel', 'tickets', 'parks', 'everyday', 'road', 'federal']) byCard[key] = [];
  for (const x of rows) { if (x.status === 'ineligible') continue; (byCard[x.row.card] || (byCard[x.row.card] = [])).push(x); }
  const dollars = totalDollars(rows, s);
  const rank = { unlocked: 0, unlockable: 1, ask: 2, expired: 3, myth: 4 };
  for (const k of Object.keys(byCard)) byCard[k].sort((a, b) => rank[a.status] - rank[b.status] || (b.counted ? 1 : 0) - (a.counted ? 1 : 0) || b.dollars - a.dollars || a.row.name.localeCompare(b.row.name));
  const unlocked = rows.filter(x => x.status === 'unlocked' && !x.row.negative);
  const unlockable = rows.filter(x => x.status === 'unlockable');
  const ask = rows.filter(x => x.status === 'ask');
  const myths = rows.filter(x => x.status === 'myth');
  const dollarRows = unlocked.filter(x => x.counted).sort((a, b) => b.dollars - a.dollars);
  // Which single card would add the most: only cards this person can obtain, and the dollar figure is the
  // change in the bucketed total with that card added (never a sum of overlapping rows).
  const upgrades = [];
  for (const card of CARD_CHOICES) {
    if (held.has(card) || !canObtain(card, st)) continue;
    const adds = unlockable.filter(x => (x.row.credentials || []).some(c => c.card === card));
    if (!adds.length) continue;
    const s2 = { ...s, cards: [...(s.cards || []), card] };
    const held2 = heldCards(s2);
    const rows2 = (ctx.rows || []).map(r => evalRow(r, s2, ctx, st, held2));
    const addDollars = Math.max(0, totalDollars(rows2, s2) - dollars);
    upgrades.push({ card, adds: adds.length, dollars: addDollars, rows: adds });
  }
  // Free credentials first; the paid WeSalute+ membership ranks last no matter how many rows it gates.
  upgrades.sort((a, b) => (a.card === 'wesalute') - (b.card === 'wesalute') || b.adds - a.adds || b.dollars - a.dollars);
  // Local layer and the Best State lines for the chosen state
  const local = { tolls: (ctx.local && ctx.local.tolls && ctx.local.tolls[s.state]) || [], airports: (ctx.local && ctx.local.airports && ctx.local.airports[s.state]) || [] };
  const stateRec = (ctx.states && s.state && ctx.states[s.state]) || null;
  const stateLines = stateRec ? bestStateLines(stateRec, s, st) : [];
  // Grouped by the card held, for the "what your cards unlock" card
  const byHeld = {};
  for (const x of unlocked) { const k = x.heldCred ? x.heldCred.card : 'none'; (byHeld[k] = byHeld[k] || []).push(x); }
  return { s, statuses: st, held, rows, byCard, unlocked, unlockable, ask, myths, dollars, dollarRows, upgrades, local, stateRec, stateLines, byHeld, today };
}

/* ─── Best State lines (read at render time from the shared dataset, never copied) ─── */
export function bestStateLines(rec, s, st) {
  const out = [];
  const r = s.rating;
  const meets = req => req == null ? true : (r != null && r >= req);
  const sp = rec.stateParks || {};
  if (sp.freePass && sp.freePass.available) out.push({ kind: 'parks', ok: meets(sp.freePass.ratingRequired), text: `${rec.name} state parks: ${sp.summary || 'free pass for disabled veterans'}`, need: sp.freePass.ratingRequired });
  else if (sp.discountedPass) out.push({ kind: 'parks', ok: true, text: `${rec.name} state parks: ${sp.summary || 'discounted pass for veterans'}`, need: null });
  else if (sp.summary) out.push({ kind: 'parks', ok: false, text: `${rec.name} state parks: ${sp.summary}`, need: null });
  const hf = rec.huntingFishing || {};
  if (hf.freeForDisabled && hf.freeForDisabled.available) out.push({ kind: 'hunting', ok: meets(hf.freeForDisabled.ratingRequired), text: `${rec.name} hunting and fishing licenses: ${hf.summary || 'free for disabled veterans'}`, need: hf.freeForDisabled.ratingRequired });
  else if (hf.summary) out.push({ kind: 'hunting', ok: !!hf.reducedForVeterans, text: `${rec.name} hunting and fishing licenses: ${hf.summary}`, need: null });
  const ve = rec.vehicle || {};
  if (ve.registrationExemption && ve.registrationExemption.available) out.push({ kind: 'plates', ok: meets(ve.registrationExemption.ratingRequired), text: `${rec.name} DV plates and registration: ${(ve.registrationExemption.detail || ve.summary || '').replace(/—/g, ',')}`, need: ve.registrationExemption.ratingRequired, value: ve.registrationExemption.estAnnualValue || null });
  else if (ve.summary) out.push({ kind: 'plates', ok: false, text: `${rec.name} vehicle: ${ve.summary.replace(/—/g, ',')}`, need: null });
  if (ve.dlFeeWaiver && ve.dlFeeWaiver.available) out.push({ kind: 'license', ok: meets(ve.dlFeeWaiver.ratingRequired), text: `${rec.name} driver’s license fee waived for disabled veterans${ve.dlFeeWaiver.ratingRequired ? ` at ${ve.dlFeeWaiver.ratingRequired}%+` : ''}.`, need: ve.dlFeeWaiver.ratingRequired });
  return out;
}

/* ─── The what-to-bring list (the take-artifact; shape matches docx.js) ─── */
// How the person would describe themselves on the phone ("a veteran rated 60% service-connected").
export function statusPhrase(r) {
  const s = r.s, st = r.statuses;
  if (st.has('sc-100')) return `a veteran rated 100% service-connected${s.isPT ? ' (permanent and total)' : ''}`;
  if (st.has('sc-10-90')) return `a veteran rated ${s.rating}% service-connected`;
  if (st.has('sc-0')) return 'a veteran with a 0% service-connected rating';
  if (st.has('retiree')) return 'a military retiree';
  if (st.has('guard-reserve')) return 'a Guard or Reserve member';
  if (st.has('active')) return 'an active-duty service member';
  if (st.has('veteran-unrated')) return 'a veteran with no VA rating';
  if (st.has('caregiver')) return 'a VA family caregiver';
  if (st.has('surviving-spouse')) return 'a surviving spouse';
  if (st.has('gold-star')) return 'a Gold Star family member';
  if (st.has('dod-civilian')) return 'a DoD civilian';
  return 'someone in my situation';
}
const T = t => ({ t }), B = b => ({ b });
export function buildChecklist(r, labels) {
  const s = r.s;
  const L = labels || {};
  const credName = c => (L.CRED_LABEL && L.CRED_LABEL[c]) || c;
  const credShort = c => (L.CRED_SHORT && L.CRED_SHORT[c]) || c;
  const credHow = c => (L.CRED_HOWTO && L.CRED_HOWTO[c]) || '';
  const stateName = r.stateRec ? r.stateRec.name : (s.state || 'your state');
  const header = [[T('WHAT TO BRING: YOUR VETERAN PERKS AND THE ID THAT PROVES EACH ONE')], [T(`${stateName}, prepared ${longDate(r.today)}`)], [T('Built with the Veteran Perks & Travel Navigator, tools.thebetterveteran.com/perks-travel/')]];
  const howTo = [
    'Each perk names the ID that proves it (a VHIC, a DoD ID card, a DD-214, a VA letter). Bring that ID, not a photo of it; most front desks and registers want the physical card plus a REAL ID.',
    'Rows marked "reported" or "not yet verified" were not confirmed on the program\u2019s own page. Confirm those with the program before you travel.',
  ];
  const sections = [];
  const n = () => sections.length + 1;
  // 1 Cards you hold
  const heldList = (s.cards || []).filter(c => c !== 'none');
  const items1 = heldList.length ? heldList.map(c => { const rows = (r.byHeld[c] || []); return [T(`${credName(c)}: ${rows.length ? rows.slice(0, 8).map(x => x.row.name).join('; ') + (rows.length > 8 ? `; and ${rows.length - 8} more` : '') : 'nothing on this list keys on it alone'}`)]; }) : [[T('No IDs ticked. Tick what you hold in the tool, or start with the DD-214 row below.')]];
  sections.push({ n: n(), title: 'IDs you hold and what each one opens today', blocks: [{ type: 'ul', items: items1 }] });
  // 2 Cards worth getting
  const ups = r.upgrades.slice(0, 4);
  const items2 = ups.length ? ups.map(u => [T(`${credName(u.card)}: adds ${u.adds} perk${u.adds === 1 ? '' : 's'}${u.dollars > 0 ? ` (about ${fmtUSD(u.dollars)} a year at your spend)` : ''}. ${credHow(u.card)}`)]) : [[T('Every perk you qualify for is already unlocked by an ID you hold.')]];
  sections.push({ n: n(), title: 'IDs worth getting', blocks: [{ type: 'ul', items: items2 }] });
  // 3..8 per card
  const titles = { travel: 'Travel and lodging', tickets: 'Tickets and attractions', parks: 'Parks and outdoors', everyday: 'Everyday savings', road: 'On the road', federal: 'Status and federal' };
  for (const key of ['travel', 'tickets', 'parks', 'everyday', 'road', 'federal']) {
    const list = (r.byCard[key] || []).filter(x => x.status === 'unlocked' || x.status === 'unlockable' || x.status === 'ask');
    if (!list.length && key !== 'road') continue;
    const items = list.slice(0, 18).map(x => {
      const c = x.heldCred || x.bestCred;
      const tag = x.status === 'unlocked' ? '' : x.status === 'ask' ? ' (ask which ID they accept)' : ' (not yet: get the ID)';
      const conf = x.row.confidence !== 'verified' ? ` [${x.row.confidence}]` : '';
      return [T(`☐ ${x.row.name}${tag}: bring ${c ? credShort(c.card) : 'nothing'}${c && c.note ? ` (${c.note})` : ''}.${x.row.bring && x.row.bring.length ? ' Also: ' + x.row.bring.join('; ') + '.' : ''}${conf}`)];
    });
    if (list.length > 18) items.push([T(`and ${list.length - 18} more on the page`)]);
    if (key === 'road') {
      for (const t of r.local.tolls) items.push([T(`Tolls, ${t.authority}: ${t.verdict === 'yes' ? 'YES' : t.verdict === 'partial' ? 'PARTIAL' : t.verdict === 'no' ? 'NO' : 'not verified'}. ${t.rule}`)]);
      for (const a of r.local.airports) items.push([T(`Airport parking, ${a.code} ${a.name}: ${a.verdict === 'yes' ? 'YES' : a.verdict === 'no' ? 'NO' : 'not verified'}. ${a.rule}`)]);
      for (const l of r.stateLines) items.push([T(l.text)]);
      if (!items.length) items.push([T(`No toll or airport rows for ${stateName} yet; tell us if your authority has one.`)]);
    }
    if (key === 'parks') for (const l of r.stateLines.filter(x => x.kind === 'parks' || x.kind === 'hunting')) items.push([T(l.text)]);
    sections.push({ n: n(), title: titles[key], blocks: [{ type: 'ul', items }] });
  }
  // Myths
  const my = r.myths.slice(0, 12);
  if (my.length) sections.push({ n: n(), title: 'Your ID does not unlock these (so you do not argue at the counter)', blocks: [{ type: 'ul', items: my.map(x => [T(`${x.row.name}: ${x.row.summary}`)]) }] });
  // Follow up
  const who = statusPhrase(r);
  const carry = heldList.filter(c => !['idme', 'sheerid', 'wesalute', 'military-pass', 'access-pass', 'dv-plates'].includes(c)).map(c => credShort(c));
  sections.push({ n: n(), title: 'Before you go', blocks: [{ type: 'ul', items: [
    [T('Carry a REAL ID or a passport along with your veteran ID. Gates, front desks, and registers on base ask for both.')],
    [T(carry.length ? `Put these in your wallet, not on your phone: ${carry.join(', ')}. A photo of an ID is not accepted at a gate or a ticket window.` : 'Put the physical ID in your wallet, not a photo on your phone. A photo is not accepted at a gate or a ticket window.')],
    [T(`For a resort or park stay, call the front desk a week out and ask: "Which ID do you need from ${who} at check-in?"`)],
  ] }] });
  const closing = [[T(`Dollar figure on the page: ${r.dollars > 0 ? 'about ' + fmtUSD(r.dollars) + ' a year at your own spend assumptions' : 'none yet'}; it counts only verified rows you can prove today. Data stamp ${DATA_STAMP}. Educational, not legal or financial advice.`)]];
  return { header, howTo, sections, closing, title: 'What to Bring: Your Veteran Perks' };
}
export function countBrackets(doc) { let n = 0; const walk = parts => parts.forEach(p => { if (p.b) n++; }); doc.header.forEach(walk); doc.sections.forEach(sec => sec.blocks.forEach(b => b.items.forEach(walk))); doc.closing.forEach(walk); return n; }
export function checklistToText(doc) {
  const line = parts => parts.map(p => p.b ? `[${p.b}]` : p.t).join('');
  const out = [...doc.header.map(line), '', 'HOW TO USE THIS LIST', ...doc.howTo.map(h => '- ' + h), ''];
  for (const sec of doc.sections) { out.push(`${sec.n}. ${sec.title.toUpperCase()}`); for (const b of sec.blocks) b.items.forEach((it, i) => out.push((b.type === 'p' ? '' : b.type === 'ol' ? `${i + 1}. ` : '- ') + line(it))); out.push(''); }
  out.push(...doc.closing.map(line));
  return out.join('\n');
}
export function checklistToHtml(doc, esc) {
  const line = parts => parts.map(p => p.b ? `<mark class="br">[${esc(p.b)}]</mark>` : esc(p.t)).join('');
  let h = doc.header.map((l, i) => `<p class="lh${i < 2 ? ' lh-title' : ''}">${line(l)}</p>`).join('');
  h += `<div class="l-howto"><p class="l-howto-t">How to use this list</p><ul>${doc.howTo.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  for (const sec of doc.sections) {
    h += `<h4>${sec.n}. ${esc(sec.title)}</h4>`;
    for (const b of sec.blocks) h += b.type === 'p' ? `<p>${line(b.items[0])}</p>` : `<${b.type}>${b.items.map(it => `<li>${line(it)}</li>`).join('')}</${b.type}>`;
  }
  h += doc.closing.map(l => `<p class="l-close">${line(l)}</p>`).join('');
  return h;
}

/* ─── Search: every program, including the ones this person does not qualify for, with the reason ─── */
// Keyword matching only (no model call): fast, free, and it cannot invent a perk. Filler words drop out, so
// "disabled veteran discounts at hotels" searches for "hotels"; common words map to the terms our rows use.
const SEARCH_STOP = new Set(['a', 'an', 'the', 'for', 'at', 'of', 'my', 'me', 'i', 'do', 'does', 'can', 'is', 'are', 'what', 'with', 'to', 'in', 'on', 'and', 'or', 'get', 'any', 'there', 'have', 'how', 'about', 'veteran', 'veterans', 'vet', 'vets', 'military', 'disabled', 'discount', 'discounts', 'deal', 'deals', 'perk', 'perks', 'benefit', 'benefits', 'free', 'program', 'programs', 'rate', 'rates', 'percent', 'cheap', 'cheaper', 'savings', 'save']);
const AIR = ['airline', 'flight', 'airfare', 'jetblue', 'lufthansa', 'allegiant', 'breeze airways'];
const APPAREL = ['nike', 'adidas', 'under armour', 'carhartt', 'north face', 'columbia', 'l.l.bean', 'oakley', 'bass pro'];
const SEARCH_SYN = {
  hotel: ['hotel', 'lodging', ' inns', 'navy lodge'], lodging: ['hotel', 'lodging', ' inns', 'navy lodge'], room: ['hotel', 'lodging', 'room discount'], resort: ['hale koa', 'shades of green', 'edelweiss', 'dragon hill', 'new sanno', 'great wolf', 'kalahari', 'sandals', 'margaritaville'],
  flight: AIR, airline: AIR, airfare: AIR, fly: AIR, plane: AIR, flying: AIR, bag: ['bags'], baggage: ['bags'],
  grocery: ['commissary'], food: ['commissary'], commissary: ['commissary'], shopping: ['exchange', 'retail', 'commissary'], store: ['exchange', 'retail', 'commissary'],
  phone: ['wireless', 'verizon', 't-mobile', 'at&t'], cell: ['wireless', 'verizon', 't-mobile', 'at&t'], wireless: ['wireless', 'verizon', 't-mobile', 'at&t'], mobile: ['wireless', 'verizon', 't-mobile', 'at&t'], internet: ['xfinity', 'lifeline', 'fios'], cable: ['xfinity', 'lifeline', 'fios'],
  car: ['auto', 'vehicle', 'rental', 'jeep', 'toyota', 'honda', 'nissan', 'hyundai', 'ford military', 'gm military'], auto: ['auto', 'vehicle', 'jeep', 'toyota', 'honda', 'nissan', 'hyundai', 'ford military', 'gm military'], vehicle: ['auto', 'vehicle', 'plates', 'registration'],
  rental: ['rental', 'enterprise', 'avis', 'budget', 'hertz', 'penske', 'u-haul'], truck: ['moving', 'penske', 'u-haul', 'truck'], moving: ['moving', 'penske', 'u-haul'], move: ['moving', 'penske', 'u-haul'],
  park: ['parks', 'pass', 'camp'], camping: ['camp', 'rv ', 'koa', 'escapees', 'famcamp'], camp: ['camp', 'rv ', 'koa', 'escapees', 'famcamp'], rv: ['rv ', 'koa', 'escapees', 'famcamp', 'campground'],
  ski: ['ski'], skiing: ['ski'], snow: ['ski'], snowboard: ['ski'], cruise: ['cruise'],
  museum: ['attraction', 'museum'], zoo: ['zoo', 'aquarium'], aquarium: ['zoo', 'aquarium'], attraction: ['attraction', 'museum', 'zoo', 'aquarium'],
  theme: ['theme-park', 'disney', 'universal', 'six flags', 'seaworld', 'legoland', 'dollywood'], amusement: ['theme-park', 'disney', 'universal', 'six flags', 'seaworld', 'legoland', 'dollywood'], ticket: ['ticket', 'vet tix', 'theme-park'],
  toll: ['toll'], airport: ['airport'], parking: ['parking'], tsa: ['tsa', 'precheck', 'clear', 'global entry'], precheck: ['tsa', 'precheck'], security: ['tsa', 'precheck', 'clear', 'global entry'],
  loan: ['student loan', 'tpd', 'discharge', 'funding fee'], student: ['student loan', 'tpd', 'fafsa'], tax: ['tax', 'irs', 'miltax'], taxe: ['tax', 'irs', 'miltax'],
  bank: ['bank', 'credit union', 'usaa', 'navy federal', 'chase'], banking: ['bank', 'credit union', 'usaa', 'navy federal', 'chase'], checking: ['bank', 'chase', 'checking'], insurance: ['insurance', 'geico', 'usaa', 'afba'],
  train: ['amtrak', 'rail'], rail: ['amtrak', 'rail'], bus: ['greyhound', 'bus'], gym: ['fitness', 'team rwb'], fitness: ['fitness', 'team rwb'],
  hardware: ['home depot', 'lowe'], lumber: ['home depot', 'lowe'], improvement: ['home depot', 'lowe'], tool: ['home depot', 'lowe'],
  clothe: APPAREL, clothing: APPAREL, apparel: APPAREL, shoe: APPAREL, sneaker: APPAREL, gear: APPAREL, computer: ['apple', 'dell', 'microsoft'], laptop: ['apple', 'dell', 'microsoft'],
  golf: ['golf'], hunting: ['hunting', 'fishing'], fishing: ['hunting', 'fishing'], burial: ['arlington', 'burial'], cemetery: ['arlington', 'burial'],
  job: ['career', 'linkedin', 'priority of service', 'mssa'], career: ['career', 'linkedin', 'priority of service', 'mssa'], business: ['sba', 'business'],
  spouse: ['surviving', 'survivor', 'gold star', 'taps', 'spouse'], widow: ['surviving', 'survivor', 'gold star', 'taps'], survivor: ['surviving', 'survivor', 'gold star', 'taps'], caregiver: ['caregiver'],
  ride: ['uber', 'lyft', 'transportation', 'beneficiary travel'], uber: ['uber'], lyft: ['lyft'], transportation: ['transportation', 'beneficiary travel', 'honor flight'],
};
export function searchTokens(query) {
  const raw = String(query || '').toLowerCase().replace(/[^a-z0-9&'\-. ]+/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  for (const w of raw) {
    if (SEARCH_STOP.has(w) || w.length < 2) continue;
    const stems = [w, w.endsWith('ies') ? w.slice(0, -3) + 'y' : null, w.endsWith('s') && !w.endsWith('ss') && w.length > 3 ? w.slice(0, -1) : null].filter(Boolean);
    const key = stems.find(k => SEARCH_SYN[k]);
    out.push({ word: w, terms: key ? SEARCH_SYN[key] : [stems[stems.length - 1]] });
  }
  return out;
}
function rowHay(row) {
  const e = row.eligibility || {};
  return {
    strong: `${row.name} `.toLowerCase(),
    mid: `${row.group} ${row.card} ${row.tier} ${(row.tags || []).join(' ')} ${row.summary} `.toLowerCase(),
    weak: `${e.note || ''} ${(row.credentials || []).map(c => `${c.unlocks} ${c.note || ''}`).join(' ')} ${row.howTo || ''} ${(row.value && row.value.basis) || ''} ${(row.states || []).join(' ')} `.toLowerCase(),
  };
}
const tokenScore = (hay, tok) => tok.terms.reduce((best, t) => Math.max(best, hay.strong.includes(t) ? 3 : hay.mid.includes(t) ? 2 : hay.weak.includes(t) ? 1 : 0), 0);
// Why a row is not for this person, in plain words, plus what would change it.
export function whyNot(x, r, labels) {
  const s = r.s, st = r.statuses, e = x.row.eligibility || {}, L = (labels && labels.STATUS_LABEL) || {};
  const list = e.statuses || [];
  const byStatus = !list.length || list.some(k => st.has(k));
  const parts = [];
  if (!byStatus) {
    parts.push(`It is open to: ${list.map(k => L[k] || k).join(', ')}.`);
    const mine = st.has('veteran-unrated') || st.has('sc-0') || st.has('sc-10-90');
    if (list.includes('sc-100') && mine) parts.push('A 100% rating would open it.');
    else if ((list.includes('sc-10-90') || list.includes('sc-0')) && st.has('veteran-unrated')) parts.push('Any service-connected rating would open it.');
    else if (list.every(k => k === 'active' || k === 'guard-reserve' || k === 'dod-civilian')) parts.push('This one stops at separation.');
    else if (list.length === 1 && list[0] === 'veteran-unrated' && isServiceConnected(st)) { parts.length = 0; parts.push('This is the route for veterans without a rating. Your rating already gives you the regular access, so you do not need it.'); }
  } else if (e.minRating != null && !(s.rating != null && s.rating >= e.minRating)) parts.push(`It needs a rating of ${e.minRating}% or more${s.rating != null ? `; you entered ${s.rating}%` : ''}.`);
  else if (e.ptRequired && !s.isPT) parts.push('It needs a permanent and total rating by statute; a 100% rating that is not P&T does not qualify.');
  return parts.join(' ');
}
export function searchRows(r, query, ctx, labels) {
  const tokens = searchTokens(query);
  if (!tokens.length) return { tokens, results: [], local: [], total: 0, generic: String(query || '').trim().length > 0 };
  // level 2 = name, group, tags, or summary; level 1 = fine print (notes, how-to, basis)
  const score = (hay, mode, floor) => { const sc = tokens.map(t => { const v = tokenScore(hay, t); return v >= floor ? v : 0; }); if (mode === 'and' ? sc.some(v => v === 0) : sc.every(v => v === 0)) return 0; return sc.reduce((a, b) => a + b, 0); };
  // Local layer first: every state's toll and airport rows, not only the user's state ("Florida tolls" from Texas)
  const local = [];
  const LL = (ctx && ctx.local) || {};
  for (const kind of ['tolls', 'airports']) for (const [stAbbr, lrows] of Object.entries(LL[kind] || {})) {
    const stName = (ctx.states && ctx.states[stAbbr] && ctx.states[stAbbr].name) || stAbbr;
    for (const row of lrows) {
      const hay = { strong: `${stName} ${stAbbr.toLowerCase()} ${row.authority || ''} ${row.code || ''} ${row.name || ''} `.toLowerCase(), mid: `${kind === 'tolls' ? 'toll tolls turnpike' : 'airport parking'} `, weak: '' };
      const sc = score(hay, 'and', 2);
      if (sc > 0) local.push({ kind, state: stAbbr, stateName: stName, row, score: sc, mine: stAbbr === r.s.state });
    }
  }
  local.sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || b.score - a.score || a.stateName.localeCompare(b.stateName));
  const hays = r.rows.map(x => ({ x, hay: rowHay(x.row) }));
  const pass = (mode, floor) => hays.map(h => ({ x: h.x, score: score(h.hay, mode, floor) })).filter(h => h.score > 0);
  let hits = pass('and', 2);
  if (!hits.length && !local.length) hits = pass('and', 1);
  if (!hits.length && !local.length && tokens.length > 1) hits = pass('or', 2);
  const rank = { unlocked: 0, unlockable: 1, ask: 2, expired: 3, ineligible: 4, myth: 5 };
  hits.sort((a, b) => rank[a.x.status] - rank[b.x.status] || b.score - a.score || (b.x.counted ? 1 : 0) - (a.x.counted ? 1 : 0) || a.x.row.name.localeCompare(b.x.row.name));
  const open = x => (x.status === 'unlocked' && !x.row.negative) || x.status === 'unlockable';
  const results = hits.map(h => {
    const x = h.x;
    if (x.status !== 'ineligible' && x.status !== 'myth') return { x, why: '', alts: [] };
    const pool = r.rows.filter(y => y !== x && open(y));
    let alts = pool.filter(y => y.row.group === x.row.group);
    if (!alts.length) alts = pool.filter(y => y.row.card === x.row.card && tokens.some(t => tokenScore(rowHay(y.row), t) > 0));
    alts.sort((a, b) => (a.status === 'unlocked' ? 0 : 1) - (b.status === 'unlocked' ? 0 : 1) || (b.counted ? 1 : 0) - (a.counted ? 1 : 0) || b.dollars - a.dollars || a.row.name.localeCompare(b.row.name));
    return { x, why: x.status === 'ineligible' ? whyNot(x, r, labels) : '', alts: alts.slice(0, 3) };
  });
  return { tokens, results, local, total: results.length + local.length, generic: false };
}
