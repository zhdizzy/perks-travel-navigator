/**
 * Veteran Perks & Travel Navigator headless smoke test (house pattern from property-tax).
 * Run from tbv-tools/:  node perks-travel/test/smoke.mjs   (port 8921)
 * Serves tbv-tools/ so the cross-tool script (/state-benefits/data/normalized-data.js) resolves like production.
 * Scans Chrome stderr for Uncaught/ReferenceError on the clean URL AND share-param URLs (TDZ rule).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import process from 'node:process';

const execFileP = promisify(execFile);
const PORT = 8921;
const BASE = `http://localhost:${PORT}/perks-travel/`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHARE = '?m=travel&g=veteran&r=100&pt=1&c=dd214.dod-id.vhic-marked&st=FL&source=perks-travel';
const SHARE_VHIC = '?m=card&g=veteran&r=60&c=dd214.vhic-marked&st=TX&a=groceriesMonthly:800&source=perks-travel';
const SHARE_FAMILY = '?m=family&g=caregiver.surviving-spouse&c=caregiver-letter&st=CA&source=perks-travel';
const SHARE_UNRATED = '?m=everyday&g=veteran&r=unrated&c=dd214&st=NY&source=perks-travel';

let failures = 0;
const check = (ok, label, extra = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`); };
async function chrome(url, extra = []) {
  const { stdout, stderr } = await execFileP(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--enable-logging=stderr', '--v=0', '--virtual-time-budget=9000', '--dump-dom', ...extra, url], { maxBuffer: 80 * 1024 * 1024 }).catch(e => e);
  const errors = (stderr || '').split('\n').filter(l => /Uncaught|ReferenceError|TypeError|SyntaxError|Failed to load module/.test(l));
  return { dom: stdout || '', errors };
}

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(PORT, r));
process.on('exit', () => server.close());

try {
  const first = await chrome(BASE);
  check(first.errors.length === 0, 'first visit: no console errors', first.errors.slice(0, 3).join(' | '));
  check(/id="tour-root"(?![^>]*hidden)/.test(first.dom), 'tour auto-starts on first visit');
  check(/Step 1 of 7/.test(first.dom), 'tour step label renders');
  check(/__pkArrivalHadParams/.test(first.dom), 'arrival-params snippet present');
  check(/"FAQPage"/.test(first.dom) && /"WebApplication"/.test(first.dom), 'JSON-LD present');
  check(/G-HG7N8F337G/.test(first.dom), 'GA4 present');
  check(/<h1>Veteran Perks &amp; Travel Navigator<\/h1>/.test(first.dom), 'static h1');
  check(/id="about-this-tool"/.test(first.dom) && /id="how-it-works"/.test(first.dom), 'GEO sections present');
  check((first.dom.match(/<option value="[A-Z]{2}">/g) || []).length === 55, '55 jurisdictions in the select', String((first.dom.match(/<option value="[A-Z]{2}">/g) || []).length));
  check(/id="results-container"[^>]*style="display:none;"/.test(first.dom), 'results gated on first visit');
  check(/Required to run|perks? unlocked/.test(first.dom), 'live strip renders');
  check(/More Free Veteran Tools/.test(first.dom), 'footer present');
  check(/Can disabled veterans stay at Hale Koa and Shades of Green\?/.test(first.dom), 'visible FAQ rendered');
  check(!/[—–]/.test(first.dom.replace(/<script[\s\S]*?<\/script>/g, '')), 'no em/en dashes in rendered copy');

  const share = await chrome(BASE + SHARE);
  check(share.errors.length === 0, 'share link (100% P&T, DoD ID, FL): no console errors', share.errors.slice(0, 3).join(' | '));
  check(/id="tour-root"[^>]*hidden/.test(share.dom), 'tour does NOT auto-run for share arrivals');
  check(/id="results-container"[^>]*style="display:\s*block;"/.test(share.dom), 'share link reveals results');
  check(/id="hero-capture"[^>]*style="display:\s*block;"/.test(share.dom), 'hero capture shown at the result moment');
  for (const id of ['unlocks', 'travel', 'tickets', 'parks', 'everyday', 'road', 'federal', 'bring']) check(new RegExp(`id="card-${id}"`).test(share.dom), `card-${id} rendered`);
  check(/Disney Armed Forces Salute/i.test(share.dom) && /Unlocked<\/span>/.test(share.dom), 'Disney Salute row unlocked for DoD ID holder');
  check(/MCO/.test(share.dom) && /Orlando/.test(share.dom), 'FL airport rows rendered');
  check(/WHAT TO BRING/.test(share.dom), 'what-to-bring sheet rendered');
  check(!/undefined|NaN|\[object Object\]/.test(share.dom.replace(/<script[\s\S]*?<\/script>/g, '')), 'no undefined/NaN in rendered DOM');

  const vhic = await chrome(BASE + SHARE_VHIC);
  check(vhic.errors.length === 0, 'share link (60% VHIC, TX): no console errors', vhic.errors.slice(0, 3).join(' | '));
  check(/Get the ID<\/span>/.test(vhic.dom) || /Not for your ID<\/span>/.test(vhic.dom), 'VHIC-only profile shows get-the-ID or myth rows');
  check(/NTTA/.test(vhic.dom), 'TX toll rows rendered');
  check(/Texas state parks/.test(vhic.dom), 'Best State parks line read live for TX');

  const fam = await chrome(BASE + SHARE_FAMILY);
  check(fam.errors.length === 0, 'share link (family): no console errors', fam.errors.slice(0, 3).join(' | '));
  check(/Survivor Family Package|caregiver/i.test(fam.dom), 'family rows rendered');

  const srch = await chrome(BASE + SHARE_VHIC + '&q=Disney');
  check(srch.errors.length === 0, 'share link with a search (60% VHIC, q=Disney): no console errors', srch.errors.slice(0, 3).join(' | '));
  check(/id="perk-search-results"[^>]*>\s*<p class="ps-head">/.test(srch.dom), 'search results render from the q param');
  check(/Not for you<\/span>/.test(srch.dom) && /Why not:/.test(srch.dom) && /Closest thing open to you/.test(srch.dom), 'search shows a not-for-you row with the reason and the closest alternative');
  check(/id="perk-search-input"/.test(first.dom) && /id="perk-search-results"[^>]*><\/div>/.test(first.dom), 'search box present and empty before results');

  const un = await chrome(BASE + SHARE_UNRATED);
  check(un.errors.length === 0, 'share link (unrated, NY): no console errors', un.errors.slice(0, 3).join(' | '));
  check(/Thruway/.test(un.dom), 'NY Thruway row rendered');
} finally { server.close(); }

console.log(failures === 0 ? 'ALL SMOKE CHECKS PASSED' : `${failures} smoke check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
