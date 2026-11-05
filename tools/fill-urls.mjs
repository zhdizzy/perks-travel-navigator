// One-shot: replace placeholder sourceUrls on rows the data agents flagged with todoUrl, using the page
// URLs the research agents actually opened on 11/3 to 11/4. Run from perks-travel: node tools/fill-urls.mjs
// Idempotent: a row without the id in the map is left alone; the todoUrl flag is removed wherever a map hit lands.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const U = (url, title) => ({ url, title });
const GUIDE = U('https://www.wesalute.com/blog/discounts-benefits/review-ultimate-traveler-guide-military-veteran-flight-discounts', 'WeSalute flight-discount guide (June 29, 2026)');
const MAP = {
  // access
  'acc-air-force-inns': [U('https://af.dodlodging.net/', 'Air Force Inns'), U('https://dodlodging.net/', 'DoD Lodging')],
  'acc-dragon-hill-lodge': [U('https://www.dragonhilllodge.com/about-dragon-hill-lodge/eligibility', 'Dragon Hill Lodge eligibility (8 Jun 2026)'), U('https://www.dragonhilllodge.com/rooms-and-suites', 'Dragon Hill Lodge rooms and suites (28 Oct 2026)'), U('https://www.halekoa.com/about-hale-koa-hotel/eligibility', 'Hale Koa eligibility (lists Dragon Hill as a DVEAA property)')],
  'acc-edelweiss': [U('https://www.edelweisslodgeandresort.com/your-stay/eligibility', 'Edelweiss eligibility (4 Jun 2026)'), U('https://www.edelweisslodgeandresort.com/your-stay/installation-access-control-system', 'Edelweiss installation access and eligibility graphic (8 Oct 2026)')],
  'acc-inns-of-the-corps': [U('https://www.innsofthecorps.com/', 'Inns of the Corps eligibility and priorities')],
  'acc-new-sanno': [U('https://www.thenewsanno.com/accommodations/eligibility', 'The New Sanno eligibility'), U('https://www.thenewsanno.com/accommodations/guest-room-rates', 'The New Sanno guest room rates (effective 1 Oct 2026)')],
  'acc-shades-of-green': [U('https://www.shadesofgreen.org/about-shades-green/eligibility', 'Shades of Green eligibility (5 Aug 2026)'), U('https://www.shadesofgreen.org/rooms', 'Shades of Green rooms and rate categories (5 Oct 2026)'), U('https://www.shadesofgreen.org/special-offers/monthly-specials/equal-access', 'Shades of Green Equal Access (VHIC and H623A) page (5 Aug 2026)')],
  'acc-shades-of-green-salute-veterans': [U('https://www.shadesofgreen.org/special-offers/monthly-specials/salute-our-veterans', 'Shades of Green Salute to Our Veterans (19 Jan 2024)')],
  // local: airports
  'air-az-phx': [U('https://www.skyharbor.com/parking', 'Sky Harbor parking')],
  'air-ca-sfo': [U('https://www.flysfo.com/travel/parking', 'SFO parking')],
  'air-co-den': [U('https://www.flydenver.com/parking', 'Denver International Airport parking')],
  'air-fl-jax': [U('https://www.flyjacksonville.com/content.aspx?id=433', 'JAX parking (page stamp 11/4/2026)'), U('http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/0316/Sections/0316.1964.html', 'F.S. 316.1964 (2026 statutes)')],
  'air-fl-mco': [U('https://flymco.com/parking-information/', 'MCO parking information (2026)'), U('http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/0316/Sections/0316.1964.html', 'F.S. 316.1964 (2026 statutes)')],
  'air-fl-mia': [U('https://www.miami-airport.com/airport-parking.asp', 'MIA airport parking')],
  'air-fl-pbi': [U('https://flydjt.org/new-parking/', 'PBI parking (flydjt.org, 2026)')],
  'air-fl-pns': [U('https://www.flypensacola.com/parking', 'PNS parking')],
  'air-fl-rsw': [U('https://flylcpa.com/parking/', 'RSW parking (2026)')],
  'air-fl-srq': [U('https://flysrq.com/parking', 'SRQ parking (no DV text)'), U('http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/0316/Sections/0316.1964.html', 'F.S. 316.1964 (2026 statutes)')],
  'air-fl-tpa': [U('https://www.tampaairport.com/news/accessible-parking-tpa', 'TPA accessible parking (2026)')],
  'air-il-mdw': [U('https://www.flychicago.com/midway/parking', 'Midway parking')],
  'air-il-ord': [U('https://www.flychicago.com/ohare/parking', 'O’Hare parking')],
  'air-ma-bos': [U('https://www.massport.com/logan-airport/to-from-logan/parking', 'Logan parking (Massport)')],
  'air-md-bwi': [U('https://www.bwiairport.com/parking', 'BWI parking')],
  'air-mn-msp': [U('https://www.mspairport.com/parking', 'MSP parking (updated 11/3/2026)')],
  'air-nc-clt': [U('https://www.cltairport.com/parking', 'CLT parking')],
  'air-nj-ewr': [U('https://www.newarkairport.com/to-from-airport/parking', 'Newark parking')],
  'air-nv-las': [U('https://www.harryreidairport.com/Parking', 'Harry Reid airport parking (2026)')],
  'air-ny-jfk': [U('https://www.jfkairport.com/to-from-airport/parking', 'JFK parking')],
  'air-ny-lga': [U('https://www.laguardiaairport.com/to-from-airport/parking', 'LaGuardia parking')],
  'air-or-pdx': [U('https://www.flypdx.com/parking', 'PDX parking (2026)')],
  'air-tx-dal': [U('https://www.dallas-lovefield.com/passenger-services/parking-and-transportation/garages-valet/veterans-parking-information', 'Dallas Love Field veterans parking')],
  'air-tx-hou': [U('https://www.fly2houston.com/hou/parking', 'Houston Airports HOU parking (2026)')],
  'air-tx-iah': [U('https://www.fly2houston.com/iah/parking', 'Houston Airports IAH parking (2026)')],
  'air-ut-slc': [U('https://slcairport.com/parking/disabled-veteran-parking/', 'SLC disabled veteran parking (eff. 7/1/2024)')],
  'air-va-dca': [U('https://www.flyreagan.com/parking', 'DCA parking (MWAA)')],
  'air-va-iad': [U('https://www.flydulles.com/parking', 'IAD parking (MWAA)')],
  'air-wa-sea': [U('https://www.portseattle.org/sea-tac/parking', 'SEA parking (Port of Seattle)')],
  // local: tolls
  'toll-ca-405-express': [U('https://405expresslanes.com/en/support-center/all-support-topics/tolls-and-discounts/what-type-of-veteran-license-plates-get-a-discount-on-the-405-express-lanes', '405 Express Lanes veteran plates FAQ')],
  'toll-ca-bay-area-bridges': [U('https://www.bayareafastrak.org/en/support/toll-bridges-faq11.shtml', 'Bay Area FasTrak toll bridges FAQ'), U('https://california.public.law/codes/ca_veh_code_section_23301.3', 'Cal. Veh. Code 23301.3')],
  'toll-ca-i15-express': [U('https://sandag.org/projects-and-programs/roads-and-highways/fastrak/veterans-toll-exemption-program', 'SANDAG veterans toll exemption program')],
  'toll-ca-sr125': [U('https://sandag.org/projects-and-programs/roads-and-highways/fastrak/veterans-toll-exemption-program', 'SANDAG veterans toll exemption program')],
  'toll-ca-la-metro-expresslanes': [U('https://www.metroexpresslanes.net/faq/', 'Metro ExpressLanes FAQ (site in maintenance mode 11/4/2026)')],
  'toll-ca-the-toll-roads': [U('https://thetollroads.com/driving-the-toll-roads/tolling-accounts/frequent-driver-discount-programs', 'The Toll Roads discount programs'), U('https://california.public.law/codes/ca_veh_code_section_23301.3', 'Cal. Veh. Code 23301.3')],
  'toll-co-statewide': [U('https://e470.com/faq/', 'E-470 FAQ (2026)'), U('https://nwpky.com/?p=785', 'Northwest Parkway rates (eff. 5/1/2026)'), U('https://www.codot.gov/programs/expresslanes', 'CDOT Express Lanes')],
  'toll-ga-peach-pass': [U('https://www.peachpass.com/faqs/', 'Peach Pass FAQs (2026)')],
  'toll-md-driveezmd': [U('https://driveezmd.com/?p=1825', 'DriveEzMD discount plans')],
  'toll-nj-statewide': [U('https://www.ezpassnj.com/', 'E-ZPass New Jersey'), U('https://pub.njleg.state.nj.us/Bills/2026/S4000/3725_I1.HTM', 'NJ S3725 (introduced 3/5/2026)')],
  'toll-ny-crz': [U('https://www.mta.info/fares-tolls/tolls/congestion-relief-zone/discounts-exemptions', 'MTA Congestion Relief Zone discounts and exemptions')],
  'toll-ny-mta': [U('https://www.mta.info/tolls/resident-programs', 'MTA Bridges and Tunnels resident programs (updated 1/12/2026)')],
  'toll-ny-port-authority': [U('https://www.panynj.gov/bridges-tunnels/en/tolls.html', 'Port Authority tolls (July 2026 rates)')],
  'toll-ny-thruway': [U('https://www.thruway.ny.gov/ezpass/veterans.html', 'Thruway E-ZPass for disabled veterans'), U('https://dmv.ny.gov/more-info/information-for-military-and-veterans', 'NY DMV information for military and veterans')],
  'toll-oh-turnpike': [U('https://www.ohioturnpike.org/e-zpass/faq', 'Ohio Turnpike E-ZPass FAQ')],
  'toll-pa-turnpike': [U('https://www.paturnpike.com/e-zpass', 'PA Turnpike E-ZPass FAQ (modified 3/18/2025)')],
  'toll-tx-ctrma': [U('https://www.mobilityauthority.com/', 'Central Texas Regional Mobility Authority (veterans program expanded 9/1/2025)'), U('https://www.txdot.gov/discover/toll-roads-managed-lanes/programs/txdot-veterans-discount-program.html', 'TxDOT veterans discount program (operator table)')],
  'toll-tx-fbctra': [U('https://www.fbctra.com/', 'Fort Bend County Toll Road Authority (veterans page 9/19/2024)'), U('https://www.txdot.gov/discover/toll-roads-managed-lanes/programs/txdot-veterans-discount-program.html', 'TxDOT veterans discount program (operator table)')],
  'toll-tx-hctra': [U('https://www.hctra.org/', 'Harris County Toll Road Authority (policy PL0051, form FM0204)'), U('https://www.txdot.gov/discover/toll-roads-managed-lanes/programs/txdot-veterans-discount-program.html', 'TxDOT veterans discount program (operator table)')],
  'toll-tx-private-sh130-lbj-nte': [U('https://www.txdot.gov/discover/toll-roads-managed-lanes/programs/txdot-veterans-discount-program.html', 'TxDOT veterans discount program (operator table, 2026)')],
  'toll-tx-txdot': [U('https://www.txdot.gov/discover/toll-roads-managed-lanes/programs/txdot-veterans-discount-program.html', 'TxDOT veterans discount program (2026, map 08/2026)'), U('https://statutes.capitol.texas.gov/Docs/TN/htm/TN.372.htm', 'Tex. Transp. Code ch. 372 (shows the SB 2001 amendment)')],
  'toll-va-statewide': [U('https://law.lis.virginia.gov/vacode/title33.2/chapter6/section33.2-613/', 'Va. Code 33.2-613'), U('https://www.virginiadot.org/travel/toll-roads.asp', 'VDOT toll roads')],
  'toll-wa-wsdot': [U('https://wsdot.wa.gov/travel/roads-bridges/toll-roads-bridges-tunnels/toll-exemptions-and-discounts', 'WSDOT toll exemptions and discounts')],
  // travel
  'trv-aa-vacations-wesalute': [U('https://www.wesalute.com/get-american-airlines', 'WeSalute American Airlines Vacations offer'), U('https://www.wesalute.com/offer/20281-american-airlines?g=military', 'WeSalute AA offer page (land portion only)')],
  'trv-alaska-wesalute': [U('https://www.wesalute.com/get-alaska-airlines', 'WeSalute Alaska Airlines offer'), GUIDE],
  'trv-allegiant-wesalute': [GUIDE, U('https://www.wesalute.com/brands/travel-lifestyle', 'WeSalute travel and lifestyle partners')],
  'trv-american-active': [U('https://www.aa.com/web/i18n/travel-info/baggage/specialty-and-sports.html', 'American Airlines special items (military bags section)'), U('https://www.wesalute.com/brands/american-airlines', 'WeSalute American Airlines partner page')],
  'trv-avis-wesalute': [U('https://www.avis.com/en/offers/partners/veterans-advantage', 'Avis WeSalute (Veterans Advantage) offer (2026)')],
  'trv-best-western-military': [U('https://www.bestwestern.com/en_US/offers/hotel-discounts/military-discounts.html', 'Best Western military and government discounts')],
  'trv-breeze-wesalute': [U('https://www.wesalute.com/blog/discounts-benefits/new-wesalute-military-discount-breeze-airways', 'WeSalute Breeze Airways discount'), GUIDE],
  'trv-budget-wesalute': [U('https://www.budget.com/en/offers/partner-offers/25-off-car-rentals-for-military-veterans', 'Budget WeSalute partner offer (2026)')],
  'trv-choice-military-rate': [U('https://www.choicehotels.com/deals/government-and-military-rates', 'Choice Hotels government and military rates'), U('https://media.choicehotels.com/2021-10-08-Choice-Privileges-Launches-New-Leisure-Benefit-For-Military-Members', 'Choice Privileges military leisure benefit release (Oct 8, 2021)')],
  'trv-clear-plus': [U('https://www.clearme.com/clear-plus', 'CLEAR+ pricing'), U('https://www.clearme.com/partner-detail-pages/va', 'CLEAR veterans rate ($125)')],
  'trv-enterprise': [U('https://www.enterprise.com/en/car-rental/deals/military-government-rental-discounts.html', 'Enterprise military and government discounts (2026)')],
  'trv-global-entry-myth': [U('https://www.cbp.gov/travel/trusted-traveler-programs/global-entry', 'CBP Global Entry (modified Jul 9, 2025)')],
  'trv-great-wolf-howlin-heroes': [U('https://www.greatwolf.com/mason/deals/howling-heroes', 'Great Wolf Lodge Howlin’ Heroes (2026)')],
  'trv-greyhound-wesalute': [U('https://www.greyhound.com/en/help-and-info/ticket-info/discounts', 'Greyhound discounts (2026)'), U('https://www.greyhound.com/deals-and-promos', 'Greyhound deals and promos')],
  'trv-hawaiian-wesalute': [GUIDE, U('https://www.wesalute.com/benefits/community-travel', 'WeSalute+ travel benefits')],
  'trv-hertz-military': [U('https://www.hertz.com/us/en/programs/government-and-military/military-discount-car-rental', 'Hertz military discount car rental')],
  'trv-hertz-wesalute': [U('https://www.wesalute.com/get-hertz', 'WeSalute Hertz offer')],
  'trv-hilton-military-family-rate': [U('https://www.hilton.com/en/offers/military-rate-2000000074/', 'Hilton Military Family Rate (2026)')],
  'trv-ihg-military-rate': [U('https://www.ihg.com/content/us/en/deals/hotel-offers/government/military-leisure-rate', 'IHG military leisure rate')],
  'trv-jetblue-wesalute': [GUIDE, U('https://www.wesalute.com/brands/travel-lifestyle', 'WeSalute travel and lifestyle partners (JetBlue 5% + free bags)')],
  'trv-kalahari-heroes': [U('https://www.kalahariresorts.com/pennsylvania/special-offers/kalahari-heroes/', 'Kalahari Heroes')],
  'trv-loews-coronado-bay': [U('https://www.loewshotels.com/coronado-bay-resort/specials/military-appreciation-offer', 'Loews Coronado Bay military appreciation offer (2026)')],
  'trv-lufthansa-wesalute': [GUIDE, U('https://www.wesalute.com/benefits/community-travel', 'WeSalute+ travel benefits')],
  'trv-margaritaville-orange-lake': [U('https://www.margaritavilleresorts.com/camp-margaritaville-orange-lake/special-offers/military-veteran-first-responders', 'Camp Margaritaville Orange Lake military offer')],
  'trv-margaritaville-pcb': [U('https://www.margaritavilleresorts.com/margaritaville-beach-cottage-resort-panama-city-beach/special-offers/heroes', 'Margaritaville Beach Cottage Resort Heroes rate')],
  'trv-marriott-myth': [U('https://help.marriott.com/s/article/Article-22222', 'Marriott military and government rate help article')],
  'trv-sandals-beaches': [U('https://www.sandals.com/specials/firefighter-military-police-savings/', 'Sandals service personnel discount')],
  'trv-united-active': [U('https://www.united.com/en/us/book-flight/united-military-fares/', 'United government and military fares')],
  'trv-united-wesalute': [U('https://www.wesalute.com/offer/18931-united', 'WeSalute United offer page (no United content on 11/4/2026)')],
  'trv-wesalute-plus': [U('https://www.wesalute.com/wesalute-plus-membership', 'WeSalute+ membership and pricing'), U('https://wesalute.com/plans', 'WeSalute plans (free vs WeSalute+)')],
  // tickets
  'tix-disney-salute-2026': [U('https://www.shadesofgreen.org/ticket-prices', 'Shades of Green ticket prices (6 Oct 2026)'), U('https://www.shadesofgreen.org/experiences/attractions/ticket-questions', 'Shades of Green ticket questions (15 Sep 2026)')],
  'tix-disney-wdw-military-room-discount-2026': [U('https://disneyworld.disney.go.com/special-offers/military-hotel-discount-2026/', 'Walt Disney World 2026 military hotel discount')],
  'tix-disney-military-tickets-shades-of-green': [U('https://www.shadesofgreen.org/ticket-prices', 'Shades of Green ticket prices (non-promotional military tickets)'), U('https://www.shadesofgreen.org/experiences/attractions/attraction-tickets', 'Shades of Green attraction tickets (5 Aug 2026)')],
  'tix-disney-cruise-line-military': [U('https://disneycruise.disney.go.com/special-offers/military-rates/', 'Disney Cruise Line military rates (2026)')],
  'tix-waves-of-honor': [U('https://seaworld.com/orlando/tickets/military-discount/active-duty/', 'SeaWorld Orlando Waves of Honor (active duty)'), U('https://buschgardens.com/tampa/tickets/military-discount/', 'Busch Gardens Tampa military discount')],
  'tix-seaworld-orlando-veterans-offer': [U('https://seaworld.com/orlando/tickets/military-discount/veterans/', 'SeaWorld Orlando veterans offer')],
  'tix-six-flags-over-texas': [U('https://www.sixflags.com/overtexas/military-discounts', 'Six Flags Over Texas military discounts (2026)')],
  'tix-legoland-florida-military': [U('https://www.legoland.com/florida/deals/military-offers/', 'LEGOLAND Florida military offers')],
  'tix-aspen-snowmass-military': [U('https://www.aspensnowmass.com/visit/tickets-and-passes/military-ski-passes-and-lift-tickets', 'Aspen Snowmass military passes (2026)')],
  'tix-royal-caribbean-military': [U('https://www.royalcaribbean.com/faq/questions/qualifications-special-pricing', 'Royal Caribbean special pricing qualifications (2026)')],
  'tix-blue-star-museums-myth': [U('https://www.arts.gov/initiatives/blue-star-museums', 'NEA Blue Star Museums')],
  'tix-colonial-williamsburg-mount-vernon-veterans-day': [U('https://www.colonialwilliamsburg.org/documents/359/10292025_FINAL_PressRelease_VeteransDay2025.pdf', 'Colonial Williamsburg Veterans Day 2025 release (10/29/2025)'), U('https://www.mountvernon.org/plan-your-visit/calendar/events/mount-vernon-salutes-veterans', 'Mount Vernon Salutes Veterans (11/11/2026)')],
  'tix-hersheypark-seasonal': [U('https://www.hersheypark.com/plan-your-visit/faqs/351', 'Hersheypark FAQ (military offers)')],
  'tix-empire-state-building-myth': [U('https://www.esbnyc.com/visit/faq', 'Empire State Building FAQ (2026)')],
  'tix-monterey-bay-aquarium-myth': [U('https://www.montereybayaquarium.org/visit/visitor-faqs', 'Monterey Bay Aquarium visitor FAQs')],
  'tix-escapees-rv-club': [U('https://support.harvesthosts.com/en/articles/10582285-does-escapees-offer-veterans-or-active-duty-military-personnel-a-discount-when-joining', 'Escapees veteran and active-duty discount (6/2/2026)')],
  'tix-va-veterans-transportation-service': [U('https://www.va.gov/resources/how-to-request-rides-to-va-health-appointments/', 'VA: how to request rides to VA health appointments (6/25/2026)')],
  'tix-va-beneficiary-travel': [U('https://www.va.gov/health-care/get-reimbursed-for-travel-pay/', 'VA Beneficiary Travel (7/24/2026)')],
  'tix-uber-myth': [U('https://www.uber.com/us/en/newsroom/ubermilitary-we-want-you/', 'Uber newsroom: UberMILITARY (9/17/2014; promotions no longer valid)')],
  'tix-lyft-myth': [U('https://www.lyft.com/blog/posts/this-veterans-day-lyft-expands-support-for-veterans-with-new-par', 'Lyft: Veterans Day 2025 veteran support post (11/10/2025)')],
  // retail
  'ret-apple': [U('https://www.apple.com/us_epp_805199/shop/open/salespolicies/program_agreement/military', 'Apple Veterans and Military Purchase Program agreement (2026)')],
  'ret-bass-pro-legendary-salute': [U('https://about.basspro.com/community/military-and-veterans/', 'Bass Pro Shops military and veterans (2026)'), U('https://www.basspro.com/shop/en/military-discount', 'Bass Pro Legendary Salute discount page')],
  'ret-under-armour': [U('https://www.underarmour.com/en-us/t/military-discount.html', 'Under Armour military discount')],
  'ret-adidas': [U('https://www.adidas.com/us/military-discount', 'adidas military discount program')],
  'ret-the-north-face': [U('https://www.thenorthface.com/en-us/help/discounts/the-north-face-military-discount-program', 'The North Face military discount program')],
  'ret-t-mobile': [U('https://www.t-mobile.com/cell-phone-plans/military-discount-plans', 'T-Mobile military discount plans')],
  'ret-acp-ended-myth': [U('https://www.usac.org/about/affordable-connectivity-program/', 'USAC: Affordable Connectivity Program ended June 1, 2024')],
  'ret-military-onesource': [U('https://www.militaryonesource.mil/resources/millife-guides/eligibility-for-military-onesource-services/', 'Military OneSource eligibility')],
  'ret-miltax': [U('https://www.militaryonesource.mil/financial-legal/taxes/miltax-military-tax-services/', 'MilTax'), U('https://www.hrblock.com/tax-center/filing/tax-preparation-and-services/free-ways-to-file-taxes/', 'H&R Block free filing options (Military OneSource route)')],
  'ret-amex-scra-mla-myth': [U('https://www.americanexpress.com/us/help-support/service-members-civil-relief/', 'American Express SCRA and MLA FAQ (2026)')],
  'ret-afba': [U('https://www.afba.com/about/afba-member-eligibility/', 'AFBA member eligibility (2026)')],
  'ret-liberty-mutual': [U('https://www.libertymutual.com/vehicle/auto-insurance/discounts', 'Liberty Mutual auto insurance discounts')],
  'ret-farmers': [U('https://www.farmers.com/discounts/homeowners-insurance/', 'Farmers homeowners insurance discounts (affinity)')],
  'ret-irs-free-file-vita': [U('https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers', 'IRS free tax return preparation (10/19/2026)'), U('https://www.irs.gov/individuals/information-for-veterans', 'IRS information for veterans (10/21/2026)')],
  'ret-turbotax-myth': [U('https://turbotax.intuit.com/personal-taxes/online/military-edition.jsp', 'TurboTax military edition (TY2025)')],
  'ret-nike': [U('https://www.nike.com/help/a/military-discount', 'Nike military discount (2026)')],
  'ret-oakley-si': [U('https://www.oakleysi.com/en-us/register', 'Oakley Standard Issue registration (pricing)'), U('https://www.oakleysi.com/en-us/aboutus', 'Oakley Standard Issue about (eligibility)')],
  'ret-sams-club': [U('https://www.samsclub.com/cp/membership-offers/30001901', 'Sam’s Club membership offers')],
  'ret-columbia': [U('https://www.columbia.com/t/discount-programs/', 'Columbia discount programs')],
  'ret-llbean': [U('https://www.llbean.com/llb/shop/517432?page=military-discount', 'L.L.Bean military discount')],
  'ret-navy-federal': [U('https://www.navyfederal.org/membership/become-a-member.html', 'Navy Federal membership (2026)')],
  'ret-jeep-ram-military': [U('https://www.jeep.com/incentives/military-incentive.html', 'Jeep military incentive ($500 bonus cash)'), U('https://www.ramtrucks.com/incentives/military-incentive.html', 'Ram military incentive ($500 bonus cash)')],
  'ret-harley-davidson-military': [U('https://www.harley-davidson.com/us/en/about-us/sustainability/military-support.html', 'Harley-Davidson military programs')],
  'ret-xfinity-military': [U('https://www.xfinity.com/military', 'Xfinity Military')],
  'ret-chase-premier-plus': [U('https://www.chase.com/digital/military/personal', 'Chase personal banking for military and veterans')],
  'ret-usaa': [U('https://www.usaa.com/banking/', 'USAA Bank (membership eligibility)')],
  'ret-toyota-military-rebate': [U('https://www.toyota.com/military-rebate/', 'Toyota Military Rebate')],
  'ret-honda-military': [U('https://automobiles.honda.com/financial-services', 'Honda Financial Services (Military Appreciation $500)')],
  'ret-nissan-military': [U('https://www.nissanusa.com/military-discounts.html', 'Nissan Military Program')],
  'ret-hyundai-military': [U('https://www.hyundaiusa.com/us/en/special-programs', 'Hyundai special programs (Military Program $500)')],
  'ret-ford-military': [U('https://www.ford.com/support/how-tos/owner-resources/sales-support/military-and-first-responders-appreciation-discount', 'Ford military and first responders appreciation discount')],
  'ret-gm-military': [U('https://www.gmmilitaryappreciation.com/', 'GM Military Appreciation')],
  'ret-penske': [U('https://www.pensketruckrental.com/military-discount/', 'Penske military discount (2026)')],
  'ret-uhaul': [U('https://www.uhaul.com/Military/', 'U-Haul military')],
  'ret-budget-truck-myth': [U('https://www.budgettruck.com/deals/military-discounts', 'Budget Truck military discounts')],
  'ret-linkedin-premium': [U('https://socialimpact.linkedin.com/programs/veterans/premiumform', 'LinkedIn Premium for veterans (2026)')],
  'ret-microsoft-mssa': [U('https://military.microsoft.com/mssa/', 'Microsoft Software and Systems Academy')],
  'ret-fcc-lifeline': [U('https://www.lifelinesupport.org/how-to-qualify/', 'Lifeline: how to qualify')],
  'ret-team-rwb': [U('https://teamrwb.org/join-up/', 'Team RWB join (2026)')],
  'ret-mission-22': [U('https://mission22.org/', 'Mission 22')],
  'ret-geico': [U('https://www.geico.com/information/military/', 'GEICO military (2026)')],
  'ret-armed-forces-insurance': [U('https://www.afi.org/Is-AFI-For-You', 'Armed Forces Insurance eligibility')],
  'ret-progressive-myth': [U('https://www.progressive.com/auto/discounts/', 'Progressive auto discounts (no military discount listed)')],
  'ret-service-cu': [U('https://servicecu.org/join/', 'Service Credit Union join (2026)')],
  'ret-armed-forces-bank': [U('https://www.afbank.com/', 'Armed Forces Bank')],
  'ret-military-benefit-association': [U('https://www.militarybenefit.org/', 'Military Benefit Association (2026)')],
  'ret-dell': [U('https://www.dell.com/en-us/shop/member/lp/heroes', 'Dell military discount (Heroes)')],
  'ret-microsoft-store': [U('https://www.microsoft.com/en-us/store/b/military', 'Microsoft Store military discount'), U('https://www.microsoft.com/en-us/store/b/special-discount-terms', 'Microsoft Store special discount terms')],
  'ret-att': [U('https://www.att.com/military/', 'AT&T military')],
  'ret-verizon': [U('https://www.verizon.com/military/', 'Verizon military (2026)')],
  'ret-idme': [U('https://help.id.me/hc/en-us/articles/360010305173-Who-qualifies-for-IDMe-military-discounts', 'ID.me: who qualifies for military discounts'), U('https://help.id.me/hc/en-us/articles/202211570-What-documents-prove-your-military-status', 'ID.me: documents that prove military status')],
};
const FILES = ['perks-access.js', 'perks-tickets.js', 'perks-travel.js', 'perks-retail.js', 'perks-federal.js', 'local.js'];
const lit = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
let hits = 0, left = 0;
for (const f of FILES) {
  const p = join(here, '..', 'data', f);
  let src; try { src = readFileSync(p, 'utf8'); } catch { continue; }
  let out = src;
  for (const [id, urls] of Object.entries(MAP)) {
    const at = out.indexOf(`id: '${id}'`); if (at < 0) continue;
    const next = out.indexOf("id: '", at + 5); const end = next < 0 ? out.length : next;
    let block = out.slice(at, end);
    const m = block.match(/sourceUrls:\s*\[(?:[^[\]]|\[[^[\]]*\])*\]/);
    if (!m) { console.log('no sourceUrls match in', f, id); continue; }
    const repl = 'sourceUrls: [' + urls.map(u => `{ url: ${lit(u.url)}, title: ${lit(u.title)} }`).join(', ') + ']';
    block = block.replace(m[0], repl).replace(/\s*todoUrl:\s*true\s*,?/, '');
    out = out.slice(0, at) + block + out.slice(end);
    hits++;
  }
  const remaining = (out.match(/todoUrl:\s*true/g) || []).length; left += remaining;
  if (out !== src) { writeFileSync(p, out); console.log(`${f}: patched`); }
  if (remaining) console.log(`${f}: ${remaining} todoUrl flag(s) still set`);
}
console.log(`${hits} rows patched, ${left} flags left`);
