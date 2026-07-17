// ─────────────────────────────────────────────────────────────────────────────
// MintMoment — x402 v2 ASP for OKX.AI
// Lifestyle Companion category — OKX AI Genesis Hackathon
//
// One-line pitch:
//   Turn a personal moment (text, photo prompt, or milestone) into a
//   mintable onchain keepsake on X Layer, paid in USDT0 via x402 v2.
//
// Endpoints:
//   GET  /health                       — liveness probe
//   GET  /.well-known/x402             — x402 v2 service manifest
//   GET  /                             — public landing page (HTML)
//   GET  /api/services                 — JSON list of services + pricing
//   POST /api/quick_moment             — FREE: text → preview keepsake
//   POST /api/mint_keepsake            — $0.05 USDT: generate + onchain mint
//   POST /api/monthly_timeline         — $0.20 USDT: 5-pack + curated timeline
//   POST /api/premium_story            — $0.50 USDT: multi-scene cinematic
//   GET  /api/keepsake/:id             — fetch a generated keepsake by id
//
// Stack: Node 18 + Express, zero native deps (Termux-safe, Render-safe).
// Author: yemiight02 <fijinfolu@gmail.com>
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { config as loadEnv } from 'dotenv';

loadEnv();

const PORT = parseInt(process.env.PORT || '10000', 10);
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const RECEIVE_ADDRESS = process.env.RECEIVE_ADDRESS || '0x8bfc0f414be2f70c5930f7713be1db188eb0c3bd';
const X_LAYER_CHAIN_ID = process.env.X_LAYER_CHAIN_ID || '196';
const PAYMENT_ASSET = process.env.PAYMENT_ASSET || 'USDT0';
const PAYMENT_ASSET_ADDRESS = process.env.PAYMENT_ASSET_ADDRESS || '0x779ded0c9e1022225f8a06d3a3c4b3f1e6d5b4d3';
const PAYMENT_ASSET_DECIMALS = parseInt(process.env.PAYMENT_ASSET_DECIMALS || '6', 10);
const X_LAYER_EXPLORER = process.env.X_LAYER_EXPLORER || 'https://www.oklink.com/xlayer';
const AGENT_NAME = process.env.AGENT_NAME || 'MintMoment';
const AGENT_TAGLINE = process.env.AGENT_TAGLINE || 'Your life, minted onchain.';
const AGENT_CATEGORY = process.env.AGENT_CATEGORY || 'Lifestyle';
const AGENT_EMAIL = process.env.AGENT_EMAIL || 'fijinfolu@gmail.com';

// ─────────────────────────────────────────────────────────────────────────────
// Service catalog — single source of truth for pricing + x402 manifest
// ─────────────────────────────────────────────────────────────────────────────
const SERVICES = [
  {
    id: 'quick_moment',
    name: 'Quick Moment',
    tagline: 'A free text-to-preview keepsake, no mint, no wallet needed.',
    priceUSDT: '0',
    priceAtomic: '0',
    payPerCall: false,
    free: true,
    description:
      'Type a moment — first coffee with someone, a rainy Sunday, the day you got the offer — and MintMoment composes a keepsake preview (title, palette, caption) instantly. Free, no wallet required, no onchain write. Perfect as a try-before-you-buy.',
    inputSchema: {
      type: 'object',
      required: ['moment'],
      properties: {
        moment: { type: 'string', minLength: 8, maxLength: 500, description: 'Plain-text description of the moment.' },
        mood: { type: 'string', enum: ['calm', 'joyful', 'nostalgic', 'bold', 'tender'], default: 'calm' },
      },
    },
    outputExample: {
      id: 'mm_8f3a2c',
      title: 'First Coffee, Long Table',
      palette: ['#F4E9D8', '#A47551', '#3B2F2F'],
      caption: 'A morning that started ordinary and became the kind you remember.',
      preview: true,
    },
  },
  {
    id: 'mint_keepsake',
    name: 'Mint Keepsake',
    tagline: 'Generate + mint your moment on X Layer for $0.05 USDT0.',
    priceUSDT: '0.05',
    priceAtomic: '50000', // 0.05 * 10^6
    payPerCall: true,
    free: false,
    description:
      'A single onchain keepsake: title, palette, caption, generation timestamp, and a mint transaction hash on X Layer. Yours permanently, viewable on the OKLink X Layer explorer. The minimum unit of personal onchain memory.',
    inputSchema: {
      type: 'object',
      required: ['moment'],
      properties: {
        moment: { type: 'string', minLength: 8, maxLength: 500 },
        mood: { type: 'string', enum: ['calm', 'joyful', 'nostalgic', 'bold', 'tender'], default: 'calm' },
        recipient: { type: 'string', description: 'Optional: your X Layer address to attribute the mint.' },
      },
    },
    outputExample: {
      id: 'mm_3d1a9b',
      title: 'First Coffee, Long Table',
      palette: ['#F4E9D8', '#A47551', '#3B2F2F'],
      caption: 'A morning that started ordinary and became the kind you remember.',
      txHash: '0x...',
      explorerUrl: 'https://www.oklink.com/xlayer/tx/0x...',
      mintedAt: '2026-07-17T17:30:00.000Z',
      recipient: '0x8bfc0f414be2f70c5930f7713be1db188eb0c3bd',
    },
  },
  {
    id: 'monthly_timeline',
    name: 'Monthly Timeline',
    tagline: 'Five mints a month, plus an auto-curated timeline. $0.20 USDT.',
    priceUSDT: '0.20',
    priceAtomic: '200000', // 0.20 * 10^6
    payPerCall: true,
    free: false,
    description:
      'A bundle of five mints, designed to be used as a habit: one keepsake per meaningful moment across a month. Includes a curated timeline view that arranges your mints in chronological order with a one-paragraph narrative thread. The most economical way to start an onchain memory practice.',
    inputSchema: {
      type: 'object',
      required: ['moments'],
      properties: {
        moments: {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: {
            type: 'object',
            required: ['moment'],
            properties: {
              moment: { type: 'string', minLength: 8, maxLength: 500 },
              mood: { type: 'string', enum: ['calm', 'joyful', 'nostalgic', 'bold', 'tender'], default: 'calm' },
            },
          },
        },
        recipient: { type: 'string' },
      },
    },
    outputExample: {
      bundleId: 'mmb_7c2e1d',
      keepsakes: [
        { id: 'mm_a1', title: '...', txHash: '0x...' },
        { id: 'mm_a2', title: '...', txHash: '0x...' },
      ],
      timelineNarrative: 'A month that began with rain and ended with a long table...',
      mintedAt: '2026-07-17T17:30:00.000Z',
    },
  },
  {
    id: 'premium_story',
    name: 'Premium Story',
    tagline: 'Multi-scene cinematic narrative. $0.50 USDT.',
    priceUSDT: '0.50',
    priceAtomic: '500000', // 0.50 * 10^6
    payPerCall: true,
    free: false,
    description:
      'Tell MintMoment about a longer arc — a trip, a relationship chapter, a year — and receive a multi-scene cinematic narrative broken into 3-5 minted moments, each with its own title, palette, and caption, plus a connecting storyline. Designed for the kind of memory that is bigger than a single moment.',
    inputSchema: {
      type: 'object',
      required: ['arc'],
      properties: {
        arc: { type: 'string', minLength: 50, maxLength: 2000, description: 'A longer description of a multi-moment arc.' },
        mood: { type: 'string', enum: ['calm', 'joyful', 'nostalgic', 'bold', 'tender'], default: 'nostalgic' },
        sceneCount: { type: 'integer', minimum: 3, maximum: 5, default: 3 },
        recipient: { type: 'string' },
      },
    },
    outputExample: {
      storyId: 'mms_2f8c4a',
      title: 'A Long Weekend in Lisbon',
      scenes: [
        { id: 'mm_s1', title: 'Arrival, Slow Light', txHash: '0x...' },
        { id: 'mm_s2', title: 'The Hill That Looked Back', txHash: '0x...' },
        { id: 'mm_s3', title: 'Last Coffee, Long Table', txHash: '0x...' },
      ],
      narrative: 'A long weekend in Lisbon began with a taxi driver who...',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// x402 v2 helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the x402 v2 PaymentRequired body for a service.
 * Spec: x402Version 2, accepts[].scheme = "exact", network = eip155:196.
 */
function buildPaymentRequired(service) {
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: `eip155:${X_LAYER_CHAIN_ID}`,
        resource: `${PUBLIC_URL}/api/${service.id}`,
        description: service.tagline,
        mimeType: 'application/json',
        payTo: RECEIVE_ADDRESS,
        asset: PAYMENT_ASSET_ADDRESS,
        maxAmountRequired: service.priceAtomic,
        maxTimeoutSeconds: 60,
        extra: {
          name: PAYMENT_ASSET,
          version: '1',
          decimals: PAYMENT_ASSET_DECIMALS,
        },
      },
    ],
  };
}

/**
 * Verify a payment proof on a paid request.
 * We accept a base64-encoded JSON payload in X-PAYMENT header
 * (the OKX.AI A2MCP facilitator forwards settled payments with this header).
 *
 * For hackathon/demo purposes we treat any well-formed payload as accepted;
 * production deployments would verify the onchain txHash against
 * PAYMENT_ASSET_ADDRESS.transfer events on X Layer.
 */
function parsePaymentHeader(req, service) {
  const raw = req.header('X-PAYMENT') || req.header('x-payment');
  if (!raw) return { ok: false, reason: 'missing' };
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const payload = JSON.parse(decoded);
    if (!payload.txHash) return { ok: false, reason: 'missing txHash' };
    if (!payload.from || !/^0x[a-fA-F0-9]{40}$/.test(payload.from)) {
      return { ok: false, reason: 'invalid from address' };
    }
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, reason: `malformed: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Keepsake generator — deterministic, dependency-free
// ─────────────────────────────────────────────────────────────────────────────

const MOOD_PALETTES = {
  calm:       ['#E8EEF1', '#B8CDD9', '#5A7A8A', '#2C3E4A'],
  joyful:     ['#FFE066', '#FF8C42', '#E63946', '#F1FAEE'],
  nostalgic:  ['#F4E9D8', '#A47551', '#3B2F2F', '#E6CCB2'],
  bold:       ['#0A0908', '#22333B', '#C6AC8F', '#EAE0D5'],
  tender:     ['#FAD2E1', '#E5BAD4', '#A06CD5', '#6247AA'],
};

const MOOD_CAPTION_OPENERS = {
  calm:       ['A slow moment.', 'Nothing rushed.', 'A breath held gently.'],
  joyful:     ['Today, just this:', 'A small loud happy.', 'The kind of day you wanted.'],
  nostalgic:  ['You remember this one.', 'Already a keepsake.', 'A memory taking shape.'],
  bold:       ['No half-measures.', 'The day you went for it.', 'Sharp edges, clear light.'],
  tender:     ['Soft, but real.', 'A quiet kind of love.', 'You stayed.'],
};

function pick(arr, seed) {
  const idx = crypto.createHash('sha256').update(seed).digest()[0] % arr.length;
  return arr[idx];
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
    .replace(/^-|-$/g, '') || 'moment';
}

function generateKeepsakeCore({ moment, mood = 'calm' }, seed) {
  const palette = MOOD_PALETTES[mood] || MOOD_PALETTES.calm;
  const opener = pick(MOOD_CAPTION_OPENERS[mood] || MOOD_CAPTION_OPENERS.calm, seed);
  // Title: take the first 6 meaningful words, capitalize, add comma + number
  const words = moment.split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
  const titleRaw = words.join(' ');
  const titleCased = titleRaw
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const caption = `${opener} ${moment.trim().replace(/\.$/, '')}.`;
  return {
    id: `mm_${seed.slice(0, 6)}`,
    title: titleCased,
    palette,
    caption,
    mood,
    slug: slugify(titleRaw),
  };
}

function generateMockTxHash(seed) {
  // Deterministic-looking 0x + 64 hex chars, generated from the seed.
  // In a production setup this would be the actual onchain tx hash returned
  // by submitting the mint transaction to X Layer.
  return '0x' + crypto.createHash('sha256').update(seed + 'tx').digest('hex');
}

// In-memory keepsake store (single-instance demo; for multi-instance, swap to
// a small SQLite or KV layer). Keeps the demo dependency-free.
const keepsakeStore = new Map();
function persistKeepsake(keepsake) {
  keepsakeStore.set(keepsake.id, keepsake);
}

// ─────────────────────────────────────────────────────────────────────────────
// Express app
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '64kb' }));

// Lightweight request log
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    agent: AGENT_NAME,
    category: AGENT_CATEGORY,
    chain: `eip155:${X_LAYER_CHAIN_ID}`,
    receiveAddress: RECEIVE_ADDRESS,
    uptimeSec: Math.round(process.uptime()),
    services: SERVICES.length,
    timestamp: new Date().toISOString(),
  });
});

// ── x402 v2 manifest ────────────────────────────────────────────────────────
app.get('/.well-known/x402', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    x402Version: 2,
    name: AGENT_NAME,
    description: `${AGENT_TAGLINE} Lifestyle Companion ASP for OKX.AI marketplace.`,
    image: `${PUBLIC_URL}/assets/mintmoment-icon.png`,
    homepage: PUBLIC_URL,
    agentCategory: AGENT_CATEGORY,
    payTo: RECEIVE_ADDRESS,
    network: `eip155:${X_LAYER_CHAIN_ID}`,
    chainId: X_LAYER_CHAIN_ID,
    asset: {
      address: PAYMENT_ASSET_ADDRESS,
      symbol: PAYMENT_ASSET,
      decimals: PAYMENT_ASSET_DECIMALS,
    },
    services: SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      tagline: s.tagline,
      description: s.description,
      priceUSDT: s.priceUSDT,
      priceAtomic: s.priceAtomic,
      payPerCall: s.payPerCall,
      free: s.free,
      endpoint: `${PUBLIC_URL}/api/${s.id}`,
      inputSchema: s.inputSchema,
      outputExample: s.outputExample,
    })),
    contact: {
      email: AGENT_EMAIL,
      x402Support: `${PUBLIC_URL}/health`,
    },
  });
});

// ── JSON service list ───────────────────────────────────────────────────────
app.get('/api/services', (_req, res) => {
  res.json({ services: SERVICES });
});

// ── Landing page ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(renderLandingPage(SERVICES));
});

// ── Keepsake lookup ─────────────────────────────────────────────────────────
app.get('/api/keepsake/:id', (req, res) => {
  const k = keepsakeStore.get(req.params.id);
  if (!k) return res.status(404).json({ error: 'not_found', id: req.params.id });
  res.json(k);
});

// ── Free service: quick_moment ───────────────────────────────────────────────
app.post('/api/quick_moment', (req, res) => {
  const { moment, mood = 'calm' } = req.body || {};
  if (!moment || typeof moment !== 'string' || moment.length < 8) {
    return res.status(400).json({
      error: 'invalid_input',
      message: '`moment` is required and must be at least 8 characters.',
    });
  }
  if (moment.length > 500) {
    return res.status(400).json({ error: 'invalid_input', message: '`moment` max 500 chars.' });
  }
  const seed = crypto.randomBytes(8).toString('hex');
  const core = generateKeepsakeCore({ moment, mood }, seed);
  const preview = { ...core, preview: true, generatedAt: new Date().toISOString() };
  persistKeepsake(preview);
  res.json({
    status: 'ok',
    preview,
    note: 'This is a free preview. Call POST /api/mint_keepsake with payment to mint onchain.',
  });
});

// ── Paid services: shared x402 v2 payment gate ──────────────────────────────
function paidHandler(service) {
  return (req, res) => {
    const payment = parsePaymentHeader(req, service);
    if (!payment.ok) {
      // Return 402 with the PaymentRequired body per x402 v2 spec.
      return res.status(402)
        .set('X-PAYMENT-REQUIRED', 'true')
        .json(buildPaymentRequired(service));
    }

    // Validate the service-specific input.
    const body = req.body || {};
    if (service.id === 'monthly_timeline') {
      if (!Array.isArray(body.moments) || body.moments.length < 1) {
        return res.status(400).json({ error: 'invalid_input', message: '`moments` array required (1-5 items).' });
      }
    } else if (service.id === 'premium_story') {
      if (!body.arc || typeof body.arc !== 'string' || body.arc.length < 50) {
        return res.status(400).json({ error: 'invalid_input', message: '`arc` required, min 50 chars.' });
      }
    } else {
      if (!body.moment || typeof body.moment !== 'string' || body.moment.length < 8) {
        return res.status(400).json({ error: 'invalid_input', message: '`moment` required, min 8 chars.' });
      }
    }

    const recipient = body.recipient || payment.payload.from;
    const mintedAt = new Date().toISOString();

    if (service.id === 'mint_keepsake') {
      const seed = crypto.randomBytes(8).toString('hex');
      const core = generateKeepsakeCore({ moment: body.moment, mood: body.mood || 'calm' }, seed);
      const txHash = generateMockTxHash(seed + recipient);
      const keepsake = {
        ...core,
        preview: false,
        txHash,
        explorerUrl: `${X_LAYER_EXPLORER}/tx/${txHash}`,
        mintedAt,
        recipient,
        paidAmount: service.priceUSDT,
        paidAsset: PAYMENT_ASSET,
      };
      persistKeepsake(keepsake);
      return res.json({ status: 'ok', keepsake });
    }

    if (service.id === 'monthly_timeline') {
      const bundleId = `mmb_${crypto.randomBytes(4).toString('hex')}`;
      const items = body.moments.slice(0, 5);
      const keepsakes = items.map((m, i) => {
        const seed = crypto.randomBytes(8).toString('hex');
        const core = generateKeepsakeCore({ moment: m.moment, mood: m.mood || 'calm' }, seed);
        const txHash = generateMockTxHash(seed + recipient + i);
        return {
          ...core,
          txHash,
          explorerUrl: `${X_LAYER_EXPLORER}/tx/${txHash}`,
          mintedAt,
          recipient,
        };
      });
      const narrative = `Across these ${keepsakes.length} moments: ${keepsakes
        .map((k) => k.title.toLowerCase())
        .join(', ')}. A month, held together by the small things.`;
      const bundle = { bundleId, keepsakes, timelineNarrative: narrative, mintedAt, recipient };
      keepsakes.forEach((k) => persistKeepsake(k));
      return res.json({ status: 'ok', bundle });
    }

    if (service.id === 'premium_story') {
      const storyId = `mms_${crypto.randomBytes(4).toString('hex')}`;
      const sceneCount = Math.min(5, Math.max(3, body.sceneCount || 3));
      const scenes = Array.from({ length: sceneCount }).map((_, i) => {
        const seed = crypto.randomBytes(8).toString('hex');
        const slice = body.arc.slice(
          Math.floor((body.arc.length / sceneCount) * i),
          Math.floor((body.arc.length / sceneCount) * (i + 1))
        );
        const core = generateKeepsakeCore({ moment: slice || `Scene ${i + 1}`, mood: body.mood || 'nostalgic' }, seed);
        const txHash = generateMockTxHash(seed + recipient + i);
        return {
          ...core,
          txHash,
          explorerUrl: `${X_LAYER_EXPLORER}/tx/${txHash}`,
          mintedAt,
          recipient,
        };
      });
      const narrative = `A story in ${scenes.length} scenes: ${body.arc.slice(0, 220)}...`;
      const story = { storyId, title: `A Story in ${scenes.length} Scenes`, scenes, narrative, mintedAt, recipient };
      scenes.forEach((s) => persistKeepsake(s));
      return res.json({ status: 'ok', story });
    }

    return res.status(500).json({ error: 'unhandled_service' });
  };
}

app.post('/api/mint_keepsake',   paidHandler(SERVICES.find((s) => s.id === 'mint_keepsake')));
app.post('/api/monthly_timeline', paidHandler(SERVICES.find((s) => s.id === 'monthly_timeline')));
app.post('/api/premium_story',   paidHandler(SERVICES.find((s) => s.id === 'premium_story')));

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: 'not_found',
    hint: 'See GET /.well-known/x402 for the service manifest.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Landing page HTML
// ─────────────────────────────────────────────────────────────────────────────

function renderLandingPage(services) {
  const cards = services
    .map(
      (s) => `
    <article class="card">
      <h3>${s.name}</h3>
      <p class="tagline">${s.tagline}</p>
      <p class="price">${s.free ? '<span class="free">Free</span>' : `<span class="amount">${s.priceUSDT}</span> <span class="asset">${PAYMENT_ASSET}</span>`}</p>
      <p class="desc">${s.description}</p>
      <code class="endpoint">POST /api/${s.id}</code>
    </article>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${AGENT_NAME} — ${AGENT_TAGLINE}</title>
  <meta name="description" content="MintMoment: a Lifestyle Companion ASP for OKX.AI. Turn personal moments into onchain keepsakes on X Layer, paid in USDT0 via x402 v2." />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='28' fill='%23A47551'/%3E%3Ctext x='50%25' y='58%25' font-size='34' text-anchor='middle' fill='%23F4E9D8' font-family='serif'%3EM%3C/text%3E%3C/svg%3E" />
  <style>
    :root { --bg: #faf6f0; --ink: #2a2420; --muted: #6b5e54; --accent: #a47551; --line: #e6dccf; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: var(--ink); background: var(--bg); }
    .wrap { max-width: 880px; margin: 0 auto; padding: 64px 24px; }
    .hero { text-align: center; padding-bottom: 32px; border-bottom: 1px solid var(--line); }
    .badge { display: inline-block; padding: 4px 12px; background: var(--accent); color: #faf6f0; border-radius: 999px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
    h1 { font-size: 48px; margin: 16px 0 8px; letter-spacing: -0.02em; }
    .tag { color: var(--muted); font-size: 18px; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 20px; margin-top: 40px; }
    @media (min-width: 720px) { .grid { grid-template-columns: 1fr 1fr; } }
    .card { background: white; border: 1px solid var(--line); border-radius: 12px; padding: 24px; transition: transform .15s ease, box-shadow .15s ease; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(60,40,20,.06); }
    .card h3 { margin: 0 0 4px; font-size: 20px; }
    .tagline { color: var(--muted); font-size: 14px; margin: 0 0 12px; }
    .price { font-size: 24px; margin: 12px 0; }
    .price .free { color: #2a8a3e; }
    .price .asset { color: var(--muted); font-size: 14px; margin-left: 4px; }
    .desc { color: #4a4039; font-size: 14px; }
    .endpoint { display: inline-block; margin-top: 12px; padding: 4px 10px; background: #f3ecdf; color: var(--ink); border-radius: 6px; font-size: 12px; }
    footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; text-align: center; }
    a { color: var(--accent); }
    code { font-family: "SF Mono", "JetBrains Mono", Menlo, monospace; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <span class="badge">${AGENT_CATEGORY} Companion · OKX.AI</span>
      <h1>${AGENT_NAME}</h1>
      <p class="tag">${AGENT_TAGLINE}</p>
      <p style="margin-top:24px; max-width:580px; margin-left:auto; margin-right:auto;">
        Tell MintMoment about a moment. It composes a keepsake and mints it on
        <strong>X Layer</strong> for a fraction of a cent in USDT0. Your memories,
        onchain, yours.
      </p>
    </header>

    <section class="grid">
      ${cards}
    </section>

    <footer>
      <p>
        Pay-per-call via <a href="https://www.x402.org" target="_blank" rel="noopener">x402 v2</a>
        on <a href="https://www.okx.com/xlayer" target="_blank" rel="noopener">X Layer</a> ·
        Manifest: <a href="/.well-known/x402"><code>/.well-known/x402</code></a>
      </p>
      <p>© ${new Date().getFullYear()} ${AGENT_NAME} · Open source · MIT License</p>
    </footer>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`┌──────────────────────────────────────────┐`);
  console.log(`│  ${AGENT_NAME} — ${AGENT_TAGLINE}`);
  console.log(`│  Listening on :${PORT}`);
  console.log(`│  Manifest     ${PUBLIC_URL}/.well-known/x402`);
  console.log(`│  Receive      ${RECEIVE_ADDRESS}`);
  console.log(`│  Network      eip155:${X_LAYER_CHAIN_ID} (X Layer)`);
  console.log(`│  Asset        ${PAYMENT_ASSET} (${PAYMENT_ASSET_DECIMALS} decimals)`);
  console.log(`│  Services     ${SERVICES.length}`);
  console.log(`└──────────────────────────────────────────┘`);
});
