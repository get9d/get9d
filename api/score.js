// get9d.com — 9D Property Scoring Engine v4.2 (Global — Verified + Validated + Auctions)
// dealType "auction": DE ZVG-Portal foreclosures + ES BOE.es judicial auctions
// All Apify actor IDs verified against live Apify Store pages July 2026.
// Server-side output validation: results must trace to real scraped listings.
// NO Claude/Perplexity fallback — hard fail prevents hallucination.
// Perplexity Sonar slot reserved (stubbed) for future activation.

export const config = { maxDuration: 60 };

const ALLOWED_MODELS = [
  'claude-opus-4-8','claude-sonnet-4-6','claude-haiku-4-5-20251001',
  'claude-3-5-sonnet-20241022','claude-3-5-haiku-20241022','claude-3-opus-20240229',
];
const MAX_TOKENS_CAP = 8192;   // proxy mode (frontend single-property scoring — no Apify in the same request)
const SCORE_TOKENS   = 3600;   // discovery mode — must fit alongside Apify inside 60s Vercel limit
const URL_SCORE_TOKENS = 2800; // url mode — single listing after Apify detail scrape
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
      title: i.title || i.name || [i.rooms, 'Zimmer', i.propertyType].filter(Boolean).join(' ') || '',
      address: [i.street, i.zip, i.city, i.canton].filter(Boolean).join(', '),
      price: i.price || i.pricePerMonth || i.purchasePrice || null,
      priceUnit: 'CHF',
      rooms: i.rooms || i.numberOfRooms || null,
      livingArea: i.area || i.livingSpace || null,
      floor: i.floor || null,
      yearBuilt: i.yearBuilt || i.constructionYear || null,
      listingUrl: i.source_url || i.url || i.listingUrl || null,
      description: (i.description || i.shortDescription || '').slice(0, 500) || null,
      images: i.image_url ? [i.image_url] : (i.imageUrls ? i.imageUrls.slice(0,2) : []),
      source: 'homegate.ch',
      extras: { features: i.features, lat: i.latitude, lng: i.longitude, propertyType: i.propertyType },
    }),
  }],

  // ── Germany ───────────────────────────────────────────────────────────
  // Actor: igolaizola/immobilienscout24-scraper (verified ✓, active)
  // Input: location (city string), operation (buy/rent), maxResults
  DE: [{
    name: 'ImmobilienScout24.de',
    actorId: 'igolaizola/immobilienscout24-scraper',
    buildInput: (p) => ({
      location: p.location || '',
      operation: p.propertyType === 'rent' ? 'rent' : 'buy',
      maxResults: 10,
    }),
    normalise: (i) => ({
      title: i.title || i.address || i.realEstateId || '',
      address: i.address || i.addressInformation?.address || '',
      price: i.price?.value || i.price || i.attributes?.find(a => a.label === 'Kaufpreis' || a.label === 'Kaltmiete')?.value || null,
      priceUnit: 'EUR',
      rooms: i.rooms || i.numberOfRooms || i.attributes?.find(a => a.label === 'Zimmer')?.value || null,
      livingArea: i.livingSpace || i.area || i.attributes?.find(a => a.label === 'Wohnfläche')?.value || null,
      floor: i.floor || i.floorNumber || null,
      yearBuilt: i.constructionYear || i.yearBuilt || null,
      listingUrl: i.url || i.listingUrl || (i.realEstateId ? `https://www.immobilienscout24.de/expose/${i.realEstateId}` : null),
      description: (i.description || i.titleDescriptionText || '').slice(0, 500) || null,
      images: i.images ? i.images.slice(0, 2) : (i.media ? i.media.slice(0,2) : []),
      source: 'immobilienscout24.de',
      extras: { energyClass: i.energyClass, courtageNote: i.courtageNote },
    }),
  }],

  // ── Austria ───────────────────────────────────────────────────────────
  // Actor: igolaizola/immobilienscout24-scraper covers .at via country param
  // Also covers fatihtahta/immobilienscout24-scraper as backup
  AT: [{
    name: 'ImmobilienScout24.at',
    actorId: 'igolaizola/immobilienscout24-scraper',
    buildInput: (p) => ({
      location: p.location || 'Wien',
      operation: p.propertyType === 'rent' ? 'rent' : 'buy',
      country: 'at',
      maxResults: 10,
    }),
    normalise: (i) => ({
      title: i.title || i.address || '',
      address: i.address || i.addressInformation?.address || '',
      price: i.price?.value || i.price || null,
      priceUnit: 'EUR',
      rooms: i.rooms || i.numberOfRooms || null,
      livingArea: i.livingSpace || i.area || null,
      floor: i.floor || null,
      yearBuilt: i.constructionYear || null,
      listingUrl: i.url || i.listingUrl || null,
      description: (i.description || '').slice(0, 500) || null,
      images: i.images ? i.images.slice(0, 2) : [],
      source: 'immobilienscout24.at',
      extras: {},
    }),
  }],

  // ── Spain / Portugal / Italy ──────────────────────────────────────────────
  // Actor: blackfalcondata/idealista-scraper (pay-per-event, no subscription required)
  // Input: country (es/pt/it), operation (sale/rent), propertyType (homes), location, maxResults
  ES: [{
    name: 'Idealista (ES/PT/IT)',
    actorId: 'blackfalcondata/idealista-scraper',
    buildInput: (p) => ({
      country: p.country || 'es',
      operation: p.propertyType === 'rent' ? 'rent' : 'sale',
      propertyType: 'homes',
      location: p.location || '',
      maxResults: 10,
    }),
    normalise: (i) => ({
      title: i.title || (i.suggestedTexts && i.suggestedTexts.title) || '',
      address: i.address || i.district || '',
      price: i.price,
      priceUnit: 'EUR',
      rooms: i.rooms,
      livingArea: i.size,
      floor: i.floor || null,
      yearBuilt: null,
      listingUrl: i.url || (i.propertyCode ? ('https://www.idealista.com/inmueble/' + i.propertyCode + '/') : null),
      description: (i.description || '').slice(0, 500) || null,
      images: i.thumbnail ? [i.thumbnail] : [],
      source: 'idealista.com',
      extras: { priceByArea: i.priceByArea, hasLift: i.hasLift },
    }),
  }],
  PT: [{ alias: 'ES', country: 'pt', source: 'idealista.pt' }],
  IT: [{ alias: 'ES', country: 'it', source: 'idealista.it' }],

  // ── France ────────────────────────────────────────────────────────────
  // No single verified actor found for SeLoger — using Idealista France
  // Actor: igolaizola/idealista-scraper supports France too
  FR: [{
    name: 'Idealista France',
    actorId: 'blackfalcondata/idealista-scraper',
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

  // ── United Kingdom ────────────────────────────────────────────────────────
  // Actor: automation-lab/rightmove-scraper (verified ✓, fast HTTP, pay-per-listing)
  // Input: searchLocation (city/postcode), listingType (for_sale/to_rent), maxItems
  GB: [{
    name: 'Rightmove UK',
    actorId: 'automation-lab/rightmove-scraper',
    buildInput: (p) => ({
      searchLocation: p.location || '',
      listingType: p.propertyType === 'rent' ? 'to_rent' : 'for_sale',
      maxItems: 10,
    }),
    normalise: (i) => ({
      title: i.displayAddress || i.address || i.title || '',
      address: i.displayAddress || i.address || '',
      price: (i.price && i.price.amount) ? i.price.amount : i.price,
      priceUnit: 'GBP',
      rooms: i.bedrooms,
      livingArea: i.floorArea || null,
      floor: null,
      yearBuilt: null,
      listingUrl: i.propertyUrl || i.url || null,
      description: (i.summary || i.description || '').slice(0, 500) || null,
      images: i.images ? i.images.slice(0, 2) : (i.photos ? i.photos.slice(0,2) : []),
      source: 'rightmove.co.uk',
      extras: { epcRating: i.epcRating, councilTaxBand: i.councilTaxBand, tenure: i.tenure, lat: i.latitude, lng: i.longitude },
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
      includeDetails: false,
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

  // ── UAE / Middle East ─────────────────────────────────────────────────────
  // Actor: shahidirfan/propertyfinder-scraper (verified ✓, URL-based, no proxies)
  // Input: startUrls (PropertyFinder search URLs), maxItems
  AE: [{
    name: 'PropertyFinder UAE',
    actorId: 'shahidirfan/propertyfinder-scraper',
    buildInput: (p) => {
      const type = p.propertyType === 'rent' ? 'rent' : 'buy';
      const loc = encodeURIComponent(p.location || 'Dubai');
      return {
        startUrls: [{
          url: `https://www.propertyfinder.ae/en/search?c=2&t=1&fu=0&ob=nd&l=${loc}&rp=${type}`,
        }],
        maxItems: 10,
      };
    },
    normalise: (i) => ({
      title: i.title || i.name || '',
      address: i.location || i.community || i.address || '',
      price: i.price || i.askingPrice || null,
      priceUnit: 'AED',
      rooms: i.bedrooms || i.beds || null,
      livingArea: i.area || i.size || null,
      floor: null,
      yearBuilt: null,
      listingUrl: i.url || null,
      description: (i.description || '').slice(0, 500) || null,
      images: i.images ? i.images.slice(0, 2) : (i.photos ? i.photos.slice(0,2) : []),
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
    buildInput: (p) => {
      // Domain.com.au needs suburb slugs like "sydney-nsw-2000"
      // Convert plain city name to a best-guess slug
      const loc = (p.location || 'sydney').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      return {
        suburbs: [loc],
        listingType: p.propertyType === 'rent' ? 'rent' : 'sale',
        minPrice: p.minPrice || undefined,
        maxPrice: p.maxPrice || undefined,
        minBedrooms: p.minRooms || undefined,
        maxListings: 10,
      };
    },
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
      images: i.image_urls ? i.image_urls.slice(0, 2) : (i.cover_image ? [i.cover_image] : (i.media?.images ? i.media.images.slice(0,2) : [])),
      source: 'property24.com',
      extras: { bathrooms: i.details?.bathrooms || i.bathrooms, garages: i.details?.garages, levies: i.fees?.levies },
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
  'idealista.com':           { actorId: 'parseforge/idealista-scraper', inputKey: 'startUrls' },
  'idealista.pt':            { actorId: 'parseforge/idealista-scraper', inputKey: 'startUrls' },
  'idealista.it':            { actorId: 'parseforge/idealista-scraper', inputKey: 'startUrls' },
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


// ─── AUCTION / DISTRESSED REGISTRY ────────────────────────────────────────
// Court foreclosure auctions — separate channel from regular listings.
// DE: ZVG-Portal (Zwangsversteigerungen) | ES: BOE.es (subastas judiciales)
// AT: Ediktsdatei insolvency/court publications (name or Bundesland search)
const AUCTION_CONFIG = {
  DE: {
    name: 'ZVG-Portal (Zwangsversteigerungen)',
    actorId: 'signalflow/zvg-portal-scraper',
    // Input: bundesland filter (e.g. "Bayern", "Berlin"). Maps city → Bundesland where possible.
    buildInput: (p) => {
      const BUNDESLAND_MAP = {
        'berlin':'Berlin','münchen':'Bayern','munich':'Bayern','hamburg':'Hamburg',
        'frankfurt':'Hessen','köln':'Nordrhein-Westfalen','cologne':'Nordrhein-Westfalen',
        'stuttgart':'Baden-Württemberg','düsseldorf':'Nordrhein-Westfalen',
        'leipzig':'Sachsen','dresden':'Sachsen','hannover':'Niedersachsen',
        'bremen':'Bremen','nürnberg':'Bayern','dortmund':'Nordrhein-Westfalen',
        'essen':'Nordrhein-Westfalen','bonn':'Nordrhein-Westfalen',
        'bayern':'Bayern','hessen':'Hessen','sachsen':'Sachsen',
        'baden-württemberg':'Baden-Württemberg','nordrhein-westfalen':'Nordrhein-Westfalen',
        'niedersachsen':'Niedersachsen','brandenburg':'Brandenburg',
        'thüringen':'Thüringen','rheinland-pfalz':'Rheinland-Pfalz',
        'schleswig-holstein':'Schleswig-Holstein','saarland':'Saarland',
        'mecklenburg-vorpommern':'Mecklenburg-Vorpommern','sachsen-anhalt':'Sachsen-Anhalt',
      };
      const locLower = (p.location || '').toLowerCase();
      let bundesland = null;
      for (const [key, bl] of Object.entries(BUNDESLAND_MAP)) {
        if (locLower.includes(key)) { bundesland = bl; break; }
      }
      return {
        ...(bundesland && { bundesland }),
        maxItems: 15,
      };
    },
    normalise: (i) => {
      const verkehrswert = i.verkehrswert || i.marketValue || i.market_value || null;
      const minBid = i.minBid || i.mindestgebot || i.min_bid_50 || (verkehrswert ? Math.round(verkehrswert * 0.5) : null);
      const safetyMargin = i.safetyMargin || i.sicherheitsgrenze || i.safety_70 || (verkehrswert ? Math.round(verkehrswert * 0.7) : null);
      return {
        title: `[AUKTION] ${i.title || i.objektArt || i.object_type || 'Zwangsversteigerung'}`,
        address: i.address || i.adresse || i.lage || '',
        price: verkehrswert,
        priceUnit: 'EUR',
        rooms: i.rooms || null,
        livingArea: i.area || i.wohnflaeche || null,
        floor: null,
        yearBuilt: i.yearBuilt || i.baujahr || null,
        listingUrl: i.url || i.detailUrl || 'https://www.zvg-portal.de',
        description: [
          `GERICHTLICHE ZWANGSVERSTEIGERUNG.`,
          verkehrswert ? `Verkehrswert (court-assessed market value): EUR ${verkehrswert.toLocaleString?.() || verkehrswert}.` : '',
          minBid ? `Legal minimum bid (50% rule): EUR ${minBid.toLocaleString?.() || minBid}.` : '',
          safetyMargin ? `Creditor objection threshold (70% rule): EUR ${safetyMargin.toLocaleString?.() || safetyMargin}.` : '',
          i.terminDatum || i.auctionDate ? `Auction date: ${i.terminDatum || i.auctionDate}.` : '',
          i.amtsgericht || i.court ? `Court: ${i.amtsgericht || i.court}.` : '',
          i.aktenzeichen || i.caseNumber ? `Case number: ${i.aktenzeichen || i.caseNumber}.` : '',
          (i.description || i.objektBeschreibung || '').slice(0, 250),
        ].filter(Boolean).join(' '),
        images: [],
        source: 'zvg-portal.de',
        extras: {
          dealType: 'auction',
          verkehrswert,
          minBid50: minBid,
          safetyMargin70: safetyMargin,
          auctionDate: i.terminDatum || i.auctionDate || null,
          court: i.amtsgericht || i.court || null,
          caseNumber: i.aktenzeichen || i.caseNumber || null,
        },
      };
    },
  },

  ES: {
    name: 'BOE.es Subastas (Spanish judicial auctions)',
    actorId: 'signalflow/spain-auction-scout',
    buildInput: (p) => ({
      location: p.location || '',
      maxItems: 15,
    }),
    normalise: (i) => {
      const valuation = i.valoracion || i.valuation || i.marketValue || null;
      return {
        title: `[SUBASTA] ${i.title || i.tipo || 'Subasta judicial'}`,
        address: i.address || i.direccion || i.localidad || '',
        price: valuation,
        priceUnit: 'EUR',
        rooms: null,
        livingArea: i.area || i.superficie || null,
        floor: null,
        yearBuilt: null,
        listingUrl: i.url || 'https://subastas.boe.es',
        description: [
          `SUBASTA JUDICIAL (Spanish court auction).`,
          valuation ? `Court valuation: EUR ${valuation.toLocaleString?.() || valuation}.` : '',
          i.cargas ? `Registered charges (cargas): ${i.cargas}.` : '',
          i.refCatastral || i.cadastralRef ? `Cadastral ref: ${i.refCatastral || i.cadastralRef}.` : '',
          i.fechaFin || i.endDate ? `Auction closes: ${i.fechaFin || i.endDate}.` : '',
          (i.description || '').slice(0, 250),
        ].filter(Boolean).join(' '),
        images: [],
        source: 'subastas.boe.es',
        extras: {
          dealType: 'auction',
          valuation,
          cargas: i.cargas || null,
          cadastralRef: i.refCatastral || i.cadastralRef || null,
          auctionEnd: i.fechaFin || i.endDate || null,
        },
      };
    },
  },

  // AT Ediktsdatei is insolvency-publication based (searches by debtor name or Bundesland),
  // not property-search based — reserved for a dedicated insolvency-monitoring feature.
  AT: null,
};

// ─── Fetch auction listings ────────────────────────────────────────────────
async function fetchAuctionListings(searchParams) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) throw new Error('APIFY_TOKEN not configured.');

  const market = detectMarket(searchParams.location, searchParams.countryCode || '');
  const auctionSource = AUCTION_CONFIG[market];

  if (!auctionSource) {
    return { listings: [], market, noActor: true, reason: `Court auction data is currently available for Germany (ZVG-Portal) and Spain (BOE.es). Market ${market} auction coverage is coming soon.` };
  }

  // Auctions: bare country name → search nationwide (empty location = no filter),
  // otherwise strip the ", Country" suffix like the standard fetcher.
  const normAuc = normaliseLocationForActor(searchParams.location, market);
  const aucLocation = COUNTRY_NAME_PATTERNS.test((searchParams.location || '').trim())
    ? '' // nationwide auction search
    : normAuc.location;
  const input = auctionSource.buildInput({ ...searchParams, location: aucLocation });
  const res = await fetch(
    `https://api.apify.com/v2/acts/${auctionSource.actorId}/run-sync-get-dataset-items?token=${apifyToken}&timeout=25`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
  );

  if (!res.ok) {
    throw new Error(`${auctionSource.name} returned ${res.status} ${res.statusText}`);
  }

  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) {
    return { listings: [], market, portalErrors: [] };
  }

  const listings = items.slice(0, 15).map(item => {
    try { return auctionSource.normalise(item); } catch { return null; }
  }).filter(Boolean);

  // Filter by price range against Verkehrswert if provided
  const filtered = listings.filter(l => {
    if (searchParams.minPrice && l.price && l.price < searchParams.minPrice) return false;
    if (searchParams.maxPrice && l.price && l.price > searchParams.maxPrice) return false;
    return true;
  });

  return { listings: filtered.slice(0, 5), market, portalErrors: [] };
}

// ─── Market detection ──────────────────────────────────────────────────────
// Two-pass: (1) explicit countryCode, (2) full country names, (3) major cities,
// (4) two-letter codes ONLY as ", xx" suffix — prevents "Ciudad de Mexico" → DE bug.
function detectMarket(location = '', countryCode = '') {
  const code = (countryCode || '').toUpperCase();
  if (code && PORTAL_CONFIG[code] !== undefined) return code;
  const loc = location.toLowerCase();

  // Pass 1 — full country names (unambiguous)
  if (/switzerland|schweiz|suisse|svizzera/.test(loc)) return 'CH';
  if (/germany|deutschland/.test(loc)) return 'DE';
  if (/austria|österreich|oesterreich/.test(loc)) return 'AT';
  if (/united kingdom|england|scotland|wales/.test(loc) || /\buk\b/.test(loc)) return 'GB';
  if (/france/.test(loc)) return 'FR';
  if (/portugal/.test(loc)) return 'PT';
  if (/\bitaly\b|\bitalia\b/.test(loc)) return 'IT';
  if (/spain|españa|espana/.test(loc)) return 'ES';
  if (/united states|\busa\b/.test(loc)) return 'US';
  if (/\bcanada\b/.test(loc)) return 'CA';
  if (/\buae\b|emirates/.test(loc)) return 'AE';
  if (/saudi arabia|\bsaudi\b/.test(loc)) return 'SA';
  if (/australia/.test(loc)) return 'AU';
  if (/brazil|brasil/.test(loc)) return 'BR';
  if (/\bmexico\b|méxico/.test(loc)) return 'MX';
  if (/colombia/.test(loc)) return 'CO';
  if (/argentina/.test(loc)) return 'AR';
  if (/singapore/.test(loc)) return 'SG';
  if (/malaysia/.test(loc)) return 'MY';
  if (/thailand/.test(loc)) return 'TH';
  if (/south africa|nigeria|kenya|namibia|botswana|zimbabwe|zambia|tanzania|mozambique/.test(loc)) return 'ZA';
  if (/ukraine/.test(loc)) return 'UA';
  if (/\bjapan\b/.test(loc)) return 'JP';
  if (/\bindia\b/.test(loc)) return 'IN';

  // Pass 2 — major cities (unambiguous)
  if (/zürich|zurich|\bbern\b|aarau|basel|luzern|aargau|\bzug\b|lausanne|winterthur|boniswil|st\.? gallen/.test(loc)) return 'CH';
  if (/berlin|münchen|munich|hamburg|frankfurt|köln|cologne|stuttgart|düsseldorf|leipzig|dresden/.test(loc)) return 'DE';
  if (/\bwien\b|vienna|salzburg|\bgraz\b|innsbruck|\blinz\b/.test(loc)) return 'AT';
  if (/london|manchester|birmingham|edinburgh|bristol|leeds|glasgow|liverpool/.test(loc)) return 'GB';
  if (/\bparis\b|\blyon\b|marseille|bordeaux|toulouse|\bnice\b|nantes|strasbourg/.test(loc)) return 'FR';
  if (/lisboa|lisbon|\bporto\b|algarve|cascais|\bfaro\b|braga|sintra/.test(loc)) return 'PT';
  if (/\broma\b|\brome\b|milan|milano|florence|firenze|naples|napoli|venice|venezia|torino|turin/.test(loc)) return 'IT';
  if (/madrid|barcelona|sevilla|seville|valencia|malaga|málaga|asturias|gijón|gijon|bilbao|alicante/.test(loc)) return 'ES';
  if (/new york|los angeles|chicago|houston|miami|san francisco|seattle|boston|atlanta|denver|austin|dallas/.test(loc)) return 'US';
  if (/toronto|vancouver|montreal|calgary|ottawa|edmonton|winnipeg/.test(loc)) return 'CA';
  if (/\bdubai\b|abu dhabi|sharjah|ajman/.test(loc)) return 'AE';
  if (/riyadh|jeddah|mecca|medina|dammam/.test(loc)) return 'SA';
  if (/sydney|melbourne|brisbane|perth|adelaide|canberra|gold coast|hobart/.test(loc)) return 'AU';
  if (/são paulo|sao paulo|rio de janeiro|belo horizonte|brasilia|curitiba/.test(loc)) return 'BR';
  if (/ciudad de mexico|\bcdmx\b|guadalajara|monterrey|cancún|cancun|tijuana/.test(loc)) return 'MX';
  if (/bogota|bogotá|medellin|medellín|\bcali\b|cartagena/.test(loc)) return 'CO';
  if (/buenos aires|cordoba|córdoba|rosario|mendoza/.test(loc)) return 'AR';
  if (/kuala lumpur|penang|johor bahru/.test(loc)) return 'MY';
  if (/bangkok|phuket|chiang mai|pattaya/.test(loc)) return 'TH';
  if (/cape town|johannesburg|durban|sandton|pretoria|nairobi|lagos|windhoek/.test(loc)) return 'ZA';
  if (/kyiv|kiev|lviv|odesa|kharkiv/.test(loc)) return 'UA';
  if (/tokyo|osaka|kyoto|yokohama|nagoya/.test(loc)) return 'JP';
  if (/mumbai|delhi|bangalore|bengaluru|hyderabad|chennai|pune/.test(loc)) return 'IN';

  // Pass 3 — two-letter codes ONLY as explicit ", xx" suffix (safe)
  const suffixMatch = loc.match(/,\s*([a-z]{2})\s*$/);
  if (suffixMatch) {
    const cc = suffixMatch[1].toUpperCase();
    if (PORTAL_CONFIG[cc] !== undefined) return cc;
  }

  return 'CH'; // default core market
}

// ─── Location normaliser for actor inputs ──────────────────────────────────
// Portal actors need a city/region — a bare country name ("Spain") returns
// zero results. If the location is only a country, substitute the market's
// default search city. Also strips ", Country" suffixes ("Aarau, Switzerland"
// → "Aarau") since most actors expect city-only input.
const DEFAULT_SEARCH_CITY = {
  CH:'Zürich', DE:'Berlin', AT:'Wien', GB:'London', FR:'Paris',
  ES:'Madrid', PT:'Lisboa', IT:'Milano', US:'Miami', CA:'Toronto',
  AE:'Dubai', SA:'Riyadh', AU:'Sydney', BR:'São Paulo', MX:'Ciudad de México',
  SG:'Singapore', MY:'Kuala Lumpur', TH:'Bangkok', ZA:'Cape Town',
};

const COUNTRY_NAME_PATTERNS = /^(switzerland|schweiz|suisse|svizzera|germany|deutschland|austria|österreich|oesterreich|united kingdom|england|uk|france|portugal|italy|italia|spain|españa|espana|united states|usa|canada|uae|emirates|saudi arabia|saudi|australia|brazil|brasil|mexico|méxico|singapore|malaysia|thailand|south africa)$/i;

function normaliseLocationForActor(location, market) {
  let loc = (location || '').trim();

  // Strip trailing ", Country" suffix — actors want city-only
  loc = loc.replace(/,\s*(switzerland|schweiz|suisse|germany|deutschland|austria|österreich|united kingdom|uk|france|portugal|italy|italia|spain|españa|united states|usa|canada|uae|australia|brazil|mexico|singapore|malaysia|thailand|south africa)\s*$/i, '').trim();

  // Bare country name → default search city for that market
  if (!loc || COUNTRY_NAME_PATTERNS.test(loc)) {
    return { location: DEFAULT_SEARCH_CITY[market] || loc, substituted: true, original: location };
  }

  return { location: loc, substituted: false, original: location };
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

  // Normalise the location: bare country → default city, strip ", Country" suffix
  const norm = normaliseLocationForActor(searchParams.location, market);
  const actorParams = { ...searchParams, location: norm.location };

  const portals = resolvePortals(market, actorParams);
  if (!portals || portals.length === 0) {
    return { listings: [], market, noActor: true, reason: `No actor configured for ${market}` };
  }

  const results = await Promise.allSettled(
    portals.map(async (portal) => {
      const input = portal.buildInput(actorParams);
      // Abort at 28s — Apify's timeout=25 should return first, this is the safety net
      const ctrl = new AbortController();
      const abortTimer = setTimeout(() => ctrl.abort(), 28000);
      try {
        const res = await fetch(
          `https://api.apify.com/v2/acts/${portal.actorId}/run-sync-get-dataset-items?token=${apifyToken}&timeout=25`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: ctrl.signal }
        );
        if (!res.ok) throw new Error(`${portal.name} → ${res.status} ${res.statusText}`);
        const items = await res.json();
        return { portal: portal.name, items: Array.isArray(items) ? items : [] };
      } finally {
        clearTimeout(abortTimer);
      }
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

  return {
    // Score at most 5 listings — keeps the Claude scoring call fast enough
    // to fit alongside the Apify scrape inside Vercel's 60s function limit.
    listings: deduped.slice(0, 5), market, portalErrors,
    ...(norm.substituted && { locationSubstituted: true, searchedLocation: norm.location, originalLocation: norm.original }),
  };
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

  // Most actors accept [{url}], a few want plain strings — send object form
  // (Apify's requestListSources standard) and let 400s trigger a string retry.
  let input = { [scraper.inputKey]: [{ url: listingUrl }], maxItems: 1 };

  const endpoint = `https://api.apify.com/v2/acts/${scraper.actorId}/run-sync-get-dataset-items?token=${apifyToken}&timeout=25`;
  let res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });

  // Retry once with plain-string URL array if the object form was rejected
  if (res.status === 400) {
    input = { [scraper.inputKey]: [listingUrl], maxItems: 1 };
    res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  }

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

// ─── Anti-hallucination output validation ─────────────────────────────────
// Enforces: results must map to real scraped listings, scores clamped 0-10,
// D9 suppression rule applied in code (not just prompt), prices from real data.
function validateScoredOutput(scored, realListings) {
  if (!scored || !Array.isArray(scored.results)) return scored;

  const realUrls = new Set(realListings.map(l => l.listingUrl).filter(Boolean));
  const realByUrl = {};
  realListings.forEach(l => { if (l.listingUrl) realByUrl[l.listingUrl] = l; });

  const clamp = (n) => Math.max(0, Math.min(10, Number(n) || 0));

  scored.results = scored.results
    // Keep only results traceable to a real scraped listing
    .filter(r => {
      if (realUrls.size === 0) return true; // single-listing URL mode may lack URLs
      return r.listingUrl && realUrls.has(r.listingUrl);
    })
    .map((r, idx) => {
      const real = r.listingUrl ? realByUrl[r.listingUrl] : realListings[idx];

      // Force price/currency/address from REAL data — never trust model output for facts
      if (real) {
        r.price = real.price ?? r.price;
        r.priceUnit = real.priceUnit || r.priceUnit;
        r.address = real.address || r.address;
        r.title = real.title || r.title;
        r.source = real.source || r.source;
        r.listingUrl = real.listingUrl || r.listingUrl;
        r.livingArea = real.livingArea ?? r.livingArea;
      }

      // Clamp all dimension scores 0-10
      if (r.dimensions) {
        for (const key of Object.keys(r.dimensions)) {
          if (r.dimensions[key] && typeof r.dimensions[key].score !== 'undefined') {
            r.dimensions[key].score = clamp(r.dimensions[key].score);
          }
        }
      }
      r.compositeScore = clamp(r.compositeScore);

      // Enforce D9 suppression rule server-side — threshold raised to 4.0 (v5)
      const d9 = r.dimensions?.D9?.score;
      if (typeof d9 === 'number' && d9 < 4.0 && r.compositeScore > 5.0) {
        r.compositeScore = 5.0;
        r.suppressed = true;
        r.suppressionReason = r.suppressionReason || `D9 Legal & Regulatory score ${d9.toFixed(1)} < 4.0 — composite capped at 5.0`;
      }

      return r;
    });

  // Re-rank after filtering
  scored.results.sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0));
  scored.results.forEach((r, i) => { r.rank = i + 1; });

  if (scored.searchMeta) {
    scored.searchMeta.validated = true;
    scored.searchMeta.listingsFound = scored.results.length;
  }

  return scored;
}

// ─── Build scoring prompt ──────────────────────────────────────────────────
function buildScoringPrompt(listings, searchParams, market, isAuction = false) {
  const currency = CURRENCY_MAP[market] || 'USD';

  const auctionGuidance = isAuction ? `

AUCTION-SPECIFIC SCORING GUIDANCE (these are COURT FORECLOSURE AUCTIONS, not regular listings):
- The listed "price" is the court-assessed Verkehrswert/valuation, NOT an asking price. Acquisition below this value is the core opportunity.
- D1 Valuation: Score the SPREAD — legal minimum bid is 50% of Verkehrswert; creditor objection threshold is 70%. Realistic acquisition at 60-75% of Verkehrswert is a strong D1 signal (8+).
- D8 Seller Motivation: Foreclosures are maximum-motivation by definition — score execution risk instead: competing bidders, creditor behaviour, possible auction withdrawal.
- D9 Legal: Add auction-specific risks — no warranty (gekauft wie gesehen), no interior viewing before auction, occupants/tenants (Raeumung risk), surviving charges (Sicherungshypotheken), 10% security deposit due at auction.
- Flag prominently: interior condition is UNKNOWN in most foreclosures. Renovation estimates must be conservative.
- Composite for auctions rewards deep value spreads but must reflect execution and condition uncertainty.` : '';

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
D1 Valuation & Renovation — Price vs condition-adjusted comps, price/m², renovation signals, comparable set quality A/B/C
D2 Climate Risk — Flood zone (Copernicus), wildfire, heat stress, seismic, insurability, EPC/DPE/Minergie rating
D3 Demographic Trend — Municipal population 5yr/10yr, household formation, purchasing power, migration flows
D4 Return on Investment — NET yield on total invested capital; apply country transaction costs (${market==='CH'?'~5.5%':market==='DE'?'~10.6% varies by Bundesland':market==='ES'?'~12.6%':market==='PT'?'~8.8%':market==='FR'?'~12%':'~10%'}); rent control cap at 6.0; vacancy drag
D5 Rental / Vacancy — Vacancy at postcode, days-to-let, rental trend, short-term rental viability; if RENT CONTROL ZONE applies flag it in tags_warning and reduce score by 1.5; if DPE F/G (France) flag rental restriction
D6 Liveability & Proximity — Schools, grocery, transit frequency, healthcare, airport, parks; score by category
D7 Price Trend — Historical HPI at national/regional level (NOT a forward prediction); 1yr and 3yr CAGR, supply constraint, confirmed infrastructure only; NEVER claim certainty about future values
D8 Seller Motivation — Days-on-market vs market median, price cut count and total %, re-listing after withdrawal, auction type, distress language; return signals as a LIST of specific observable evidence (not summary)
D9 Legal & Regulatory — ${D9_RULES[market] || 'Local property law, title integrity, AML compliance'}; agency registration check; encumbrance flags; energy rating disclosure

SUPPRESSION RULE: D9 score < 4.0 → cap composite at 5.0, set suppressed:true, explain suppressionReason.
COMPOSITE: D1×15% + D2×10% + D3×10% + D4×15% + D5×10% + D6×10% + D7×10% + D8×10% + D9×10%${auctionGuidance}

OUTPUT REQUIREMENTS (apply to every dimension):
- confidence: "high" (15+ comparable data points, recent data), "medium" (5-14 or older data), "low" (<5 points, extrapolated, or missing source)
- key_inputs: array of 2-4 strings each showing one real data point used ("Asking €3,200/m² vs area median €2,850/m²", "Listed 214 days vs market median 55 days", etc.)
- D8 must include signals: array of objects {signal, text, weight:"high"|"medium"|"low"} — one entry per observable evidence item
- D9 must include flags: array of objects {type, level:"info"|"warning"|"critical", message} covering agency reg, energy disclosure, encumbrances, auction-specific risks
- D7 must include disclaimer: "Historical price data only. Past performance does not predict future values."
- D9 must include disclaimer: "D9 is based on observable public data only. Independent legal due diligence by a qualified local lawyer is mandatory before any property transaction. get9d does not provide legal advice."
- If fewer than 5 comparables exist for D1, set state:"LIMITED_DATA", score:null, and explain why — never fabricate a D1 score from thin data

SEARCH: ${market} | ${searchParams.location} | ${searchParams.propertyType==='rent'?'Rental':'Purchase'}${searchParams.minPrice?` | Min ${currency} ${searchParams.minPrice}`:''}${searchParams.maxPrice?` | Max ${currency} ${searchParams.maxPrice}`:''}${searchParams.minRooms?` | Min rooms: ${searchParams.minRooms}`:''}

REAL LISTINGS (${listings.length}):
${listingsSummary}

BREVITY (hard limits — total output must stay under 3,000 tokens):
- Score ALL ${listings.length} listings, none skipped.
- rationale: ONE short sentence per dimension (max 15 words).
- key_inputs: max 2 items per dimension, each under 10 words.
- signals (D8): max 3 entries. flags (D9): max 2 entries.
- summary: max 2 short sentences. No filler. Compact JSON.

Respond ONLY in valid JSON — no preamble, no markdown fences:
{"results":[{"rank":1,"title":"...","address":"...","price":0,"priceUnit":"${currency}","listingUrl":"...","source":"...","compositeScore":7.4,"suppressed":false,"suppressionReason":null,"dimensions":{"D1":{"score":7.0,"state":"SCORED","label":"Valuation & Renovation","confidence":"medium","key_inputs":["Asking €X/m² vs area median €Y/m²","N comparables used"],"rationale":"...","self_critical":"...","tags_positive":[],"tags_warning":[]},"D2":{"score":7.5,"label":"Climate Risk","confidence":"high","key_inputs":["Flood zone: moderate","Wildfire: low"],"rationale":"...","tags_positive":[],"tags_warning":[]},"D3":{"score":7.5,"label":"Demographic Trend","confidence":"medium","key_inputs":["Population +X% 5yr","Household formation: positive"],"rationale":"...","tags_positive":[],"tags_warning":[]},"D4":{"score":6.0,"label":"Return on Investment","confidence":"medium","key_inputs":["Gross yield ~X%","Net yield ~Y% after ~Z% transaction costs","Rent control: no"],"rationale":"...","tags_positive":[],"tags_warning":[]},"D5":{"score":7.0,"label":"Rental / Vacancy","confidence":"medium","key_inputs":["Avg rent €X/m²","Vacancy: low"],"rationale":"...","rentControlFlag":false,"tags_positive":[],"tags_warning":[]},"D6":{"score":9.0,"label":"Liveability & Proximity","confidence":"high","key_inputs":["Transit: excellent","Schools: within 500m"],"rationale":"...","tags_positive":[],"tags_warning":[]},"D7":{"score":7.5,"label":"Price Trend","confidence":"medium","key_inputs":["1yr HPI: +X%","3yr CAGR: +Y%"],"rationale":"...","disclaimer":"Historical price data only. Past performance does not predict future values.","tags_positive":[],"tags_warning":[]},"D8":{"score":6.5,"label":"Seller Motivation","confidence":"high","key_inputs":["Listed N days","N price reductions"],"signals":[{"signal":"STALE_LISTING","text":"Listed 214 days vs market median 55 days","weight":"high"}],"rationale":"...","tags_positive":[],"tags_warning":[]},"D9":{"score":8.0,"label":"Legal & Regulatory","confidence":"medium","key_inputs":["Agency registered: yes","Encumbrances: none found","EPC: disclosed"],"flags":[],"rationale":"...","disclaimer":"D9 is based on observable public data only. Independent legal due diligence by a qualified local lawyer is mandatory before any property transaction. get9d does not provide legal advice.","tags_positive":[],"tags_warning":[]}},"flags":[],"summary":"Two-sentence investment thesis."}],"searchMeta":{"location":"${searchParams.location}","market":"${market}","listingsFound":${listings.length},"dataSource":"${isAuction ? 'court auction data via Apify (ZVG/BOE)' : 'live portal data via Apify'}","scoredAt":"${new Date().toISOString()}"}}`;
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
        body: JSON.stringify({ model: scoringModel, max_tokens: URL_SCORE_TOKENS, messages: [{ role: 'user', content: buildScoringPrompt([listing], searchParams, market) }] }),
      });
      const ad = await ar.json();
      if (!ar.ok) return res.status(ar.status).json({ error: 'Scoring failed', detail: ad });

      const rawText = ad.content?.[0]?.text || '';
      let scored;
      try { scored = JSON.parse(rawText.replace(/```json|```/g,'').trim()); }
      catch { return res.status(500).json({ error: 'Failed to parse scoring response', raw: rawText }); }

      scored = validateScoredOutput(scored, [listing]);
      scored.rawListings = [listing];
      scored.mode = 'url';
      return res.status(200).json(scored);
    } catch (e) {
      return res.status(500).json({ error: 'Scoring failed', detail: e.message });
    }
  }

  // ── Score mode: search by location and score results
  // dealType: 'standard' (default, portal listings) | 'auction' (court foreclosures)
  if (body.mode === 'score') {
    const { location, minPrice, maxPrice, minRooms, maxRooms, propertyType, countryCode, model, dealType } = body;
    if (!location) return res.status(400).json({ error: 'location is required' });

    const scoringModel = ALLOWED_MODELS.includes(model) ? model : 'claude-sonnet-4-6';
    const searchParams = { location, minPrice, maxPrice, minRooms, maxRooms, propertyType, countryCode };
    const market = detectMarket(location, countryCode || '');
    const isAuction = dealType === 'auction';

    let listings = [], portalErrors = [], locSubInfo = null;

    try {
      const result = isAuction
        ? await fetchAuctionListings(searchParams)
        : await fetchListings(searchParams);
      listings = result.listings || [];
      portalErrors = result.portalErrors || [];
      if (result.locationSubstituted) {
        locSubInfo = { searchedLocation: result.searchedLocation, originalLocation: result.originalLocation };
      }

      if (result.noActor) {
        return res.status(200).json({
          error: isAuction ? 'auction_market_not_supported' : 'market_not_supported',
          message: result.reason || `Live portal data is not yet available for this market. Perplexity Sonar integration coming soon.`,
          market, results: [],
          searchMeta: { location, market, listingsFound: 0, dataSource: 'none', scoredAt: new Date().toISOString() },
        });
      }
    } catch (err) {
      portalErrors.push(err.message);
    }

    if (listings.length === 0) {
      const wasCountryOnly = COUNTRY_NAME_PATTERNS.test((location || '').trim());
      return res.status(200).json({
        error: 'no_listings_found',
        message: isAuction
          ? `No court auctions currently listed for "${location}". Auction inventory changes weekly — try a whole Bundesland (e.g. "Bayern") or check back soon.`
          : wasCountryOnly
            ? `No listings found. Country-wide search defaulted to the capital — please enter a specific city or region (e.g. "Madrid", "Valencia", "Málaga") for better results.`
            : `No listings found for "${location}". Try a larger city, broader price range, or fewer filters.`,
        market, portalErrors, results: [],
        searchMeta: { location, market, listingsFound: 0, dataSource: 'none — hallucination prevention active', scoredAt: new Date().toISOString() },
      });
    }

    try {
      const ar = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json','x-api-key':anthropicKey,'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model: scoringModel, max_tokens: SCORE_TOKENS, messages: [{ role: 'user', content: buildScoringPrompt(listings, searchParams, market, isAuction) }] }),
      });
      const ad = await ar.json();
      if (!ar.ok) return res.status(ar.status).json({ error: 'Scoring failed', detail: ad });

      const rawText = ad.content?.[0]?.text || '';
      let scored;
      try { scored = JSON.parse(rawText.replace(/```json|```/g,'').trim()); }
      catch { return res.status(500).json({ error: 'Failed to parse scoring response', raw: rawText }); }

      scored = validateScoredOutput(scored, listings);

      // If validation stripped everything, the model returned untraceable results — refuse
      if (!scored.results || scored.results.length === 0) {
        return res.status(200).json({
          error: 'validation_failed',
          message: 'Scored results could not be verified against real listing data. Please try again.',
          market, results: [],
          searchMeta: { location, market, listingsFound: 0, dataSource: 'validation rejected output', scoredAt: new Date().toISOString() },
        });
      }

      scored.rawListings = listings;
      if (portalErrors.length) scored.portalErrors = portalErrors;
      if (locSubInfo) {
        scored.locationNote = `Country-level search — showing results for ${locSubInfo.searchedLocation}. Enter a specific city for targeted results.`;
        if (scored.searchMeta) scored.searchMeta.searchedLocation = locSubInfo.searchedLocation;
      }
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
