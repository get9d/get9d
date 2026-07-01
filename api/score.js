// get9d.com — 9D Property Scoring Engine v4.0 (Global — Verified Actor IDs)
// All Apify actor IDs verified against live Apify Store pages July 2026.
// NO Claude/Perplexity fallback — hard fail prevents hallucination.
// Perplexity Sonar slot reserved (stubbed) for future activation.

export const config = { maxDuration: 60 };

const ALLOWED_MODELS = [
  'claude-opus-4-8','claude-sonnet-4-6','claude-haiku-4-5-20251001',
  'claude-3-5-sonnet-20241022','claude-3-5-haiku-20241022','claude-3-opus-20240229',
];
const MAX_TOKENS_CAP = 4096;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// ─── VERIFIED PORTAL REGISTRY ─────────────────────────────────────────────
// All actorIds verified on apify.com/store July 2026.
// buildInput field names verified from each actor's documentation.
const PORTAL_CONFIG = {

  // ── Switzerland ───────────────────────────────────────────────────────
  // Actor: santamaria-automations/homegate-scraper (verified ✓, $3/1K)
  // Input: listingType, city, minPrice, maxPrice, minRooms, maxRooms, maxItems
  CH: [{
    name: 'Homegate.ch',
    actorId: 'santamaria-automations/homegate-scraper',
    buildInput: (p) => ({
      listingType: p.propertyType === 'rent' ? 'rent' : 'buy',
      city: p.location || '',
      minPrice: p.minPrice || undefined,
      maxPrice: p.maxPrice || undefined,
      minRooms: p.minRooms || undefined,
      maxRooms: p.maxRooms || undefined,
      maxItems: 10,
    }),
    normalise: (i) => ({
      title: i.title || i.name || '',
      address: [i.street, i.zip, i.city, i.canton].filter(Boolean).join(', '),
      price: i.price,
      priceUnit: 'CHF',
      rooms: i.rooms,
      livingArea: i.area,
      floor: i.floor || null,
      yearBuilt: i.yearBuilt || null,
      listingUrl: i.source_url || i.url || null,
      description: (i.description || '').slice(0, 500) || null,
      images: i.image_url ? [i.image_url] : [],
      source: 'homegate.ch',
      extras: { features: i.features, lat: i.latitude, lng: i.longitude },
    }),
  }],

  // ── Germany ───────────────────────────────────────────────────────────
  // Actor: automation-lab/immoscout24-de-scraper (verified ✓)
  // Input: startUrls (search URLs) — builds a search URL from location
  // Actor: studio-amba/immoscout24-scraper (verified ✓, alternative)
  DE: [{
    name: 'ImmobilienScout24.de',
    actorId: 'automation-lab/immoscout24-de-scraper',
    buildInput: (p) => {
      const type = p.propertyType === 'rent' ? 'wohnung-mieten' : 'wohnung-kaufen';
      const city = (p.location || 'deutschland').toLowerCase().replace(/\s+/g, '-');
      return {
        startUrls: [{
          url: `https://www.immobilienscout24.de/Suche/de/${city}/${type}`,
        }],
        maxItems: 10,
      };
    },
    normalise: (i) => ({
      title: i.title || i.address || '',
      address: i.address || i.location || '',
      price: i.price || i.rentTotal || i.purchasePrice,
      priceUnit: 'EUR',
      rooms: i.rooms || i.numberOfRooms,
      livingArea: i.livingSpace || i.area,
      floor: i.floor || null,
      yearBuilt: i.constructionYear || i.yearBuilt || null,
      listingUrl: i.url || i.detailUrl || null,
      description: (i.description || i.descriptionNote || '').slice(0, 500) || null,
      images: i.images ? i.images.slice(0, 2) : [],
      source: 'immobilienscout24.de',
      extras: { energyClass: i.energyClass, courtageNote: i.courtageNote },
    }),
  }],

  // ── Austria ───────────────────────────────────────────────────────────
  // Uses ImmoScout24 which covers .at domain too
  // Actor: memo23/immobilienscout24-scraper (verified ✓, covers DE+AT)
  AT: [{
    name: 'ImmobilienScout24.at',
    actorId: 'memo23/immobilienscout24-scraper',
    buildInput: (p) => {
      const city = (p.location || 'wien').toLowerCase().replace(/\s+/g, '-');
      const type = p.propertyType === 'rent' ? 'mieten' : 'kaufen';
      return {
        startUrls: [{
          url: `https://www.immobilienscout24.at/Suche/${city}/${type}`,
        }],
        maxItems: 10,
      };
    },
    normalise: (i) => ({
      title: i.title || '',
      address: i.address || i.location || '',
      price: i.price || i.rentTotal || i.purchasePrice,
      priceUnit: 'EUR',
      rooms: i.rooms || i.numberOfRooms,
      livingArea: i.livingSpace || i.area,
      floor: null,
      yearBuilt: i.constructionYear || null,
      listingUrl: i.url || null,
      description: (i.description || '').slice(0, 500) || null,
      images: i.images ? i.images.slice(0, 2) : [],
      source: 'immobilienscout24.at',
      extras: {},
    }),
  }],

  // ── Spain / Portugal / Italy ──────────────────────────────────────────
  // Actor: igolaizola/idealista-scraper (verified ✓, active, pay-per-event)
  // Input: country, operation, location, maxResults
  ES: [{
    name: 'Idealista (ES/PT/IT)',
    actorId: 'igolaizola/idealista-scraper',
    buildInput: (p) => ({
      country: p.country || 'es',
      operation: p.propertyType === 'rent' ? 'rent' : 'sale',
      location: p.location || '',
      maxResults: 10,
    }),
    normalise: (i) => ({
      title: i.title || i.suggestedTexts?.title || '',
      address: i.address || i.district || '',
      price: i.price,
      priceUnit: 'EUR',
      rooms: i.rooms,
      livingArea: i.size,
      floor: i.floor || null,
      yearBuilt: null,
      listingUrl: i.url || (i.propertyCode ? `https://www.idealista.com/inmueble/${i.propertyCode}/` : null),
      description: (i.description || '').slice(0, 500) || null,
      images: i.thumbnail ? [i.thumbnail] : [],
      source: 'idealista.com',
      extras: { priceByArea: i.priceByArea, hasLift: i.hasLift, energyCertificationType: i.energyCertificationType },
    }),
  }],
  PT: [{ alias: 'ES', country: 'pt', source: 'idealista.pt' }],
  IT: [{ alias: 'ES', country: 'it', source: 'idealista.it' }],

  // ── France ────────────────────────────────────────────────────────────
  // No single verified actor found for SeLoger — using Idealista France
  // Actor: igolaizola/idealista-scraper supports France too
  FR: [{
    name: 'Idealista France',
    actorId: 'igolaizola/idealista-scraper',
    buildInput: (p) => ({
      country: 'fr',
      operation: p.propertyType === 'rent' ? 'rent' : 'sale',
      location: p.location || '',
      maxResults: 10,
    }),
    normalise: (i) => ({
      title: i.title || '',
      address: i.address || i.district || '',
      price: i.price,
      priceUnit: 'EUR',
      rooms: i.rooms,
      livingArea: i.size,
      floor: i.floor || null,
      yearBuilt: null,
      listingUrl: i.url || null,
      description: (i.description || '').slice(0, 500) || null,
      images: i.thumbnail ? [i.thumbnail] : [],
      source: 'idealista.fr',
      extras: {},
    }),
  }],

  // ── United Kingdom ────────────────────────────────────────────────────
  // Actor: jungle_synthesizer/rightmove-zoopla-onthemarket-uk-scraper (verified ✓)
  // Actor: automation-lab/rightmove-scraper (verified ✓, fast HTTP)
  GB: [{
    name: 'Rightmove + Zoopla + OnTheMarket',
    actorId: 'jungle_synthesizer/rightmove-zoopla-onthemarket-uk-scraper',
    buildInput: (p) => ({
      location: p.location || '',
      listingType: p.propertyType === 'rent' ? 'rent' : 'sale',
      minPrice: p.minPrice || undefined,
      maxPrice: p.maxPrice || undefined,
      minBedrooms: p.minRooms || undefined,
      maxItems: 10,
    }),
    normalise: (i) => ({
      title: i.title || i.displayAddress || '',
      address: i.displayAddress || i.address || '',
      price: i.price,
      priceUnit: 'GBP',
      rooms: i.bedrooms,
      livingArea: i.floorArea || null,
      floor: null,
      yearBuilt: null,
      listingUrl: i.propertyUrl || i.url || null,
      description: (i.summary || i.description || '').slice(0, 500) || null,
      images: i.images ? i.images.slice(0, 2) : [],
      source: i.portal || 'rightmove.co.uk',
      extras: { epcRating: i.epcRating, councilTaxBand: i.councilTaxBand, tenure: i.tenure },
    }),
  }],

  // ── USA ───────────────────────────────────────────────────────────────
  // Actor: maxcopell/zillow-scraper (verified ✓, $2/1K)
  // Input: location, listingType, minPrice, maxPrice, minBeds, maxItems
  US: [{
    name: 'Zillow',
    actorId: 'maxcopell/zillow-scraper',
    buildInput: (p) => ({
      location: p.location || '',
      listingType: p.propertyType === 'rent' ? 'for_rent' : 'for_sale',
      minPrice: p.minPrice || undefined,
      maxPrice: p.maxPrice || undefined,
      minBeds: p.minRooms || undefined,
      maxItems: 10,
    }),
    normalise: (i) => ({
      title: i.address || i.streetAddress || '',
      address: i.address || i.streetAddress || '',
      price: i.price || i.listPrice,
      priceUnit: 'USD',
      rooms: i.bedrooms || i.beds,
      livingArea: i.livingArea || i.sqft,
      floor: null,
      yearBuilt: i.yearBuilt,
      listingUrl: i.url || i.detailUrl || null,
      description: (i.description || '').slice(0, 500) || null,
      images: i.photos ? i.photos.slice(0, 2) : (i.images ? i.images.slice(0, 2) : []),
      source: 'zillow.com',
      extras: { zestimate: i.zestimate, daysOnMarket: i.daysOnMarket, pricePerSqft: i.pricePerSqft },
    }),
  }],

  // ── Canada ────────────────────────────────────────────────────────────
  // No verified search-by-city actor found. Mark as noActor.
  CA: null,

  // ── UAE / Middle East ─────────────────────────────────────────────────
  // Actor: stealth_mode/propertyfinder-property-search-scraper (verified ✓)
  // Actor: shahidirfan/propertyfinder-scraper (verified ✓, URL-based)
  AE: [{
    name: 'PropertyFinder UAE',
    actorId: 'stealth_mode/propertyfinder-property-search-scraper',
    buildInput: (p) => ({
      location: p.location || 'dubai',
      category: p.propertyType === 'rent' ? 'rent' : 'buy',
      maxItems: 10,
    }),
    normalise: (i) => ({
      title: i.title || '',
      address: i.location || i.community || i.address || '',
      price: i.price,
      priceUnit: 'AED',
      rooms: i.bedrooms || i.beds,
      livingArea: i.area || i.size,
      floor: null,
      yearBuilt: null,
      listingUrl: i.url || null,
      description: (i.description || '').slice(0, 500) || null,
      images: i.images ? i.images.slice(0, 2) : [],
      source: 'propertyfinder.ae',
      extras: { permitNumber: i.permitNumber, furnished: i.furnished, completionStatus: i.completionStatus },
    }),
  }],
  SA: [{ alias: 'AE', country: 'sa', source: 'propertyfinder.ae/saudi' }],

  // ── Australia ─────────────────────────────────────────────────────────
  // Actor: haketa/domain-com-au-scraper (verified ✓)
  // Input: suburbs (array of suburb slugs), listingType, maxListings
  AU: [{
    name: 'Domain.com.au',
    actorId: 'haketa/domain-com-au-scraper',
    buildInput: (p) => ({
      suburbs: [p.location || ''],
      listingType: p.propertyType === 'rent' ? 'rent' : 'sale',
      minPrice: p.minPrice || undefined,
      maxPrice: p.maxPrice || undefined,
      minBedrooms: p.minRooms || undefined,
      maxListings: 10,
    }),
    normalise: (i) => ({
      title: i.address || i.displayableAddress || '',
      address: i.address || i.displayableAddress || '',
      price: i.price,
      priceUnit: 'AUD',
      rooms: i.bedrooms,
      livingArea: i.area || i.buildingArea || null,
      floor: null,
      yearBuilt: null,
      listingUrl: i.url || i.listingUrl || null,
      description: (i.description || '').slice(0, 500) || null,
      images: i.images ? i.images.slice(0, 2) : [],
      source: 'domain.com.au',
      extras: { auctionDate: i.auctionDetails?.dateTime, daysOnMarket: i.daysOnMarket },
    }),
  }],

  // ── Brazil ────────────────────────────────────────────────────────────
  // No verified search actor found. Mark as noActor.
  BR: null,

  // ── Mexico ────────────────────────────────────────────────────────────
  // No verified actor with simple city search. Mark as noActor.
  MX: null,

  // ── Colombia ──────────────────────────────────────────────────────────
  CO: null,

  // ── Argentina ─────────────────────────────────────────────────────────
  AR: null,

  // ── Southeast Asia ────────────────────────────────────────────────────
  SG: null,
  MY: null,
  TH: null,

  // ── South Africa + Africa ─────────────────────────────────────────────
  // Actor: agentx/property24-property-scraper (verified ✓, clean JSON API)
  // Input: country, location, max_results, listing_type
  ZA: [{
    name: 'Property24',
    actorId: 'agentx/property24-property-scraper',
    buildInput: (p) => ({
      country: p.country || 'South Africa',
      location: p.location || '',
      max_results: 10,
      listing_type: p.propertyType === 'rent' ? 'To Rent' : 'For Sale',
    }),
    normalise: (i) => ({
      title: i.title || '',
      address: i.address || i.location?.address || '',
      price: i.price,
      priceUnit: 'ZAR',
      rooms: i.rooms || i.bedrooms,
      livingArea: i.area || i.floorSize,
      floor: null,
      yearBuilt: null,
      listingUrl: i.source_url || i.official_url || i.url || null,
      description: (i.description || '').slice(0, 500) || null,
      images: i.image_urls ? i.image_urls.slice(0, 2) : (i.cover_image ? [i.cover_image] : []),
      source: 'property24.com',
      extras: { bathrooms: i.bathrooms, garages: i.details?.garages },
    }),
  }],

  // ── Perplexity-only markets ───────────────────────────────────────────
  UA: null,
  JP: null,
  IN: null,
  CN: null,
};

// ─── URL-based single listing scrapers ────────────────────────────────────
// Verified actor IDs for detail scraping from a specific listing URL.
const URL_SCRAPER_MAP = {
  // Switzerland
  'homegate.ch':             { actorId: 'ecomscrape/homegate-property-details-scraper', inputKey: 'startUrls' },
  'immoscout24.ch':          { actorId: 'ecomscrape/homegate-property-details-scraper', inputKey: 'startUrls' },
  // Germany
  'immobilienscout24.de':    { actorId: 'clearpath/immoscout24-detail-listing-scraper', inputKey: 'urls' },
  'immoscout24.de':          { actorId: 'clearpath/immoscout24-detail-listing-scraper', inputKey: 'urls' },
  // Spain/Portugal/Italy
  'idealista.com':           { actorId: 'igolaizola/idealista-scraper', inputKey: 'startUrls' },
  'idealista.pt':            { actorId: 'igolaizola/idealista-scraper', inputKey: 'startUrls' },
  'idealista.it':            { actorId: 'igolaizola/idealista-scraper', inputKey: 'startUrls' },
  // UK
  'rightmove.co.uk':         { actorId: 'automation-lab/rightmove-scraper', inputKey: 'startUrls' },
  'zoopla.co.uk':            { actorId: 'cryptosignals/zoopla-scraper',     inputKey: 'startUrls' },
  'onthemarket.com':         { actorId: 'jungle_synthesizer/rightmove-zoopla-onthemarket-uk-scraper', inputKey: 'startUrls' },
  // USA
  'zillow.com':              { actorId: 'maxcopell/zillow-detail-scraper',   inputKey: 'urls' },
  'realtor.com':             { actorId: 'maxcopell/zillow-scraper',          inputKey: 'startUrls' },
  // UAE
  'propertyfinder.ae':       { actorId: 'shahidirfan/propertyfinder-scraper', inputKey: 'startUrls' },
  'bayut.com':               { actorId: 'shahidirfan/propertyfinder-scraper', inputKey: 'startUrls' },
  // Australia
  'domain.com.au':           { actorId: 'haketa/domain-com-au-scraper',     inputKey: 'startUrls' },
  'realestate.com.au':       { actorId: 'haketa/domain-com-au-scraper',     inputKey: 'startUrls' },
  // South Africa
  'property24.com':          { actorId: 'agentx/property24-property-scraper', inputKey: 'startUrls' },
};

// ─── Market detection ──────────────────────────────────────────────────────
function detectMarket(location = '', countryCode = '') {
  const code = countryCode.toUpperCase();
  if (code && PORTAL_CONFIG[code] !== undefined) return code;
  const loc = location.toLowerCase();
  if (/\b(ch|switzerland|schweiz|zürich|zurich|bern|aarau|basel|luzern|aargau|zug|lausanne|winterthur|boniswil)\b/.test(loc)) return 'CH';
  if (/\b(de|germany|deutschland|berlin|münchen|munich|hamburg|frankfurt|köln|cologne|stuttgart|düsseldorf)\b/.test(loc)) return 'DE';
  if (/\b(at|austria|österreich|wien|vienna|salzburg|graz|innsbruck|linz)\b/.test(loc)) return 'AT';
  if (/\b(gb|uk|united kingdom|england|london|manchester|birmingham|edinburgh|bristol|leeds|glasgow)\b/.test(loc)) return 'GB';
  if (/\b(fr|france|paris|lyon|marseille|bordeaux|toulouse|nice|nantes)\b/.test(loc)) return 'FR';
  if (/\b(pt|portugal|lisboa|lisbon|porto|algarve|cascais|faro|braga)\b/.test(loc)) return 'PT';
  if (/\b(it|italy|italia|rome|roma|milan|milano|florence|firenze|naples|venice)\b/.test(loc)) return 'IT';
  if (/\b(es|spain|españa|madrid|barcelona|sevilla|valencia|malaga|asturias|gijón|gijon|bilbao)\b/.test(loc)) return 'ES';
  if (/\b(us|usa|united states|new york|los angeles|chicago|houston|miami|san francisco|seattle|boston)\b/.test(loc)) return 'US';
  if (/\b(ca|canada|toronto|vancouver|montreal|calgary|ottawa|edmonton)\b/.test(loc)) return 'CA';
  if (/\b(ae|uae|dubai|abu dhabi|sharjah)\b/.test(loc)) return 'AE';
  if (/\b(sa|saudi|riyadh|jeddah)\b/.test(loc)) return 'SA';
  if (/\b(au|australia|sydney|melbourne|brisbane|perth|adelaide|canberra)\b/.test(loc)) return 'AU';
  if (/\b(br|brazil|brasil|são paulo|sao paulo|rio de janeiro)\b/.test(loc)) return 'BR';
  if (/\b(mx|mexico|méxico|ciudad de mexico|cdmx|guadalajara|monterrey)\b/.test(loc)) return 'MX';
  if (/\b(co|colombia|bogota|bogotá|medellin|medellín|cali)\b/.test(loc)) return 'CO';
  if (/\b(ar|argentina|buenos aires|cordoba|rosario)\b/.test(loc)) return 'AR';
  if (/\b(sg|singapore)\b/.test(loc)) return 'SG';
  if (/\b(my|malaysia|kuala lumpur|penang)\b/.test(loc)) return 'MY';
  if (/\b(th|thailand|bangkok|phuket|chiang mai)\b/.test(loc)) return 'TH';
  if (/\b(za|south africa|cape town|johannesburg|durban|sandton|nigeria|kenya|nairobi|namibia)\b/.test(loc)) return 'ZA';
  if (/\b(ua|ukraine|kyiv|kiev|lviv|odesa)\b/.test(loc)) return 'UA';
  if (/\b(jp|japan|tokyo|osaka|kyoto)\b/.test(loc)) return 'JP';
  if (/\b(in|india|mumbai|delhi|bangalore|bengaluru)\b/.test(loc)) return 'IN';
  return 'CH';
}

// ─── Resolve alias entries ─────────────────────────────────────────────────
function resolvePortals(market, searchParams) {
  const config = PORTAL_CONFIG[market];
  if (!config) return null;
  return config.map(entry => {
    if (entry.alias) {
      const parent = PORTAL_CONFIG[entry.alias];
      if (!parent) return null;
      const base = { ...parent[0] };
      const aliasCountry = entry.country;
      const aliasSource = entry.source;
      return {
        ...base,
        name: `${base.name} (${market})`,
        buildInput: (p) => base.buildInput({ ...p, country: aliasCountry }),
        normalise: (i) => ({ ...base.normalise(i), source: aliasSource || base.normalise(i).source }),
      };
    }
    return entry;
  }).filter(Boolean);
}

// ─── Fetch from Apify portals (search mode) ───────────────────────────────
async function fetchListings(searchParams) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) throw new Error('APIFY_TOKEN not configured.');

  const market = detectMarket(searchParams.location, searchParams.countryCode || '');
  const config = PORTAL_CONFIG[market];

  if (!config) {
    return { listings: [], market, noActor: true, reason: `Market ${market} not yet supported` };
  }

  const portals = resolvePortals(market, searchParams);
  if (!portals || portals.length === 0) {
    return { listings: [], market, noActor: true, reason: `No actor configured for ${market}` };
  }

  const results = await Promise.allSettled(
    portals.map(async (portal) => {
      const input = portal.buildInput(searchParams);
      const res = await fetch(
        `https://api.apify.com/v2/acts/${portal.actorId}/run-sync-get-dataset-items?token=${apifyToken}&timeout=50`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
      );
      if (!res.ok) throw new Error(`${portal.name} → ${res.status} ${res.statusText}`);
      const items = await res.json();
      return { portal: portal.name, items: Array.isArray(items) ? items : [] };
    })
  );

  const listings = [], portalErrors = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i], portal = portals[i];
    if (r.status === 'fulfilled') {
      listings.push(...r.value.items.slice(0, 10).map(item => {
        try { return portal.normalise(item); } catch { return null; }
      }).filter(Boolean));
    } else {
      portalErrors.push(`${portal.name}: ${r.reason?.message}`);
    }
  }

  const seen = new Set();
  const deduped = listings.filter(l => {
    if (!l.listingUrl || seen.has(l.listingUrl)) return false;
    seen.add(l.listingUrl);
    return true;
  });

  return { listings: deduped.slice(0, 15), market, portalErrors };
}

// ─── URL-based single listing fetch ───────────────────────────────────────
function getHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return null; }
}

async function fetchListingByUrl(listingUrl, countryCode) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) throw new Error('APIFY_TOKEN not configured.');

  const host = getHostname(listingUrl);
  const scraper = host ? URL_SCRAPER_MAP[host] : null;

  if (!scraper) {
    throw new Error(`No URL scraper available for ${host || listingUrl}. Please enter the property details manually.`);
  }

  const input = { [scraper.inputKey]: [{ url: listingUrl }], maxItems: 1 };

  const res = await fetch(
    `https://api.apify.com/v2/acts/${scraper.actorId}/run-sync-get-dataset-items?token=${apifyToken}&timeout=50`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
  );

  if (!res.ok) {
    throw new Error(`Scraper returned ${res.status}. The listing may require a login or have been removed.`);
  }

  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No data returned for this listing. It may be delisted or require login.');
  }

  const market = countryCode || detectMarket(listingUrl, '');
  const portals = PORTAL_CONFIG[market] ? resolvePortals(market, {}) : null;
  const portal = portals?.[0];

  let listing;
  try {
    listing = portal ? portal.normalise(items[0]) : {
      title: items[0].title || items[0].name || items[0].address || 'Property',
      address: items[0].address || items[0].location || '',
      price: items[0].price || items[0].listPrice || null,
      priceUnit: items[0].currency || items[0].priceUnit || null,
      rooms: items[0].rooms || items[0].bedrooms || items[0].numberOfRooms || null,
      livingArea: items[0].livingArea || items[0].area || items[0].size || null,
      floor: items[0].floor || null,
      yearBuilt: items[0].yearBuilt || items[0].constructionYear || null,
      listingUrl,
      description: (items[0].description || '').slice(0, 500) || null,
      images: (items[0].images || items[0].imageUrls || []).slice(0, 2),
      source: host || 'portal',
      extras: {},
    };
  } catch {
    listing = {
      title: 'Property', address: '', price: null, priceUnit: null,
      rooms: null, livingArea: null, floor: null, yearBuilt: null,
      listingUrl, description: JSON.stringify(items[0]).slice(0, 500),
      images: [], source: host || 'portal', extras: {},
    };
  }

  return { listing, market };
}

// ─── Perplexity Sonar (reserved — not yet active) ─────────────────────────
async function fetchPerplexityListings(_searchParams) {
  // RESERVED FOR FUTURE INTEGRATION — activate when PERPLEXITY_API_KEY is set
  return [];
}

// ─── D9 legal rules per market ────────────────────────────────────────────
const D9_RULES = {
  CH: 'Lex Koller (foreign buyer restrictions on residential property), Stockwerkeigentum strata rules, cantonal zoning, FINMA AML for funds',
  DE: 'Grundbuch title register, Mietrecht tenant protections, Grunderwerbsteuer 3.5–6.5%, Bebauungsplan zoning',
  AT: 'Grundbuch, Wohnungseigentumsgesetz, foreign buyer restrictions in some Bundesländer, Grunderwerbsteuer 3.5%',
  GB: 'SDLT/LTT stamp duty, leasehold vs freehold, EPC minimum E, Section 21 abolition, planning use class',
  FR: 'DPE energy rating mandatory, Taxe Foncière, copropriété rules, Loi Pinel, PTZ eligibility',
  ES: 'ITP/AJD transfer tax 6–10%, Ley de Arrendamientos Urbanos rent controls, Cadastral vs market value',
  PT: 'NHR/IFICI tax regime, IMT transfer tax 0–7.5%, Golden Visa residential abolished, ARU urban rehab zones',
  IT: 'Catasto cadastral values, IMU property tax, Superbonus eligibility, Codice del Consumo disclosures',
  US: 'HOA rules, local zoning/setbacks, FIRPTA for foreign sellers, FEMA flood zone, 1031 exchange eligibility',
  CA: 'Foreign Buyer Ban 2023, FINTRAC AML, land transfer tax, condo/strata act, foreign buyer tax in BC/ON',
  AE: 'RERA Dubai regulations, Trakheesi permit verification, off-plan escrow, DLD transfer fees 4%',
  SA: 'Saudi Investment Law, foreign ownership in NEOM/Vision 2030 zones, Riyali AML compliance',
  AU: 'FIRB foreign investment approval, stamp duty, strata title, auction clearance, negative gearing',
  BR: 'ITBI transfer tax ~3%, IPTU annual property tax, condomínio fees, foreign ownership generally permitted',
  MX: 'Fideicomiso trust for foreign buyers in coastal/border zones, ISAI transfer tax ~2–4%',
  CO: 'Impuesto de Delineación Urbana, Catastro valuation, restitución de tierras risk in rural areas',
  AR: 'Currency controls (CEPO), AFIP registration, peso vs USD pricing, foreign restrictions on rural land',
  SG: 'ABSD 60% for foreigners, SLA approval, strata title vs 99yr leasehold',
  MY: 'MM2H visa programme, RPGT capital gains, foreign threshold MYR 1M+, Malay reserved land',
  TH: 'Foreign freehold condo quota 49%, Chanote title deed, 30+30yr lease for houses',
  ZA: 'FICA AML compliance, Transfer Duty, HOA special levies, Sectional Title Act',
  UA: 'Wartime restrictions, agricultural land moratorium, title registry disruptions, reconstruction risk zones',
  JP: 'No foreign ownership restrictions, Jutakuchi-ho building standards, seismic compliance, fixed-term leases',
  IN: 'RERA 2016, foreign ownership restricted to NRI/OCI, stamp duty 5–8%, benami prohibition',
};

const CURRENCY_MAP = {
  CH:'CHF', DE:'EUR', AT:'EUR', GB:'GBP', FR:'EUR', ES:'EUR', PT:'EUR', IT:'EUR',
  US:'USD', CA:'CAD', AE:'AED', SA:'SAR', AU:'AUD',
  BR:'BRL', MX:'MXN', CO:'COP', AR:'USD', SG:'SGD', MY:'MYR', TH:'THB',
  ZA:'ZAR', UA:'UAH', JP:'JPY', IN:'INR',
};

// ─── Build scoring prompt ──────────────────────────────────────────────────
function buildScoringPrompt(listings, searchParams, market) {
  const currency = CURRENCY_MAP[market] || 'USD';

  const listingsSummary = listings.map((l, i) => `
LISTING ${i+1}:
- Title: ${l.title}
- Address: ${l.address}
- Price: ${l.price ? `${l.priceUnit||currency} ${typeof l.price==='number'?l.price.toLocaleString():l.price}` : 'Not disclosed'}
- Rooms/Beds: ${l.rooms || 'N/A'}
- Area: ${l.livingArea ? `${l.livingArea}m²` : 'N/A'}
- Year built: ${l.yearBuilt || 'N/A'}
- Source: ${l.source} — ${l.listingUrl || 'no URL'}
- Description: ${l.description || 'N/A'}
${l.extras && Object.keys(l.extras).length ? `- Extra: ${JSON.stringify(l.extras)}` : ''}`
  ).join('\n---\n');

  return `You are the 9D scoring engine for get9d.com — professional property intelligence for EAMs and family offices.

REAL listings from live portals are provided below. Score ONLY these listings. Never invent properties.
If data is missing for a dimension, apply conservative default (5.0) and note it.
Currency for this market: ${currency}

9D FRAMEWORK (0–10 each):
D1 Valuation & Renovation — Price vs comps, price/m², renovation signals
D2 Climate Risk — Flood/fire/seismic, energy rating (EPC/DPE/Minergie)
D3 Demographic Trend — Population growth, migration, age structure
D4 Return on Investment — Gross yield, capital growth, IRR potential
D5 Rental & Vacancy — Local vacancy rate, rental demand, achievable rent
D6 Liveability & Proximity — Transport, schools, amenities, walkability
D7 Appreciation Potential — Infrastructure pipeline, rezoning, gentrification
D8 Seller Motivation — Days on market, price reductions, listing urgency
D9 Legal & Regulatory — ${D9_RULES[market] || 'Local property law, title integrity, AML compliance'}

SUPPRESSION RULE: Any D9 sub-score < 3.0 → cap composite at 5.0, flag prominently.
COMPOSITE: D1×15% + D2×10% + D3×10% + D4×15% + D5×10% + D6×10% + D7×10% + D8×10% + D9×10%

SEARCH: ${market} | ${searchParams.location} | ${searchParams.propertyType==='rent'?'Rental':'Purchase'}${searchParams.minPrice?` | Min ${currency} ${searchParams.minPrice}`:''}${searchParams.maxPrice?` | Max ${currency} ${searchParams.maxPrice}`:''}${searchParams.minRooms?` | Min rooms: ${searchParams.minRooms}`:''}

REAL LISTINGS (${listings.length}):
${listingsSummary}

Respond ONLY in valid JSON — no preamble, no markdown fences:
{"results":[{"rank":1,"title":"...","address":"...","price":0,"priceUnit":"${currency}","listingUrl":"...","source":"...","compositeScore":7.4,"suppressed":false,"suppressionReason":null,"dimensions":{"D1":{"score":7.0,"label":"Valuation & Renovation","rationale":"..."},"D2":{"score":7.5,"label":"Climate Risk","rationale":"..."},"D3":{"score":7.5,"label":"Demographic Trend","rationale":"..."},"D4":{"score":6.0,"label":"Return on Investment","rationale":"..."},"D5":{"score":7.0,"label":"Rental & Vacancy","rationale":"..."},"D6":{"score":9.0,"label":"Liveability & Proximity","rationale":"..."},"D7":{"score":7.5,"label":"Appreciation Potential","rationale":"..."},"D8":{"score":6.5,"label":"Seller Motivation","rationale":"..."},"D9":{"score":8.0,"label":"Legal & Regulatory","rationale":"..."}},"flags":[],"summary":"Two-sentence investment thesis."}],"searchMeta":{"location":"${searchParams.location}","market":"${market}","listingsFound":${listings.length},"dataSource":"live portal data via Apify","scoredAt":"${new Date().toISOString()}"}}`;
}

// ─── Main handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });

  const body = req.body ?? {};

  // ── Proxy mode (passthrough for direct Claude calls from frontend)
  if (body.mode === 'proxy' || (!body.mode && body.messages)) {
    const { model, messages, system, max_tokens, tools, tool_choice } = body;
    if (!model || !ALLOWED_MODELS.includes(model)) return res.status(400).json({ error: 'Invalid model', allowed: ALLOWED_MODELS });
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages required' });
    const clampedTokens = Math.min(typeof max_tokens==='number'&&max_tokens>0?max_tokens:MAX_TOKENS_CAP, MAX_TOKENS_CAP);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json','x-api-key':anthropicKey,'anthropic-version':'2023-06-01','anthropic-beta':'web-search-2025-03-05' },
        body: JSON.stringify({ model, messages, max_tokens: clampedTokens, ...(system&&{system}), ...(tools&&{tools}), ...(tool_choice&&{tool_choice}) }),
      });
      return res.status(r.status).json(await r.json());
    } catch (e) { return res.status(500).json({ error: 'Proxy failed', detail: e.message }); }
  }

  // ── URL mode: scrape a specific listing URL then score it
  if (body.mode === 'url') {
    const { listingUrl, countryCode, model } = body;
    if (!listingUrl) return res.status(400).json({ error: 'listingUrl is required for url mode' });

    const scoringModel = ALLOWED_MODELS.includes(model) ? model : 'claude-sonnet-4-6';

    let listing, market;
    try {
      const result = await fetchListingByUrl(listingUrl, countryCode);
      listing = result.listing;
      market = result.market;
    } catch (err) {
      return res.status(200).json({
        error: 'url_scrape_failed',
        message: err.message,
      });
    }

    const searchParams = { location: listing.address || listingUrl, propertyType: 'buy', countryCode };

    try {
      const ar = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json','x-api-key':anthropicKey,'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model: scoringModel, max_tokens: MAX_TOKENS_CAP, messages: [{ role: 'user', content: buildScoringPrompt([listing], searchParams, market) }] }),
      });
      const ad = await ar.json();
      if (!ar.ok) return res.status(ar.status).json({ error: 'Scoring failed', detail: ad });

      const rawText = ad.content?.[0]?.text || '';
      let scored;
      try { scored = JSON.parse(rawText.replace(/```json|```/g,'').trim()); }
      catch { return res.status(500).json({ error: 'Failed to parse scoring response', raw: rawText }); }

      scored.rawListings = [listing];
      scored.mode = 'url';
      return res.status(200).json(scored);
    } catch (e) {
      return res.status(500).json({ error: 'Scoring failed', detail: e.message });
    }
  }

  // ── Score mode: search by location and score results
  if (body.mode === 'score') {
    const { location, minPrice, maxPrice, minRooms, maxRooms, propertyType, countryCode, model } = body;
    if (!location) return res.status(400).json({ error: 'location is required' });

    const scoringModel = ALLOWED_MODELS.includes(model) ? model : 'claude-sonnet-4-6';
    const searchParams = { location, minPrice, maxPrice, minRooms, maxRooms, propertyType, countryCode };
    const market = detectMarket(location, countryCode || '');

    let listings = [], portalErrors = [];

    try {
      const result = await fetchListings(searchParams);
      listings = result.listings || [];
      portalErrors = result.portalErrors || [];

      if (result.noActor) {
        return res.status(200).json({
          error: 'market_not_supported',
          message: result.reason || `Live portal data is not yet available for this market. Perplexity Sonar integration coming soon.`,
          market, results: [],
          searchMeta: { location, market, listingsFound: 0, dataSource: 'none', scoredAt: new Date().toISOString() },
        });
      }
    } catch (err) {
      portalErrors.push(err.message);
    }

    if (listings.length === 0) {
      return res.status(200).json({
        error: 'no_listings_found',
        message: `No listings found for "${location}". Try a larger city, broader price range, or fewer filters.`,
        market, portalErrors, results: [],
        searchMeta: { location, market, listingsFound: 0, dataSource: 'none — hallucination prevention active', scoredAt: new Date().toISOString() },
      });
    }

    try {
      const ar = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json','x-api-key':anthropicKey,'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model: scoringModel, max_tokens: MAX_TOKENS_CAP, messages: [{ role: 'user', content: buildScoringPrompt(listings, searchParams, market) }] }),
      });
      const ad = await ar.json();
      if (!ar.ok) return res.status(ar.status).json({ error: 'Scoring failed', detail: ad });

      const rawText = ad.content?.[0]?.text || '';
      let scored;
      try { scored = JSON.parse(rawText.replace(/```json|```/g,'').trim()); }
      catch { return res.status(500).json({ error: 'Failed to parse scoring response', raw: rawText }); }

      scored.rawListings = listings;
      if (portalErrors.length) scored.portalErrors = portalErrors;
      return res.status(200).json(scored);
    } catch (e) {
      return res.status(500).json({ error: 'Scoring failed', detail: e.message });
    }
  }

  return res.status(400).json({
    error: 'Use mode: "score", "url", or "proxy".',
    verifiedMarkets: Object.entries(PORTAL_CONFIG).filter(([,v])=>v!==null).map(([k])=>k),
    unsupportedMarkets: Object.entries(PORTAL_CONFIG).filter(([,v])=>v===null).map(([k])=>k),
    example: { mode: 'score', location: 'Aarau, Aargau', propertyType: 'buy', minPrice: 500000, maxPrice: 1500000, minRooms: 3 },
  });
}
