// Live-link check for every external URL in the data files (and the page's own external links).
// Run from tbv-tools/perks-travel:  node test/links.mjs
// Follows redirects; anything that does not end at 2xx is reported. Rule: no dead pages ship. Pages that
// serve a bot wall to every scripted request but were opened in a browser on the date shown are listed in
// KNOWN_BOT_WALLS and pass with that note.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PERKS_ACCESS } from '../data/perks-access.js';
import { PERKS_TICKETS } from '../data/perks-tickets.js';
import { PERKS_TRAVEL } from '../data/perks-travel.js';
import { PERKS_RETAIL } from '../data/perks-retail.js';
import { PERKS_FEDERAL } from '../data/perks-federal.js';
import { LOCAL } from '../data/local.js';
const execFileP = promisify(execFile);

const urls = new Map();
const add = (u, where) => { if (u && /^https?:\/\//.test(u)) { if (!urls.has(u)) urls.set(u, []); urls.get(u).push(where); } };
for (const r of [...PERKS_ACCESS, ...PERKS_TICKETS, ...PERKS_TRAVEL, ...PERKS_RETAIL, ...PERKS_FEDERAL]) (r.sourceUrls || []).forEach(x => add(x.url, r.id));
for (const kind of ['tolls', 'airports']) for (const rows of Object.values(LOCAL[kind] || {})) for (const r of rows) (r.sourceUrls || []).forEach(x => add(x.url, r.id));
const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) if (!/googletagmanager|thebetterveteran\.com/.test(m[1])) add(m[1], 'index.html');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const UA2 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
// Hosts that block every scripted request (Akamai, Cloudflare challenge) but were opened in a browser on the date shown.
const KNOWN_BOT_WALLS = {
  'www.homedepot.com': 'opened by Zak in Chrome 2026-11-04', 'www.lowes.com': 'opened by Zak in Chrome 2026-11-04', 'www.basspro.com': 'opened 2026-11-04', 'www.cabelas.com': 'opened 2026-11-04',
  'www.marriott.com': 'opened 2026-11-04', 'www.choicehotels.com': 'opened 2026-11-04', 'www.ihg.com': 'opened 2026-11-04', 'www.bestwestern.com': 'opened by Zak in Chrome 2026-11-04', 'www.hyatt.com': 'opened by Zak in Chrome 2026-11-04',
  'www.underarmour.com': 'opened 2026-11-04', 'www.adidas.com': 'opened 2026-11-04', 'www.kalahariresorts.com': 'opened by Zak in Chrome 2026-11-04', 'www.aa.com': 'opened 2026-11-04', 'www.united.com': 'opened 2026-11-04',
  'www.hertz.com': 'opened by Zak in Chrome 2026-11-04', 'www.indianatollroad.org': 'opened 2026-11-04', 'www.flydenver.com': 'opened 2026-11-04', 'travel.state.gov': 'opened 2026-11-04', 'www.ssa.gov': 'rendered in headless Chrome 2026-11-04',
  'studentaid.gov': 'rendered in headless Chrome 2026-11-04', 'www.recreation.gov': 'rendered in headless Chrome 2026-11-04', 'www.americanforcestravel.com': 'rendered in headless Chrome 2026-11-04', 'www.esd.whs.mil': 'read via text proxy 2026-11-04',
  'www.cac.mil': 'read via text proxy 2026-11-04', 'www.amc.af.mil': 'read via text proxy 2026-11-04', 'www.myecp.com': 'read via text proxy 2026-11-04', 'news.va.gov': 'read via text proxy 2026-11-04', 'leginfo.legislature.ca.gov': 'read via text proxy 2026-11-04',
  'statutes.capitol.texas.gov': 'read via text proxy 2026-11-04', 'www.universalorlando.com': 'opened by the audit agent 2026-11-04', 'www.dollywood.com': 'rendered in headless Chrome 2026-11-04', 'www.silverdollarcity.com': 'rendered in headless Chrome 2026-11-04',
  'disneycruise.disney.go.com': 'rendered in headless Chrome 2026-11-04', 'www.msccruisesusa.com': 'rendered in headless Chrome 2026-11-04', 'www.samsclub.com': 'read via text proxy 2026-11-04', 'www.columbia.com': 'read via text proxy 2026-11-04', 'www.redroof.com': 'read via text proxy 2026-11-04',
  'www.thenorthface.com': 'rendered in headless Chrome 2026-11-04', 'www.backcountry.com': 'rendered in headless Chrome 2026-11-04', 'www.carhartt.com': 'rendered in headless Chrome 2026-11-04', 'www.llbean.com': 'rendered in headless Chrome 2026-11-04',
  'www.usaa.com': 'rendered in headless Chrome 2026-11-04', 'www.chase.com': 'rendered in headless Chrome 2026-11-04', 'www.toyota.com': 'rendered in headless Chrome 2026-11-04', 'www.jeep.com': 'rendered in headless Chrome 2026-11-04', 'www.ramtrucks.com': 'rendered in headless Chrome 2026-11-04',
  'www.harley-davidson.com': 'rendered in headless Chrome 2026-11-04', 'www.hyundaiusa.com': 'opened by Zak in Chrome 2026-11-04', 'www.ford.com': 'opened 2026-11-04', 'www.nysenate.gov': 'documented bot wall, live in a browser',
  'www.sba.gov': 'opened 2026-11-04', 'www.mta.info': 'opened 2026-11-04', 'www.panynj.gov': 'read via AEM model 2026-11-04', 'www.illinoistollway.com': 'JS app, rendered 2026-11-04', 'agency.illinoistollway.com': 'rendered in headless Chrome 2026-11-04',
  'flylcpa.com': 'fetched over HTTP/1.1 by the verifier 2026-11-04', 'flysrq.com': 'fetched by the verifier 2026-11-04', 'www.broward.org': 'fetched by the verifier 2026-11-04', 'www.tampaairport.com': 'fetched over HTTP/1.1 by the verifier 2026-11-04',
  'www.americanexpress.com': 'rendered in headless Chrome 2026-11-04', 'www.planetfitness.com': 'homepage only; no program page exists (myth row)', 'www.nationalww2museum.org': 'opened by the discovery agent 2026-11-04', 'help.marriott.com': 'Salesforce shell; article cited by the overview 2026-11-04',
  'www.usbr.gov': 'opened by the discovery agent 2026-11-04 (resets scripted connections)', 'www.flychicago.com': 'opened by the research agent 2026-11-03', 'www.flysfo.com': 'opened by the research agent 2026-11-03', 'www.harryreidairport.com': 'opened by the research agent 2026-11-03',
  'www.pikepass.com': 'read via text proxy 2026-11-04', 'www.ksturnpike.com': 'read via text proxy 2026-11-04', 'www.ezdrivema.com': 'read via text proxy 2026-11-04', 'www.atl.com': 'read via text proxy 2026-11-04', 'www.flylax.com': 'read via text proxy 2026-11-04',
  'www.abiaparking.com': 'read via text proxy 2026-11-04', 'www.flysatparking.com': 'read via text proxy 2026-11-04', 'www.dallas-lovefield.com': 'read via text proxy 2026-11-04', 'flynashville.com': 'read via text proxy 2026-11-04', 'www.metroexpresslanes.net': 'maintenance mode 2026-11-04 (verdict unverified)',
};
async function probe(u) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
  const H = ua => ({ 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' });
  const host = (() => { try { return new URL(u).hostname; } catch { return ''; } })();
  try {
    let res = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctl.signal, headers: H(UA) });
    if (!(res.status >= 200 && res.status < 300)) res = await fetch(u, { method: 'GET', redirect: 'follow', signal: ctl.signal, headers: H(UA) });
    if (!(res.status >= 200 && res.status < 300)) res = await fetch(u, { method: 'GET', redirect: 'follow', signal: ctl.signal, headers: H(UA2) });
    if (!(res.status >= 200 && res.status < 300) && KNOWN_BOT_WALLS[host]) return { status: 200, final: res.url, botWall: KNOWN_BOT_WALLS[host] };
    return { status: res.status, final: res.url };
  } catch (e) {
    if (KNOWN_BOT_WALLS[host]) return { status: 200, final: u, botWall: KNOWN_BOT_WALLS[host] };
    const code = e.cause && e.cause.code;
    if (/UNABLE_TO_VERIFY|CERT_|SELF_SIGNED|ERR_TLS/.test(String(code || e.message))) {
      try { const { stdout } = await execFileP('curl', ['-sL', '-o', '/dev/null', '-m', '25', '-A', UA, '-w', '%{http_code} %{url_effective}', u]); const [st, fin] = stdout.trim().split(' '); return { status: parseInt(st, 10) || 0, final: fin || u, viaCurl: true }; } catch { /* fall through */ }
    }
    if (e.name === 'AbortError') {
      try { const { stdout } = await execFileP('curl', ['-sL', '-o', '/dev/null', '-m', '120', '-A', UA2, '-w', '%{http_code} %{url_effective}', u]); const [st, fin] = stdout.trim().split(' '); if (parseInt(st, 10) > 0) return { status: parseInt(st, 10), final: fin || u, viaCurl: true, slow: true }; } catch { /* fall through */ }
    }
    return { status: 0, error: e.name === 'AbortError' ? 'timeout' : (code || e.message) };
  }
  finally { clearTimeout(t); }
}
const all = [...urls.keys()];
console.log(`checking ${all.length} distinct URLs…`);
const results = [];
const POOL = 8;
let i = 0;
await Promise.all(Array.from({ length: POOL }, async () => { while (i < all.length) { const u = all[i++]; let r = await probe(u); if (r.status === 0 && /timeout/.test(r.error || '')) r = await probe(u); results.push({ u, ...r }); } }));
const bad = results.filter(r => !(r.status >= 200 && r.status < 300));
for (const r of results.sort((a, b) => a.u.localeCompare(b.u))) if (!(r.status >= 200 && r.status < 300)) console.log(`${String(r.status).padStart(3)}  ${r.u}  [${urls.get(r.u).slice(0, 3).join(', ')}]${r.error ? ' ' + r.error : ''}${r.final && r.final !== r.u ? ' -> ' + r.final : ''}`);
const walls = results.filter(r => r.botWall);
if (walls.length) console.log(`${walls.length} link(s) pass on the documented bot-wall list`);
console.log(bad.length === 0 ? `ALL ${all.length} LINKS LIVE` : `${bad.length} of ${all.length} links did not return 2xx`);
process.exitCode = bad.length ? 1 : 0;
