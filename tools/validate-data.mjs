// Validates every data file against data/_schema.js. Run from tbv-tools/perks-travel:  node tools/validate-data.mjs [file ...]
// Exit 1 on any error. Checks: required fields, enums, unique ids across files, URL shape (never google.com),
// date format, summary length, no em/en dashes, no unfilled brackets, provenance/confidence pairing, local layer shape.
import { STATUSES, CARDS, TIERS, CARD_KEYS, VALUE_TYPES, ASSUMPTIONS, REFRESH, CONFIDENCE } from '../data/_schema.js';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const FILES = [['perks-access.js', 'PERKS_ACCESS'], ['perks-tickets.js', 'PERKS_TICKETS'], ['perks-travel.js', 'PERKS_TRAVEL'], ['perks-retail.js', 'PERKS_RETAIL'], ['perks-federal.js', 'PERKS_FEDERAL']];
const only = process.argv.slice(2);
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isUrl = s => typeof s === 'string' && /^https?:\/\/[^\s"']+$/.test(s) && !/google\.com\/search|googleusercontent/.test(s);
const dash = s => /[—–]/.test(String(s));
const ids = new Map();
let total = 0;

function checkText(where, label, s, max) {
  if (typeof s !== 'string') { err(where, `${label} must be a string`); return; }
  if (dash(s)) err(where, `${label} contains an em or en dash`);
  if (/\[[A-Z][^\]]*\]/.test(s)) err(where, `${label} contains an unfilled [BRACKET]`);
  if (max && s.length > max) err(where, `${label} is ${s.length} chars (max ${max})`);
}
function checkRow(r, file) {
  total++;
  const where = `${file}#${r && r.id}`;
  if (!r || typeof r !== 'object') { err(file, 'row is not an object'); return; }
  if (!r.id || !/^[a-z0-9-]+$/.test(r.id)) err(where, 'id must be kebab-case');
  if (ids.has(r.id)) err(where, `duplicate id (also in ${ids.get(r.id)})`); else ids.set(r.id, file);
  checkText(where, 'name', r.name, 120);
  if (!TIERS.includes(r.tier)) err(where, `tier '${r.tier}' not in ${TIERS.join('|')}`);
  if (!CARD_KEYS.includes(r.card)) err(where, `card '${r.card}' not in ${CARD_KEYS.join('|')}`);
  if (typeof r.group !== 'string' || !r.group) err(where, 'group required');
  checkText(where, 'summary', r.summary, 170);
  const e = r.eligibility || {};
  if (!Array.isArray(e.statuses)) err(where, 'eligibility.statuses must be an array');
  else e.statuses.forEach(s => { if (!STATUSES.includes(s)) err(where, `status '${s}' unknown`); });
  if (e.minRating != null && typeof e.minRating !== 'number') err(where, 'eligibility.minRating must be number or null');
  if (typeof e.ptRequired !== 'boolean' || typeof e.overseas !== 'boolean') err(where, 'eligibility.ptRequired/overseas must be booleans');
  if (e.note != null) checkText(where, 'eligibility.note', e.note, 400);
  if (!Array.isArray(r.credentials)) err(where, 'credentials must be an array');
  else r.credentials.forEach((c, i) => { if (!CARDS.includes(c.card)) err(where, `credentials[${i}].card '${c.card}' unknown`); checkText(where, `credentials[${i}].unlocks`, c.unlocks, 300); if (c.note != null) checkText(where, `credentials[${i}].note`, c.note, 300); });
  const v = r.value || {};
  if (!VALUE_TYPES.includes(v.type)) err(where, `value.type '${v.type}' unknown`);
  if (['fixed', 'percent', 'per-night', 'per-day', 'per-use'].includes(v.type)) {
    if (v.amount != null && typeof v.amount !== 'number') err(where, 'value.amount must be number or null');
    if (v.type === 'percent' && v.amount != null && (v.amount <= 0 || v.amount >= 1)) err(where, 'percent amount must be a fraction like 0.10');
    if (v.type !== 'fixed' && v.amount != null && !ASSUMPTIONS.includes(v.assumption)) err(where, `value.assumption '${v.assumption}' must be one of ${ASSUMPTIONS.join('|')} when amount is set`);
  } else if (v.amount != null) err(where, `value.amount must be null for type ${v.type}`);
  if (v.cap != null && typeof v.cap !== 'number') err(where, 'value.cap must be number or null');
  checkText(where, 'value.basis', v.basis, 500);
  if (typeof r.negative !== 'boolean') err(where, 'negative must be boolean');
  checkText(where, 'howTo', r.howTo, 600);
  if (!Array.isArray(r.bring)) err(where, 'bring must be an array'); else r.bring.forEach((b, i) => checkText(where, `bring[${i}]`, b, 220));
  if (r.blockouts != null) checkText(where, 'blockouts', r.blockouts, 300);
  if (r.validFrom != null && !isDate(r.validFrom)) err(where, 'validFrom must be YYYY-MM-DD or null');
  if (r.validTo != null && !isDate(r.validTo)) err(where, 'validTo must be YYYY-MM-DD or null');
  if (!REFRESH.includes(r.refresh)) err(where, `refresh '${r.refresh}' unknown`);
  if (!Array.isArray(r.sourceUrls) || !r.sourceUrls.length) err(where, 'sourceUrls must have at least one entry');
  else r.sourceUrls.forEach((s, i) => { if (!isUrl(s.url)) err(where, `sourceUrls[${i}].url bad: ${s.url}`); if (!s.title) err(where, `sourceUrls[${i}].title missing`); });
  if (!isDate(r.verifiedDate)) err(where, 'verifiedDate must be YYYY-MM-DD');
  if (!CONFIDENCE.includes(r.confidence)) err(where, `confidence '${r.confidence}' unknown`);
  if (r.provenance != null && r.provenance !== 'overview') err(where, 'provenance must be null or "overview"');
  if (r.states != null && (!Array.isArray(r.states) || r.states.some(s => !/^[A-Z]{2}$/.test(s)))) err(where, 'states must be null or an array of 2-letter codes');
  if (!Array.isArray(r.tags)) err(where, 'tags must be an array');
  if (r.todoUrl) err(where, 'todoUrl flag set: a source URL still needs to be filled');
}

for (const [file, name] of FILES) {
  if (only.length && !only.includes(file)) continue;
  const p = join(here, '..', 'data', file);
  if (!existsSync(p)) { console.log(`skip ${file} (not written yet)`); continue; }
  let mod;
  try { mod = await import(pathToFileURL(p).href); } catch (e) { err(file, `failed to import: ${e.message}`); continue; }
  const rows = mod[name];
  if (!Array.isArray(rows)) { err(file, `must export const ${name} = [...]`); continue; }
  rows.forEach(r => checkRow(r, file));
  console.log(`${file}: ${rows.length} rows`);
}

// Local layer
const localPath = join(here, '..', 'data', 'local.js');
if ((!only.length || only.includes('local.js')) && existsSync(localPath)) {
  try {
    const { LOCAL } = await import(pathToFileURL(localPath).href);
    let n = 0;
    for (const kind of ['tolls', 'airports']) {
      const map = LOCAL[kind] || {};
      for (const [st, rows] of Object.entries(map)) {
        if (!/^[A-Z]{2}$/.test(st)) err(`local.${kind}`, `bad state key ${st}`);
        rows.forEach(r => {
          n++;
          const where = `local.${kind}.${st}#${r.id}`;
          if (!r.id || ids.has(r.id)) err(where, 'id missing or duplicate'); else ids.set(r.id, 'local.js');
          if (r.state !== st) err(where, 'state must equal the map key');
          if (!['yes', 'no', 'partial', 'unverified'].includes(r.verdict)) err(where, `verdict '${r.verdict}' unknown`);
          checkText(where, 'rule', r.rule, 700);
          if (kind === 'tolls') { checkText(where, 'authority', r.authority, 120); if (r.enroll != null) checkText(where, 'enroll', r.enroll, 400); }
          else { if (!/^[A-Z]{3}$/.test(r.code || '')) err(where, 'airport code must be 3 letters'); checkText(where, 'name', r.name, 120); if (r.howTo != null) checkText(where, 'howTo', r.howTo, 400); }
          if (!Array.isArray(r.sourceUrls) || !r.sourceUrls.length) err(where, 'sourceUrls required'); else r.sourceUrls.forEach((s, i) => { if (!isUrl(s.url)) err(where, `sourceUrls[${i}].url bad`); });
          if (!isDate(r.verifiedDate)) err(where, 'verifiedDate must be YYYY-MM-DD');
          if (!CONFIDENCE.includes(r.confidence)) err(where, 'confidence unknown');
        });
      }
    }
    console.log(`local.js: ${n} rows`);
  } catch (e) { err('local.js', `failed to import: ${e.message}`); }
}

if (errors.length) { console.log(errors.join('\n')); console.log(`\n${errors.length} error(s) across ${total} rows`); process.exitCode = 1; }
else console.log(`OK: ${total} perk rows valid, ${ids.size} unique ids`);
