// Veteran Perks & Travel Navigator — UI wiring on the house template (forked from property-tax 11/4/26).
// State data is the Best State dataset loaded as a classic script (NORMALIZED_DATA); the perk rows and the
// local layer are this tool's own modules.
import { PERKS_ACCESS } from './data/perks-access.js';
import { PERKS_TICKETS } from './data/perks-tickets.js';
import { PERKS_TRAVEL } from './data/perks-travel.js';
import { PERKS_RETAIL } from './data/perks-retail.js';
import { PERKS_FEDERAL } from './data/perks-federal.js';
import { LOCAL } from './data/local.js';
import { MODE_BRIEF, BTN_TEXT, CARD_TITLES, CRED_LABEL, CRED_SHORT, CRED_HOWTO, CONFIDENCE, STATUS_LABEL, FAQ } from './data/copy.js';
import { solve, buildChecklist, countBrackets, checklistToText, checklistToHtml, searchRows, DATA_STAMP, MODES, CARD_ORDER, DEFAULT_ASSUMPTIONS, CARD_CHOICES } from './engine.js';
import { buildDocxBytes, DOCX_MIME } from './docx.js';

/* global NORMALIZED_DATA */
const STATES = typeof NORMALIZED_DATA !== 'undefined' ? NORMALIZED_DATA : {};
const ROWS = [...PERKS_ACCESS, ...PERKS_TICKETS, ...PERKS_TRAVEL, ...PERKS_RETAIL, ...PERKS_FEDERAL];
const $ = id => document.getElementById(id);
const fmtUSD = n => '$' + Math.round(n).toLocaleString('en-US');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SOURCE = 'perks-travel';
const LABELS = { CRED_LABEL, CRED_SHORT, CRED_HOWTO };

const state = { mode: 'travel', revealed: false, last: null, steps: new Set() };
$('data-stamp').textContent = DATA_STAMP;
$('data-stamp-2').textContent = DATA_STAMP;

/* ─── Elements ─────────────────────────────────────────────────────────── */
const stateEl = $('state'), ratingEl = $('rating'), ptEl = $('is-pt'), tempEl = $('is-temp'), tdiuEl = $('is-tdiu'), phEl = $('is-ph'), powEl = $('is-pow'), mohEl = $('is-moh');
const statusEls = () => [...document.querySelectorAll('input[name="status"]')];
const cardEls = () => [...document.querySelectorAll('input[name="card"]')];
const ASSUMP_KEYS = Object.keys(DEFAULT_ASSUMPTIONS);
const assumpEl = k => $('a-' + k);

// State select from the dataset itself (no typos): states, then DC, then the territories.
{
  const entries = Object.values(STATES).map(s => ({ ab: s.abbreviation, name: s.name, terr: !!s.isTerritory, dc: s.abbreviation === 'DC' }));
  const sortName = (a, b) => a.name.localeCompare(b.name);
  const groups = [['States', entries.filter(e => !e.terr && !e.dc).sort(sortName)], ['District', entries.filter(e => e.dc)], ['Territories', entries.filter(e => e.terr).sort(sortName)]];
  stateEl.innerHTML = '<option value="">Choose one</option>' + groups.map(([g, list]) => `<optgroup label="${g}">${list.map(e => `<option value="${e.ab}">${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
}

/* ─── Mode pills ───────────────────────────────────────────────────────── */
function setMode(m, opts = {}) {
  if (!MODES.includes(m)) m = 'travel';
  state.mode = m;
  document.querySelectorAll('.mode-pill').forEach(p => { p.classList.toggle('active', p.dataset.mode === m); p.setAttribute('aria-pressed', p.dataset.mode === m ? 'true' : 'false'); });
  $('mode-briefing').textContent = MODE_BRIEF[m];
  $('compare-btn').textContent = BTN_TEXT[m];
  // Reshape: the family pill surfaces the family statuses and unticks "veteran" if nothing else is ticked; the
  // travel and everyday pills put their assumption card first in the drawer.
  const grid = $('drawer-grid'), trav = $('card-travel-assump'), every = $('card-everyday-assump');
  if (m === 'everyday' && grid.firstElementChild !== every) grid.insertBefore(every, trav);
  else if (m !== 'everyday' && grid.firstElementChild !== trav) grid.insertBefore(trav, every);
  if (m === 'family' && !opts.fromUrl) {
    const sg = $('status-grid');
    for (const v of ['caregiver', 'surviving-spouse', 'gold-star']) { const lab = sg.querySelector(`input[value="${v}"]`).closest('label'); sg.prepend(lab); }
    $('rating-label').innerHTML = 'The veteran’s VA rating <span class="req-tag">required</span>';
  } else if (!opts.fromUrl) $('rating-label').innerHTML = 'VA disability rating <span class="req-tag">required</span>';
  if (state.revealed) reveal({ silent: true });
  updateLiveStrip();
}
document.querySelectorAll('.mode-pill').forEach(p => p.addEventListener('click', () => {
  setMode(p.dataset.mode);
  if (isTourActive() && tourState.steps[tourState.i]?.id === 'pills') showTourStep(tourState.i + 1);
}));

/* ─── Conditional fields ───────────────────────────────────────────────── */
function ratingInfo() {
  const v = ratingEl.value;
  const unrated = v === 'unrated';
  const num = (v !== '' && !unrated) ? parseInt(v, 10) : null;
  return { raw: v, unrated, num, rated: num !== null };
}
function syncConditionalFields() {
  const r = ratingInfo();
  const rl = $('rating-line');
  const vhic = cardEls().find(c => c.value === 'vhic-marked').checked, dod = cardEls().find(c => c.value === 'dod-id').checked;
  if (r.unrated) { rl.hidden = false; rl.innerHTML = '<strong>Without a rating</strong> the DD-214 still opens the online Exchange, the ID.me retail layer, the cruise and hotel rates, and the state license designation. The commissary, the resorts, and the parks pass want a VHIC; the <a href="/benefits-quiz/">Benefits Finder Quiz</a> is where a claim starts.'; }
  else if (r.rated && r.num === 0) { rl.hidden = false; rl.innerHTML = '<strong>0% counts.</strong> Since 2020 any service-connected rating opens the commissary, Exchange, MWR, and the military resorts at Rate III; the card is a marked VHIC, or Form H623A with a REAL ID if you cannot enroll.'; }
  else if (r.rated && r.num === 100) { rl.hidden = false; rl.innerHTML = `<strong>100%.</strong> ${dod ? 'Your DoD ID opens the Disney Salute, Universal, Hale Koa Rate II, and USO tier.' : 'Any 100% rating qualifies for the DoD ID card, which opens Disney Salute, Universal, Hale Koa Rate II, USO, and dependent cards. A VHIC alone does not; tick DoD ID if you already hold it.'}${ptEl.checked ? ' P&T adds Space-A.' : ' Space-A needs P&T.'}`; }
  else if (r.rated) { rl.hidden = false; rl.innerHTML = `<strong>${r.num}%.</strong> ${vhic ? 'Your marked VHIC opens the commissary, Exchange, MWR, and the resorts at Rate III.' : 'A VHIC marked SERVICE CONNECTED opens the commissary, Exchange, MWR, and the resorts at Rate III; tick it if you hold one, or the VA letter with a REAL ID does the same at the gate.'}`; }
  else rl.hidden = true;
  $('field-pt').hidden = !(r.rated && r.num >= 100);
  const anyVet = statusEls().some(s => s.checked && ['veteran', 'retiree', 'guard-reserve', 'active'].includes(s.value));
  $('field-rating').style.opacity = anyVet ? '' : '.75';
}
[ratingEl, ptEl, tempEl, tdiuEl, ...cardEls(), ...statusEls()].forEach(el => { el.addEventListener('change', syncConditionalFields); });

/* ─── Inputs → model ───────────────────────────────────────────────────── */
function buildInput() {
  const r = ratingInfo();
  const assumptions = {};
  for (const k of ASSUMP_KEYS) { const el = assumpEl(k); if (!el) { assumptions[k] = DEFAULT_ASSUMPTIONS[k]; continue; } assumptions[k] = el.type === 'checkbox' ? el.checked : (parseFloat(el.value) || 0); }
  return {
    mode: state.mode,
    statuses: statusEls().filter(s => s.checked).map(s => s.value),
    ratingRaw: r.raw, rating: r.num, unrated: r.unrated,
    isPT: ptEl.checked && r.num === 100, isTemp: tempEl.checked && r.num === 100, isTDIU: tdiuEl.checked && r.num === 100,
    ph: phEl.checked, pow: powEl.checked, moh: mohEl.checked,
    cards: cardEls().filter(c => c.checked).map(c => c.value),
    state: stateEl.value || null,
    assumptions,
  };
}
const CTX = { rows: ROWS, local: LOCAL, states: STATES };
const run = () => solve(buildInput(), CTX);

/* ─── Live strip ───────────────────────────────────────────────────────── */
let liveTimer = null;
function updateLiveStrip() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    const el = $('live-strip');
    const s = buildInput();
    const anyVet = s.statuses.some(x => ['veteran', 'retiree', 'guard-reserve', 'active'].includes(x));
    if (!s.statuses.length || (anyVet && !s.ratingRaw)) { el.innerHTML = '<strong>Required to run:</strong> your status and your rating. The count builds here as you tick the IDs you hold.'; return; }
    const r = run();
    const top = r.upgrades[0];
    el.innerHTML = `<span class="stake">${r.unlocked.length}</span> perk${r.unlocked.length === 1 ? '' : 's'} unlocked by the IDs you hold${r.dollars > 0 ? ` · about <strong>${fmtUSD(r.dollars)}</strong> a year at your spend` : ''}${r.unlockable.length ? ` · <strong>${r.unlockable.length}</strong> more need an ID you don’t hold${top ? ` (${esc(CRED_SHORT[top.card])} would add ${top.adds})` : ''}` : ''}. Press the button for the full list.`;
  }, 150);
}
let rerenderTimer = null;
function onFormChange() {
  updateLiveStrip();
  if (!state.revealed) return;
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(() => reveal({ silent: true }), 250);
}
document.querySelectorAll('#calc-form input, #calc-form select').forEach(el => { el.addEventListener('input', onFormChange); el.addEventListener('change', onFormChange); });

/* ─── Validation (novalidate + JS, house rule) ─────────────────────────── */
function clearMissing() { document.querySelectorAll('.field-missing, .field-error').forEach(el => el.classList.remove('field-missing', 'field-error')); }
function validate() {
  clearMissing();
  const s = buildInput();
  if (!s.statuses.length) { $('status-grid').classList.add('field-missing'); return { message: 'Required: tick at least one status (the red box).', focusEl: statusEls()[0] }; }
  const anyVet = s.statuses.some(x => ['veteran', 'retiree', 'guard-reserve', 'active'].includes(x));
  if (anyVet && !ratingEl.value) { ratingEl.closest('.fg-field').classList.add('field-missing'); ratingEl.classList.add('field-error'); return { message: 'Required: the VA rating. “Not rated” is a fine answer.', focusEl: ratingEl }; }
  return { message: '', focusEl: null };
}
[ratingEl, ...statusEls()].forEach(el => el.addEventListener('change', () => { clearMissing(); $('form-error').textContent = ''; }));

/* ─── Submit gate ──────────────────────────────────────────────────────── */
$('calc-form').addEventListener('submit', e => { e.preventDefault(); reveal(); });
function reveal(opts = {}) {
  const v = validate();
  if (opts.silent && v.message) { clearMissing(); return; }
  $('form-error').textContent = v.message;
  if (v.message) { if (!isTourActive()) v.focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); v.focusEl.focus({ preventScroll: true }); return; }
  const r = run();
  state.last = r;
  renderHero(r);
  renderCards(r);
  state.revealed = true;
  $('hero-verdict').style.display = 'block';
  $('hero-capture').style.display = 'block';
  $('results-container').style.display = 'block';
  $('action-bar').style.display = 'flex';
  if (opts.silent) return;
  if (typeof gtag === 'function') gtag('event', 'show_results', { mode: state.mode, state: r.s.state, rating: r.s.ratingRaw, unlocked: r.unlocked.length, unlockable: r.unlockable.length });
  if (isTourActive() && tourState.steps[tourState.i]?.id === 'gate') endTour();
  if (!isTourActive()) $('hero-verdict').scrollIntoView({ behavior: 'smooth', block: 'start' });
  let resultsSeen = true;
  try { resultsSeen = localStorage.getItem(RESULTS_TOUR_KEY) === '1'; } catch {}
  if (!resultsSeen && !window.__pkArrivalHadParams) setTimeout(() => startTourWith(RESULTS_TOUR, RESULTS_TOUR_KEY), 800);
}
$('retake-btn').addEventListener('click', () => {
  state.revealed = false;
  ['hero-verdict', 'hero-capture', 'results-container'].forEach(id => $(id).style.display = 'none');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ─── Hero ─────────────────────────────────────────────────────────────── */
const confChip = c => `<span class="chip ${c === 'verified' ? 'chip-green' : c === 'reported' ? 'chip-gold' : 'chip-red'}">${esc(CONFIDENCE[c]?.label || c)}</span>`;
const credChip = c => `<span class="chip chip-navy">${esc(CRED_SHORT[c] || c)}</span>`;
function heldSummary(s) { const h = (s.cards || []).filter(c => c !== 'none'); return h.length ? h.map(c => CRED_SHORT[c]).join(', ') : 'no IDs ticked'; }
function renderHero(r) {
  const el = $('hero-verdict');
  const s = r.s;
  const n = r.unlocked.length, m = r.unlockable.length;
  const top = r.upgrades[0];
  const heldTxt = heldSummary(s);
  const dollarTxt = r.dollars > 0 ? `At your spend that is about <strong>${fmtUSD(r.dollars)}</strong> a year, counting only verified rows you can prove today.` : 'Add your spend in the drawer and the dollar figure builds from verified rows you can prove today.';
  const upTxt = top ? `A <strong>${esc(CRED_LABEL[top.card])}</strong> would add <strong>${top.adds}</strong> more${top.dollars > 0 ? ` (about ${fmtUSD(top.dollars)} a year)` : ''}; the What to Bring section says how to get it.` : (m ? 'The rest need IDs listed on each row.' : 'Nothing you qualify for is waiting on an ID.');
  const is100 = s.rating === 100, hasDod = r.held.has('dod-id'), hasVhic = r.held.has('vhic-marked'), sc = r.statuses.has('sc-0') || r.statuses.has('sc-10-90') || r.statuses.has('sc-100');
  let kicker, line;
  if (s.mode === 'family') {
    kicker = `${n} perk${n === 1 ? '' : 's'} for your family today`;
    line = `With ${esc(heldTxt)}, the rows below are the ones that admit a caregiver, surviving spouse, or Gold Star family by name: the VA caregiver letter on base, the Survivor Family Package at the resorts, the Gold Star parks pass and PreCheck waiver, and the survivor lines the roundups skip. ${upTxt}`;
  } else if (s.mode === 'everyday') {
    kicker = n ? `${n} everyday perk${n === 1 ? '' : 's'} you can prove today` : 'Start with the ID';
    line = `${sc ? (hasVhic || hasDod ? 'Service-connected with the right ID: the commissary, Exchange, and MWR are open to you, and ' : 'Service-connected at any rating, the commissary, Exchange, and MWR are open to you once you carry a marked VHIC or the VA letter with a REAL ID, and ') : 'With a DD-214 the online Exchange, the ID.me retail layer, and the memberships are open, and '}the retail and wireless rows below were confirmed on the retailer’s own page. ${dollarTxt} ${upTxt}`;
  } else if (s.mode === 'card') {
    kicker = `Your IDs (${esc(heldTxt)}) unlock ${n}; one more ID would unlock ${top ? top.adds : 0} more`;
    line = `${is100 ? (hasDod ? 'Your DoD ID card is the top one: it opens the Disney Salute, Universal, Hale Koa Rate II, USO, and dependent tier. ' : 'At 100% you qualify for the DoD ID card and do not hold it yet; it is the single biggest upgrade on this page (Disney Salute, Universal, Hale Koa Rate II, USO, dependent cards). ') : sc ? (hasVhic ? 'Your marked VHIC is doing the work: commissary, Exchange, MWR, the resorts at Rate III, the parks pass. ' : 'A marked VHIC is the ID to get: commissary, Exchange, MWR, the resorts at Rate III, the parks pass. ') : 'Without a rating the DD-214 is your ID, and the veteran designation on your license is the cheap upgrade. '}${dollarTxt}`;
  } else {
    kicker = n ? `${n} travel perk${n === 1 ? '' : 's'} unlocked by the IDs you hold` : 'Start with the ID';
    line = `${is100 ? (hasDod ? 'Your DoD ID books Hale Koa at Rate II and buys Disney Salute and Universal Freedom Pass tickets; ' : 'Disney Salute and Hale Koa Rate II need the DoD ID a 100% rating earns, and you have not ticked one; ') : sc ? (hasVhic ? 'Your marked VHIC books Hale Koa at Rate III and Shades of Green at Category 3, and buys Disney’s non-promotional military tickets; Disney Salute needs a DoD ID; ' : 'A marked VHIC books the resorts at Rate III and buys Disney’s non-promotional tickets; ') : 'The cruise lines, Hyatt, and the parks pass take a DD-214 or a veteran license; '}${s.state ? `the On the road section has your ${esc(r.stateRec?.name || s.state)} toll and airport rules. ` : 'pick a state for the toll and airport rules. '}${dollarTxt} ${upTxt}`;
  }
  const tiles = `<div class="three-num">
    <div class="num-card comfortable"><span class="nc-label">Unlocked today</span><span class="nc-amount">${n}</span><span class="nc-sub">by ${esc(heldTxt)}</span></div>
    <div class="num-card"><span class="nc-label">One more ID adds</span><span class="nc-amount">${top ? top.adds : 0}</span><span class="nc-sub">${top ? esc(CRED_SHORT[top.card]) : 'nothing waiting'}</span></div>
    <div class="num-card ${r.dollars > 0 ? '' : 'off'}"><span class="nc-label">Estimate, your spend</span><span class="nc-amount">${r.dollars > 0 ? fmtUSD(r.dollars) : '—'}</span><span class="nc-sub">${r.dollars > 0 ? 'per year, verified rows only' : 'add spend in the drawer'}</span></div>
  </div>`;
  const myth = r.myths.length ? `<p class="v-sub"><span class="chip chip-red">${r.myths.length} myth${r.myths.length === 1 ? '' : 's'}</span> your ID does not unlock (airline bags, Florida tolls, Blue Star Museums and the rest); each is a row below so you do not argue at the counter.</p>` : '';
  el.innerHTML = `<p class="v-kicker">${kicker}</p><p class="v-line">${line}</p>${tiles}${myth}`;
}

/* ─── Cards ────────────────────────────────────────────────────────────── */
function card(id, title, value, valueClass, body, open) {
  return `<details class="stack-card" id="card-${id}"${open ? ' open' : ''}><summary><span class="sc-title">${esc(title)}</span><span class="sc-value ${valueClass || ''}">${value}</span></summary><div class="sc-body">${body}</div></details>`;
}
const ext = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} →</a>`;
const statusTag = x => x.status === 'unlocked' ? (x.row.negative ? '<span class="rs rs-doc">Yes, for you</span>' : '<span class="rs rs-doc">Unlocked</span>') : x.status === 'unlockable' ? '<span class="rs rs-thin">Get the ID</span>' : x.status === 'ask' ? '<span class="rs rs-thin">Ask which ID</span>' : x.status === 'expired' ? '<span class="rs rs-thin">Terms expired</span>' : x.status === 'ineligible' ? '<span class="rs rs-miss">Not for you</span>' : '<span class="rs rs-miss">Not for your ID</span>';
function rowHtml(x) {
  const r = x.row, c = x.heldCred || x.bestCred;
  const v = r.value || {};
  const perVisit = v.assumption === 'parkDays';
  const dollars = x.dollars > 0 ? (x.counted ? `<p class="r-a">About <strong>${fmtUSD(x.dollars)}</strong> ${perVisit ? 'a visit, counted in your estimate' : 'a year at your spend, counted in your estimate'}${v.cap ? ` (program cap ${fmtUSD(v.cap)})` : ''}.</p>` : x.optIn ? `<p class="r-a">Worth about <strong>${fmtUSD(x.dollars)}</strong> a year if you use it. Not added to your estimate.</p>` : `<p class="r-a">About ${fmtUSD(x.dollars)} ${perVisit ? 'a visit' : 'a year at your spend'}. Not added to your estimate: it counts one program per spend type${perVisit ? ' and your best visits first' : ''}.</p>`) : '';
  const credLine = r.negative ? '' : (x.status === 'unlocked' ? (c ? `<p class="r-a">Show: ${credChip(c.card)} ${c.unlocks ? esc(c.unlocks) : ''}${c.note ? ` <span class="r-note">(${esc(c.note)})</span>` : ''}</p>` : '<p class="r-a">Show: <span class="chip chip-navy">nothing</span> open to everyone</p>') : x.status === 'unlockable' ? `<p class="r-a">Needs: ${(r.credentials || []).map(k => credChip(k.card)).join(' or ')} ${c && c.unlocks ? '→ ' + esc(c.unlocks) : ''}</p>` : x.status === 'ask' ? `<p class="r-a">The program asks for ${(r.credentials || []).map(k => credChip(k.card)).join(' or ')}, which your status does not issue. Call ahead and ask whether a VHIC, a veteran-designated license, or a DD-214 is accepted.</p>` : '');
  const alt = (r.credentials || []).length > 1 && x.status === 'unlocked' ? `<p class="r-w">${(r.credentials || []).filter(k => k !== c).map(k => `${esc(CRED_SHORT[k.card] || k.card)}: ${esc(k.unlocks)}`).join(' · ')}</p>` : '';
  const when = r.validTo ? `<p class="r-w">Terms shown through ${esc(r.validTo)}${x.status === 'expired' ? '; the next period is not yet announced' : ''}.</p>` : '';
  const elig = r.eligibility && r.eligibility.note ? `<p class="r-w">${esc(r.eligibility.note)}</p>` : '';
  const where = r.states && r.states.length ? `<p class="r-w"><strong>Where:</strong> ${r.states.map(esc).join(', ')}</p>` : '';
  const over = r.eligibility && r.eligibility.overseas ? '<p class="r-w">Overseas installation: VHIC-only access is not guaranteed (status of forces agreements); bring a DoD ID.</p>' : '';
  const srcs = (r.sourceUrls || []).map(u => ext(u.url, u.title || u.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])).join(' · ');
  return `<li>${statusTag(x)}<div><p class="r-t">${esc(r.name)}${r.confidence !== 'verified' ? ' ' + confChip(r.confidence) : ''}${r.provenance === 'overview' ? ' <span class="chip chip-gold" title="confirmed from a search overview citing the program site; re-opened at each refresh">site via overview</span>' : ''}</p><p class="r-w">${esc(r.summary)}</p>${credLine}${dollars}<details class="row-more"><summary>How to use it, what to bring, sources</summary>${alt}${elig}${where}${over}${when}<p class="r-w">${esc(r.howTo)}</p>${r.bring && r.bring.length ? `<p class="r-w"><strong>Bring:</strong> ${r.bring.map(esc).join('; ')}</p>` : ''}<p class="sc-src">${confChip(r.confidence)} ${srcs ? 'Sources: ' + srcs + '. ' : ''}Opened ${esc(r.verifiedDate)}.</p></details></div></li>`;
}
function listHtml(rows, cap = 8) {
  if (!rows.length) return '<p class="r-w">Nothing in this group for your status and cards yet.</p>';
  const main = rows.filter(x => x.status !== 'myth'), myths = rows.filter(x => x.status === 'myth');
  const first = main.slice(0, cap), rest = main.slice(cap);
  return `${first.length ? `<ul class="ready-list">${first.map(rowHtml).join('')}</ul>` : ''}${rest.length ? `<details class="more-rows"><summary>Show ${rest.length} more in this group</summary><ul class="ready-list">${rest.map(rowHtml).join('')}</ul></details>` : ''}${myths.length ? `<details class="more-rows myth-rows"><summary>${myths.length} thing${myths.length === 1 ? '' : 's'} your ID does not unlock here</summary><ul class="ready-list">${myths.map(rowHtml).join('')}</ul></details>` : ''}`;
}
function groupCounts(rows) { const u = rows.filter(x => x.status === 'unlocked' && !x.row.negative).length, g = rows.filter(x => x.status === 'unlockable').length, a = rows.filter(x => x.status === 'ask').length, m = rows.filter(x => x.status === 'myth').length; return `${u} unlocked${g ? ` · ${g} need an ID` : ''}${a ? ` · ${a} ask first` : ''}${m ? ` · ${m} myth${m === 1 ? '' : 's'}` : ''}`; }
function localHtml(r) {
  const t = r.local.tolls, a = r.local.airports;
  const vTag = v => v === 'yes' ? '<span class="rs rs-doc">Yes</span>' : v === 'partial' ? '<span class="rs rs-thin">Partial</span>' : v === 'no' ? '<span class="rs rs-miss">No</span>' : '<span class="rs rs-thin">Unverified</span>';
  const src = x => `<p class="sc-src">${confChip(x.confidence)} ${x.statute ? esc(x.statute) + '. ' : ''}${(x.sourceUrls || []).map(u => ext(u.url, u.title || u.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])).join(' · ')}. Opened ${esc(x.verifiedDate)}.</p>`;
  const tolls = t.length ? `<ul class="ready-list">${t.map(x => `<li>${vTag(x.verdict)}<div><p class="r-t">Tolls: ${esc(x.authority)}</p><p class="r-w">${esc(x.rule)}</p>${x.enroll ? `<p class="r-w"><strong>Enroll:</strong> ${esc(x.enroll)}</p>` : ''}${x.excludes ? `<p class="r-w"><strong>Not on:</strong> ${esc(x.excludes)}</p>` : ''}${src(x)}</div></li>`).join('')}</ul>` : `<p class="r-w">No toll-authority row for ${esc(r.stateRec?.name || 'your state')} yet. We found no DV-plate toll program in the states we checked outside Texas, California, and the New York Thruway; if your authority has one, tell us and we will open its page.</p>`;
  const airports = a.length ? `<ul class="ready-list">${a.map(x => `<li>${vTag(x.verdict)}<div><p class="r-t">Airport parking: ${esc(x.code)} ${esc(x.name)}</p><p class="r-w">${esc(x.rule)}</p>${x.days ? `<p class="r-w"><strong>Limit:</strong> ${esc(x.days)}</p>` : ''}${x.howTo ? `<p class="r-w"><strong>At the exit:</strong> ${esc(x.howTo)}</p>` : ''}${src(x)}</div></li>`).join('')}</ul>` : `<p class="r-w">No airport row for ${esc(r.stateRec?.name || 'your state')} yet. Florida airports are required by statute to waive parking for the free DV plate; Texas airports opt in one by one; Las Vegas, Portland, and Salt Lake City have policies. Most others charge posted rates.</p>`;
  const lines = r.stateLines.filter(x => x.kind === 'plates' || x.kind === 'license');
  const st = lines.length ? `<ul class="ready-list">${lines.map(l => `<li>${l.ok ? '<span class="rs rs-doc">Yes</span>' : '<span class="rs rs-thin">At ' + esc(String(l.need)) + '%+</span>'}<div><p class="r-t">${esc(l.text)}</p>${l.value ? `<p class="r-a">Best State values the registration at about ${fmtUSD(l.value)} a year.</p>` : ''}<p class="sc-src">From <a href="/state-benefits/">Best State for Veterans</a>, read live.</p></div></li>`).join('')}</ul>` : '';
  return `<p>Your DV plate waives tolls in a few places and is a myth in most. Every "no" below cites the statute or the authority’s own page; every "yes" says how to enroll.</p>${st}<p class="chk-label"><strong>Tolls</strong></p>${tolls}<p class="chk-label"><strong>Airport parking</strong></p>${airports}`;
}
function unlocksHtml(r) {
  const held = (r.s.cards || []).filter(c => c !== 'none');
  const groups = held.map(c => { const rows = r.byHeld[c] || []; return `<div class="callout"><h3>${esc(CRED_LABEL[c])} <span class="chip chip-navy">${rows.length} perk${rows.length === 1 ? '' : 's'}</span></h3>${rows.length ? `<p>${rows.slice(0, 14).map(x => esc(x.row.name)).join(' · ')}${rows.length > 14 ? ` · and ${rows.length - 14} more` : ''}</p>` : '<p>Nothing on this list keys on this card alone (another ID you hold already covers its rows).</p>'}</div>`; }).join('');
  const none = (r.byHeld.none || []);
  const noneHtml = none.length ? `<div class="callout"><h3>No ID needed <span class="chip chip-navy">${none.length}</span></h3><p>${none.slice(0, 14).map(x => esc(x.row.name)).join(' · ')}${none.length > 14 ? ` · and ${none.length - 14} more` : ''}</p></div>` : '';
  const ups = r.upgrades.slice(0, 4).map((u, i) => `<li><span class="rs ${i === 0 ? 'rs-doc' : 'rs-thin'}">+${u.adds}</span><div><p class="r-t">${esc(CRED_LABEL[u.card])}${u.dollars > 0 ? ` <span class="chip chip-gold">about ${fmtUSD(u.dollars)}/yr</span>` : ''}</p><p class="r-w">Opens: ${u.rows.slice(0, 10).map(x => esc(x.row.name)).join(' · ')}${u.rows.length > 10 ? ` · and ${u.rows.length - 10} more` : ''}</p><p class="r-w"><strong>How:</strong> ${esc(CRED_HOWTO[u.card] || '')}</p></div></li>`).join('');
  const statuses = [...r.statuses].map(x => `<span class="chip chip-navy">${esc(STATUS_LABEL[x] || x)}</span>`).join(' ');
  return `<p>You told us: ${statuses || 'no status'}${r.s.rating != null ? `, rated ${r.s.rating}%${r.s.isPT ? ' P&T' : r.s.isTemp ? ' (temporary)' : ''}${r.s.isTDIU ? ' TDIU' : ''}` : ''}${r.stateRec ? `, in ${esc(r.stateRec.name)}` : ''}.</p>${groups}${noneHtml}${ups ? `<p class="chk-label"><strong>The ID worth getting next</strong></p><ul class="ready-list">${ups}</ul>` : '<p class="one-line">Every perk you qualify for is unlocked by an ID you already hold.</p>'}`;
}

function renderCards(r) {
  const cards = {};
  cards.unlocks = card('unlocks', CARD_TITLES.unlocks, `${r.unlocked.length} today`, '', unlocksHtml(r), true);
  for (const key of ['travel', 'tickets', 'parks', 'everyday', 'federal']) {
    const rows = r.byCard[key] || [];
    let extra = '';
    if (key === 'parks') { const lines = r.stateLines.filter(x => x.kind === 'parks' || x.kind === 'hunting'); if (lines.length) extra = `<p class="chk-label"><strong>${esc(r.stateRec.name)} (from Best State for Veterans)</strong></p><ul class="ready-list">${lines.map(l => `<li>${l.ok ? '<span class="rs rs-doc">Yes</span>' : '<span class="rs rs-thin">At ' + esc(String(l.need)) + '%+</span>'}<div><p class="r-t">${esc(l.text)}</p><p class="sc-src"><a href="/state-benefits/?st=${esc(r.s.state)}${r.s.rating != null ? '&r=' + r.s.rating : ''}${r.s.isPT ? '&pt=1' : ''}">Open ${esc(r.stateRec.name)} in Best State for Veterans →</a></p></div></li>`).join('')}</ul>`; else if (!r.s.state) extra = '<p class="r-w">Pick a state in the form for the state park pass and hunting and fishing lines.</p>'; }
    if (key === 'federal') extra = '<p class="r-w">These are the benefits your status turns on outside the discount world. VA-side rows (priority groups, dental, the funding fee) link to the tool that covers them.</p>';
    cards[key] = card(key, CARD_TITLES[key], groupCounts(rows), rows.some(x => x.status === 'unlocked' && !x.row.negative) ? '' : 'off', `${key === 'federal' ? extra : ''}${listHtml(rows)}${key === 'parks' ? extra : ''}`, false);
  }
  { const rows = r.byCard.road || []; cards.road = card('road', CARD_TITLES.road, r.s.state ? `${r.local.tolls.filter(x => x.verdict === 'yes').length + r.local.airports.filter(x => x.verdict === 'yes').length} yes · ${r.local.tolls.filter(x => x.verdict === 'no').length + r.local.airports.filter(x => x.verdict === 'no').length} no` : 'pick a state', r.s.state ? '' : 'off', `${localHtml(r)}${rows.length ? `<p class="chk-label"><strong>Getting there and through security</strong></p>${listHtml(rows)}` : ''}`, false); }
  cards.bring = card('bring', CARD_TITLES.bring, 'print or Word', 'door', renderChecklistCard(r), false);
  const order = CARD_ORDER[r.s.mode] || CARD_ORDER.travel;
  $('cards-panel').innerHTML = order.map((id, i) => { let h = cards[id]; if (i === 0 && !h.includes(' open>')) h = h.replace('<details class="stack-card"', '<details class="stack-card" open'); return h; }).join('');
  wireChecklistCard();
  runSearch();
}

/* ─── Search: every program, including the ones not on this person's list, with the reason ─── */
const searchEl = $('perk-search-input');
const SEARCH_LABELS = { STATUS_LABEL };
function localResultHtml(l) {
  const x = l.row;
  const vTag = x.verdict === 'yes' ? '<span class="rs rs-doc">Yes</span>' : x.verdict === 'partial' ? '<span class="rs rs-thin">Partial</span>' : x.verdict === 'no' ? '<span class="rs rs-miss">No</span>' : '<span class="rs rs-thin">Unverified</span>';
  const srcs = (x.sourceUrls || []).map(u => ext(u.url, u.title || u.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])).join(' · ');
  const title = l.kind === 'tolls' ? `${esc(l.stateName)} tolls: ${esc(x.authority)}` : `${esc(l.stateName)} airport parking: ${esc(x.code)} ${esc(x.name)}`;
  return `<li>${vTag}<div><p class="r-t">${title}${l.mine ? ' <span class="chip chip-navy">your state</span>' : ''}</p><p class="r-w">${esc(x.rule)}</p>${x.enroll ? `<p class="r-w"><strong>Enroll:</strong> ${esc(x.enroll)}</p>` : ''}${x.days ? `<p class="r-w"><strong>Limit:</strong> ${esc(x.days)}</p>` : ''}<p class="sc-src">${confChip(x.confidence)} ${x.statute ? esc(x.statute) + '. ' : ''}${srcs ? srcs + '. ' : ''}Opened ${esc(x.verifiedDate)}.</p></div></li>`;
}
function notForYouHtml(res) {
  const x = res.x, r = x.row;
  const srcs = (r.sourceUrls || []).map(u => ext(u.url, u.title || u.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])).join(' · ');
  const alts = res.alts.length ? `<p class="r-a">Closest thing open to you: ${res.alts.map(a => `<strong>${esc(a.row.name)}</strong>${a.status === 'unlockable' ? ' (get the ID)' : ''}`).join(' · ')}</p>` : '';
  return `<li>${statusTag(x)}<div><p class="r-t">${esc(r.name)}</p><p class="r-w">${esc(r.summary)}</p>${res.why ? `<p class="r-w"><strong>Why not:</strong> ${esc(res.why)}</p>` : ''}${alts}<details class="row-more"><summary>Details and sources</summary>${r.eligibility && r.eligibility.note ? `<p class="r-w">${esc(r.eligibility.note)}</p>` : ''}<p class="r-w">${esc(r.howTo)}</p><p class="sc-src">${confChip(r.confidence)} ${srcs ? 'Sources: ' + srcs + '. ' : ''}Opened ${esc(r.verifiedDate)}.</p></details></div></li>`;
}
let searchLogTimer = null;
function runSearch() {
  const box = $('perk-search-results'); if (!box || !searchEl) return;
  const q = searchEl.value.trim();
  $('perk-search-clear').hidden = !q;
  if (q.length < 2 || !state.last) { box.innerHTML = ''; return; }
  const out = searchRows(state.last, q, CTX, SEARCH_LABELS);
  if (out.generic) { box.innerHTML = `<p class="ps-none">Add one specific word: <strong>hotels</strong>, <strong>Disney</strong>, <strong>tolls</strong>, <strong>cruise</strong>, <strong>cell phone</strong>, <strong>student loans</strong>. Words like "veteran" and "discount" match everything here.</p>`; return; }
  if (!out.total) {
    box.innerHTML = `<p class="ps-none">Nothing in our 220 programs or the toll and airport rules matches <strong>${esc(q)}</strong>. That means we have not opened a page for it, not that it does not exist. If you know the program, reply to any Better Veteran newsletter email with its name and a link and we will open its page.</p>`;
  } else {
    const CAP = 20;
    const res = out.results, n = k => res.filter(k).length;
    const unlocked = n(y => y.x.status === 'unlocked' && !y.x.row.negative), need = n(y => y.x.status === 'unlockable' || y.x.status === 'ask'), not = n(y => y.x.status === 'ineligible' || y.x.status === 'myth' || y.x.status === 'expired');
    const head = `<p class="ps-head"><strong>${out.total}</strong> match${out.total === 1 ? '' : 'es'} for <strong>${esc(q)}</strong>${res.length ? `: ${unlocked} unlocked for you${need ? `, ${need} need an ID or a call` : ''}${not ? `, ${not} not for you (with the reason)` : ''}` : ''}${out.local.length ? `${res.length ? '; ' : ': '}${out.local.length} toll or airport rule${out.local.length === 1 ? '' : 's'}` : ''}.</p>`;
    const rows = res.slice(0, CAP).map(y => (y.x.status === 'ineligible' || y.x.status === 'myth') ? notForYouHtml(y) : rowHtml(y.x)).join('');
    const loc = out.local.slice(0, 12).map(localResultHtml).join('');
    box.innerHTML = `${head}${rows ? `<ul class="ready-list">${rows}</ul>` : ''}${res.length > CAP ? `<p class="r-w">${res.length - CAP} more programs match; add a word to narrow it.</p>` : ''}${loc ? `<p class="chk-label"><strong>Toll and airport rules</strong></p><ul class="ready-list">${loc}</ul>` : ''}${out.local.length > 12 ? `<p class="r-w">${out.local.length - 12} more toll and airport rules match; add a state name.</p>` : ''}`;
  }
  clearTimeout(searchLogTimer);
  searchLogTimer = setTimeout(() => { if (typeof gtag === 'function') gtag('event', 'perk_search', { search_term: q.slice(0, 60), results: out.total, source: SOURCE }); }, 1500);
}
let searchTimer = null;
searchEl.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 180); });
searchEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
$('perk-search-clear').addEventListener('click', () => { searchEl.value = ''; runSearch(); searchEl.focus(); });
document.querySelectorAll('#perk-search .ps-try').forEach(b => b.addEventListener('click', () => { searchEl.value = b.dataset.q; runSearch(); }));

/* ─── What to bring card ───────────────────────────────────────────────── */
function currentChecklist() { const r = state.last || run(); const doc = buildChecklist(r, LABELS); doc.howToTitle = 'HOW TO USE THIS LIST'; return doc; }
function renderChecklistCard() {
  return `
    <p>One printable page: the IDs you hold and what each opens, the ID to get next and how, then every perk by group with the ID to show at the counter, your state’s toll and airport rule, and the myths to skip. Print it or open it in Word. Nothing you type is sent anywhere.</p>
    <div class="letter-tools no-print">
      <button type="button" id="letter-copy" class="action-btn secondary">Copy list</button>
      <button type="button" id="letter-print" class="action-btn secondary">Print list only</button>
      <button type="button" id="letter-download" class="action-btn secondary">Download for Word</button>
      <span class="bracket-count" id="bracket-count"></span>
    </div>
    <p class="phone-hint no-print">On a phone, <strong>Download for Word</strong> opens your share menu: pick Pages, Word, Google Docs, or Save to Files. If a different app opens instead, use <strong>Copy list</strong> and paste it wherever you write.</p>
    <div id="cl-grid" class="cl-grid no-print" aria-label="What to bring"></div>
    <div id="letter-sheet" class="sheet-print-only"></div>`;
}
function linkify(parts) {
  return parts.map(p => {
    if (p.b) return `<mark class="br">[${esc(p.b)}]</mark>`;
    return esc(p.t.replace(/^☐\s*/, '')).replace(/(https?:\/\/[^\s<]+[^\s<.,;:)])/g, u => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>`);
  }).join('');
}
function fitChecklistCards() {
  document.querySelectorAll('#cl-grid .cl-card').forEach(c => {
    const body = c.querySelector('.cl-body'); if (!body) return;
    c.querySelector('.cl-more')?.remove();
    c.classList.remove('expanded', 'overflow');
    if (body.scrollHeight <= body.clientHeight + 4) return;
    c.classList.add('overflow');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cl-more'; b.textContent = 'Show more';
    b.addEventListener('click', () => { const open = c.classList.toggle('expanded'); b.textContent = open ? 'Show less' : 'Show more'; });
    c.appendChild(b);
  });
}
function paintChecklist() {
  const sheet = $('letter-sheet'); if (!sheet) return;
  const doc = currentChecklist();
  sheet.innerHTML = checklistToHtml(doc, esc);
  const grid = $('cl-grid');
  if (grid) grid.innerHTML = doc.sections.map(sec => {
    const done = state.steps.has(String(sec.n));
    const body = sec.blocks.map(b => b.type === 'p' ? `<p>${linkify(b.items[0])}</p>` : `<ul>${b.items.map(it => `<li>${linkify(it)}</li>`).join('')}</ul>`).join('');
    return `<div class="cl-card${done ? ' done' : ''}"><label class="cl-head"><input type="checkbox" data-step="${sec.n}"${done ? ' checked' : ''}><span class="cl-n">${sec.n}</span><span class="cl-t">${esc(sec.title)}</span></label><div class="cl-body">${body}</div></div>`;
  }).join('');
  const n = countBrackets(doc);
  const bc = $('bracket-count'); if (bc) { bc.textContent = `${n ? `${n} blank${n === 1 ? '' : 's'} to fill · ` : ''}${state.steps.size} of ${doc.sections.length} sections checked off`; bc.classList.toggle('done', state.steps.size === doc.sections.length); }
  if (grid) requestAnimationFrame(fitChecklistCards);
}
addEventListener('resize', () => { if (state.revealed) fitChecklistCards(); });
function wireChecklistCard() {
  paintChecklist();
  $('cl-grid')?.addEventListener('change', e => {
    const cb = e.target.closest('[data-step]'); if (!cb) return;
    cb.checked ? state.steps.add(cb.dataset.step) : state.steps.delete(cb.dataset.step);
    cb.closest('.cl-card').classList.toggle('done', cb.checked);
    const doc = currentChecklist(); const bc = $('bracket-count'); if (bc) bc.textContent = `${state.steps.size} of ${doc.sections.length} sections checked off`;
  });
  $('letter-copy')?.addEventListener('click', async () => {
    const btn = $('letter-copy'), text = checklistToText(currentChecklist());
    try { await navigator.clipboard.writeText(text); const o = btn.textContent; btn.textContent = '✓ Copied'; setTimeout(() => { btn.textContent = o; }, 2000); } catch { prompt('Copy your list:', text); }
    if (typeof gtag === 'function') gtag('event', 'checklist_copy', { source: SOURCE });
  });
  $('letter-download')?.addEventListener('click', async () => {
    const name = 'veteran-perks-what-to-bring.docx';
    const bytes = buildDocxBytes(currentChecklist());
    if (typeof gtag === 'function') gtag('event', 'checklist_download', { source: SOURCE });
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch && typeof File === 'function' && navigator.canShare) {
      try { const file = new File([bytes], name, { type: DOCX_MIME }); if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'What to Bring: Your Veteran Perks' }); return; } }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: DOCX_MIME }));
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
  $('letter-print')?.addEventListener('click', () => {
    document.body.classList.add('print-letter-only');
    const done = () => { document.body.classList.remove('print-letter-only'); removeEventListener('afterprint', done); };
    addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
    if (typeof gtag === 'function') gtag('event', 'checklist_print', { source: SOURCE });
  });
}

/* ─── FAQ (visible; mirrors FAQPage JSON-LD) ───────────────────────────── */
$('faq-items').innerHTML = FAQ.map(([q, a]) => `<details class="faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');

/* ─── Share URL ────────────────────────────────────────────────────────── */
const SHARE_KEYS = new Set(['m', 'g', 'r', 'pt', 'tp', 'iu', 'ph', 'pow', 'moh', 'c', 'st', 'a', 'done', 'open', 'q']);
function buildShareUrl() {
  const s = buildInput();
  const p = new URLSearchParams();
  p.set('m', state.mode);
  p.set('g', s.statuses.join('.'));
  if (s.ratingRaw) p.set('r', s.ratingRaw);
  if (ptEl.checked) p.set('pt', '1'); if (tempEl.checked) p.set('tp', '1'); if (tdiuEl.checked) p.set('iu', '1');
  if (phEl.checked) p.set('ph', '1'); if (powEl.checked) p.set('pow', '1'); if (mohEl.checked) p.set('moh', '1');
  p.set('c', s.cards.join('.'));
  if (s.state) p.set('st', s.state);
  const a = ASSUMP_KEYS.filter(k => String(s.assumptions[k]) !== String(DEFAULT_ASSUMPTIONS[k])).map(k => `${k}:${s.assumptions[k] === true ? 1 : s.assumptions[k] === false ? 0 : s.assumptions[k]}`);
  if (a.length) p.set('a', a.join('.'));
  if (state.steps.size) p.set('done', [...state.steps].join('.'));
  if (searchEl && searchEl.value.trim()) p.set('q', searchEl.value.trim().slice(0, 60));
  return location.origin + location.pathname + '?' + p.toString() + '&source=' + SOURCE;
}
function hasShareParams(p) { return [...p.keys()].some(k => SHARE_KEYS.has(k)); }
async function loadFromUrl() {
  const p = new URLSearchParams(location.search);
  if (!hasShareParams(p)) return false;
  setMode(MODE_BRIEF[p.get('m')] ? p.get('m') : 'travel', { fromUrl: true });
  if (p.has('g')) { const g = new Set(p.get('g').split('.').filter(Boolean)); statusEls().forEach(el => { el.checked = g.has(el.value); }); }
  if (p.has('r')) ratingEl.value = p.get('r');
  ptEl.checked = p.get('pt') === '1'; tempEl.checked = p.get('tp') === '1'; tdiuEl.checked = p.get('iu') === '1';
  phEl.checked = p.get('ph') === '1'; powEl.checked = p.get('pow') === '1'; mohEl.checked = p.get('moh') === '1';
  if (p.has('c')) { const c = new Set(p.get('c').split('.').filter(Boolean)); cardEls().forEach(el => { el.checked = c.has(el.value); }); }
  if (p.has('st')) stateEl.value = p.get('st');
  if (p.has('a')) { for (const kv of p.get('a').split('.')) { const [k, v] = kv.split(':'); const el = assumpEl(k); if (!el) continue; if (el.type === 'checkbox') el.checked = v === '1'; else el.value = v; } $('assumptions-drawer').open = true; }
  if (p.has('done')) p.get('done').split('.').filter(Boolean).forEach(x => state.steps.add(x));
  if (p.has('q')) searchEl.value = p.get('q').slice(0, 60);
  const openCard = p.get('open'); // deep link to one card: unlocks|travel|tickets|parks|everyday|road|federal|bring
  history.replaceState(null, '', location.pathname);
  syncConditionalFields();
  const v = validate(); clearMissing();
  if (v.message) return false;
  reveal();
  if (openCard) { const c = $('card-' + openCard); if (c) { c.open = true; setTimeout(() => c.scrollIntoView({ behavior: 'auto', block: 'start' }), 350); } }
  return true;
}

/* ─── Email capture ────────────────────────────────────────────────────── */
async function sendResultsEmail(email, statusEl2, btn, placement) {
  if (!email || !email.includes('@')) { statusEl2.textContent = 'Please enter a valid email.'; statusEl2.className = 'email-status error'; return false; }
  btn.disabled = true;
  statusEl2.textContent = 'Sending…'; statusEl2.className = 'email-status';
  try {
    const res = await fetch('/api/email-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, resultsUrl: buildShareUrl(), source: SOURCE }) });
    const data = await res.json();
    if (res.ok && data.success) {
      statusEl2.textContent = '✓ Check your inbox: your perks list link is on the way.'; statusEl2.className = 'email-status success';
      if (typeof gtag === 'function') gtag('event', 'email_capture', { placement, source: SOURCE });
      return true;
    }
    statusEl2.textContent = data.error || 'Something went wrong. Please try again.'; statusEl2.className = 'email-status error';
  } catch { statusEl2.textContent = 'Network error. Please try again.'; statusEl2.className = 'email-status error'; }
  finally { btn.disabled = false; }
  return false;
}
$('hero-capture-form').addEventListener('submit', async e => { e.preventDefault(); if (await sendResultsEmail($('hero-email-input').value.trim(), $('hero-email-status'), $('hero-email-btn'), 'hero')) $('hero-email-input').value = ''; });
$('email-results-form').addEventListener('submit', async e => { e.preventDefault(); if (await sendResultsEmail($('email-input').value.trim(), $('email-status'), $('email-submit-btn'), 'bottom')) $('email-input').value = ''; });
$('print-btn').addEventListener('click', () => window.print());
$('share-btn').addEventListener('click', async () => {
  const btn = $('share-btn');
  try { await navigator.clipboard.writeText(buildShareUrl()); const o = btn.textContent; btn.textContent = '✓ Link Copied!'; setTimeout(() => { btn.textContent = o; }, 2000); }
  catch { prompt('Copy this link:', buildShareUrl()); }
});

/* ─── Interactive tour (house standard, copied from VFI via property-tax) ── */
const INPUT_TOUR_KEY = 'pk-tour-seen', RESULTS_TOUR_KEY = 'pk-results-tour-seen';
const INPUT_TOUR = [
  { id: 'welcome', target: null, label: 'Step 1 of 7', title: 'Welcome: 60 seconds, then it’s all yours', text: 'A front desk or a register never asks your rating. It asks for an ID: a VHIC, a DoD ID card, a DD-214. This shows what the IDs in your wallet open today, what one more would add, and what to bring. Fill in your real answers as we go; exit anytime.' },
  { id: 'pills', target: '#mode-pills', label: 'Step 2 of 7', title: 'What brings you here?', text: 'A trip, the everyday savings, the ID question, or a family situation. The perks are the same; which section comes first and how the verdict reads changes. Click one.' },
  { id: 'you', target: '#card-you', label: 'Step 3 of 7', title: 'Who you are', text: 'Tick every status that applies and pick the rating. At 100%, say whether it is permanent, temporary, or TDIU: any 100% gets the DoD ID; only Space-A needs P&T.' },
  { id: 'cards', target: '#card-cards', label: 'Step 4 of 7', title: 'The IDs in your wallet', text: 'This is the whole trick. Tick only the IDs and documents you hold right now. A marked VHIC and a DoD ID card open very different lists, and the page will show you which one to get next.' },
  { id: 'assumptions', target: '#assumptions-drawer', label: 'Step 5 of 7', title: 'Your spend, so the dollars are yours', text: 'All optional. Nights, park days, groceries, wireless, home improvement. The estimate counts only verified rows you can prove today, times these numbers.' },
  { id: 'live', target: '#live-strip', label: 'Step 6 of 7', title: 'The count, live', text: 'Perks unlocked, the dollar figure, and how many more one ID would add update as you tick.' },
  { id: 'gate', target: '#compare-btn', label: 'Step 7 of 7', title: 'Get the list', text: 'Press it, and we’ll walk through the sections and the what-to-bring page together.' },
];
const RESULTS_TOUR = [
  { id: 'r-hero', target: '#hero-verdict', label: 'Results 1 of 5', title: 'The verdict', text: 'Unlocked today, what one more ID adds, and the estimate at your spend. Myths are counted so you do not argue at a counter.' },
  { id: 'r-search', target: '#perk-search', label: 'Results 2 of 6', title: 'Search everything', text: 'Type a word like hotels, Disney, or tolls. It looks across all 220 programs, including the ones that are not on your list, and tells you why.' },
  { id: 'r-unlocks', target: '#card-unlocks', label: 'Results 3 of 6', title: 'ID by ID', text: 'Each ID you hold and what it opens, then the ID worth getting next with how to get it. That is the page to screenshot.' },
  { id: 'r-lead', target: '#cards-panel > details:nth-child(2)', label: 'Results 3 of 5', title: 'The group that leads', text: 'For your mode this group comes first. Every row shows the ID to show, the source, and the date we opened it; "get the ID" rows show what is missing.' },
  { id: 'r-sheet', target: '#card-bring', label: 'Results 4 of 5', title: 'What to bring', text: 'One printable page built from your answers, with Word download. Section 2 is the ID worth getting and the exact steps.' },
  { id: 'r-capture', target: '#email-results-container', label: 'Results 5 of 5', title: 'Don’t lose this', text: 'Email yourself the link; it rebuilds everything on any device. That’s the walkthrough.' },
];
const tourState = { active: false, i: 0, steps: INPUT_TOUR, seenKey: INPUT_TOUR_KEY, timer: null };
function isTourActive() { return tourState.active; }
function tourEls() { return { root: $('tour-root'), spot: $('tour-spotlight'), tip: $('tour-tooltip') }; }
function positionTour() {
  const step = tourState.steps[tourState.i]; if (!step) return;
  const { spot, tip } = tourEls();
  if (!step.target) {
    spot.style.cssText = `top:${scrollY + innerHeight / 2}px; left:50vw; width:0; height:0;`;
    if (!matchMedia('(max-width: 560px)').matches) {
      tip.style.left = Math.max(24, (innerWidth - Math.min(380, innerWidth - 48)) / 2) + 'px';
      tip.style.top = (scrollY + innerHeight / 2 - (tip.offsetHeight || 220) / 2) + 'px';
    }
    return;
  }
  const target = document.querySelector(step.target);
  if (!target || target.offsetParent === null) return;
  const r = target.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return;
  const pad = 8;
  Object.assign(spot.style, { top: (r.top + scrollY - pad) + 'px', left: (r.left + scrollX - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
  const tipH = tip.offsetHeight || 180;
  const below = r.bottom + 16 + tipH < innerHeight || r.top < tipH + 32;
  if (matchMedia('(max-width: 560px)').matches) { tip.style.top = ''; tip.style.left = ''; }
  else {
    tip.style.top = (below ? r.bottom + scrollY + 14 : r.top + scrollY - tipH - 14) + 'px';
    tip.style.left = Math.max(12, Math.min(r.left + scrollX, innerWidth - tip.offsetWidth - 12)) + 'px';
  }
}
function showTourStep(i, dir = 1) {
  if (i < 0 || i >= tourState.steps.length) return endTour();
  const step = tourState.steps[i];
  if (step.target) { const el = document.querySelector(step.target); if (!el || el.offsetParent === null) return showTourStep(i + dir, dir); }
  tourState.i = i;
  const visible = tourState.steps.filter(s => { if (!s.target) return true; const el = document.querySelector(s.target); return el && el.offsetParent !== null; });
  $('tour-step-label').textContent = `${step.label.split(' ')[0]} ${visible.indexOf(step) + 1} of ${visible.length}`;
  $('tour-title').textContent = step.title;
  $('tour-text').textContent = step.text;
  $('tour-next').textContent = i === tourState.steps.length - 1 ? 'Done ✓' : 'Next';
  $('tour-back').style.visibility = i === 0 ? 'hidden' : 'visible';
  if (step.id === 'assumptions') $('assumptions-drawer').open = true;
  if (step.id === 'r-unlocks') { const c = $('card-unlocks'); if (c) c.open = true; }
  if (step.id === 'r-sheet') { const c = $('card-bring'); if (c) c.open = true; }
  if (!step.target) window.scrollTo({ top: 0, behavior: 'smooth' });
  else { const target = document.querySelector(step.target); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  setTimeout(positionTour, 350);
}
function startTourWith(steps, seenKey) {
  tourState.steps = steps; tourState.seenKey = seenKey; tourState.active = true; tourState.i = 0;
  $('tour-root').hidden = false;
  showTourStep(0);
  clearInterval(tourState.timer);
  tourState.timer = setInterval(positionTour, 400);
}
function endTour() {
  tourState.active = false;
  clearInterval(tourState.timer);
  $('tour-root').hidden = true;
  try { localStorage.setItem(tourState.seenKey, '1'); } catch {}
}
$('tour-next').addEventListener('click', () => showTourStep(tourState.i + 1, 1));
$('tour-back').addEventListener('click', () => showTourStep(tourState.i - 1, -1));
$('tour-exit').addEventListener('click', endTour);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && tourState.active) endTour(); });
document.addEventListener('click', e => {
  if (!tourState.active || e.detail === 0) return;
  if (e.target.closest('#tour-tooltip') || e.target.closest('#tour-restart')) return;
  if (e.target.closest('#compare-btn') || e.target.closest('.mode-pill')) return;
  const r = $('tour-spotlight').getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!inside) endTour();
});
$('tour-restart').addEventListener('click', () => startTourWith(INPUT_TOUR, INPUT_TOUR_KEY));
addEventListener('resize', positionTour);

/* ─── Intro: collapse on phones, one tap to expand (content stays in the HTML) ── */
{
  const about = $('about-this-tool');
  if (about && !about.querySelector('.about-more')) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'about-more no-print'; b.textContent = 'Read more';
    b.addEventListener('click', () => { const open = about.classList.toggle('open'); b.textContent = open ? 'Show less' : 'Read more'; });
    about.appendChild(b);
  }
}

/* ─── Init (last line: the layer above must be defined before boot reaches it) ── */
setMode('travel');
syncConditionalFields();
loadFromUrl().then(arrived => {
  let tourSeen = true;
  try { tourSeen = localStorage.getItem(INPUT_TOUR_KEY) === '1'; } catch {}
  if (!arrived && !window.__pkArrivalHadParams && !tourSeen) setTimeout(() => startTourWith(INPUT_TOUR, INPUT_TOUR_KEY), 600);
  updateLiveStrip();
});
