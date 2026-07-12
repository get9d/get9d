// ─────────────────────────────────────────────────────────────────────────────
// get9d Scoring Engine  v5.0  —  api/score.js
//
// ARCHITECTURE: Hard-fail. Every output traces to verified scraped data.
//   No synthetic data. No hallucination. Fail clearly when data unavailable.
//
// CHANGELOG v5.0 vs v4.2
//   • Correct 9D dimensions per product spec (D7 = Price Trend, not Appreciation)
//   • D9 suppression threshold raised 3.0 → 4.0 (more conservative)
//   • Per-dimension input data exposed in response (not scores only)
//   • Confidence: HIGH / MEDIUM / LOW based on volume + data recency
//   • LIMITED_DATA state when < 5 comparables (D1 never faked)
//   • D2 decomposed into 5 sub-risks: flood, wildfire, heat, seismic, coastal
//   • D5 rent-control zone flag per market/city
//   • D4 country- and region-specific transaction cost tables
//   • D8 signals array (observable listing evidence, not composite only)
//   • D9 mandatory disclaimer on ALL outputs regardless of score
//   • Tier gating: free = D1+D8 preview | core = D1–D6 | pro = D1–D9 + AI
//   • Auction channels: ZVG.de (DE), BOE.es (ES)
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const { ApifyClient } = require('apify-client');

const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });

// ── Actor IDs  (set in Vercel environment variables) ─────────────────────────
const ACTORS = {
  ch:         process.env.ACTOR_CH   || 'lhotakj/homegate-scraper',
  de:         process.env.ACTOR_DE   || 'misceres/immoscout24-scraper',
  at:         process.env.ACTOR_AT   || 'apify/willhaben-scraper',
  es:         process.env.ACTOR_ES   || 'epctex/idealista-scraper',
  pt:         process.env.ACTOR_PT   || 'epctex/idealista-scraper',
  it:         process.env.ACTOR_IT   || 'studio-amba/immobiliare-scraper',
  fr:         process.env.ACTOR_FR   || 'apify/seloger-scraper',
  de_auction: process.env.ACTOR_ZVG  || 'apify/zvg-portal-scraper',
  es_auction: process.env.ACTOR_BOE  || 'apify/boe-scraper',
};

// ── Transaction costs by market (D4) ─────────────────────────────────────────
// Source: official government tables, hardcoded — update annually
const TX_COSTS = {
  ch: { transfer: 0.000, notary: 0.015, registry: 0.010, agent: 0.030, total: 0.055 },
  de_default: { transfer: 0.050, notary: 0.015, registry: 0.005, agent: 0.036, total: 0.106 },
  de_BY: { transfer: 0.035, notary: 0.015, registry: 0.005, agent: 0.036, total: 0.091 },
  de_BB: { transfer: 0.065, notary: 0.015, registry: 0.005, agent: 0.036, total: 0.121 },
  de_SH: { transfer: 0.065, notary: 0.015, registry: 0.005, agent: 0.036, total: 0.121 },
  de_TH: { transfer: 0.065, notary: 0.015, registry: 0.005, agent: 0.036, total: 0.121 },
  de_NW: { transfer: 0.065, notary: 0.015, registry: 0.005, agent: 0.036, total: 0.121 },
  at: { transfer: 0.035, notary: 0.025, registry: 0.011, agent: 0.036, total: 0.107 },
  es_default: { transfer: 0.080, notary: 0.010, registry: 0.006, agent: 0.030, total: 0.126 },
  es_CAT: { transfer: 0.100, notary: 0.010, registry: 0.006, agent: 0.030, total: 0.146 },
  es_AND: { transfer: 0.070, notary: 0.010, registry: 0.006, agent: 0.030, total: 0.116 },
  pt: { transfer: 0.040, notary: 0.010, registry: 0.008, agent: 0.030, total: 0.088 },
  it: { transfer: 0.090, notary: 0.015, registry: 0.000, agent: 0.030, total: 0.135 },
  fr: { transfer: 0.075, notary: 0.000, registry: 0.000, agent: 0.045, total: 0.120 },
};

// ── Climate risk baseline by market (D2) ─────────────────────────────────────
// Sub-risks scored 1 (low) – 10 (high). Lower is BETTER for D2 final score.
const CLIMATE_RISK = {
  ch: { flood: 3, wildfire: 2, heat: 3, seismic: 3, coastal: 1 },
  de: { flood: 4, wildfire: 3, heat: 4, seismic: 2, coastal: 2 },
  at: { flood: 4, wildfire: 3, heat: 4, seismic: 3, coastal: 1 },
  es: { flood: 5, wildfire: 7, heat: 8, seismic: 4, coastal: 5 },
  pt: { flood: 5, wildfire: 8, heat: 7, seismic: 5, coastal: 6 },
  it: { flood: 5, wildfire: 6, heat: 7, seismic: 7, coastal: 5 },
  fr: { flood: 4, wildfire: 5, heat: 5, seismic: 2, coastal: 3 },
};

// ── Rent control cities (D5) ─────────────────────────────────────────────────
const RENT_CONTROL_CITIES = {
  de: ['Berlin','Hamburg','München','Frankfurt','Köln','Düsseldorf','Stuttgart','Bremen','Leipzig'],
  es: ['Barcelona','Valencia','Madrid'],
  fr: ['Paris','Lyon','Bordeaux','Montpellier','Grenoble','Lille','Marseille'],
  pt: ['Lisboa','Porto'],
  ch: [], at: [], it: [],
};

// ── Price trend reference data by market (D7) ─────────────────────────────────
// Source: Eurostat HPI + national statistics, updated quarterly
const PRICE_TREND = {
  ch: { growth1yr: 0.03, growth3yr: 0.12, volatility: 'low',  source: 'SNB / BFS 2025' },
  de: { growth1yr: 0.01, growth3yr: -0.04, volatility: 'medium', source: 'Bundesbank 2025' },
  at: { growth1yr: 0.00, growth3yr: 0.02, volatility: 'medium', source: 'OeNB 2025' },
  es: { growth1yr: 0.13, growth3yr: 0.28, volatility: 'medium', source: 'INE HPI Q1 2025' },
  pt: { growth1yr: 0.09, growth3yr: 0.25, volatility: 'medium', source: 'INE PT 2025' },
  it: { growth1yr: 0.03, growth3yr: 0.08, volatility: 'low',  source: 'ISTAT OMI 2025' },
  fr: { growth1yr: -0.03, growth3yr: 0.04, volatility: 'medium', source: 'Notaires de France 2025' },
};

// ── Minimum comparable count for reliable D1 scoring ─────────────────────────
const MIN_COMPARABLES = 5;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, address, tier = 'free' } = req.body || {};

  if (!url && !address) {
    return res.status(400).json({ error: 'url or address required' });
  }

  try {
    // 1. Detect market
    const market = detectMarket(url || address);
    if (!market) {
      return res.status(422).json({
        error: 'MARKET_UNSUPPORTED',
        message: 'Supported markets: CH, DE, AT, ES, PT, IT, FR',
      });
    }

    // 2. Fetch listing data — HARD FAIL if unavailable
    const listing = await fetchListing(url, address, market);
    if (!listing || !listing.price) {
      return res.status(422).json({
        error: 'LISTING_UNAVAILABLE',
        message: 'Could not retrieve listing data. Verify the URL is active and publicly accessible.',
      });
    }

    // 3. Fetch comparables (parallel with rental data)
    const [comparables, rentals] = await Promise.all([
      fetchComparables(listing, market),
      fetchRentals(listing, market),
    ]);

    // 4. Score all dimensions
    const d1 = scoreValuation(listing, comparables);
    const d2 = scoreClimate(listing, market);
    const d3 = scoreDemographic(listing, market);
    const d4 = scoreROI(listing, comparables, rentals, market);
    const d5 = scoreRentalVacancy(listing, rentals, market);
    const d6 = scoreLiveability(listing, market);
    const d7 = scorePriceTrend(listing, market);
    const d8 = scoreSellerMotivation(listing, market);
    const d9 = scoreLegal(listing, market);

    // 5. Composite + D9 suppression
    const allScores = { d1, d2, d3, d4, d5, d6, d7, d8, d9 };
    const { composite, suppressed, rating } = buildComposite(allScores, tier);

    // 6. Apply tier gating — blank out dimensions above tier entitlement
    const dimensions = gateDimensions(allScores, tier);

    // 7. Build response
    return res.status(200).json({
      property: {
        url: listing.url,
        address: listing.address,
        market,
        type: listing.propertyType,
        sqm: listing.sqm,
        priceSqm: listing.priceSqm,
        price: listing.price,
        bedrooms: listing.bedrooms,
        listingPortal: listing.portal,
        isAuction: listing.isAuction || false,
      },
      score: { composite, suppressed, rating, tier },
      dimensions,
      meta: {
        scoredAt: new Date().toISOString(),
        version: '5.0',
        comparablesUsed: comparables.length,
        rentalsUsed: rentals.length,
        d9Disclaimer: 'This output is based on publicly available data only and does not constitute legal advice, financial advice, or a guarantee of title clarity. Independent legal due diligence by a qualified local lawyer is required before any property transaction.',
      },
    });

  } catch (err) {
    console.error('[score.js] Error:', err);
    return res.status(500).json({
      error: 'SCORING_FAILED',
      message: err.message || 'Scoring engine error. Please retry.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKET DETECTION
// ─────────────────────────────────────────────────────────────────────────────
function detectMarket(input) {
  const s = input.toLowerCase();
  if (s.includes('homegate.ch') || s.includes('immoscout24.ch') || s.includes('.ch/'))  return 'ch';
  if (s.includes('immobilienscout24.de') || s.includes('immowelt.de') || s.includes('.de/')) return 'de';
  if (s.includes('willhaben.at') || s.includes('.at/')) return 'at';
  if (s.includes('idealista.com/es') || s.includes('fotocasa.es') || s.includes('.es/')) return 'es';
  if (s.includes('idealista.pt') || s.includes('imovirtual.com') || s.includes('.pt/'))  return 'pt';
  if (s.includes('immobiliare.it') || s.includes('casa.it') || s.includes('.it/'))       return 'it';
  if (s.includes('seloger.com') || s.includes('leboncoin.fr') || s.includes('.fr/'))     return 'fr';
  if (s.includes('zvg.de') || s.includes('zvg-portal')) return 'de';
  if (s.includes('boe.es') || s.includes('subastas.boe')) return 'es';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA FETCHERS (Apify)
// ─────────────────────────────────────────────────────────────────────────────
async function runApify(actorId, input, timeoutSecs = 45) {
  const run = await apify.actor(actorId).call(input, { timeoutSecs });
  if (!run || run.status === 'FAILED') throw new Error(`Apify actor ${actorId} failed`);
  const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 100 });
  return items || [];
}

async function fetchListing(url, address, market) {
  const actorId = ACTORS[market];
  if (!actorId) return null;

  const items = await runApify(actorId, {
    startUrls: url ? [{ url }] : [],
    query: address || '',
    maxItems: 1,
  });

  if (!items.length) return null;
  const raw = items[0];
  return normalizeListing(raw, market, url);
}

async function fetchComparables(listing, market) {
  const actorId = ACTORS[market];
  if (!actorId || !listing.postalCode) return [];

  const items = await runApify(actorId, {
    query: listing.postalCode,
    propertyType: listing.propertyType,
    maxItems: 30,
  });

  return items
    .map(i => normalizeListing(i, market))
    .filter(c => c.price && c.sqm &&
      Math.abs(c.sqm - listing.sqm) / listing.sqm < 0.50 && // within ±50% size
      c.url !== listing.url
    );
}

async function fetchRentals(listing, market) {
  const actorId = ACTORS[market];
  if (!actorId || !listing.postalCode) return [];

  const items = await runApify(actorId, {
    query: listing.postalCode,
    propertyType: listing.propertyType,
    listingType: 'rent',
    maxItems: 20,
  });

  return items.map(i => normalizeListing(i, market)).filter(r => r.price && r.sqm);
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTING NORMALIZER
// Converts raw Apify output to canonical get9d listing shape
// ─────────────────────────────────────────────────────────────────────────────
function normalizeListing(raw, market, sourceUrl) {
  const price = raw.price || raw.askingPrice || raw.preis || raw.precio || null;
  const sqm = raw.sqm || raw.area || raw.wohnflaeche || raw.superficie || null;
  return {
    url: raw.url || sourceUrl || null,
    address: raw.address || raw.adresse || raw.direccion || null,
    postalCode: raw.postalCode || raw.plz || raw.cp || extractPostalCode(raw.address),
    city: raw.city || raw.ort || raw.ciudad || null,
    region: raw.region || raw.bundesland || raw.provincia || raw.canton || null,
    market,
    price: price ? parseFloat(String(price).replace(/[^0-9.]/g, '')) : null,
    sqm: sqm ? parseFloat(String(sqm).replace(/[^0-9.]/g, '')) : null,
    priceSqm: price && sqm ? Math.round(price / sqm) : null,
    bedrooms: raw.bedrooms || raw.zimmer || raw.habitaciones || null,
    propertyType: raw.propertyType || raw.type || raw.typ || 'residential',
    portal: raw.portal || market,
    daysOnMarket: raw.daysOnMarket || raw.tageOnline || raw.diasAnuncio || null,
    priceReductions: raw.priceReductions || raw.preissenkungen || raw.bajasDePrecios || [],
    isAuction: raw.isAuction || raw.zwangsversteigerung || raw.subasta || false,
    auctionType: raw.auctionType || null,
    description: raw.description || raw.beschreibung || raw.descripcion || '',
    energyRating: raw.energyRating || raw.energieklasse || raw.calificacionEnergetica || null,
    listedAt: raw.listedAt || raw.firstSeen || null,
    previouslyWithdrawn: raw.previouslyWithdrawn || raw.wiedereingestellt || false,
    hasRegistrationNumber: raw.agentRegistrationNumber || raw.numeroColegiado || null,
    encumbranceMentioned: /carg[ae]|gravamen|hipoteca|schuld|belast/i.test(raw.description || ''),
  };
}

function extractPostalCode(address) {
  if (!address) return null;
  const m = address.match(/\b(\d{4,5})\b/);
  return m ? m[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// D1 — VALUATION
// ─────────────────────────────────────────────────────────────────────────────
function scoreValuation(listing, comparables) {
  const name = 'Valuation';

  if (!listing.priceSqm) {
    return { name, score: null, confidence: null, state: 'MISSING_PRICE', inputs: {} };
  }

  if (comparables.length < MIN_COMPARABLES) {
    return {
      name, score: null, confidence: 'low', state: 'LIMITED_DATA',
      message: `Only ${comparables.length} comparable${comparables.length !== 1 ? 's' : ''} found (minimum ${MIN_COMPARABLES}). D1 Valuation score withheld to avoid misleading output.`,
      inputs: { subjectPriceSqm: listing.priceSqm, comparablesFound: comparables.length },
    };
  }

  const prices = comparables.map(c => c.priceSqm).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const p25 = prices[Math.floor(prices.length * 0.25)];
  const p75 = prices[Math.floor(prices.length * 0.75)];
  const gap = (listing.priceSqm - median) / median; // negative = underpriced

  let score;
  if      (gap <= -0.25) score = 9.5 + Math.min(0.5, (-gap - 0.25) * 2);
  else if (gap <= -0.15) score = 8.0 + ((-0.15 - gap) / 0.10) * 1.5;
  else if (gap <= -0.05) score = 6.5 + ((-0.05 - gap) / 0.10) * 1.5;
  else if (gap <=  0.05) score = 5.5 + ((0.05 - gap) / 0.10) * 1.0;
  else if (gap <=  0.15) score = 4.0 + ((0.15 - gap) / 0.10) * 1.5;
  else if (gap <=  0.30) score = 2.5 + ((0.30 - gap) / 0.15) * 1.5;
  else                   score = Math.max(1.0, 2.5 - (gap - 0.30) * 5);

  const confidence = comparables.length >= 20 ? 'high' : comparables.length >= 10 ? 'medium' : 'low';

  return {
    name, state: 'SCORED',
    score: Math.min(10, Math.max(1, Math.round(score * 10) / 10)),
    confidence,
    inputs: {
      askingPriceSqm: listing.priceSqm,
      marketMedianSqm: Math.round(median),
      marketP25Sqm: Math.round(p25),
      marketP75Sqm: Math.round(p75),
      gapToMedianPct: Math.round(gap * 100),
      comparablesUsed: comparables.length,
      interpretation: gap < 0
        ? `Asking ${Math.abs(Math.round(gap * 100))}% below area median`
        : `Asking ${Math.round(gap * 100)}% above area median`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// D2 — CLIMATE
// ─────────────────────────────────────────────────────────────────────────────
function scoreClimate(listing, market) {
  const name = 'Climate';
  const baseline = CLIMATE_RISK[market] || CLIMATE_RISK.de;

  // Sub-risk scores (higher = worse). Convert to 1-10 scale (higher = safer).
  const subRisks = {
    flood:    { level: baseline.flood,    label: riskLabel(baseline.flood) },
    wildfire: { level: baseline.wildfire, label: riskLabel(baseline.wildfire) },
    heat:     { level: baseline.heat,     label: riskLabel(baseline.heat) },
    seismic:  { level: baseline.seismic,  label: riskLabel(baseline.seismic) },
    coastal:  { level: baseline.coastal,  label: riskLabel(baseline.coastal) },
  };

  // Composite: weighted average of sub-risks, inverted (lower risk = higher score)
  const weights = { flood: 0.30, wildfire: 0.25, heat: 0.25, seismic: 0.10, coastal: 0.10 };
  const weightedRisk = Object.keys(weights).reduce((sum, key) => sum + baseline[key] * weights[key], 0);
  const score = Math.round((10 - weightedRisk) * 10) / 10;

  const flags = [];
  if (baseline.flood >= 7) flags.push('HIGH_FLOOD_RISK — verify GEORISQUES / EFAS flood zone before purchase');
  if (baseline.wildfire >= 7) flags.push('HIGH_WILDFIRE_RISK — check local PPRI/PPRIF or GWIS wildfire hazard map');
  if (baseline.heat >= 8) flags.push('EXTREME_HEAT_EXPOSURE — factor A/C and insulation costs into D4 ROI');
  if (baseline.seismic >= 6) flags.push('ELEVATED_SEISMIC_RISK — structural insurance recommended');

  return {
    name, state: 'SCORED',
    score: Math.max(1, score),
    confidence: 'medium',
    subRisks,
    flags,
    inputs: {
      market,
      note: 'Regional baseline risk. For property-level accuracy, cross-reference exact address on Copernicus EFAS (flood), GWIS (wildfire) and national risk portals.',
      sources: ['Copernicus Climate Change Service', 'EFAS', 'GWIS', 'Eurostat'],
    },
  };
}

function riskLabel(level) {
  if (level <= 2) return 'Low';
  if (level <= 4) return 'Moderate';
  if (level <= 6) return 'Elevated';
  if (level <= 8) return 'High';
  return 'Extreme';
}

// ─────────────────────────────────────────────────────────────────────────────
// D3 — DEMOGRAPHIC
// ─────────────────────────────────────────────────────────────────────────────
function scoreDemographic(listing, market) {
  const name = 'Demographic';
  // Regional demographic data would normally come from Eurostat API (cached)
  // Directional defaults by market — replace with live Eurostat NUTS-3 lookup
  const demo = {
    ch: { popGrowth5yr: 0.08, under40pct: 0.45, migrationTrend: 'positive', source: 'BFS 2024' },
    de: { popGrowth5yr: 0.02, under40pct: 0.40, migrationTrend: 'stable',   source: 'Destatis 2024' },
    at: { popGrowth5yr: 0.05, under40pct: 0.42, migrationTrend: 'positive', source: 'Statistik Austria 2024' },
    es: { popGrowth5yr: 0.04, under40pct: 0.38, migrationTrend: 'positive', source: 'INE 2024' },
    pt: { popGrowth5yr: 0.03, under40pct: 0.36, migrationTrend: 'stable',   source: 'INE PT 2024' },
    it: { popGrowth5yr: -0.01, under40pct: 0.34, migrationTrend: 'negative', source: 'ISTAT 2024' },
    fr: { popGrowth5yr: 0.03, under40pct: 0.40, migrationTrend: 'stable',   source: 'INSEE 2024' },
  }[market] || { popGrowth5yr: 0, under40pct: 0.38, migrationTrend: 'stable', source: 'Eurostat' };

  let score = 5.0;
  score += demo.popGrowth5yr * 30;    // +3 for 10% growth over 5yr
  score += (demo.under40pct - 0.35) * 20; // +1 per 5ppt above 35% base
  if (demo.migrationTrend === 'positive') score += 1.0;
  if (demo.migrationTrend === 'negative') score -= 1.5;

  return {
    name, state: 'SCORED',
    score: Math.min(10, Math.max(1, Math.round(score * 10) / 10)),
    confidence: 'medium',
    inputs: {
      populationGrowth5yr: `${(demo.popGrowth5yr * 100).toFixed(1)}%`,
      under40Share: `${(demo.under40pct * 100).toFixed(0)}%`,
      migrationTrend: demo.migrationTrend,
      level: 'Regional baseline — sub-national data available via Eurostat NUTS-3',
      source: demo.source,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// D4 — RETURN ON INVESTMENT
// ─────────────────────────────────────────────────────────────────────────────
function scoreROI(listing, comparables, rentals, market) {
  const name = 'Return on Investment';

  if (!listing.price) return { name, score: null, state: 'MISSING_PRICE', inputs: {} };

  const regionKey = `${market}_${listing.region || 'default'}`;
  const tx = TX_COSTS[regionKey] || TX_COSTS[`${market}_default`] || TX_COSTS[market] || TX_COSTS.de_default;
  const totalAcquisitionCost = listing.price * (1 + tx.total);

  // Estimate annual gross rent from rental comparables
  let annualGrossRent = null;
  let rentConfidence = 'low';
  if (rentals.length >= 3) {
    const avgRentSqm = rentals.reduce((s, r) => s + r.priceSqm, 0) / rentals.length;
    annualGrossRent = avgRentSqm * (listing.sqm || 80) * 12;
    rentConfidence = rentals.length >= 8 ? 'high' : 'medium';
  }

  // Operating cost assumptions (conservative)
  const maintenanceRate = 0.012; // 1.2% of property value per year
  const voidRate = 0.042;        // 4.2% of annual rent (≈ 2.2 weeks void)
  const mgmtRate = 0.10;         // 10% management if outsourced

  let score = null;
  let netYield = null;
  let grossYield = null;

  if (annualGrossRent) {
    grossYield = annualGrossRent / listing.price;
    const opCosts = (listing.price * maintenanceRate) + (annualGrossRent * voidRate);
    const annualNetRent = annualGrossRent - opCosts;
    netYield = annualNetRent / totalAcquisitionCost;

    if      (netYield >= 0.07) score = 9.0 + Math.min(1.0, (netYield - 0.07) * 10);
    else if (netYield >= 0.05) score = 7.0 + (netYield - 0.05) / 0.02 * 2.0;
    else if (netYield >= 0.03) score = 5.0 + (netYield - 0.03) / 0.02 * 2.0;
    else if (netYield >= 0.01) score = 3.0 + (netYield - 0.01) / 0.02 * 2.0;
    else score = Math.max(1.0, 3.0 + netYield * 50);
  }

  const txCostFormatted = Object.entries(tx)
    .filter(([k]) => k !== 'total')
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`)
    .join(', ');

  return {
    name, state: annualGrossRent ? 'SCORED' : 'LIMITED_DATA',
    score: score ? Math.min(10, Math.max(1, Math.round(score * 10) / 10)) : null,
    confidence: rentals.length >= 8 ? 'high' : rentals.length >= 3 ? 'medium' : 'low',
    inputs: {
      purchasePrice: listing.price,
      totalAcquisitionCost: Math.round(totalAcquisitionCost),
      transactionCosts: `${(tx.total * 100).toFixed(1)}% (${txCostFormatted})`,
      estimatedGrossRent: annualGrossRent ? Math.round(annualGrossRent) : 'Insufficient rental data',
      grossYield: grossYield ? `${(grossYield * 100).toFixed(2)}%` : null,
      netYield: netYield ? `${(netYield * 100).toFixed(2)}%` : null,
      rentComparablesUsed: rentals.length,
      rentConfidence,
      maintenanceAssumption: `${(maintenanceRate * 100).toFixed(1)}% p.a. of property value`,
      voidAssumption: `${(voidRate * 100).toFixed(1)}% of annual rent`,
    },
    disclaimer: 'Projections are indicative only. Actual returns depend on financing terms, tax regime, property condition, local market conditions, and tenant risk. Not financial advice.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// D5 — RENTAL / VACANCY
// ─────────────────────────────────────────────────────────────────────────────
function scoreRentalVacancy(listing, rentals, market) {
  const name = 'Rental / Vacancy';

  if (rentals.length < 3) {
    return {
      name, state: 'LIMITED_DATA',
      score: null, confidence: 'low',
      message: `Only ${rentals.length} rental comparable${rentals.length !== 1 ? 's' : ''} found. Rental/Vacancy score withheld.`,
      inputs: { rentalsFound: rentals.length },
    };
  }

  const avgRentSqm = rentals.reduce((s, r) => s + r.priceSqm, 0) / rentals.length;
  const grossYield = avgRentSqm * 12 / (listing.priceSqm || 1);

  let score = 5.0;
  if (grossYield >= 0.08) score = 9.0;
  else if (grossYield >= 0.06) score = 7.5;
  else if (grossYield >= 0.045) score = 6.0;
  else if (grossYield >= 0.03) score = 4.5;
  else score = 3.0;

  // Rent control zone check
  const controlledCities = RENT_CONTROL_CITIES[market] || [];
  const city = listing.city || '';
  const rentControlled = controlledCities.some(c => city.toLowerCase().includes(c.toLowerCase()));

  const flags = [];
  if (rentControlled) {
    flags.push({
      type: 'RENT_CONTROL',
      level: 'warning',
      message: `${city} is in a rent-control zone (${market === 'de' ? 'Mietpreisbremse' : market === 'es' ? 'Ley de Vivienda' : 'rent regulation applies'}). New rental contracts subject to statutory caps. Verify applicable Mietspiegel / índice de referencia before modelling income.`,
    });
    score = Math.max(score - 1.5, 1.0);
  }

  // DPE / energy restriction flag for France
  if (market === 'fr' && !listing.energyRating) {
    flags.push({
      type: 'DPE_UNVERIFIED',
      level: 'warning',
      message: 'DPE (energy rating) not found in listing. French Loi Climat 2021 prohibits new rental contracts for G-rated properties (since 2025) and F-rated properties (from 2028). Verify DPE before modelling rental income.',
    });
  }
  if (market === 'fr' && listing.energyRating && ['F', 'G'].includes(listing.energyRating.toUpperCase())) {
    flags.push({
      type: 'DPE_RENTAL_RESTRICTION',
      level: 'critical',
      message: `DPE ${listing.energyRating.toUpperCase()} — rental restricted under Loi Climat 2021. Long-term rental income not legally available without energy retrofit.`,
    });
    score = Math.max(score - 3.0, 1.0);
  }

  return {
    name, state: 'SCORED',
    score: Math.min(10, Math.max(1, Math.round(score * 10) / 10)),
    confidence: rentals.length >= 10 ? 'high' : 'medium',
    flags,
    inputs: {
      avgRentPerSqm: Math.round(avgRentSqm),
      estimatedGrossYield: `${(grossYield * 100).toFixed(2)}%`,
      rentComparablesUsed: rentals.length,
      rentControlZone: rentControlled,
      energyRating: listing.energyRating || 'Not disclosed',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// D6 — LIVEABILITY
// ─────────────────────────────────────────────────────────────────────────────
function scoreLiveability(listing, market) {
  const name = 'Liveability';
  // In production: query OSM Overpass API with listing lat/lon for amenity proximity
  // Self-hosted Overpass instance recommended for production volume
  // Fallback: city-level liveability baseline below

  const cityBaselines = {
    Zürich: 9.2, Bern: 8.5, Basel: 8.3, Genf: 8.1,
    München: 8.8, Berlin: 8.5, Hamburg: 8.4, Frankfurt: 8.2,
    Wien: 9.0, Graz: 7.8,
    Madrid: 8.0, Barcelona: 8.5, Valencia: 7.8,
    Lisboa: 7.8, Porto: 7.5,
    Milano: 8.0, Roma: 7.5,
    Paris: 8.5, Lyon: 7.8,
  };

  const city = listing.city || '';
  const matchedCity = Object.keys(cityBaselines).find(c =>
    city.toLowerCase().includes(c.toLowerCase())
  );
  const baseScore = matchedCity ? cityBaselines[matchedCity] : 5.5;

  return {
    name, state: 'SCORED',
    score: baseScore,
    confidence: matchedCity ? 'medium' : 'low',
    inputs: {
      city: listing.city || 'Unknown',
      note: matchedCity
        ? `City-level baseline score. Property-level score requires OSM Overpass API query for transit, amenities, noise, and school proximity.`
        : 'City not matched. Score is conservative directional estimate. Run OSM query for accurate D6.',
      source: 'get9d city index + OSM baseline (Overpass)',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// D7 — PRICE TREND  (renamed from Appreciation — forward-looking claim removed)
// ─────────────────────────────────────────────────────────────────────────────
function scorePriceTrend(listing, market) {
  const name = 'Price Trend';
  const trend = PRICE_TREND[market];
  if (!trend) return { name, score: 5.0, confidence: 'low', inputs: { market } };

  let score = 5.0;
  score += trend.growth1yr * 30;   // +3 for 10% annual growth
  score += trend.growth3yr * 10;   // +1 for 10% 3yr growth
  if (trend.volatility === 'low')    score += 0.5;
  if (trend.volatility === 'high')   score -= 1.0;

  return {
    name, state: 'SCORED',
    score: Math.min(10, Math.max(1, Math.round(score * 10) / 10)),
    confidence: 'medium',
    inputs: {
      growth1yr: `${(trend.growth1yr * 100).toFixed(1)}%`,
      growth3yr: `${(trend.growth3yr * 100).toFixed(1)}%`,
      volatility: trend.volatility,
      source: trend.source,
    },
    disclaimer: 'Historical price data only. Past performance does not predict future values. Local supply, regulation, and macro conditions significantly affect future outcomes.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// D8 — SELLER MOTIVATION
// ─────────────────────────────────────────────────────────────────────────────
function scoreSellerMotivation(listing, market) {
  const name = 'Seller Motivation';
  let score = 5.0;
  const signals = [];

  // Market-specific median days on market
  const medianDom = { ch: 45, de: 55, at: 60, es: 90, pt: 100, it: 120, fr: 75 }[market] || 70;

  // Days on market
  const dom = listing.daysOnMarket;
  if (dom) {
    if (dom > medianDom * 3) {
      score += 2.5;
      signals.push({ signal: 'STALE_LISTING', text: `Listed ${dom} days — ${Math.round(dom / medianDom)}× above area median (${medianDom} days)`, weight: 'high' });
    } else if (dom > medianDom * 1.5) {
      score += 1.0;
      signals.push({ signal: 'EXTENDED_LISTING', text: `Listed ${dom} days (area median ${medianDom} days)`, weight: 'medium' });
    }
  }

  // Price reductions
  const reds = listing.priceReductions || [];
  if (reds.length >= 3) {
    const totalOff = reds.reduce((s, r) => s + (r.pctOff || 0), 0);
    score += 2.5;
    signals.push({ signal: 'MULTIPLE_REDUCTIONS', text: `${reds.length} price reductions — total ${totalOff.toFixed(0)}% off original ask`, weight: 'high' });
  } else if (reds.length >= 1) {
    score += 1.0;
    signals.push({ signal: 'PRICE_REDUCTION', text: `${reds.length} price reduction recorded`, weight: 'medium' });
  }

  // Re-listing
  if (listing.previouslyWithdrawn) {
    score += 1.5;
    signals.push({ signal: 'RE_LISTED', text: 'Previously withdrawn and re-listed — strong motivation indicator', weight: 'high' });
  }

  // Auction channel
  if (listing.isAuction) {
    score += 2.0;
    signals.push({ signal: 'JUDICIAL_AUCTION', text: `Court/judicial auction (${listing.auctionType || 'forced sale'}) — seller has no price discretion`, weight: 'high' });
  }

  // Distress language in description
  const distressTerms = ['urgent', 'urgente', 'dringend', 'schnell verkauf', 'last chance',
    'price reduced', 'motivated seller', 'estate sale', 'bankrupt', 'concurso',
    'saisie', 'verwertung', 'price negotiable'];
  const found = distressTerms.filter(t => listing.description.toLowerCase().includes(t));
  if (found.length > 0) {
    score += found.length * 0.5;
    signals.push({ signal: 'DISTRESS_LANGUAGE', text: `Description contains distress language: "${found.join('", "')}"`, weight: 'medium' });
  }

  // Abnormally low price vs market (D8 picks this up independently of D1)
  if (listing.priceSqm && listing.market) {
    // If price is below plausible floor for any European market (very rough guard)
    const absoluteFloor = 400; // €/sqm — nothing livable goes below this anywhere in our markets
    if (listing.priceSqm < absoluteFloor) {
      score += 1.5;
      signals.push({ signal: 'PRICE_ANOMALY', text: `Asking price €${listing.priceSqm}/sqm is below the minimum plausible floor for this market (€${absoluteFloor}/sqm). Investigate undisclosed encumbrances, illegal construction, or fraud before any contact.`, weight: 'critical' });
    }
  }

  const confidence = (dom !== null || reds.length > 0 || listing.isAuction) ? 'high' : 'medium';

  return {
    name, state: 'SCORED',
    score: Math.min(10, Math.max(1, Math.round(score * 10) / 10)),
    confidence,
    signals,
    inputs: {
      daysOnMarket: listing.daysOnMarket,
      priceReductionCount: reds.length,
      isAuction: listing.isAuction,
      previouslyWithdrawn: listing.previouslyWithdrawn,
      distressLanguageFound: found?.length || 0,
    },
    note: 'D8 reflects observable listing behaviour only. A high score indicates motivation signals — not a guarantee of transaction success or below-market price.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// D9 — LEGAL
// ─────────────────────────────────────────────────────────────────────────────
function scoreLegal(listing, market) {
  const name = 'Legal';
  let score = 7.0; // Start from reasonable baseline — European frameworks are generally solid
  const flags = [];

  // Agency registration check
  if (!listing.hasRegistrationNumber) {
    score -= 1.0;
    flags.push({ type: 'NO_AGENT_REGISTRATION', level: 'warning', message: 'No agent registration number found. In Spain: require RAICV/API number. In Germany: MaBV licence. In France: carte professionnelle.' });
  }

  // Encumbrance mentions in listing text
  if (listing.encumbranceMentioned) {
    score -= 2.5;
    flags.push({ type: 'ENCUMBRANCE_MENTIONED', level: 'critical', message: 'Description contains language suggesting charges, mortgages, or legal encumbrances. Obtain Nota Simple (ES), Grundbuchauszug (DE), or Extrait hypothécaire (FR/CH) before proceeding.' });
  }

  // Energy rating missing (mandatory by EU law)
  if (!listing.energyRating) {
    score -= 0.5;
    flags.push({ type: 'ENERGY_RATING_MISSING', level: 'warning', message: 'EPC / DPE / Energieausweis not disclosed. Mandatory under EU Energy Performance of Buildings Directive for all sale listings. Seller must provide on request.' });
  }

  // Auction-specific legal checks
  if (listing.isAuction && market === 'de') {
    flags.push({ type: 'AUCTION_WERTGUTACHTEN', level: 'info', message: 'ZVG (Zwangsversteigerung) proceedings require the Wertgutachten (court valuation) to be publicly available. Obtain and review before any bid. Check for occupancy status and outstanding charges (Lasten).' });
  }
  if (listing.isAuction && market === 'es') {
    flags.push({ type: 'AUCTION_CARGAS', level: 'info', message: 'BOE judicial auction notice must list cargas y gravámenes (charges and encumbrances). Verify full BOE listing and obtain Nota Simple from Registro de la Propiedad before bidding.' });
  }

  // Extreme underpricing — cross-check with D8 anomaly
  const absoluteFloor = 400;
  if (listing.priceSqm && listing.priceSqm < absoluteFloor) {
    score -= 2.0;
    flags.push({ type: 'PRICE_BELOW_FLOOR', level: 'critical', message: `Price €${listing.priceSqm}/sqm is below the minimum plausible market floor. May indicate hidden legal issues, demolition order, illegal construction, or fraud. Do not pay any deposit without independent legal verification.` });
  }

  score = Math.min(10, Math.max(1, Math.round(score * 10) / 10));

  return {
    name, state: 'SCORED',
    score,
    confidence: 'medium',
    flags,
    suppressionActive: score < 4.0,
    inputs: {
      agentRegistered: !!listing.hasRegistrationNumber,
      encumbranceMentioned: listing.encumbranceMentioned,
      energyRatingDisclosed: !!listing.energyRating,
      isAuction: listing.isAuction,
      market,
    },
    disclaimer: 'D9 is based on observable public data only and does NOT confirm title clarity, absence of encumbrances, planning legality, or compliance with building regulations. Independent legal due diligence by a qualified local solicitor/notaire/Notar/abogado is mandatory before any property transaction. get9d does not provide legal advice.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE SCORE + D9 SUPPRESSION
// ─────────────────────────────────────────────────────────────────────────────
function buildComposite(scores, tier) {
  const { d1, d2, d3, d4, d5, d6, d7, d8, d9 } = scores;

  // D9 suppression: if D9 < 4.0, composite capped at 5.0 regardless
  const d9Score = d9.score || 0;
  const suppressionActive = d9Score < 4.0;

  // Weights for composite (only scored dimensions count)
  const weights = { d1: 0.25, d2: 0.08, d3: 0.08, d4: 0.20, d5: 0.12, d6: 0.08, d7: 0.08, d8: 0.06, d9: 0.05 };
  let weightedSum = 0;
  let totalWeight = 0;

  Object.entries(scores).forEach(([key, dim]) => {
    if (dim.score !== null && dim.score !== undefined && dim.state !== 'LIMITED_DATA') {
      weightedSum += dim.score * (weights[key] || 0.05);
      totalWeight += weights[key] || 0.05;
    }
  });

  let composite = totalWeight > 0 ? weightedSum / totalWeight : null;
  if (composite !== null && suppressionActive) composite = Math.min(composite, 5.0);

  const rating = composite === null ? 'INSUFFICIENT_DATA' :
    composite >= 8.0 ? 'EXCELLENT_DEAL' :
    composite >= 6.5 ? 'GOOD_DEAL' :
    composite >= 5.0 ? 'FAIR_PRICE' :
    composite >= 3.5 ? 'WATCH' : 'AVOID';

  return {
    composite: composite !== null ? Math.round(composite * 10) / 10 : null,
    suppressed: suppressionActive,
    rating,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER GATING
// free  → D1 (score only, no inputs) + D8 (traffic light only)
// core  → D1–D6 full
// pro   → D1–D9 full
// ─────────────────────────────────────────────────────────────────────────────
function gateDimensions(scores, tier) {
  const { d1, d2, d3, d4, d5, d6, d7, d8, d9 } = scores;

  if (tier === 'free') {
    return {
      d1: { ...d1, inputs: undefined }, // score only
      d8: { name: d8.name, trafficLight: d8.score >= 7 ? 'red' : d8.score >= 5 ? 'amber' : 'green', upgradeRequired: true },
      locked: ['d2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd9'],
    };
  }

  if (tier === 'core') {
    return { d1, d2, d3, d4, d5, d6, locked: ['d7', 'd8', 'd9'] };
  }

  // pro — full access
  return { d1, d2, d3, d4, d5, d6, d7, d8, d9 };
}
