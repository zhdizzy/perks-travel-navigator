// One-shot: swap short or wrong source URLs for the full paths the research agents opened (11/3 to 11/4).
import { readFileSync, writeFileSync } from 'node:fs';
const MAP = {
  'https://bigbearmountainresort.com/military': 'https://www.bigbearmountainresort.com/deals-and-discounts/military',
  'https://bigskyresort.com/military-lift-tickets/validate': 'https://www.bigskyresort.com/winter-tickets/military-lift-tickets/validate',
  'https://myarmybenefits.us.army.mil/Benefit-Library/Federal-Benefits/Disability-Severance-Pay': 'https://myarmybenefits.us.army.mil/Benefit-Library/Federal-Benefits/DoD-Disability-Severance-Pay-?serv=122',
  'https://pearlharboraviationmuseum.org/tickets': 'https://www.pearlharboraviationmuseum.org/tickets/',
  'https://shop.alta.com/military-season-pass': 'https://shop.alta.com/products/military-season-pass',
  'https://topgolf.com/heroes-program': 'https://topgolf.com/us/promo/heroes-program/',
  'https://www.aqua.org/special-offers': 'https://aqua.org/visit/special-offers',
  'https://www.biltmore.com/special-offers': 'https://www.biltmore.com/visit/tickets-pricing/special-offers/',
  'https://www.celebritycruises.com/military-cruise-deal': 'https://www.celebritycruises.com/cruise-deals/military-cruise-deal',
  'https://www.flychicago.com/midway/parking': 'https://www.flychicago.com/',
  'https://www.flychicago.com/ohare/parking': 'https://www.flychicago.com/',
  'https://www.flysfo.com/travel/parking': 'https://www.flysfo.com/',
  'https://www.harryreidairport.com/Parking': 'https://www.harryreidairport.com/',
  'https://www.hollandamerica.com/military-appreciation-offer': 'https://www.hollandamerica.com/en/us/cruise-deals/community-appreciation-cruise-offers/military-appreciation-offer',
  'https://www.kennedyspacecenter.com/tickets': 'https://www.kennedyspacecenter.com/info/tickets/',
  'https://www.midway.org/buy-tickets': 'https://www.midway.org/visit/buy-tickets',
  'https://www.midway.org/special-offers': 'https://www.midway.org/visit/special-offers',
  'https://www.nationalww2museum.org/plan-your-visit': 'https://www.nationalww2museum.org/visit/plan-your-visit',
  'https://www.palisadestahoe.com/military-passes': 'https://www.palisadestahoe.com/plan-your-visit/tickets-and-passes/military-passes',
  'https://www.princess.com/military-benefit-program': 'https://www.princess.com/cruise-deals-promotions/military-benefit-program',
  'https://www.reaganfoundation.org/plan-your-visit': 'https://www.reaganfoundation.org/library-museum/plan-your-visit',
  'https://www.sugarbush.com/redemption-details': 'https://www.sugarbush.com/plan-your-trip/lift-tickets/redemption-details',
  'https://www.sunvalley.com/military-benefits': 'https://www.sunvalley.com/tickets-passes/military-benefits/',
  'https://www.virginiadot.org/travel/toll-roads.asp': 'https://www.vdot.virginia.gov/',
};
let n = 0;
for (const f of ['perks-access.js', 'perks-tickets.js', 'perks-travel.js', 'perks-retail.js', 'perks-federal.js', 'local.js']) {
  const p = new URL('../data/' + f, import.meta.url); let s = readFileSync(p, 'utf8'); const o = s;
  for (const [a, b] of Object.entries(MAP)) { const parts = s.split(`'${a}'`); if (parts.length > 1) { n += parts.length - 1; s = parts.join(`'${b}'`); } }
  if (s !== o) writeFileSync(p, s);
}
console.log(n + ' url(s) replaced');
