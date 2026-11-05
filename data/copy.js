// Veteran Perks & Travel Navigator — static copy. Mode briefs, button text, card and credential labels,
// confidence labels, FAQ (mirrors the FAQPage JSON-LD in index.html).

export const MODE_BRIEF = {
  travel: 'Planning a trip. We lead with lodging and tickets: the Armed Forces Recreation Centers and your rate category, Disney and Universal routed by which ID you hold, cruise lines, ski passes, the parks passes, and the hotel chains with a real veteran rate. The drawer asks how many nights and park days so the dollar figure is yours, not a brochure number.',
  everyday: 'Month-to-month money. We lead with the commissary and Exchange rule (service-connected at any rating since 2020), the retail and wireless programs confirmed on the retailer’s own page, and the memberships and services that take a DD-214. Enter your grocery, wireless, and home-improvement spend and the total builds from those.',
  card: 'The ID question. You tell us which IDs you hold today (a VHIC, a DoD ID card, a DD-214, a veteran-designated license) and we show what each one opens, what it does not, and which single ID would add the most. The common surprise: a 100% rating gets a DoD ID that opens Disney Salute and Hale Koa Rate II; a VHIC alone does not.',
  family: 'For caregivers, surviving spouses, and Gold Star families. We lead with what the VA caregiver letter opens on base, the Survivor Family Package at the military resorts, the Gold Star parks pass and PreCheck waiver, and the survivor rows most roundups skip.',
};
export const BTN_TEXT = { travel: 'Show What My ID Unlocks →', everyday: 'Show My Everyday Perks →', card: 'Show What Each ID Opens →', family: 'Show What We Qualify For →' };

export const CARD_TITLES = { unlocks: 'What your IDs unlock today', travel: 'Travel & lodging', tickets: 'Tickets & attractions', parks: 'Parks & outdoors', everyday: 'Everyday savings', road: 'On the road', federal: 'Status & federal', bring: 'What to bring' };

export const CRED_LABEL = {
  'dod-id': 'DoD ID card (DD 2, DD 1173, DD 2765, or Next Gen USID)',
  'vhic-marked': 'VHIC marked SERVICE CONNECTED, PURPLE HEART, or FORMER POW',
  'vhic-plain': 'VHIC with no marker',
  'h623a': 'HEC Form H623A (0% veterans who cannot enroll in VA health care)',
  'va-letter': 'VA benefit summary or service-connected letter (download at VA.gov)',
  'dd214': 'DD-214',
  'idme': 'ID.me verified account (free; takes a DD-214, VHIC, VIC, or veteran license)',
  'sheerid': 'SheerID verification at checkout (takes a DD-214 or veteran license)',
  'dv-plates': 'Disabled Veteran license plates',
  'state-dl-veteran': 'Veteran designation on your state driver’s license or ID',
  'caregiver-letter': 'VA caregiver (PCAFC) letter from the Office of Community Care',
  'military-pass': 'America the Beautiful Military Lifetime Pass',
  'access-pass': 'America the Beautiful Access Pass',
  'wesalute': 'WeSalute+ paid membership',
  'none': 'No card needed',
};
export const CRED_SHORT = { 'dod-id': 'DoD ID', 'vhic-marked': 'marked VHIC', 'vhic-plain': 'VHIC', 'h623a': 'Form H623A', 'va-letter': 'VA letter', 'dd214': 'DD-214', 'idme': 'ID.me', 'sheerid': 'SheerID', 'dv-plates': 'DV plates', 'state-dl-veteran': 'veteran license', 'caregiver-letter': 'caregiver letter', 'military-pass': 'Military Pass', 'access-pass': 'Access Pass', 'wesalute': 'WeSalute+', 'none': 'nothing' };
// How to get each card (the upgrade line and the printable page).
export const CRED_HOWTO = {
  'dod-id': 'Any 100% service-connected rating (schedular, temporary, or TDIU) qualifies. Make a RAPIDS appointment at an ID card office (idco.dmdc.osd.mil), bring the VA letter stating 100% service-connected, your DD-214, and two IDs. A temporary 100% card expires 60 days after your next VA re-exam date; a permanent one is indefinite. Dependents get their own card.',
  'vhic-marked': 'Enroll in VA health care (va.gov/health-care/apply) and request the Veteran Health Identification Card at your VA; the SERVICE CONNECTED, PURPLE HEART, or FORMER POW line prints under the photo when it is on your record.',
  'h623a': 'For 0% veterans who cannot enroll in VA health care: ask the Health Eligibility Center (877-222-8387) for Form H623A showing Priority Group 8E, and carry it with a REAL ID.',
  'va-letter': 'Sign in at va.gov/records/download-va-letters and download the Benefit Summary Letter or the service-connected disability letter. Print one; the registers on base need paper.',
  'idme': 'Create the account at id.me (free), verify with a DD-214, VHIC, VIC, or veteran-designated license once; it does not expire for veterans and retirees.',
  'sheerid': 'Nothing to get ahead of time; the store asks at checkout and takes a DD-214 or veteran license.',
  'state-dl-veteran': 'Ask your state DMV to add the veteran designation to your license or ID at your next renewal (most take a DD-214). It is on the National Park Service list of accepted IDs; the DD-214 itself is not.',
  'military-pass': 'Free. Get it in person at a federal recreation site with a VHIC, the VA digital Veteran ID, a DoD ID, or a veteran-designated license, or order the digital pass at recreation.gov (verified through ID.me; a plastic card is $7.50 shipping). The USGS Store charges $12.50 per order.',
  'access-pass': 'Free lifetime pass for a permanent disability (any percentage). Bring a VA Summary of Benefits or Award Letter to a federal site, or order online or by mail from the USGS Store ($12.50). It discounts camping at Corps of Engineers lakes by 50%; the Military Pass does not.',
  'dv-plates': 'Apply at your state DMV with the VA letter; most states key the plate to a rating threshold or the VA auto grant. Best State for Veterans lists your state’s rule.',
  'caregiver-letter': 'Issued by the VA Office of Community Care to Program of Comprehensive Assistance for Family Caregivers primary caregivers; it expires each December 31 (bring a REAL ID with it).',
  'wesalute': 'Paid: $59.95 the first year plus $4.95 processing, about $120 a year after. Worth it only if the rows it unlocks beat the fee at your spend; the page does that math.',
  'dd214': 'Request a copy from the National Archives (vetrecs.archives.gov) if yours is missing.',
  'none': '',
};

export const CONFIDENCE = {
  verified: { label: 'Verified', text: 'opened on the program’s own page, the statute, or the DoD or VA page on the date shown' },
  reported: { label: 'Reported', text: 'from a second-hand source or a page that would not state every detail; confirm before you go' },
  unverified: { label: 'Not yet verified', text: 'we found the program but could not open its page; ask them the question shown' },
};

export const STATUS_LABEL = { active: 'Active duty', retiree: 'Military retiree', 'guard-reserve': 'Guard or Reserve', 'veteran-unrated': 'Veteran, no rating', 'sc-0': '0% service-connected', 'sc-10-90': '10% to 90% service-connected', 'sc-100': '100% service-connected', 'purple-heart': 'Purple Heart', pow: 'Former POW', moh: 'Medal of Honor', 'gold-star': 'Gold Star family', caregiver: 'VA family caregiver (PCAFC)', 'surviving-spouse': 'Surviving spouse', 'dod-civilian': 'DoD civilian' };

export const ASSUMPTION_LABEL = { nightsPerYear: 'nights at a military resort per year', hotelNights: 'hotel nights per year', parkDays: 'museum, zoo, or attraction visits per year', groceriesMonthly: 'groceries per month', improvementYearly: 'home-improvement spend per year', wirelessMonthly: 'wireless bill per month', rentalDays: 'rental-car days per year', flightsYearly: 'flights per year', airportDays: 'airport parking days per year', skiDays: 'ski days per year', cruiseSpend: 'cruise fare per year', newCar: 'buying a new vehicle this year', apparelYearly: 'clothing and gear spend per year', diningYearly: 'dining out per year' };

export const FAQ = [
  ['Can disabled veterans stay at Hale Koa and Shades of Green?', 'Yes, at any service-connected rating, since January 1, 2020. A veteran with a Veteran Health Identification Card marked SERVICE CONNECTED, PURPLE HEART, or FORMER POW books at Rate III (Hale Koa) or Category 3 (Shades of Green), with a REAL ID or passport. A veteran rated 100% who holds a DoD ID card (DD 1173 or DD 2765) books at Rate II, the same category as E-7 to E-9. Dragon Hill Lodge in Seoul accepts the marked VHIC or a current VA service-connected letter; Edelweiss in Germany and The New Sanno in Tokyo do not admit VHIC-only veterans. A 0% veteran without a VHIC can use HEC Form H623A at Shades of Green; Hale Koa’s pages do not mention it.'],
  ['Does a 100% disabled veteran get the Disney military discount?', 'Only with a DoD ID card. Disney’s Armed Forces Salute tickets (4-Day Park Hopper from about $405 at Shades of Green in 2026) are sold to active, retired, and 100% disabled service members who hold a Uniformed Services ID card; Shades of Green’s page says “Disney will not accept a VHIC or benefits paperwork.” Any 100% service-connected rating qualifies for the DoD ID card at a RAPIDS ID office. Veterans rated below 100% can still buy Disney’s non-promotional military tickets through Shades of Green, about 10% off one- and two-day tickets and about 20% off three days or more, tax-free, with no limit.'],
  ['Can service-connected veterans shop at the commissary?', 'Yes. Under 10 U.S.C. 1065, since January 1, 2020, veterans with any service-connected rating, Purple Heart recipients, former prisoners of war, and VA family caregivers can shop the commissary and Exchange and use MWR retail facilities on base in the United States and its territories. The ID is a VHIC with the status printed under the photo; a veteran without a VHIC can use the VA service-connected letter or Form H623A with a REAL ID. Veterans rated 100% should get the DoD ID card instead, which also covers family members. The Defense Commissary Agency puts average U.S. savings at 21.3%; a card fee of 1.43% (credit) or 0.36% (PIN debit) applies to these patrons unless they pay cash, EBT, or MILITARY STAR.'],
  ['Is the national parks pass free for veterans?', 'Yes. The America the Beautiful Military Lifetime Pass is free for veterans and Gold Star families, in person at a federal site or as a digital pass at recreation.gov. Accepted proof is a VHIC, the VA’s digital Veteran ID Card, a DoD ID, or a veteran designation on a state driver’s license; a DD-214 is not on the list. It covers entrance and day-use fees but not camping. A veteran with a permanent disability of any percentage can also get the free Access Pass, which takes a VA award letter and discounts camping at Corps of Engineers lakes by 50%, so a rated veteran who camps should carry both.'],
  ['What is the difference between a VHIC and a DoD ID card?', 'The VHIC is the VA’s health card. With SERVICE CONNECTED, PURPLE HEART, or FORMER POW printed on it, it opens the commissary, Exchange, and MWR under the 2020 expansion and books the military resorts at Rate III, but it does not open Disney’s Salute tickets, Universal’s Freedom Pass, Space-A flights, USO centers, or the European and Japanese military lodges, and it does nothing for your family. The DoD ID card (DD 1173, DD 2765, or the Next Generation USID) is issued to veterans rated 100% service-connected, including temporary and TDIU ratings, and opens all of those plus ID cards for dependents. Space-A travel is the one benefit that needs a permanent and total rating by statute.'],
];
