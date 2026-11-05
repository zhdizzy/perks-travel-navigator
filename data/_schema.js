// Veteran Perks & Travel Navigator — DATA SCHEMA (the contract every data file follows).
// Written 11/4/26 from perks-travel-navigator-spec-2026-11.md §5.2 plus the round-2/3 additions.
// This file is documentation plus the enums the validator (tools/validate-data.mjs) and the engine use.
// Data files export arrays of ROWS: data/perks-access.js (PERKS_ACCESS), data/perks-travel.js (PERKS_TRAVEL),
// data/perks-retail.js (PERKS_RETAIL), data/perks-federal.js (PERKS_FEDERAL). The local layer (tolls, airport
// parking by state) is data/local.js (LOCAL), a different shape, documented at the bottom.

export const STATUSES = ['active', 'retiree', 'guard-reserve', 'veteran-unrated', 'sc-0', 'sc-10-90', 'sc-100', 'purple-heart', 'pow', 'moh', 'gold-star', 'caregiver', 'surviving-spouse', 'dod-civilian'];
// How the engine derives a user's status SET from the inputs (so rows list EVERY status that qualifies):
//   veteran + rating 100  -> sc-100 (flags: pt, temp, tdiu)      veteran + 10..90 -> sc-10-90
//   veteran + 0           -> sc-0                                 veteran + unrated -> veteran-unrated
//   retiree               -> retiree (+ the rating status above)   guard-reserve, active, caregiver, surviving-spouse, gold-star, dod-civilian as ticked
//   purple-heart / pow / moh toggles add those statuses.
// A row matches when its statuses intersect the user's set (empty statuses = everyone, incl. civilians).
// IMPORTANT: a 100% veteran is ALSO service-connected. Rows that admit "any service-connected rating" must list sc-0, sc-10-90 AND sc-100.

export const CARDS = ['dod-id', 'vhic-marked', 'vhic-plain', 'h623a', 'va-letter', 'dd214', 'idme', 'sheerid', 'dv-plates', 'state-dl-veteran', 'caregiver-letter', 'military-pass', 'access-pass', 'wesalute', 'none'];
// 'dod-id' = DD 2 / DD 1173 / DD 1173-1 / DD 2765 / Next Gen USID (active, retiree, Guard/Reserve, any 100% SC, their dependents)
// 'vhic-marked' = VHIC showing PURPLE HEART / FORMER POW / SERVICE CONNECTED under the photo; 'vhic-plain' = VHIC with no marker
// 'h623a' = HEC Form H623A (Priority Group 8E, 0% who cannot enroll); 'va-letter' = VA service-connected disability or benefit summary letter
// 'idme' / 'sheerid' = online verification (they accept DD-214, VHIC, VIC, veteran DL, etc.); 'none' = no credential needed (everyone)
// A row's credentials[] lists each card that unlocks it and what that card unlocks; the FIRST entry is the best card.

export const TIERS = ['government', 'afrc', 'parks', 'travel', 'retail', 'federal'];
export const CARD_KEYS = ['unlocks', 'travel', 'tickets', 'parks', 'everyday', 'road', 'federal']; // which results card renders the row
export const VALUE_TYPES = ['fixed', 'percent', 'per-night', 'per-day', 'per-use', 'varies', 'none'];
// Drawer assumptions the dollar engine multiplies against (user-editable; defaults in engine.js):
export const ASSUMPTIONS = ['nightsPerYear', 'hotelNights', 'parkDays', 'groceriesMonthly', 'improvementYearly', 'wirelessMonthly', 'rentalDays', 'flightsYearly', 'airportDays', 'skiDays', 'cruiseSpend', 'newCar', 'apparelYearly', 'diningYearly'];
export const REFRESH = ['annual-oct', 'annual-nov', 'annual-jan', 'quarterly', 'on-report'];
export const CONFIDENCE = ['verified', 'reported', 'unverified'];

/** @typedef {Object} Row
 * @property {string} id            unique kebab-case across ALL files (prefix by file: acc-, trv-, ret-, fed-)
 * @property {string} name          program name as the program writes it
 * @property {string} tier          one of TIERS
 * @property {string} card          one of CARD_KEYS (results card)
 * @property {string} group         short sub-group label: lodging | commissary | exchange | mwr | space-a | passes | security | rail | flights | rental | bus | hotel | cruise | ski | theme-park | attraction | golf | camping | getting-there | retail | wireless | services | banking | insurance | tax | moving | auto | career | federal-money | special-status | survivor | myth
 * @property {string} summary       ONE plain sentence (<= 170 chars): what you get. No "free" unless the program says free. Never "savings you are owed".
 * @property {{statuses:string[], minRating:(number|null), ptRequired:boolean, overseas:boolean, note:string}} eligibility
 * @property {{card:string, unlocks:string, note:string}[]} credentials   best card first; [] only when card 'none' applies to everyone
 * @property {{type:string, amount:(number|null), assumption:(string|null), cap:(number|null), basis:string}} value
 *            fixed: amount = dollars per year (e.g. Chase fee waiver 300); percent: amount = 0.10 and assumption names the spend it applies to;
 *            per-night/per-day/per-use: amount = dollars saved per unit, assumption names the unit count; varies/none: amount null.
 *            Only confidence 'verified' rows with a numeric amount enter the dollar total (engine rule).
 * @property {boolean} negative     true = myth row: renders "your card does not unlock this" (airline bags, Blue Star Museums, Progressive, Uber...)
 * @property {string} howTo         one or two sentences: where to go, what to click, what to say
 * @property {string[]} bring       what to carry (cards, letters, forms)
 * @property {(string|null)} blockouts
 * @property {(string|null)} validFrom  'YYYY-MM-DD' when the offer period is published
 * @property {(string|null)} validTo
 * @property {string} refresh       one of REFRESH
 * @property {{url:string, title:string}[]} sourceUrls   the program's own page / statute / DoD-VA page, verbatim from the spec; never google.com
 * @property {string} verifiedDate  'YYYY-MM-DD' (2026-11-03 or 2026-11-04 from the spec)
 * @property {string} confidence    one of CONFIDENCE
 * @property {(string|null)} provenance   'overview' when the spec says the row was verified from an AI Overview citing the program site (Zak 11/4); else null
 * @property {(string[]|null)} states     null = national; otherwise state abbreviations the row is limited to (e.g. Amtrak California 15%: ['CA'])
 * @property {string[]} tags        free: 'requires-wesalute', 'active-only', 'seasonal', 'veterans-day', 'property-level', 'chain', 'base-ticket-office', 'cross-link:/100-pt/'
 */

// EXAMPLE ROWS (the exact shape; copy these):
export const EXAMPLE_ROWS = [
  {
    id: 'acc-hale-koa', name: 'Hale Koa Hotel (Honolulu)', tier: 'afrc', card: 'travel', group: 'lodging',
    summary: 'Waikiki beachfront military resort; your rate category depends on which card you hold.',
    eligibility: { statuses: ['active', 'retiree', 'guard-reserve', 'sc-0', 'sc-10-90', 'sc-100', 'purple-heart', 'pow', 'caregiver', 'surviving-spouse', 'dod-civilian'], minRating: null, ptRequired: false, overseas: false, note: '0% without a VHIC: Hale Koa’s pages do not mention Form H623A; ask before booking.' },
    credentials: [
      { card: 'dod-id', unlocks: 'Rate II for 100% DAV (Resort View $249 a night, 1 Oct 2026 to 30 Sep 2027); Rate I to III by rank for others', note: 'DD 1173, DD 2765, or Next Gen USID' },
      { card: 'vhic-marked', unlocks: 'Rate III (Resort View $279 a night) for 0 to 99% service-connected, Purple Heart, former POW', note: 'VHIC with the marker plus a REAL ID or passport' },
      { card: 'caregiver-letter', unlocks: 'Rate III', note: 'official VA caregiver letter' },
    ],
    value: { type: 'per-night', amount: null, assumption: 'nightsPerYear', cap: null, basis: 'Resort View $199 / $249 / $279 / $309 by category (1 Oct 2026 to 30 Sep 2027); no sourced Waikiki comparable, so the row counts but adds no dollars.' },
    negative: false,
    howTo: 'Book at halekoa.com. The front desk verifies your card at check-in and sets the rate category; sponsors check in with any non-eligible guests (up to two extra rooms at Category III).',
    bring: ['DoD ID, or marked VHIC plus REAL ID or passport', 'Survivor Family Package: DD 1173 showing the AD sponsor and the DB or CH relationship'],
    blockouts: null, validFrom: '2026-10-01', validTo: '2027-09-30', refresh: 'annual-oct',
    sourceUrls: [{ url: 'https://www.halekoa.com/about-hale-koa-hotel/eligibility', title: 'Hale Koa eligibility' }, { url: 'https://www.halekoa.com/rooms-suites/room-rates', title: 'Hale Koa room rates' }],
    verifiedDate: '2026-11-04', confidence: 'verified', provenance: null, states: null, tags: ['afrc'],
  },
  {
    id: 'trv-airline-bags-myth', name: 'Airline free checked bags and military fares', tier: 'travel', card: 'travel', group: 'myth',
    summary: 'Every airline bag waiver and military fare is for active duty with a military ID; no airline publishes a standing veteran fare or bag benefit.',
    eligibility: { statuses: ['active'], minRating: null, ptRequired: false, overseas: false, note: 'Delta and Southwest confirmed 11/4; American and United pages blocked, same pattern per their own snippets.' },
    credentials: [{ card: 'dod-id', unlocks: 'active-duty bag allowance and fares', note: 'active-duty ID only; veterans and retirees are not included' }],
    value: { type: 'none', amount: null, assumption: null, cap: null, basis: 'Not a veteran benefit.' },
    negative: true,
    howTo: 'Veterans reach airline discounts only through WeSalute+ partners (JetBlue, Alaska, Hawaiian, Lufthansa, Breeze) or American Forces Travel, each its own row.',
    bring: [], blockouts: null, validFrom: null, validTo: null, refresh: 'quarterly',
    sourceUrls: [{ url: 'https://www.delta.com/us/en/baggage/checked-baggage/military-baggage-allowance', title: 'Delta military baggage' }, { url: 'https://www.southwest.com/military-travel/', title: 'Southwest military travel' }],
    verifiedDate: '2026-11-04', confidence: 'verified', provenance: null, states: null, tags: ['active-only'],
  },
  {
    id: 'ret-home-depot', name: 'Home Depot military discount', tier: 'retail', card: 'everyday', group: 'retail',
    summary: '10% off in store and online for veterans, active duty, and spouses, up to $400 a year.',
    eligibility: { statuses: ['active', 'retiree', 'guard-reserve', 'veteran-unrated', 'sc-0', 'sc-10-90', 'sc-100', 'purple-heart', 'pow', 'moh'], minRating: null, ptRequired: false, overseas: false, note: 'Spouses register by linking to the member’s account.' },
    credentials: [{ card: 'sheerid', unlocks: '10% off, $400 annual cap', note: 'register once in the Home Depot app; DD-214, VHIC, veteran DL designation accepted' }],
    value: { type: 'percent', amount: 0.10, assumption: 'improvementYearly', cap: 400, basis: '10% of your home-improvement spend, capped at $400 per calendar year; excludes certain major appliances, building materials, and brands.' },
    negative: false,
    howTo: 'Register in the Home Depot app, verify through SheerID, then show the app QR code or give your registered phone number at checkout; online it applies after you log in.',
    bring: ['Home Depot app with the virtual ID, or your registered phone number'],
    blockouts: null, validFrom: null, validTo: null, refresh: 'quarterly',
    sourceUrls: [{ url: 'https://www.homedepot.com/c/military-discount', title: 'Home Depot military discount' }, { url: 'https://corporate.homedepot.com/newsroom/home-depot-military-discount-instructions', title: 'Home Depot corporate instructions (6/28/2022)' }],
    verifiedDate: '2026-11-04', confidence: 'verified', provenance: 'overview', states: null, tags: [],
  },
];

// LOCAL LAYER SHAPE (data/local.js): export const LOCAL = { tolls: { TX: [TollRow...] }, airports: { FL: [AirportRow...] } }
// TollRow:    { id:'toll-tx-txdot', state:'TX', authority:'TxDOT-operated toll lanes', verdict:'yes'|'no'|'partial'|'unverified',
//               rule:'one or two sentences', plates:['DV','Purple Heart',...], enroll:'how to enroll or "no enrollment"', excludes:'HOT lanes...'|null,
//               statute:'Transp. Code 372.053'|null, sourceUrls:[{url,title}], verifiedDate:'2026-11-04', confidence:'verified'|'reported'|'unverified', provenance:null|'overview' }
// AirportRow: { id:'air-fl-mco', state:'FL', code:'MCO', name:'Orlando International', verdict:'yes'|'no'|'unverified', rule:'...', days:'90 consecutive days'|null,
//               plates:'...', presentRequired:true|false|null, howTo:'exit via cashier lane...', statute:'F.S. 316.1964(7)'|null, sourceUrls:[...], verifiedDate, confidence, provenance }
// States with no toll row ship nothing (the engine renders "we found no program; tell us if your authority has one").
