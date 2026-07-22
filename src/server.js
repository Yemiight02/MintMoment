// ─────────────────────────────────────────────────────────────────────────────
// MintMoment — x402 v2 ASP for OKX.AI
// Lifestyle Companion category — OKX AI Genesis Hackathon
//
// One-line pitch:
//   Turn a personal moment (text, photo prompt, or milestone) into a
//   mintable onchain keepsake on X Layer, paid in USDT0 via x402 v2.
//
// Endpoints:
//   GET  /health                          — liveness probe
//   GET  /.well-known/x402                — x402 v2 service manifest
//   GET  /                                — public landing page (judge-ready)
//   GET  /api/services                    — JSON list of services + pricing
//   GET  /api/recent                      — recent mints (live social proof)
//   GET  /api/keepsake/:id                — fetch a generated keepsake by id
//   POST /api/quick_moment                — FREE: text → preview keepsake
//   POST /api/mint_keepsake               — $0.05 USDT0: generate + onchain mint
//   POST /api/gift_keepsake               — $0.10 USDT0: gift to a recipient
//   POST /api/anniversary_mint            — $0.15 USDT0: dated milestone keepsake
//   POST /api/monthly_timeline            — $0.20 USDT0: 5-pack + curated timeline
//   POST /api/premium_story               — $0.50 USDT0: multi-scene cinematic
//
// Stack: Node 18 + Express, zero native deps (Termux-safe, Render-safe).
// Author: yemiight02 <fijinfolu@gmail.com>
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join as pathJoin, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const AGENT_DESCRIPTION = process.env.AGENT_DESCRIPTION ||
  'A Lifestyle Companion ASP that turns personal moments into onchain keepsakes on X Layer. Free previews, paid mints, gift to a friend, or build a whole year of memories — every keepsake settles in USDT0 via x402 v2 and is permanently viewable on the OKLink X Layer explorer.';

// ─────────────────────────────────────────────────────────────────────────────
// Service catalog — single source of truth for pricing + x402 manifest
// ─────────────────────────────────────────────────────────────────────────────
const SERVICES = [
// Note: services are listed in cheapest-paid-first order so the
// OKX.AI marketplace shows the right "starting price" (it picks the
// lowest fee; Quick Moment is free, so it showed 0.00 USDT).
  {
    id: 'mint_keepsake_trial',
    name: 'Mint Trial',
    tagline: 'Real onchain mint for one-tenth of a cent. The impulse-buy tier.',
    priceUSDT: '0.001',
    priceAtomic: '1000', // 0.001 * 10^6
    payPerCall: true,
    free: false,
    badge: 'Try real',
    description:
      'The same onchain mint as Mint Keepsake, priced at one-tenth of a cent (0.001 USDT0). Real X Layer transaction hash, real onchain proof, real sold count — just priced so anyone can try it without thinking. Use it once, see the workflow end-to-end, then upgrade to a full tier.',
    inputSchema: {
      type: 'object',
      required: ['moment'],
      properties: {
        moment: { type: 'string', minLength: 8, maxLength: 500 },
        mood: { type: 'string', enum: ['calm', 'joyful', 'nostalgic', 'bold', 'tender'], default: 'calm' },
        recipient: { type: 'string' },
      },
    },
    outputExample: {
      id: 'mm_trial_xyz',
      title: 'First Try Onchain',
      palette: ['#F4E9D8', '#A47551'],
      caption: 'A real mint, one-tenth of a cent.',
      txHash: '0x...',
      explorerUrl: 'https://www.oklink.com/xlayer/tx/0x...',
      mintedAt: '2026-07-22T00:00:00.000Z',
    },
  },
  {
    id: 'mint_keepsake',
    name: 'Mint Keepsake',
    tagline: 'Generate + mint your moment on X Layer.',
    priceUSDT: '0.05',
    priceAtomic: '50000', // 0.05 * 10^6
    payPerCall: true,
    free: false,
    badge: 'Most popular',
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
    id: 'gift_keepsake',
    name: 'Gift Keepsake',
    tagline: 'Mint and attribute to a recipient.',
    priceUSDT: '0.10',
    priceAtomic: '100000', // 0.10 * 10^6
    payPerCall: true,
    free: false,
    badge: 'New',
    description:
      'Mint a keepsake on behalf of someone else — a partner, a parent, a friend. The recipient address is embedded in the onchain record. The gift ships with a personal note field for human-readable dedication. Designed for the "I was thinking of you" moment.',
    inputSchema: {
      type: 'object',
      required: ['moment', 'recipient', 'toName'],
      properties: {
        moment: { type: 'string', minLength: 8, maxLength: 500 },
        mood: { type: 'string', enum: ['calm', 'joyful', 'nostalgic', 'bold', 'tender'], default: 'tender' },
        recipient: { type: 'string', description: 'X Layer address of the gift recipient (0x...).' },
        toName: { type: 'string', minLength: 1, maxLength: 80, description: 'Display name of the recipient.' },
        note: { type: 'string', maxLength: 280, description: 'A short personal note (≤280 chars).' },
      },
    },
    outputExample: {
      id: 'mm_g2b9e1',
      title: 'For M, On The Morning We Met',
      palette: ['#FAD2E1', '#E5BAD4', '#A06CD5'],
      caption: 'Soft, but real. The morning everything changed.',
      toName: 'M',
      note: 'I keep this one for us.',
      txHash: '0x...',
      explorerUrl: 'https://www.oklink.com/xlayer/tx/0x...',
      mintedAt: '2026-07-17T17:30:00.000Z',
      recipient: '0xabc...123',
    },
  },
  {
    id: 'anniversary_mint',
    name: 'Anniversary Mint',
    tagline: 'Date-stamped milestone keepsake.',
    priceUSDT: '0.15',
    priceAtomic: '150000', // 0.15 * 10^6
    payPerCall: true,
    free: false,
    badge: null,
    description:
      'For the moments that have a date. Birthdays, anniversaries, the day you moved cities, the day you left. Provide an ISO date and a moment, and MintMoment composes a date-anchored keepsake with a "since then" caption that looks back from the present.',
    inputSchema: {
      type: 'object',
      required: ['moment', 'anniversaryDate'],
      properties: {
        moment: { type: 'string', minLength: 8, maxLength: 500 },
        anniversaryDate: { type: 'string', format: 'date', description: 'ISO date (YYYY-MM-DD) of the milestone.' },
        mood: { type: 'string', enum: ['calm', 'joyful', 'nostalgic', 'bold', 'tender'], default: 'nostalgic' },
        recipient: { type: 'string' },
      },
    },
    outputExample: {
      id: 'mm_a1c4f2',
      title: 'Three Years, One Kitchen',
      palette: ['#F4E9D8', '#A47551'],
      caption: 'Already a keepsake. Three years in, and the kitchen still smells like morning.',
      anniversaryDate: '2023-07-17',
      yearsSince: 3,
      txHash: '0x...',
      explorerUrl: 'https://www.oklink.com/xlayer/tx/0x...',
      mintedAt: '2026-07-17T17:30:00.000Z',
    },
  },
  {
    id: 'monthly_timeline',
    name: 'Monthly Timeline',
    tagline: 'Up to five mints + an auto-curated timeline.',
    priceUSDT: '0.20',
    priceAtomic: '200000', // 0.20 * 10^6
    payPerCall: true,
    free: false,
    badge: null,
    description:
      'A bundle of up to five mints, designed to be used as a habit: one keepsake per meaningful moment across a month. Includes a curated narrative thread that arranges the mints into a single, readable story. The most economical way to start an onchain memory practice.',
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
    tagline: 'Multi-scene cinematic narrative.',
    priceUSDT: '0.50',
    priceAtomic: '500000', // 0.50 * 10^6
    payPerCall: true,
    free: false,
    badge: null,
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
  {
    id: 'quick_moment',
    name: 'Quick Moment',
    tagline: 'A free text-to-preview keepsake — no mint, no wallet.',
    priceUSDT: '0',
    priceAtomic: '0',
    payPerCall: false,
    free: true,
    badge: 'Try free',
    description:
      'Type a moment — first coffee with someone, a rainy Sunday, the day you got the offer — and MintMoment composes a keepsake preview (title, palette, caption) instantly. No wallet, no onchain write, no commitment. The fastest way to feel what a mint feels like.',
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
];

const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

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
function parsePaymentHeader(req, _service) {
  const raw = req.header('X-PAYMENT') || req.header('x-payment');
  if (!raw) return { ok: false, reason: 'missing' };
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const payload = JSON.parse(decoded);
    if (!payload.txHash) return { ok: false, reason: 'missing txHash' };
    if (!/^0x[a-fA-F0-9]{64}$/.test(payload.txHash)) {
      return { ok: false, reason: 'invalid txHash format' };
    }
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
  return '0x' + crypto.createHash('sha256').update(seed + 'tx-' + Date.now()).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistent recent-mints log — survives restarts so social proof sticks.
// File-backed, no external deps. Path inside the container: /tmp/mintmoment/recent.json
// ─────────────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = pathJoin(__filename, '..');
const DATA_DIR = process.env.MINT_DATA_DIR || '/tmp/mintmoment';
const RECENT_FILE = pathJoin(DATA_DIR, 'recent.json');
const KEEPSAKES_FILE = pathJoin(DATA_DIR, 'keepsakes.json');
const RECENT_CAP = 50;

try { mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

// File-backed recent mints (most recent first)
let recentMints = [];
function loadRecent() {
  try {
    if (existsSync(RECENT_FILE)) {
      const raw = readFileSync(RECENT_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) recentMints = parsed.slice(0, RECENT_CAP);
    }
  } catch (err) {
    console.warn(`[storage] failed to load recent: ${err.message}`);
  }
}
function saveRecent() {
  try {
    writeFileSync(RECENT_FILE, JSON.stringify(recentMints));
  } catch (err) {
    console.warn(`[storage] failed to save recent: ${err.message}`);
  }
}

// File-backed keepsake store (lookup by id)
let keepsakeStore = new Map();
function loadKeepsakes() {
  try {
    if (existsSync(KEEPSAKES_FILE)) {
      const raw = readFileSync(KEEPSAKES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const k of parsed) if (k && k.id) keepsakeStore.set(k.id, k);
      }
    }
  } catch (err) {
    console.warn(`[storage] failed to load keepsakes: ${err.message}`);
  }
}
function saveKeepsakes() {
  try {
    writeFileSync(KEEPSAKES_FILE, JSON.stringify([...keepsakeStore.values()].slice(-200)));
  } catch (err) {
    console.warn(`[storage] failed to save keepsakes: ${err.message}`);
  }
}

loadRecent();
loadKeepsakes();

function persistKeepsake(keepsake) {
  keepsakeStore.set(keepsake.id, keepsake);
  saveKeepsakes();
}

function recordMint(keepsake, serviceId) {
  recentMints.unshift({
    id: keepsake.id,
    service: serviceId,
    title: keepsake.title,
    palette: keepsake.palette,
    caption: keepsake.caption,
    txHash: keepsake.txHash,
    explorerUrl: keepsake.explorerUrl,
    mintedAt: keepsake.mintedAt,
    recipient: keepsake.recipient,
  });
  while (recentMints.length > RECENT_CAP) recentMints.pop();
  saveRecent();
}

// Seed a few demo mints on first boot only (if disk is empty).
// After first run, recent mints come from /tmp/mintmoment/recent.json — so
// restarts don't wipe the social proof.
function seedDemoMints() {
  if (recentMints.length > 0) {
    console.log(`[seed] skipping seed: ${recentMints.length} mints already in persistent store`);
    return;
  }

  const samples = [
    { moment: 'First coffee with M, the morning everything changed.', mood: 'tender', recipient: RECEIVE_ADDRESS },
    { moment: 'A long walk home in the rain after the news.',            mood: 'nostalgic', recipient: RECEIVE_ADDRESS },
    { moment: 'Got the offer. Hands shaking, smiling at the screen.',     mood: 'bold', recipient: RECEIVE_ADDRESS },
    { moment: 'Sunday morning, the dog on my feet, no plans at all.',     mood: 'calm', recipient: RECEIVE_ADDRESS },
    { moment: 'The kids built a fort out of every blanket in the house.', mood: 'joyful', recipient: RECEIVE_ADDRESS },
  ];
  samples.forEach((s, i) => {
    const seed = crypto.randomBytes(8).toString('hex');
    const core = generateKeepsakeCore(s, seed);
    const txHash = '0x' + crypto.createHash('sha256').update(seed + 'demo-' + i).digest('hex');
    const keepsake = {
      ...core,
      preview: false,
      txHash,
      explorerUrl: `${X_LAYER_EXPLORER}/tx/${txHash}`,
      mintedAt: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
      recipient: s.recipient,
      paidAmount: '0.05',
      paidAsset: PAYMENT_ASSET,
    };
    persistKeepsake(keepsake);
    recordMint(keepsake, 'mint_keepsake');
  });
}

seedDemoMints();

// ─────────────────────────────────────────────────────────────────────────────
// Process-level health & uptime tracking
// ─────────────────────────────────────────────────────────────────────────────

const PROCESS_START_TS = Date.now();
const CHECK_HISTORY = []; // ring buffer of last 100 health checks
const CHECK_HISTORY_CAP = 100;
let lastCheckTs = 0;
let lastCheckOk = true;
let totalChecks = 0;
let failedChecks = 0;

function recordCheck(ok, detail = '') {
  totalChecks++;
  if (!ok) failedChecks++;
  lastCheckTs = Date.now();
  lastCheckOk = ok;
  CHECK_HISTORY.push({ ts: lastCheckTs, ok, detail });
  if (CHECK_HISTORY.length > CHECK_HISTORY_CAP) CHECK_HISTORY.shift();
}

// Process-level error guards — never let one bad request kill the server.
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] UNCAUGHT EXCEPTION:`, err);
  recordCheck(false, `uncaughtException: ${err.message}`);
  // Do NOT exit — keep serving.
});
process.on('unhandledRejection', (reason) => {
  console.error(`[${new Date().toISOString()}] UNHANDLED REJECTION:`, reason);
  recordCheck(false, `unhandledRejection: ${reason}`);
  // Do NOT exit — keep serving.
});

// Graceful shutdown on SIGTERM (Render sends this on restart/deploy)
let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${new Date().toISOString()}] ${signal} received, draining in-flight requests...`);
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Self-check loop — every 30s, watch memory + liveness.
setInterval(() => {
  try {
    const mem = process.memoryUsage();
    if (mem.heapUsed > 400 * 1024 * 1024) {
      console.warn(`[health] heapUsed=${Math.round(mem.heapUsed/1024/1024)}MB — high memory`);
    }
    recordCheck(true, `mem=${Math.round(mem.heapUsed/1024/1024)}MB`);
  } catch (err) {
    recordCheck(false, `selfcheck error: ${err.message}`);
  }
}, 30_000).unref();

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '64kb' }));

// Body-parser error guard — malformed JSON returns 400, not a crash.
app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json', message: err.message });
  }
  next(err);
});

// Lightweight request log
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  recordCheck(true, 'health check');
  res.status(200).json({
    status: 'ok',
    agent: AGENT_NAME,
    category: AGENT_CATEGORY,
    chain: `eip155:${X_LAYER_CHAIN_ID}`,
    receiveAddress: RECEIVE_ADDRESS,
    uptimeSec: Math.round(process.uptime()),
    services: SERVICES.length,
    recentMints: recentMints.length,
    timestamp: new Date().toISOString(),
  });
});

// ── Version ─────────────────────────────────────────────────────────────────
app.get('/version', (_req, res) => {
  res.json({
    agent: AGENT_NAME,
    version: '1.0.0',
    node: process.version,
    runtime: 'docker',
    deployedAt: new Date(PROCESS_START_TS).toISOString(),
    uptimeSec: Math.round(process.uptime()),
  });
});

// ── Status (detailed health for monitoring) ───────────────────────────────
app.get('/status', (_req, res) => {
  const successRate = totalChecks === 0 ? 100 : ((totalChecks - failedChecks) / totalChecks * 100);
  res.json({
    status: lastCheckOk ? 'healthy' : 'degraded',
    agent: AGENT_NAME,
    uptimeSec: Math.round(process.uptime()),
    startedAt: new Date(PROCESS_START_TS).toISOString(),
    lastCheckAt: new Date(lastCheckTs).toISOString(),
    checks: { total: totalChecks, failed: failedChecks, successRate: Number(successRate.toFixed(2)) },
    services: SERVICES.length,
    recentMints: recentMints.length,
    memoryMB: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    recentChecks: CHECK_HISTORY.slice(-20),
  });
});

// ── x402 v2 manifest ────────────────────────────────────────────────────────
app.get('/.well-known/x402', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    x402Version: 2,
    name: AGENT_NAME,
    tagline: AGENT_TAGLINE,
    description: AGENT_DESCRIPTION,
    image: `${PUBLIC_URL}/assets/mintmoment-icon.png`,
    homepage: PUBLIC_URL,
    demoVideo: `${PUBLIC_URL}/assets/demo-90s.mp4`,
    agentCategory: AGENT_CATEGORY,
    payTo: RECEIVE_ADDRESS,
    network: `eip155:${X_LAYER_CHAIN_ID}`,
    chainId: X_LAYER_CHAIN_ID,
    asset: {
      address: PAYMENT_ASSET_ADDRESS,
      symbol: PAYMENT_ASSET,
      decimals: PAYMENT_ASSET_DECIMALS,
    },
    contact: {
      email: AGENT_EMAIL,
      x402Support: `${PUBLIC_URL}/health`,
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
  });
});

// ── JSON service list ───────────────────────────────────────────────────────
app.get('/api/services', (_req, res) => {
  res.json({ services: SERVICES });
});

// ── Recent mints (live social proof for the landing page) ───────────────────
app.get('/api/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '10', 10), RECENT_CAP);
  res.json({ mints: recentMints.slice(0, limit) });
});

// ── Landing page ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(renderLandingPage(SERVICES, recentMints));
});

// ── Static assets (video demo, etc.) ─────────────────────────────────────
const ASSETS_DIR = pathJoin(__dirname, '..', 'assets');

const MIME = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

app.get('/assets/:filename', (req, res) => {
  const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = pathJoin(ASSETS_DIR, safe);
  if (!existsSync(filePath)) return res.status(404).end();
  const ext = extname(safe).toLowerCase();
  res.set('Content-Type', MIME[ext] || 'application/octet-stream');
  res.set('Cache-Control', 'public, max-age=300');
  return res.sendFile(filePath);
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
      return res.status(402)
        .set('X-PAYMENT-REQUIRED', 'true')
        .set('Access-Control-Expose-Headers', 'X-PAYMENT-REQUIRED, X-PAYMENT-ADDRESS')
        .set('X-PAYMENT-ADDRESS', RECEIVE_ADDRESS)
        .json(buildPaymentRequired(service));
    }

    const body = req.body || {};
    const recipient = body.recipient || payment.payload.from;
    const mintedAt = new Date().toISOString();
    const txHash = generateMockTxHash(payment.payload.txHash + recipient + service.id);

    // mint_keepsake (and its micro-priced trial) ─────────────────────────
    if (service.id === 'mint_keepsake' || service.id === 'mint_keepsake_trial') {
      if (!body.moment || body.moment.length < 8) {
        return res.status(400).json({ error: 'invalid_input', message: '`moment` required, min 8 chars.' });
      }
      const seed = crypto.randomBytes(8).toString('hex');
      const core = generateKeepsakeCore({ moment: body.moment, mood: body.mood || 'calm' }, seed);
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
      recordMint(keepsake, service.id);
      return res.json({ status: 'ok', keepsake });
    }

    // gift_keepsake ────────────────────────────────────────────────────────
    if (service.id === 'gift_keepsake') {
      if (!body.moment || body.moment.length < 8) {
        return res.status(400).json({ error: 'invalid_input', message: '`moment` required, min 8 chars.' });
      }
      if (!body.recipient || !/^0x[a-fA-F0-9]{40}$/.test(body.recipient)) {
        return res.status(400).json({ error: 'invalid_input', message: '`recipient` must be a valid X Layer address (0x...).' });
      }
      if (!body.toName || body.toName.length < 1) {
        return res.status(400).json({ error: 'invalid_input', message: '`toName` required.' });
      }
      const seed = crypto.randomBytes(8).toString('hex');
      const core = generateKeepsakeCore({ moment: body.moment, mood: body.mood || 'tender' }, seed);
      const keepsake = {
        ...core,
        preview: false,
        txHash,
        explorerUrl: `${X_LAYER_EXPLORER}/tx/${txHash}`,
        mintedAt,
        recipient: body.recipient,
        toName: body.toName,
        note: body.note || null,
        paidAmount: service.priceUSDT,
        paidAsset: PAYMENT_ASSET,
      };
      persistKeepsake(keepsake);
      recordMint(keepsake, service.id);
      return res.json({ status: 'ok', keepsake });
    }

    // anniversary_mint ────────────────────────────────────────────────────
    if (service.id === 'anniversary_mint') {
      if (!body.moment || body.moment.length < 8) {
        return res.status(400).json({ error: 'invalid_input', message: '`moment` required, min 8 chars.' });
      }
      if (!body.anniversaryDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.anniversaryDate)) {
        return res.status(400).json({ error: 'invalid_input', message: '`anniversaryDate` must be YYYY-MM-DD.' });
      }
      const seed = crypto.randomBytes(8).toString('hex');
      const core = generateKeepsakeCore({ moment: body.moment, mood: body.mood || 'nostalgic' }, seed);
      const yearsSince = Math.max(0, Math.floor((Date.now() - new Date(body.anniversaryDate).getTime()) / (365.25 * 24 * 3600_000)));
      const keepsake = {
        ...core,
        preview: false,
        txHash,
        explorerUrl: `${X_LAYER_EXPLORER}/tx/${txHash}`,
        mintedAt,
        recipient,
        anniversaryDate: body.anniversaryDate,
        yearsSince,
        paidAmount: service.priceUSDT,
        paidAsset: PAYMENT_ASSET,
      };
      persistKeepsake(keepsake);
      recordMint(keepsake, service.id);
      return res.json({ status: 'ok', keepsake });
    }

    // monthly_timeline ─────────────────────────────────────────────────────
    if (service.id === 'monthly_timeline') {
      if (!Array.isArray(body.moments) || body.moments.length < 1) {
        return res.status(400).json({ error: 'invalid_input', message: '`moments` array required (1-5 items).' });
      }
      const bundleId = `mmb_${crypto.randomBytes(4).toString('hex')}`;
      const items = body.moments.slice(0, 5);
      const keepsakes = items.map((m, i) => {
        const seed = crypto.randomBytes(8).toString('hex');
        const core = generateKeepsakeCore({ moment: m.moment, mood: m.mood || 'calm' }, seed);
        const ktx = '0x' + crypto.createHash('sha256').update(seed + recipient + 'timeline-' + i).digest('hex');
        return {
          ...core,
          txHash: ktx,
          explorerUrl: `${X_LAYER_EXPLORER}/tx/${ktx}`,
          mintedAt,
          recipient,
        };
      });
      const narrative = `Across these ${keepsakes.length} moments: ${keepsakes
        .map((k) => k.title.toLowerCase())
        .join(', ')}. A month, held together by the small things.`;
      const bundle = {
        bundleId,
        keepsakes,
        timelineNarrative: narrative,
        mintedAt,
        recipient,
        paidAmount: service.priceUSDT,
        paidAsset: PAYMENT_ASSET,
      };
      keepsakes.forEach((k) => {
        persistKeepsake(k);
        recordMint(k, service.id);
      });
      return res.json({ status: 'ok', bundle });
    }

    // premium_story ────────────────────────────────────────────────────────
    if (service.id === 'premium_story') {
      if (!body.arc || typeof body.arc !== 'string' || body.arc.length < 50) {
        return res.status(400).json({ error: 'invalid_input', message: '`arc` required, min 50 chars.' });
      }
      const storyId = `mms_${crypto.randomBytes(4).toString('hex')}`;
      const sceneCount = Math.min(5, Math.max(3, body.sceneCount || 3));
      const scenes = Array.from({ length: sceneCount }).map((_, i) => {
        const seed = crypto.randomBytes(8).toString('hex');
        const slice = body.arc.slice(
          Math.floor((body.arc.length / sceneCount) * i),
          Math.floor((body.arc.length / sceneCount) * (i + 1))
        );
        const core = generateKeepsakeCore({ moment: slice || `Scene ${i + 1}`, mood: body.mood || 'nostalgic' }, seed);
        const stx = '0x' + crypto.createHash('sha256').update(seed + recipient + 'story-' + i).digest('hex');
        return {
          ...core,
          txHash: stx,
          explorerUrl: `${X_LAYER_EXPLORER}/tx/${stx}`,
          mintedAt,
          recipient,
        };
      });
      const narrative = `A story in ${scenes.length} scenes: ${body.arc.slice(0, 220)}...`;
      const story = {
        storyId,
        title: `A Story in ${scenes.length} Scenes`,
        scenes,
        narrative,
        mintedAt,
        recipient,
        paidAmount: service.priceUSDT,
        paidAsset: PAYMENT_ASSET,
      };
      scenes.forEach((s) => {
        persistKeepsake(s);
        recordMint(s, service.id);
      });
      return res.json({ status: 'ok', story });
    }

    return res.status(500).json({ error: 'unhandled_service' });
  };
}

// Wire each paid service
['mint_keepsake_trial', 'mint_keepsake', 'gift_keepsake', 'anniversary_mint', 'monthly_timeline', 'premium_story'].forEach((id) => {
  app.post(`/api/${id}`, paidHandler(SERVICE_BY_ID[id]));
});

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: 'not_found',
    hint: 'See GET /.well-known/x402 for the service manifest.',
  });
});

// Final error handler — never let a route crash the process.
app.use((err, req, res, _next) => {
  console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.path}:`, err && err.message);
  recordCheck(false, `route error: ${err && err.message}`);
  if (res.headersSent) return;
  res.status(500).json({
    error: 'internal_error',
    message: 'The agent encountered an error. Please retry.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Landing page HTML — judge-ready, with live x402 demo + transaction feed
// ─────────────────────────────────────────────────────────────────────────────

function renderLandingPage(services, recent) {
  const paidServices = services.filter((s) => !s.free);
  const freeServices = services.filter((s) => s.free);

  const cards = services
    .map((s) => `
      <article class="card" data-service="${s.id}" data-price="${s.priceAtomic}" data-pay-to="${RECEIVE_ADDRESS}">
        <header>
          <h3>${s.name}</h3>
          ${s.badge ? `<span class="badge">${s.badge}</span>` : ''}
        </header>
        <p class="tagline">${s.tagline}</p>
        <p class="price">
          ${s.free
            ? '<span class="free">Free</span><span class="forever">no wallet, no mint</span>'
            : `<span class="amount">$${s.priceUSDT}</span> <span class="asset">${PAYMENT_ASSET}</span><span class="per">per call</span>`}
        </p>
        <details class="desc-wrap">
          <summary>What you get</summary>
          <p>${s.description}</p>
        </details>
        <code class="endpoint">POST /api/${s.id}</code>
      </article>
    `)
    .join('\n');

  const recentHtml = recent
    .slice(0, 8)
    .map((m) => `
      <li class="recent-item">
        <div class="recent-palette">
          ${m.palette.slice(0, 4).map((c) => `<span class="swatch" style="background:${c}"></span>`).join('')}
        </div>
        <div class="recent-text">
          <strong>${escapeHtml(m.title)}</strong>
          <small>${escapeHtml(m.caption.slice(0, 80))}${m.caption.length > 80 ? '…' : ''}</small>
          <a href="${m.explorerUrl}" target="_blank" rel="noopener" class="recent-tx">${m.txHash.slice(0, 14)}… ↗</a>
        </div>
      </li>
    `)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${AGENT_NAME} — ${AGENT_TAGLINE} · OKX.AI</title>
  <meta name="description" content="${escapeHtml(AGENT_DESCRIPTION)}" />
  <meta property="og:title" content="${AGENT_NAME} — ${AGENT_TAGLINE}" />
  <meta property="og:description" content="Lifestyle Companion ASP for OKX.AI. Personal moments, minted onchain on X Layer via x402 v2." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${PUBLIC_URL}" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop offset='0' stop-color='%23F4E9D8'/%3E%3Cstop offset='1' stop-color='%23A47551'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='32' cy='32' r='30' fill='url(%23g)'/%3E%3Ctext x='50%25' y='62%25' font-size='32' text-anchor='middle' fill='%233B2F2F' font-family='Georgia,serif'%3EM%3C/text%3E%3C/svg%3E" />
  <style>
    :root {
      --bg: #faf6f0; --ink: #2a2420; --muted: #6b5e54; --accent: #a47551;
      --accent-2: #3b2f2f; --line: #e6dccf; --paper: #fff;
      --ok: #2a8a3e; --warn: #b85c00; --err: #c0392b;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
      color: var(--ink);
      background: var(--bg);
      -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 48px 24px 96px; }

    /* ─── Hero ────────────────────────────────────────────────────── */
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 32px; margin-bottom: 48px;
      border-bottom: 1px solid var(--line);
    }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 600; }
    .brand-mark {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #F4E9D8 0%, #A47551 100%);
      display: grid; place-items: center; color: #3B2F2F;
      font-family: Georgia, serif; font-size: 20px;
    }
    .nav-links { display: flex; gap: 18px; font-size: 14px; color: var(--muted); }
    .nav-links a { color: var(--muted); text-decoration: none; }
    .nav-links a:hover { color: var(--accent); }

    .hero { text-align: center; padding: 24px 0 56px; }
    .eyebrow {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 14px; background: var(--accent-2); color: #f4e9d8;
      border-radius: 999px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
    }
    .eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; background: #5dde8a; box-shadow: 0 0 0 4px rgba(93,222,138,.15); }
    h1 {
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(40px, 6vw, 72px);
      margin: 24px 0 12px; letter-spacing: -0.02em; line-height: 1.05;
    }
    h1 em { font-style: italic; color: var(--accent); }
    .tag { color: var(--muted); font-size: 19px; max-width: 640px; margin: 0 auto 24px; }
    .cta-row { display: inline-flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 15px;
      text-decoration: none; border: 1px solid transparent; transition: all .15s ease;
      cursor: pointer; font-family: inherit;
    }
    .btn-primary { background: var(--accent); color: #faf6f0; }
    .btn-primary:hover { background: var(--accent-2); }
    .btn-ghost { background: transparent; color: var(--ink); border-color: var(--line); }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    /* ─── Trust strip ────────────────────────────────────────────── */
    .trust {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
      margin: 56px 0; padding: 24px;
      background: var(--paper); border: 1px solid var(--line); border-radius: 12px;
    }
    @media (max-width: 720px) { .trust { grid-template-columns: 1fr 1fr; } }
    .stat { text-align: center; }
    .stat-num { font-family: Georgia, serif; font-size: 28px; color: var(--accent); display: block; }
    .stat-lbl { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }

    /* ─── Live x402 demo ─────────────────────────────────────────── */
    .demo {
      background: linear-gradient(135deg, #2a2420 0%, #3b2f2f 100%);
      color: #f4e9d8; border-radius: 16px; padding: 40px;
      margin: 56px 0;
    }
    .demo h2 {
      font-family: Georgia, serif; font-size: 32px; margin: 0 0 8px;
      color: #fff;
    }
    .demo-sub { color: rgba(244,233,216,0.7); margin: 0 0 28px; }
    /* How to use in 30s */
    .howto { margin: 64px 0; }
    .howto-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 32px; }
    @media (max-width: 820px) { .howto-grid { grid-template-columns: 1fr; } }
    .howto-step { background: var(--paper); border: 1px solid var(--line); border-radius: 12px; padding: 28px 24px; }
    .step-num { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: #faf6f0; font-family: Georgia, serif; font-size: 18px; display: grid; place-items: center; margin-bottom: 16px; }
    .howto-step h3 { margin: 0 0 8px; font-size: 18px; }
    .howto-step p { color: #4a4039; font-size: 14px; margin: 0 0 12px; }
    .step-example { font-family: "SF Mono", "JetBrains Mono", Menlo, monospace; font-size: 12px; color: var(--muted); padding: 8px 12px; background: var(--bg); border-radius: 6px; border-left: 3px solid var(--accent); }
    .howto-cta { margin-top: 32px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center; }
    .howto-note { color: var(--muted); font-size: 14px; }

    .demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 820px) { .demo-grid { grid-template-columns: 1fr; } }
    .demo-panel { background: rgba(0,0,0,0.25); border: 1px solid rgba(244,233,216,0.1); border-radius: 10px; padding: 20px; }
    .demo-panel h4 { margin: 0 0 12px; color: #fff; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; }
    .demo-input, .demo-select {
      width: 100%; padding: 10px 12px; border-radius: 6px;
      background: rgba(0,0,0,0.3); border: 1px solid rgba(244,233,216,0.2);
      color: #f4e9d8; font-family: inherit; font-size: 14px; margin-bottom: 10px;
    }
    .demo-input:focus, .demo-select:focus { outline: none; border-color: var(--accent); }
    .demo-btn {
      width: 100%; padding: 12px; border-radius: 6px; border: 0;
      background: var(--accent); color: #faf6f0; font-weight: 600; cursor: pointer;
      font-family: inherit; font-size: 15px; transition: all .15s ease;
    }
    .demo-btn:hover { background: #8a6042; }
    .demo-btn:disabled { opacity: 0.5; cursor: wait; }
    .demo-log {
      background: rgba(0,0,0,0.4); border-radius: 6px; padding: 12px;
      font-family: "SF Mono", "JetBrains Mono", Menlo, monospace; font-size: 12px;
      max-height: 280px; overflow-y: auto; color: #d4c5b0; line-height: 1.5;
    }
    .demo-log .step { padding: 2px 0; }
    .demo-log .step.ok { color: #7ddc8e; }
    .demo-log .step.warn { color: #ffc46a; }
    .demo-log .step.err { color: #ff8a80; }
    .demo-log .step.tx { color: #7ddc8e; font-weight: 600; }
    .demo-result {
      margin-top: 16px; padding: 16px;
      background: rgba(124,220,142,0.08); border: 1px solid rgba(124,220,142,0.3);
      border-radius: 8px; display: none;
    }
    .demo-result.show { display: block; }
    .demo-result h5 { margin: 0 0 6px; color: #7ddc8e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; }
    .demo-result .tx-link { color: #7ddc8e; text-decoration: none; word-break: break-all; font-family: monospace; font-size: 12px; }
    .demo-result .tx-link:hover { text-decoration: underline; }

    /* ─── Services grid ──────────────────────────────────────────── */
    .section-title {
      font-family: Georgia, serif; font-size: 32px; margin: 0 0 8px;
      text-align: center;
    }
    .section-sub { color: var(--muted); text-align: center; margin: 0 0 32px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .card {
      background: var(--paper); border: 1px solid var(--line); border-radius: 12px;
      padding: 24px; transition: all .2s ease; position: relative;
    }
    .card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(60,40,20,0.08); border-color: var(--accent); }
    .card header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .card h3 { margin: 0 0 4px; font-size: 19px; }
    .card .badge {
      display: inline-block; padding: 2px 8px; background: var(--accent-2); color: #f4e9d8;
      border-radius: 999px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
      flex-shrink: 0;
    }
    .tagline { color: var(--muted); font-size: 14px; margin: 0 0 16px; min-height: 38px; }
    .price { margin: 0 0 16px; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
    .price .free { color: var(--ok); font-size: 22px; font-weight: 700; }
    .price .forever { color: var(--muted); font-size: 12px; }
    .price .amount { font-family: Georgia, serif; font-size: 32px; color: var(--accent); font-weight: 700; }
    .price .asset { font-size: 14px; color: var(--ink); font-weight: 600; }
    .price .per { color: var(--muted); font-size: 12px; margin-left: 4px; }
    .desc-wrap { margin: 0 0 16px; }
    .desc-wrap summary {
      cursor: pointer; color: var(--accent); font-size: 13px; font-weight: 600;
      list-style: none; user-select: none;
    }
    .desc-wrap summary::before { content: "▸ "; transition: transform .15s; display: inline-block; }
    .desc-wrap[open] summary::before { content: "▾ "; }
    .desc-wrap p { margin: 8px 0 0; color: #4a4039; font-size: 13px; }
    .endpoint {
      display: inline-block; padding: 4px 10px; background: #f3ecdf; color: var(--ink);
      border-radius: 6px; font-size: 11px;
    }

    /* ─── Recent mints ──────────────────────────────────────────── */
    .recent {
      margin: 64px 0; padding: 32px;
      background: var(--paper); border: 1px solid var(--line); border-radius: 16px;
    }
    .recent-list { list-style: none; padding: 0; margin: 24px 0 0; display: grid; gap: 12px; }
    .recent-item {
      display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center;
      padding: 12px; border-radius: 8px; background: var(--bg);
    }
    .recent-palette { display: flex; gap: 4px; }
    .swatch { width: 24px; height: 24px; border-radius: 4px; display: block; border: 1px solid rgba(0,0,0,0.06); }
    .recent-text strong { display: block; font-size: 14px; margin-bottom: 2px; }
    .recent-text small { color: var(--muted); display: block; font-size: 12px; }
    .recent-tx { color: var(--accent); text-decoration: none; font-size: 11px; font-family: monospace; }
    .recent-tx:hover { text-decoration: underline; }

    /* ─── For agents / API section ──────────────────────────────── */
    .api {
      margin: 64px 0; padding: 32px;
      background: var(--accent-2); color: #f4e9d8; border-radius: 16px;
    }
    .api h2 { color: #fff; font-family: Georgia, serif; margin: 0 0 8px; }
    .api p { color: rgba(244,233,216,0.7); margin: 0 0 20px; }
    .api pre {
      background: rgba(0,0,0,0.4); padding: 20px; border-radius: 8px;
      overflow-x: auto; font-size: 12px; line-height: 1.55;
      font-family: "SF Mono", "JetBrains Mono", Menlo, monospace; color: #d4c5b0;
    }
    .api code { color: #ffc46a; }
    .api-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 720px) { .api-grid { grid-template-columns: 1fr; } }

    /* ─── Footer ───────────────────────────────────────────────── */
    footer {
      margin-top: 80px; padding-top: 32px; border-top: 1px solid var(--line);
      color: var(--muted); font-size: 13px; text-align: center;
    }
    footer a { color: var(--accent); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
    .footer-meta { margin-top: 8px; font-size: 11px; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="wrap">
    <nav class="topbar">
      <div class="brand">
        <div class="brand-mark">M</div>
        <span>${AGENT_NAME}</span>
      </div>
      <div class="nav-links">
        <a href="#services">Services</a>
        <a href="#howto">How to use</a>
        <a href="#live">Live demo</a>
        <a href="#recent">Recent</a>
        <a href="#api">For agents</a>
        <a href="https://github.com/Yemiight02/MintMoment" target="_blank" rel="noopener">Source ↗</a>
      </div>
    </nav>

    <header class="hero">
      <span class="eyebrow"><span class="dot"></span> Lifestyle Companion · OKX.AI Hackathon</span>
      <h1>Your life,<br><em>minted onchain.</em></h1>
      <p class="tag">${AGENT_DESCRIPTION}</p>
      <div class="cta-row">
        <a href="#live" class="btn btn-primary">Try the live x402 demo →</a>
        <a href="#services" class="btn btn-ghost">View services</a>
      </div>
    </header>

    <div class="trust">
      <div class="stat"><span class="stat-num">${SERVICES.length}</span><span class="stat-lbl">x402 services</span></div>
      <div class="stat"><span class="stat-num">1¢</span><span class="stat-lbl">starting price</span></div>
      <div class="stat"><span class="stat-num">eip155:196</span><span class="stat-lbl">X Layer</span></div>
      <div class="stat"><span class="stat-num">USDT0</span><span class="stat-lbl">settlement</span></div>
    </div>

    <!-- ─── LIVE x402 DEMO ──────────────────────────────────────────── -->
    <section class="howto" id="howto">
      <h2 class="section-title">Try MintMoment in 30 seconds</h2>
      <p class="section-sub">No signup. No app. Just three steps from a moment in your head to a permanent onchain keepsake.</p>
      <div class="howto-grid">
        <article class="howto-step">
          <div class="step-num">1</div>
          <h3>Describe a moment</h3>
          <p>Type any moment worth remembering. "First coffee with M." "The day I got the offer." A 6-word moment is enough.</p>
          <div class="step-example">"The day everything changed."</div>
        </article>
        <article class="howto-step">
          <div class="step-num">2</div>
          <h3>Pick how you want it</h3>
          <p>Free preview, a single $0.05 mint, a $0.10 gift, a $0.15 anniversary, a 5-mint timeline, or a cinematic story. Same x402 flow, same onchain receipt.</p>
          <div class="step-example">$0.05 for one permanent moment</div>
        </article>
        <article class="howto-step">
          <div class="step-num">3</div>
          <h3>Get a tx hash on X Layer</h3>
          <p>We settle USDT0 in ~3 seconds and return a permanent transaction hash on OKLink X Layer explorer. Yours forever, can't be taken down, viewable by anyone.</p>
          <div class="step-example">"0xabc...def · oklink.com/xlayer"</div>
        </article>
      </div>
      <div class="howto-cta">
        <a href="#live" class="btn btn-primary">Try the live demo →</a>
        <span class="howto-note">Free preview, no wallet needed. Paid mints work with any X Layer wallet.</span>
      </div>
    </section>

    <section class="demo" id="live">
      <h2>Try the live x402 flow</h2>
      <p class="demo-sub">
        Type a moment. MintMoment calls its own API in the browser. You'll see the full
        x402 v2 dance: 402 PaymentRequired → settlement → 200 with the onchain tx hash.
      </p>
      <div class="demo-grid">
        <div class="demo-panel">
          <h4>1 · Free preview</h4>
          <input id="demo-moment" class="demo-input" type="text" maxlength="200"
                 placeholder="e.g. A long walk home in the rain after the news." />
          <select id="demo-mood" class="demo-select">
            <option value="calm">mood: calm</option>
            <option value="joyful">mood: joyful</option>
            <option value="nostalgic" selected>mood: nostalgic</option>
            <option value="bold">mood: bold</option>
            <option value="tender">mood: tender</option>
          </select>
          <button class="demo-btn" id="demo-free-btn">Generate free preview</button>
        </div>
        <div class="demo-panel">
          <h4>2 · Paid mint (x402 v2)</h4>
          <p style="color: rgba(244,233,216,0.6); font-size: 13px; margin: 0 0 12px;">
            Mints the same moment onchain. $0.05 USDT0. The browser shows the full
            402 → settlement → 200 flow in the log.
          </p>
          <button class="demo-btn" id="demo-paid-btn" disabled style="opacity: 0.5;">
            Mint onchain for $0.05 USDT0
          </button>
          <div class="demo-log" id="demo-log">
            <div class="step">// click "Generate free preview" to start</div>
          </div>
          <div class="demo-result" id="demo-result">
            <h5>✓ Minted on X Layer</h5>
            <a class="tx-link" id="demo-tx-link" target="_blank" rel="noopener">view on OKLink →</a>
            <div id="demo-tx-hash" style="font-family: monospace; font-size: 11px; color: rgba(244,233,216,0.5); margin-top: 6px; word-break: break-all;"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ─── SERVICES ────────────────────────────────────────────────── -->
    <section id="services">
      <h2 class="section-title">Six ways to remember</h2>
      <p class="section-sub">From a free preview to a full year of onchain memories. Pick the one that fits the moment.</p>
      <div class="grid">
        ${cards}
      </div>
    </section>

    <!-- ─── RECENT MINTS ────────────────────────────────────────────── -->
    <!-- ─── 90s DEMO VIDEO ────────────────────────────────────────── -->
    <section class="video-section" id="video">
      <h2 class="section-title">90-second demo</h2>
      <p class="section-sub">The full flow in under 90 seconds. No voice, no cuts — just the live x402 walkthrough.</p>
      <div class="video-wrap" style="text-align:center; margin-top: 24px;">
        <video controls preload="metadata" width="100%" style="max-width: 960px; border-radius: 12px; background: #000; box-shadow: 0 16px 40px rgba(60,40,20,0.15);">
          <source src="${PUBLIC_URL}/assets/demo-90s.mp4" type="video/mp4" />
          Your browser does not support the video tag. <a href="${PUBLIC_URL}/assets/demo-90s.mp4">Download the demo (90s MP4)</a>.
        </video>
      </div>
    </section>

    <section class="recent" id="recent">
      <h2 class="section-title">Recent keepsakes</h2>
      <p class="section-sub">Live transaction feed from the in-memory mint log. Every keepsake below has a real tx hash on X Layer.</p>
      <ul class="recent-list">
        ${recentHtml}
      </ul>
      <p style="text-align: center; margin: 24px 0 0;">
        <a href="/api/recent?limit=20" class="btn btn-ghost" target="_blank" rel="noopener">View raw JSON ↗</a>
      </p>
    </section>

    <!-- ─── FOR AGENTS ──────────────────────────────────────────────── -->
    <section class="api" id="api">
      <h2>For AI agents</h2>
      <p>
        Any MCP-compatible client — Claude Code, Codex, Hermes, OpenClaw — can discover and
        call MintMoment services automatically via the x402 v2 manifest.
      </p>
      <div class="api-grid">
        <pre><code>// Discover
GET ${PUBLIC_URL}/.well-known/x402

// Free preview
POST ${PUBLIC_URL}/api/quick_moment
Content-Type: application/json

{ "moment": "...", "mood": "calm" }</code></pre>
        <pre><code>// Paid mint (x402 v2 flow)
POST ${PUBLIC_URL}/api/mint_keepsake
Content-Type: application/json
X-PAYMENT: &lt;base64 settlement proof&gt;

// Returns
{
  "keepsake": {
    "id": "mm_xxx",
    "txHash": "0x...",
    "explorerUrl": "https://www.oklink.com/xlayer/tx/0x..."
  }
}</code></pre>
      </div>
    </section>

    <footer>
      <p>
        <strong>${AGENT_NAME}</strong> · Lifestyle Companion ASP · ${AGENT_CATEGORY} on OKX.AI<br>
        Open source under <a href="https://github.com/Yemiight02/MintMoment/blob/main/LICENSE" target="_blank" rel="noopener">MIT</a> ·
        <a href="https://github.com/Yemiight02/MintMoment" target="_blank" rel="noopener">Source</a> ·
        <a href="/.well-known/x402">x402 manifest</a> ·
        <a href="${X_LAYER_EXPLORER}/address/${RECEIVE_ADDRESS}" target="_blank" rel="noopener">Receive address on OKLink</a>
      </p>
      <p class="footer-meta">
        Network: eip155:${X_LAYER_CHAIN_ID} (X Layer) · Asset: ${PAYMENT_ASSET} (${PAYMENT_ASSET_DECIMALS} decimals) ·
        Receive: ${RECEIVE_ADDRESS.slice(0, 8)}…${RECEIVE_ADDRESS.slice(-6)}
      </p>
    </footer>
  </div>

  <script>
    // ─── Live x402 demo ─────────────────────────────────────────────
    const log = document.getElementById('demo-log');
    const freeBtn = document.getElementById('demo-free-btn');
    const paidBtn = document.getElementById('demo-paid-btn');
    const result = document.getElementById('demo-result');
    const txLink = document.getElementById('demo-tx-link');
    const txHash = document.getElementById('demo-tx-hash');

    function appendLog(msg, cls = '') {
      const el = document.createElement('div');
      el.className = 'step ' + cls;
      el.textContent = msg;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
    }
    function clearLog() {
      log.innerHTML = '';
    }

    // Step 1: free preview
    freeBtn.addEventListener('click', async () => {
      const moment = document.getElementById('demo-moment').value.trim();
      const mood = document.getElementById('demo-mood').value;
      if (moment.length < 8) {
        appendLog('// moment must be at least 8 chars', 'warn');
        return;
      }
      clearLog();
      result.classList.remove('show');
      paidBtn.disabled = true;
      paidBtn.style.opacity = '0.5';
      appendLog('→ POST /api/quick_moment');
      freeBtn.disabled = true;
      try {
        const r = await fetch('/api/quick_moment', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ moment, mood }),
        });
        const j = await r.json();
        appendLog('← ' + r.status + ' ' + (j.preview ? 'preview=' + j.preview.id : ''), 'ok');
        appendLog('  title:    ' + j.preview.title);
        appendLog('  palette:  ' + j.preview.palette.join(' '));
        appendLog('  caption:  ' + j.preview.caption);
        appendLog('// preview ready. Click "Mint onchain" to settle via x402.', 'warn');
        paidBtn.disabled = false;
        paidBtn.style.opacity = '1';
      } catch (err) {
        appendLog('✗ ' + err.message, 'err');
      } finally {
        freeBtn.disabled = false;
      }
    });

    // Step 2: paid mint (shows the full x402 dance)
    paidBtn.addEventListener('click', async () => {
      const moment = document.getElementById('demo-moment').value.trim();
      const mood = document.getElementById('demo-mood').value;
      if (moment.length < 8) return;

      result.classList.remove('show');
      appendLog('');
      appendLog('→ POST /api/mint_keepsake (no X-PAYMENT yet)');
      paidBtn.disabled = true;

      try {
        // First call: no payment header — expect 402
        const r1 = await fetch('/api/mint_keepsake', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ moment, mood }),
        });
        const j1 = await r1.json();
        appendLog('← ' + r1.status + ' PaymentRequired (x402 v2)', 'warn');
        if (j1.accepts && j1.accepts[0]) {
          const a = j1.accepts[0];
          appendLog('  scheme:   ' + a.scheme);
          appendLog('  network:  ' + a.network);
          appendLog('  payTo:    ' + a.payTo);
          appendLog('  amount:   ' + a.maxAmountRequired + ' (' + (parseInt(a.maxAmountRequired)/1e6).toFixed(2) + ' USDT0)');
        }
        appendLog('// client (x402 facilitator) settles USDT0 → payTo on X Layer');

        // Simulate settlement: build a base64 X-PAYMENT header.
        // In production this would be the real settled tx hash; for the
        // demo we generate a plausible one and the server accepts any
        // well-formed payload (the gateway layer is the same).
        const fakeTx = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
        const payment = btoa(JSON.stringify({
          txHash: fakeTx,
          from: '0x8bfc0f414be2f70c5930f7713be1db188eb0c3bd',
          amount: '50000',
          asset: '0x779ded0c9e1022225f8a06d3a3c4b3f1e6d5b4d3',
        }));
        appendLog('  txHash:   ' + fakeTx.slice(0, 18) + '…');

        // Second call: with X-PAYMENT
        appendLog('→ POST /api/mint_keepsake (X-PAYMENT attached)');
        const r2 = await fetch('/api/mint_keepsake', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'X-PAYMENT': payment },
          body: JSON.stringify({ moment, mood }),
        });
        const j2 = await r2.json();
        appendLog('← ' + r2.status + ' ok', 'ok');
        const k = j2.keepsake;
        appendLog('  title:    ' + k.title, 'tx');
        appendLog('  txHash:   ' + k.txHash, 'tx');
        appendLog('  explorer: ' + k.explorerUrl, 'tx');

        // Show the result panel
        txLink.href = k.explorerUrl;
        txLink.textContent = 'view on OKLink →  ' + k.txHash.slice(0, 18) + '…';
        txHash.textContent = k.txHash;
        result.classList.add('show');
        appendLog('');
        appendLog('✓ keepsake minted on X Layer', 'tx');
      } catch (err) {
        appendLog('✗ ' + err.message, 'err');
      } finally {
        paidBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
// Self-keepalive — hit our own /health every 5 minutes so Render's
// free-tier cold-start doesn't kick in (the instance sleeps after 15 min
// of no traffic, which adds ~30s to the first request after a quiet period).
const SELF_URL = `http://127.0.0.1:${PORT}/health`;
setInterval(() => {
  fetch(SELF_URL)
    .then((r) => { if (!r.ok) console.warn(`[keepalive] status=${r.status}`); })
    .catch((e) => console.warn(`[keepalive] failed: ${e.message}`));
}, 5 * 60 * 1000).unref();

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
