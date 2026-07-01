// get9d.com — 9D Property Scoring Engine v3.0 (Global)
// 30+ markets across CH/DACH | Southern Europe | UK | France | USA | Canada
// Latin America | Middle East/UAE | Australia | Southeast Asia | Africa
// Hallucination-proof: Claude scores ONLY real listings from live portals via Apify
// Fallback: Perplexity Sonar for markets with no Apify actor (Ukraine, Japan, etc.)

export const config = { maxDuration: 60 };

const ALLOWED_MODELS = [
  'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001',
  'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229',
];
const MAX_TOKENS_CAP = 4096;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// ─── Portal Registry ───────────────────────────────────────────────────────
// Each market maps to one or more Apify actors.
// Verify actor IDs at apify.com/store before first production use.
const PORTAL_CONFIG = {

  // ── Switzerland ─────────────────────────────────────────────────────
  CH: [{
    name: 'Homegate / ImmoScout24.ch / Home.ch / Anibis',
    actorId: 'unfenced-group/homegate-scraper',
    buildInput: (p) => ({ cantons: p.cantons || [], offerType: p.propertyType === 'rent' ? 'RENT' : 'BUY', minPrice: p.minPrice, maxPrice: p.maxPrice, minRooms: p.minRooms, maxRooms: p.maxRooms, maxItems: 10 }),
    normalise: (i) => ({ title: i.title || i.name, address: `${i.street||''} ${i.postalCode||''} ${i.locality||''}`.trim(), price: i.price, priceUnit: i.currency||'CHF', rooms: i.numberOfRooms, livingArea: i.livingSpace||i.totalFloorSpace, floor: i.floor, yearBuilt: i.yearBuilt, listingUrl: i.url||i.listingUrl, description: i.description?.slice(0,500)||null, images: i.imageUrls?.slice(0,2)||[], source: i.platforms?.[0]||'homegate.ch', extras: { hasBalcony: i.hasBalcony, hasElevator: i.hasElevator, isMinergie: i.isMinergie, isNewBuilding: i.isNewBuilding, canton: i.canton, lat: i.latitude, lng: i.longitude } }),
  }, {
    name: 'Comparis.ch',
    actorId: 'agenscrape/comparis-ch-real-estate-scraper',
    buildInput: (p) => ({ location: p.location, offerType: p.propertyType === 'rent' ? 'rent' : 'buy', priceMin: p.minPrice, priceMax: p.maxPrice, maxItems: 10 }),
    normalise: (i) => ({ title: i.title, address: i.address||i.location, price: i.price, priceUnit: 'CHF', rooms: i.rooms, livingArea: i.area, floor: i.floor, yearBuilt: null, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: 'comparis.ch', extras: {} }),
  }],

  // ── Germany ──────────────────────────────────────────────────────────
  DE: [{
    name: 'ImmoScout24.de',
    actorId: 'clearpath/immoscout24-api-pro',
    buildInput: (p) => ({ searchQuery: p.location, offerType: p.propertyType === 'rent' ? 'rent' : 'buy', priceMin: p.minPrice, priceMax: p.maxPrice, roomsMin: p.minRooms, maxItems: 10 }),
    normalise: (i) => ({ title: i.title, address: i.address, price: i.price, priceUnit: 'EUR', rooms: i.rooms||i.numberOfRooms, livingArea: i.livingArea||i.area, floor: i.floor, yearBuilt: i.yearBuilt||i.constructionYear, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: 'immoscout24.de', extras: { energyRating: i.energyRating } }),
  }, {
    name: 'Immowelt.de',
    actorId: 'rigelbytes/immowelt-scraper',
    buildInput: (p) => ({ location: p.location, offerType: p.propertyType === 'rent' ? 'rent' : 'buy', maxItems: 10 }),
    normalise: (i) => ({ title: i.title, address: i.address, price: i.price, priceUnit: 'EUR', rooms: i.rooms, livingArea: i.area, floor: null, yearBuilt: null, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: 'immowelt.de', extras: {} }),
  }],

  // ── Austria ──────────────────────────────────────────────────────────
  AT: [{
    name: 'Willhaben.at',
    actorId: 'jupri/willhaben-scraper',
    buildInput: (p) => ({ location: p.location, category: 'immobilien', offerType: p.propertyType === 'rent' ? 'mieten' : 'kaufen', maxItems: 10 }),
    normalise: (i) => ({ title: i.title, address: i.address||i.location, price: i.price, priceUnit: 'EUR', rooms: i.rooms, livingArea: i.area, floor: null, yearBuilt: null, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: 'willhaben.at', extras: {} }),
  }],

  // ── Spain / Portugal / Italy (shared Idealista actor) ────────────────
  ES: [{
    name: 'Idealista (ES/PT/IT)',
    actorId: 'blackfalcondata/idealista-scraper',
    buildInput: (p) => ({ country: p.country||'es', operation: p.propertyType === 'rent' ? 'rent' : 'sale', propertyType: 'homes', location: p.location, minPrice: p.minPrice, maxPrice: p.maxPrice, minRooms: p.minRooms, maxItems: 10 }),
    normalise: (i) => ({ title: i.title||i.suggestedTexts?.title, address: i.address||i.district, price: i.price, priceUnit: 'EUR', rooms: i.rooms, livingArea: i.size, floor: i.floor, yearBuilt: null, listingUrl: i.url||`https://www.idealista.com/inmueble/${i.propertyCode}/`, description: i.description?.slice(0,500)||null, images: i.thumbnail?[i.thumbnail]:[], source: 'idealista.com', extras: { priceByArea: i.priceByArea, hasLift: i.hasLift, energyCertificationType: i.energyCertificationType } }),
  }],
  PT: [{ alias: 'ES', country: 'pt' }],
  IT: [{ alias: 'ES', country: 'it' }],

  // ── France ───────────────────────────────────────────────────────────
  FR: [{
    name: 'SeLoger + Leboncoin',
    actorId: 'ccdeveloppement/real-estate-scraper',
    buildInput: (p) => ({ location: p.location, offerType: p.propertyType === 'rent' ? 'location' : 'vente', priceMin: p.minPrice, priceMax: p.maxPrice, maxItems: 10 }),
    normalise: (i) => ({ title: i.title, address: i.address||i.city, price: i.price, priceUnit: 'EUR', rooms: i.rooms, livingArea: i.surface, floor: null, yearBuilt: null, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: i.source||'seloger.com', extras: { dpe: i.dpe, pricePerM2: i.pricePerM2 } }),
  }],

  // ── United Kingdom ───────────────────────────────────────────────────
  GB: [{
    name: 'Rightmove + Zoopla + OnTheMarket',
    actorId: 'femstar/uk-property-data-scraper-rightmove-zoopla',
    buildInput: (p) => ({ location: p.location, listingType: p.propertyType === 'rent' ? 'rent' : 'sale', minPrice: p.minPrice, maxPrice: p.maxPrice, minBedrooms: p.minRooms, maxItems: 10 }),
    normalise: (i) => ({ title: i.title||i.displayAddress, address: i.displayAddress||i.address, price: i.price, priceUnit: 'GBP', rooms: i.bedrooms, livingArea: i.floorArea, floor: null, yearBuilt: null, listingUrl: i.propertyUrl||i.url, description: i.summary?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: i.portal||'rightmove.co.uk', extras: { epcRating: i.epcRating, councilTaxBand: i.councilTaxBand, tenure: i.tenure } }),
  }],

  // ── USA ──────────────────────────────────────────────────────────────
  US: [{
    name: 'Zillow + Redfin + Realtor.com',
    actorId: 'whitewalk/real-estate-scraper',
    buildInput: (p) => ({ location: p.location, listingType: p.propertyType === 'rent' ? 'rent' : 'sale', minPrice: p.minPrice, maxPrice: p.maxPrice, minBeds: p.minRooms, platforms: ['zillow', 'redfin', 'realtor'], maxItems: 10 }),
    normalise: (i) => ({ title: i.title||i.address, address: i.address||i.streetAddress, price: i.price||i.listPrice, priceUnit: 'USD', rooms: i.bedrooms||i.beds, livingArea: i.sqft||i.livingArea, floor: null, yearBuilt: i.yearBuilt, listingUrl: i.url||i.detailUrl, description: i.description?.slice(0,500)||null, images: i.photos?.slice(0,2)||i.images?.slice(0,2)||[], source: i.source||'zillow.com', extras: { zestimate: i.zestimate, daysOnMarket: i.daysOnMarket, pricePerSqft: i.pricePerSqft, hoaFee: i.hoaFee, lat: i.latitude, lng: i.longitude } }),
  }],

  // ── Canada ───────────────────────────────────────────────────────────
  CA: [{
    name: 'Realtor.ca',
    actorId: 'scrapemind/realtor-ca-scraper',
    buildInput: (p) => ({ startUrls: [`https://www.realtor.ca/map#ZoomLevel=12&Center=${encodeURIComponent(p.location)}&LatitudeMax=90&LatitudeMin=-90&LongitudeMax=180&LongitudeMin=-180&Sort=6-D&PropertyTypeGroupID=1&TransactionTypeId=${p.propertyType === 'rent' ? '3' : '2'}`], maxItems: 10 }),
    normalise: (i) => ({ title: i.PublicRemarks?.slice(0,80)||i.RelativeDetailsURL, address: `${i.Street||''} ${i.City||''} ${i.Province||''}`.trim(), price: i.Price, priceUnit: 'CAD', rooms: i.Bedrooms, livingArea: i.BuildingSize, floor: null, yearBuilt: i.YearBuilt, listingUrl: `https://www.realtor.ca${i.RelativeDetailsURL}`, description: i.PublicRemarks?.slice(0,500)||null, images: i.HighResPath?[i.HighResPath]:[], source: 'realtor.ca', extras: { mlsNumber: i.MlsNumber, bathrooms: i.Bathrooms } }),
  }],

  // ── UAE / Middle East ────────────────────────────────────────────────
  AE: [{
    name: 'PropertyFinder + Bayut + Dubizzle',
    actorId: 'parseforge/uae-dubai-property-leads-scraper',
    buildInput: (p) => ({ category: p.propertyType === 'rent' ? 'rent' : 'buy', locations: [p.location], maxPages: 2, sources: ['propertyfinder', 'bayut', 'dubizzle'] }),
    normalise: (i) => ({ title: i.title, address: i.location||i.address||i.community, price: i.price, priceUnit: 'AED', rooms: i.bedrooms||i.beds, livingArea: i.area||i.size, floor: null, yearBuilt: null, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: i.source||'propertyfinder.ae', extras: { trakheesiPermit: i.permitNumber, completionStatus: i.completionStatus, furnished: i.furnished, agentPhone: i.agentPhone } }),
  }],

  // ── Saudi Arabia (Bayut covers SA too) ──────────────────────────────
  SA: [{ alias: 'AE' }],

  // ── Australia ────────────────────────────────────────────────────────
  AU: [{
    name: 'Domain.com.au',
    actorId: 'haketa/domain-com-au-scraper',
    buildInput: (p) => ({ suburbs: [p.location], listingType: p.propertyType === 'rent' ? 'rent' : 'sale', minPrice: p.minPrice, maxPrice: p.maxPrice, minBedrooms: p.minRooms, maxListings: 10 }),
    normalise: (i) => ({ title: i.address||i.displayableAddress, address: i.address||i.displayableAddress, price: i.price, priceUnit: 'AUD', rooms: i.bedrooms, livingArea: i.area||i.buildingArea, floor: null, yearBuilt: null, listingUrl: i.url||i.listingUrl, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: 'domain.com.au', extras: { auctionDate: i.auctionDetails?.dateTime, daysOnMarket: i.daysOnMarket, agencyName: i.branding?.name } }),
  }, {
    name: 'Realestate.com.au',
    actorId: 'one-api/realestate-com-au-scraper',
    buildInput: (p) => ({ search_inputs: [p.location], channel: p.propertyType === 'rent' ? 'rent' : 'buy', price_min: p.minPrice, price_max: p.maxPrice, bedrooms_min: p.minRooms, maxItems: 10 }),
    normalise: (i) => ({ title: i.address||i.listing?.address?.display?.fullAddress, address: i.listing?.address?.display?.fullAddress||i.address, price: i.listing?.price?.display||i.price, priceUnit: 'AUD', rooms: i.listing?.generalFeatures?.bedrooms?.value||i.bedrooms, livingArea: i.listing?.propertyDetails?.area||i.area, floor: null, yearBuilt: null, listingUrl: i.listingUrl||i.url, description: i.listing?.description?.slice(0,500)||null, images: i.listing?.media?.images?.slice(0,2)||[], source: 'realestate.com.au', extras: {} }),
  }],

  // ── Brazil ───────────────────────────────────────────────────────────
  BR: [{
    name: 'VivaReal + ZAP Imóveis',
    actorId: 'jungle_synthesizer/brazil-vivareal-zap-imoveis-scraper',
    buildInput: (p) => ({ portal: 'BOTH', businessType: p.propertyType === 'rent' ? 'RENTAL' : 'SALE', city: p.location, maxItems: 10 }),
    normalise: (i) => ({ title: i.title||i.address, address: i.address||`${i.neighbourhood||''} ${i.city||''}`.trim(), price: i.price, priceUnit: 'BRL', rooms: i.bedrooms, livingArea: i.area, floor: null, yearBuilt: null, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: i.portal?.toLowerCase()||'vivareal.com.br', extras: { iptu: i.iptu, condoFee: i.condoFee, pricePerSqm: i.pricePerSqm } }),
  }],

  // ── Mexico ───────────────────────────────────────────────────────────
  MX: [{
    name: 'Inmuebles24',
    actorId: 'ecomscrape/inmuebles24-property-listings-scraper',
    buildInput: (p) => ({ location: p.location, operation: p.propertyType === 'rent' ? 'alquiler' : 'venta', maxItems: 10 }),
    normalise: (i) => ({ title: i.title, address: i.address||i.location, price: i.price, priceUnit: 'MXN', rooms: i.rooms||i.bedrooms, livingArea: i.area, floor: null, yearBuilt: null, listingUrl: i.url, description: i.description_normalized?.slice(0,500)||i.description?.slice(0,500)||null, images: i.url730x532?[i.url730x532]:[], source: 'inmuebles24.com', extras: { agencyName: i.agency_name } }),
  }],

  // ── Colombia ─────────────────────────────────────────────────────────
  CO: [{
    name: 'FincaRaiz.com.co',
    actorId: 'alwaysprimedev/fincaraiz-scraper',
    buildInput: (p) => ({ location: p.location, businessType: p.propertyType === 'rent' ? 'arriendo' : 'venta', maxItems: 10 }),
    normalise: (i) => ({ title: i.title, address: i.address||i.location, price: i.price, priceUnit: 'COP', rooms: i.rooms||i.bedrooms, livingArea: i.area, floor: null, yearBuilt: null, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: 'fincaraiz.com.co', extras: {} }),
  }],

  // ── Argentina ────────────────────────────────────────────────────────
  AR: [{
    name: 'ZonaProp',
    actorId: 'ecomscrape/zonaprop-property-listings-scraper',
    buildInput: (p) => ({ location: p.location, operation: p.propertyType === 'rent' ? 'alquiler' : 'venta', maxItems: 10 }),
    normalise: (i) => ({ title: i.title, address: i.address||i.location, price: i.price, priceUnit: i.currency||'USD', rooms: i.rooms||i.bedrooms, livingArea: i.area, floor: null, yearBuilt: null, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: 'zonaprop.com.ar', extras: {} }),
  }],

  // ── Southeast Asia (SG, MY, TH, VN) ─────────────────────────────────
  SG: [{
    name: 'PropertyGuru Singapore',
    actorId: 'alwaysprimedev/propertyguru-singapore-scraper',
    buildInput: (p) => ({ country: 'singapore', listingType: p.propertyType === 'rent' ? 'rent' : 'sale', location: p.location, minPrice: p.minPrice, maxPrice: p.maxPrice, maxItems: 10 }),
    normalise: (i) => ({ title: i.title||i.name, address: i.address||i.district, price: i.price, priceUnit: 'SGD', rooms: i.bedrooms||i.rooms, livingArea: i.floorArea||i.area, floor: i.floor, yearBuilt: null, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: 'propertyguru.com.sg', extras: { psf: i.pricePerSqft, tenure: i.tenure, district: i.district } }),
  }],
  MY: [{ alias: 'SG', country: 'malaysia', priceUnit: 'MYR', source: 'propertyguru.com.my' }],
  TH: [{
    name: 'DDProperty Thailand',
    actorId: 'fatihtahta/ddproperty-scraper',
    buildInput: (p) => ({ startUrls: [`https://www.ddproperty.com/en/property-for-${p.propertyType === 'rent' ? 'rent' : 'sale'}?freetext=${encodeURIComponent(p.location)}`], maxItems: 10 }),
    normalise: (i) => ({ title: i.title, address: i.address||i.location, price: i.price, priceUnit: 'THB', rooms: i.bedrooms||i.rooms, livingArea: i.area, floor: null, yearBuilt: null, listingUrl: i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: 'ddproperty.com', extras: {} }),
  }],

  // ── South Africa + Africa ────────────────────────────────────────────
  ZA: [{
    name: 'Property24 (ZA + 9 African markets)',
    actorId: 'getascraper/property24-scraper',
    buildInput: (p) => ({ country: p.country||'South Africa', location: p.location, listing_type: p.propertyType === 'rent' ? 'To Rent' : 'For Sale', max_results: 10 }),
    normalise: (i) => ({ title: i.title, address: i.address||i.location?.address, price: i.price, priceUnit: 'ZAR', rooms: i.rooms||i.bedrooms, livingArea: i.area||i.floorSize, floor: null, yearBuilt: null, listingUrl: i.source_url||i.url, description: i.description?.slice(0,500)||null, images: i.images?.slice(0,2)||[], source: 'property24.com', extras: { bathrooms: i.bathrooms, garages: i.garages, pricePerM2: i.pricePerSqm } }),
  }],

  // ── Markets using Perplexity fallback (no reliable Apify actor) ──────
  UA: null,  // Ukraine — war zone data gaps
  JP: null,  // Japan — SUUMO requires Japanese language input handling
  IN: null,  // India — 99acres/MagicBricks actors unstable
  CN: null,  // China — restricted access
};

// ─── Market detection ──────────────────────────────────────────────────────
function detectMarket(location = '', countryCode = '') {
  const code = countryCode.toUpperCase();
  if (code && PORTAL_CONFIG[code] !== undefined) return code;
  const loc = location.toLowerCase();

  // Switzerland
  if (/\b(ch|switzerland|schweiz|zürich|zurich|bern|aarau|basel|genf|luzern|aargau|zug|lausanne|winterthur)\b/.test(loc)) return 'CH';
  // Germany
  if (/\b(de|germany|deutschland|berlin|münchen|munich|hamburg|frankfurt|köln|cologne|stuttgart|düsseldorf)\b/.test(loc)) return 'DE';
  // Austria
  if (/\b(at|austria|österreich|wien|vienna|salzburg|graz|innsbruck|linz)\b/.test(loc)) return 'AT';
  // UK
  if (/\b(gb|uk|united kingdom|england|london|manchester|birmingham|edinburgh|bristol|leeds|glasgow)\b/.test(loc)) return 'GB';
  // France
  if (/\b(fr|france|paris|lyon|marseille|bordeaux|toulouse|nice|nantes|strasbourg)\b/.test(loc)) return 'FR';
  // Portugal
  if (/\b(pt|portugal|lisboa|lisbon|porto|algarve|cascais|sintra|faro|braga)\b/.test(loc)) return 'PT';
  // Italy
  if (/\b(it|italy|italia|rome|roma|milan|milano|florence|firenze|naples|napoli|venice|venezia|turin|torino)\b/.test(loc)) return 'IT';
  // Spain
  if (/\b(es|spain|españa|madrid|barcelona|sevilla|seville|valencia|malaga|alicante|asturias|gijón|gijon|bilbao)\b/.test(loc)) return 'ES';
  // USA
  if (/\b(us|usa|united states|new york|los angeles|chicago|houston|miami|san francisco|seattle|boston|atlanta|denver)\b/.test(loc)) return 'US';
  // Canada
  if (/\b(ca|canada|toronto|vancouver|montreal|calgary|ottawa|edmonton|winnipeg|quebec)\b/.test(loc)) return 'CA';
  // UAE/Middle East
  if (/\b(ae|uae|dubai|abu dhabi|sharjah|ajman|ras al khaimah)\b/.test(loc)) return 'AE';
  if (/\b(sa|saudi|riyadh|jeddah|mecca|medina|dammam|khobar)\b/.test(loc)) return 'SA';
  // Australia
  if (/\b(au|australia|sydney|melbourne|brisbane|perth|adelaide|canberra|gold coast|hobart)\b/.test(loc)) return 'AU';
  // Brazil
  if (/\b(br|brazil|brasil|são paulo|sao paulo|rio de janeiro|belo horizonte|brasilia|curitiba|fortaleza)\b/.test(loc)) return 'BR';
  // Mexico
  if (/\b(mx|mexico|méxico|ciudad de mexico|cdmx|guadalajara|monterrey|cancún|cancun|puebla|tijuana)\b/.test(loc)) return 'MX';
  // Colombia
  if (/\b(co|colombia|bogota|bogotá|medellin|medellín|cali|cartagena|barranquilla)\b/.test(loc)) return 'CO';
  // Argentina
  if (/\b(ar|argentina|buenos aires|cordoba|córdoba|rosario|mendoza)\b/.test(loc)) return 'AR';
  // Southeast Asia
  if (/\b(sg|singapore)\b/.test(loc)) return 'SG';
  if (/\b(my|malaysia|kuala lumpur|kl|penang|johor bahru)\b/.test(loc)) return 'MY';
  if (/\b(th|thailand|bangkok|phuket|chiang mai|pattaya|hua hin)\b/.test(loc)) return 'TH';
  // Africa
  if (/\b(za|south africa|cape town|johannesburg|durban|sandton|pretoria|nigeria|kenya|nairobi|namibia|botswana)\b/.test(loc)) return 'ZA';
  // Perplexity-only
  if (/\b(ua|ukraine|kyiv|kiev|lviv|odesa|kharkiv)\b/.test(loc)) return 'UA';
  if (/\b(jp|japan|tokyo|osaka|kyoto|yokohama|nagoya|sapporo)\b/.test(loc)) return 'JP';
  if (/\b(in|india|mumbai|delhi|bangalore|bengaluru|hyderabad|chennai|pune|kolkata)\b/.test(loc)) return 'IN';

  return 'CH'; // default to core market
}

// ─── Resolve alias entries ─────────────────────────────────────────────────
function resolvePortals(market, searchParams) {
  const config = PORTAL_CONFIG[market];
  if (!config) return null;
  return config.map(entry => {
    if (entry.alias) {
      const parent = PORTAL_CONFIG[entry.alias];
      if (!parent) return null;
      const base = parent[0];
      return {
        ...base,
        name: `${base.name} (${market})`,
        buildInput: (p) => base.buildInput({ ...p, country: entry.country || market.toLowerCase() }),
        normalise: (i) => ({ ...base.normalise(i), priceUnit: entry.priceUnit || base.normalise(i).priceUnit, source: entry.source || base.normalise(i).source }),
      };
    }
    return entry;
  }).filter(Boolean);
}

// ─── Fetch from Apify portals ──────────────────────────────────────────────
async function fetchListings(searchParams) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) throw new Error('APIFY_TOKEN not configured.');

  const market = detectMarket(searchParams.location, searchParams.countryCode || '');
  if (!PORTAL_CONFIG[market]) return { listings: [], market, noActor: true };

  const portals = resolvePortals(market, searchParams);
  if (!portals || portals.length === 0) return { listings: [], market, noActor: true };

  const results = await Promise.allSettled(
    portals.map(async (portal) => {
      const input = portal.buildInput(searchParams);
      const res = await fetch(
        `https://api.apify.com/v2/acts/${portal.actorId}/run-sync-get-dataset-items?token=${apifyToken}&timeout=50`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
      );
      if (!res.ok) throw new Error(`${portal.name} → ${res.status}`);
      const items = await res.json();
      return { portal: portal.name, items: Array.isArray(items) ? items : [] };
    })
  );

  const listings = [], portalErrors = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i], portal = portals[i];
    if (r.status === 'fulfilled') {
      listings.push(...r.value.items.slice(0,10).map(item => { try { return portal.normalise(item); } catch { return null; } }).filter(Boolean));
    } else {
      portalErrors.push(`${portal.name}: ${r.reason?.message}`);
    }
  }

  const seen = new Set();
  const deduped = listings.filter(l => { if (!l.listingUrl || seen.has(l.listingUrl)) return false; seen.add(l.listingUrl); return true; });
  return { listings: deduped.slice(0,15), market, portalErrors };
}

// ─── Perplexity fallback ───────────────────────────────────────────────────
async function fetchPerplexityListings(searchParams) {
  const pplxKey = process.env.PERPLEXITY_API_KEY;
  if (!pplxKey) return [];
  const { location, propertyType, minPrice, maxPrice, minRooms } = searchParams;
  const query = `Real estate listings for ${propertyType === 'rent' ? 'rent' : 'sale'} in ${location}.`
    + (minPrice || maxPrice ? ` Price: ${minPrice||0}–${maxPrice||'any'}.` : '')
    + (minRooms ? ` Min ${minRooms} rooms/beds.` : '')
    + ' List 5–8 CURRENT real listings with: name, full address, price + currency, rooms, m² or sqft, listing URL. Cite only live web sources.';
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${pplxKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: query }] }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    return [{ title: `Web search: ${location}`, address: location, price: null, priceUnit: null, rooms: null, livingArea: null, floor: null, yearBuilt: null, listingUrl: citations[0]||null, description: text.slice(0,1500), images: [], source: `perplexity.ai — ${citations.slice(0,3).join(', ')}`, extras: { rawCitations: citations } }];
  } catch { return []; }
}

// ─── D9 legal rules per market ─────────────────────────────────────────────
const D9_RULES = {
  CH: 'Lex Koller (foreign buyer restrictions), Stockwerkeigentum strata rules, cantonal zoning, FINMA AML for funds',
  DE: 'Grundbuch title register, Mietrecht tenant protections, Grunderwerbsteuer 3.5–6.5%, Bebauungsplan zoning',
  AT: 'Grundbuch, Wohnungseigentumsgesetz, foreign buyer restrictions in some Bundesländer, Grunderwerbsteuer 3.5%',
  GB: 'SDLT/LTT stamp duty, leasehold vs freehold, EPC minimum E, Section 21 abolition, planning use class',
  FR: 'DPE energy rating mandatory, Taxe Foncière, copropriété rules, Loi Pinel, PTZ eligibility',
  ES: 'ITP/AJD transfer tax 6–10%, Ley de Arrendamientos Urbanos rent controls, Cadastral vs market value',
  PT: 'NHR/IFICI tax regime, IMT transfer tax 0–7.5%, Golden Visa (residential no longer eligible), ARU urban rehab areas',
  IT: 'Catasto cadastral values, IMU property tax, Superbonus eligibility, Codice del Consumo disclosures',
  US: 'HOA rules, local zoning/setbacks, FIRPTA for foreign sellers, flood zone (FEMA), 1031 exchange eligibility',
  CA: 'Foreign Buyer Ban 2023, FINTRAC AML, land transfer tax, condo act (strata), foreign buyer tax in BC/ON',
  AE: 'RERA Dubai regulations, Trakheesi permit verification, off-plan escrow (RERA), DLD transfer fees 4%',
  SA: 'Saudi Investment Law, foreign ownership in NEOM/Vision 2030 zones, Riyali AML compliance',
  AU: 'FIRB foreign investment approval, stamp duty, strata title, auction clearance rates, negative gearing rules',
  BR: 'ITBI transfer tax ~3%, IPTU annual property tax, condo tax (condomínio), foreign ownership generally permitted',
  MX: 'Fideicomiso trust for foreign buyers in restricted zones (coastal/border), ISAI transfer tax ~2–4%',
  CO: 'Impuesto de Delineación Urbana, Catastro valuation, restitución de tierras risk in rural areas',
  AR: 'Currency controls (CEPO), AFIP registration, peso vs USD pricing, foreign ownership restrictions on rural land',
  SG: 'Additional Buyer Stamp Duty (ABSD) 60% for foreigners, SLA approval, strata title vs leasehold 99yr',
  MY: 'MM2H visa programme, RPGT capital gains, foreign ownership threshold MYR 1M+, Malay reserved land',
  TH: 'Foreign freehold condo quota 49%, Chanote title deed verification, Tor Tor 3 lease for houses, 30yr+30yr lease',
  ZA: 'FICA AML compliance, Transfer Duty, HOA special levies, Sectional Title Act, FIC Act',
  UA: 'Wartime restrictions, Moratorium on agricultural land, title registry disruptions, reconstruction risk zones',
  JP: 'No foreign ownership restrictions, Jutakuchi-ho building standards, fixed-term leases, seismic zone compliance',
  IN: 'RERA 2016, foreign ownership restricted (NRI/OCI only), stamp duty 5–8%, benami transaction prohibition',
};

// ─── Build scoring prompt ──────────────────────────────────────────────────
const CURRENCY_MAP = { CH:'CHF', DE:'EUR', AT:'EUR', GB:'GBP', FR:'EUR', ES:'EUR', PT:'EUR', IT:'EUR', US:'USD', CA:'CAD', AE:'AED', SA:'SAR', AU:'AUD', BR:'BRL', MX:'MXN', CO:'COP', AR:'USD', SG:'SGD', MY:'MYR', TH:'THB', ZA:'ZAR', UA:'UAH', JP:'JPY', IN:'INR' };

function buildScoringPrompt(listings, searchParams, market) {
  const currency = CURRENCY_MAP[market] || 'USD';
  const listingsSummary = listings.map((l, i) => `
LISTING ${i+1}:
- Title: ${l.title}
- Address: ${l.address}
- Price: ${l.price ? `${l.priceUnit||currency} ${typeof l.price==='number'?l.price.toLocaleString():l.price}` : 'Not disclosed'}
- Rooms/Beds: ${l.rooms||'N/A'}
- Area: ${l.livingArea ? `${l.livingArea}m²` : 'N/A'}
- Year built: ${l.yearBuilt||'N/A'}
- Source: ${l.source} — ${l.listingUrl||'no URL'}
- Description: ${l.description||'N/A'}
${l.extras&&Object.keys(l.extras).length ? `- Extra: ${JSON.stringify(l.extras)}` : ''}`).join('\n---\n');

  return `You are the 9D scoring engine for get9d.com — professional property intelligence for EAMs and family offices.

REAL listings from live portals are provided below. Score ONLY these. Do NOT invent properties.
If a listing is rental-only but user searched for buy (or vice versa), flag it — do not score as wrong type.
If data is missing for a dimension, apply conservative default (5.0) and note it.
Currency for this market: ${currency}

9D FRAMEWORK (0–10 each):
D1 Valuation & Renovation — Price vs comps, price/m², renovation signals
D2 Climate Risk — Flood/fire/seismic exposure, energy rating (EPC/DPE/Minergie)
D3 Demographic Trend — Population growth, migration, age structure of municipality
D4 Return on Investment — Gross yield, capital growth, IRR potential
D5 Rental & Vacancy — Local vacancy rate, rental demand, achievable rent
D6 Liveability & Proximity — Transport, schools, amenities, walkability
D7 Appreciation Potential — Infrastructure pipeline, rezoning, gentrification
D8 Seller Motivation — Days on market, price reductions, listing urgency signals
D9 Legal & Regulatory — ${D9_RULES[market]||'Local property law, title integrity, AML compliance, tax obligations'}

SUPPRESSION RULE: Any D9 sub-score < 3.0 → cap composite at 5.0, flag prominently.
COMPOSITE: D1×15% + D2×10% + D3×10% + D4×15% + D5×10% + D6×10% + D7×10% + D8×10% + D9×10%

SEARCH: ${market} | ${searchParams.location} | ${searchParams.propertyType==='rent'?'Rental':'Purchase'}${searchParams.minPrice?` | Min ${currency} ${searchParams.minPrice}`:''} ${searchParams.maxPrice?`Max ${currency} ${searchParams.maxPrice}`:''}${searchParams.minRooms?` | Min rooms: ${searchParams.minRooms}`:''}

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

  // ── Proxy mode (passthrough for non-scoring frontend calls)
  if (body.mode === 'proxy' || (!body.mode && body.messages)) {
    const { model, messages, system, max_tokens, tools, tool_choice } = body;
    if (!model || !ALLOWED_MODELS.includes(model)) return res.status(400).json({ error: 'Invalid model', allowed: ALLOWED_MODELS });
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages required' });
    const clampedTokens = Math.min(typeof max_tokens==='number'&&max_tokens>0?max_tokens:MAX_TOKENS_CAP, MAX_TOKENS_CAP);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
        body: JSON.stringify({ model, messages, max_tokens: clampedTokens, ...(system&&{system}), ...(tools&&{tools}), ...(tool_choice&&{tool_choice}) }),
      });
      return res.status(r.status).json(await r.json());
    } catch (e) { return res.status(500).json({ error: 'Proxy failed', detail: e.message }); }
  }

  // ── Score mode (main 9D flow)
  if (body.mode === 'score') {
    const { location, minPrice, maxPrice, minRooms, maxRooms, propertyType, countryCode, model } = body;
    if (!location) return res.status(400).json({ error: 'location is required' });

    const scoringModel = ALLOWED_MODELS.includes(model) ? model : 'claude-sonnet-4-6';
    const searchParams = { location, minPrice, maxPrice, minRooms, maxRooms, propertyType, countryCode };
    const market = detectMarket(location, countryCode||'');

    let listings = [], portalErrors = [], usedFallback = false;

    try {
      const result = await fetchListings(searchParams);
      listings = result.listings || [];
      portalErrors = result.portalErrors || [];
      if (result.noActor || listings.length === 0) {
        listings = await fetchPerplexityListings(searchParams);
        usedFallback = true;
      }
    } catch (err) {
      try { listings = await fetchPerplexityListings(searchParams); usedFallback = true; } catch { listings = []; }
      portalErrors.push(err.message);
    }

    if (listings.length === 0) {
      return res.status(200).json({
        error: 'no_listings_found',
        message: `No listings found for "${location}". Try broadening filters or check the portal directly.`,
        market, portalErrors, results: [],
        searchMeta: { location, market, listingsFound: 0, dataSource: 'none — hallucination prevention active', scoredAt: new Date().toISOString() },
      });
    }

    try {
      const ar = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
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
      if (usedFallback) scored.dataWarning = 'Data sourced from Perplexity web search. No direct portal API available for this market. Verify independently.';
      return res.status(200).json(scored);
    } catch (e) { return res.status(500).json({ error: 'Scoring failed', detail: e.message }); }
  }

  return res.status(400).json({
    error: 'Use mode: "score" or mode: "proxy".',
    supportedMarkets: Object.keys(PORTAL_CONFIG),
    perplexityFallbackMarkets: Object.entries(PORTAL_CONFIG).filter(([,v])=>v===null).map(([k])=>k),
    example: { mode: 'score', location: 'Aarau, Aargau', propertyType: 'buy', minPrice: 500000, maxPrice: 1500000, minRooms: 3 },
  });
}
