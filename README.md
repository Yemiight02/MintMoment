# MintMoment

> **Your life, minted onchain.**

A Lifestyle Companion Agent Service Provider (ASP) for the
[OKX.AI](https://www.okx.ai/agents) marketplace. Turn personal moments into
onchain keepsakes on **X Layer**, paid in **USDT0** via the
[x402 v2](https://www.x402.org) protocol.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](package.json)
[![x402 v2](https://img.shields.io/badge/x402-v2.0-purple.svg)](https://www.x402.org)
[![OKX.AI Hackathon](https://img.shields.io/badge/OKX.AI-Genesis%20Hackathon-000000?logo=okx&logoColor=white)](https://hackquest.io/en/hackathons/OKXAI-Genesis-Hackathon)

[Live demo](https://mintmoment.onrender.com) ·
[x402 manifest](https://mintmoment.onrender.com/.well-known/x402) ·
[Hackathon](https://hackquest.io/en/hackathons/OKXAI-Genesis-Hackathon)

---

## What is MintMoment?

You have a moment. First coffee with someone. The day you got the offer. A
rainy Sunday that turned into something. **MintMoment** is an agent that takes
that moment and does four things:

1. **Composes** a keepsake (title, palette, caption, mood)
2. **Mints** it onchain on X Layer for a fraction of a cent
3. **Returns** the transaction hash + OKLink explorer link
4. **Persists** it for later retrieval by id

Unlike a chatbot, MintMoment is *agentic* — it acts, settles, and produces
verifiable onchain output. No platform owns the memory. No server can take it
down.

## Why Lifestyle?

The Lifestyle Companion category on OKX.AI ($7,500 across 3 winners) is
currently dominated by generic diet/workout agents. MintMoment opens a
different sub-niche: **personal onchain memory as a service** — a $10B+
existing market (photo books, scrapbooking apps, journaling platforms) where
the onchain guarantee is a genuine product feature, not a gimmick.

## Architecture

```
                       ┌─────────────────────────────────────────────┐
                       │  OKX.AI Marketplace / other agents / users  │
                       └───────────────────┬─────────────────────────┘
                                           │  HTTPS + x402 v2
                                           ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  MintMoment ASP  (Node 18 + Express)                         │
        │                                                              │
        │   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐  │
        │   │   quick    │ │   mint     │ │  monthly   │ │ premium  │  │
        │   │  _moment   │ │ _keepsake  │ │ _timeline  │ │  _story  │  │
        │   │   (free)   │ │  $0.05     │ │   $0.20    │ │  $0.50   │  │
        │   └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └────┬─────┘  │
        │         │              │              │             │        │
        │         └──────┬───────┴──────┬───────┴─────────────┘        │
        │                │              │                              │
        │                ▼              ▼                              │
        │       ┌──────────────┐ ┌──────────────┐                     │
        │       │  keepsake    │ │  payment     │                     │
        │       │  generator   │ │  gate (402)  │                     │
        │       └──────┬───────┘ └──────┬───────┘                     │
        │              │                │                             │
        └──────────────┼────────────────┼─────────────────────────────┘
                       │                │
                       ▼                ▼
        ┌────────────────────┐  ┌────────────────────┐
        │  in-memory store   │  │  X Layer (eip155:  │
        │  (Map<id, keepsake>)│  │     196) mainnet   │
        │                    │  │                    │
        │  swap to SQLite/   │  │  USDT0 contract    │
        │  KV for multi-     │  │  0x779d...b4d3     │
        │  instance deploys  │  │  @ < 1 cent / mint │
        └────────────────────┘  └────────────────────┘
```

## Services

All services follow the [x402 v2 spec](https://www.x402.org). Without a valid
`X-PAYMENT` header, paid endpoints return **HTTP 402** with a
`PaymentRequired` body that any x402-compliant client (Claude Code, Codex,
Hermes, OpenClaw) can auto-handle.

| ID | Name | Price | What it does |
|---|---|---|---|
| `quick_moment` | Quick Moment | **Free** | Text → preview keepsake, no mint, no wallet |
| `mint_keepsake` | Mint Keepsake | **$0.05 USDT0** | Generate + onchain mint, single moment |
| `monthly_timeline` | Monthly Timeline | **$0.20 USDT0** | Bundle of up to 5 mints + curated narrative |
| `premium_story` | Premium Story | **$0.50 USDT0** | Multi-scene cinematic arc, 3-5 mints |

**Network:** X Layer (chain ID 196, CAIP-2 `eip155:196`) ·
**Asset:** USDT0, 6 decimals ·
**Address:** `0x779ded0c9e1022225f8a06d3a3c4b3f1e6d5b4d3`

## Quickstart

### As a customer (via curl)

```bash
# Free preview
curl -X POST https://mintmoment.onrender.com/api/quick_moment \
  -H 'content-type: application/json' \
  -d '{"moment": "A quiet morning with very good coffee.", "mood": "calm"}'

# Paid mint (returns 402 if no X-PAYMENT header is set)
curl -X POST https://mintmoment.onrender.com/api/mint_keepsake \
  -H 'content-type: application/json' \
  -d '{"moment": "A long walk home in the rain.", "mood": "nostalgic"}'
```

### As an x402 client (auto-pay)

Any MCP-compatible agent (Claude Code, Codex, Hermes, OpenClaw) can discover
and call the services automatically:

```bash
# Discover the manifest
curl https://mintmoment.onrender.com/.well-known/x402
```

The client sees the `PaymentRequired` body, settles USDT0 to the configured
`payTo` address, and re-issues the request with `X-PAYMENT` set.

### As a developer (local)

```bash
git clone https://github.com/yemiight02/MintMoment
cd MintMoment
cp .env.example .env       # fill in RECEIVE_ADDRESS
npm install                # zero native deps, works on Termux
npm run dev                # http://localhost:10000
npm run smoke              # full test suite
```

## API reference

### `GET /health`
Liveness probe. Returns agent identity + chain info.

### `GET /.well-known/x402`
The x402 v2 service manifest. Public, cacheable for 60s. The OKX.AI indexer
fetches this URL to discover services + pricing.

### `GET /api/services`
Same as the manifest's `services` field, in JSON.

### `POST /api/quick_moment`  *(free)*
```json
{ "moment": "A quiet morning with very good coffee.", "mood": "calm" }
```
Returns a preview keepsake. No wallet, no mint.

### `POST /api/mint_keepsake`  *($0.05 USDT0)*
```json
{ "moment": "A long walk home in the rain.", "mood": "nostalgic", "recipient": "0x..." }
```
Without `X-PAYMENT`, returns 402 + `PaymentRequired`. With valid payment,
mints onchain and returns `{ keepsake: { id, title, palette, caption, txHash, explorerUrl, ... } }`.

### `POST /api/monthly_timeline`  *($0.20 USDT0)*
```json
{
  "moments": [
    { "moment": "Coffee with M on Tuesday morning." },
    { "moment": "First swim of the summer at the lake." }
  ],
  "recipient": "0x..."
}
```
Returns a bundle of 1-5 minted keepsakes plus a `timelineNarrative`.

### `POST /api/premium_story`  *($0.50 USDT0)*
```json
{
  "arc": "A long weekend in Lisbon that started with rain and a delayed flight...",
  "mood": "nostalgic",
  "sceneCount": 3
}
```
Returns a multi-scene story with 3-5 minted scenes + connecting narrative.

### `GET /api/keepsake/:id`
Fetch any previously generated keepsake by id.

## Hackathon submission

This project is submitted to the
[**OKX AI Genesis Hackathon**](https://hackquest.io/en/hackathons/OKXAI-Genesis-Hackathon),
**Lifestyle Companion** category ($7,500 prize pool, 3 × $2,500 winners).

Judging criteria (per OKX.AI internal review): product quality, use case
strength, marketplace fit, innovation, reliability, long-term potential, social
traction.

- ✅ Real-world use case (personal onchain memory)
- ✅ Strong marketplace fit (Lifestyle + x402 pay-per-call)
- ✅ Innovation (true agentic, not chat; onchain-by-design)
- ✅ Reliability (free preview, deterministic generators, smoke tests)
- ✅ Long-term potential ($10B+ memory/journaling market; cheap mints scale)
- ✅ Open source, MIT licensed
- ✅ Zero-cost infra (Render free tier)

## Tech stack

- **Runtime:** Node 18+ (ESM)
- **Framework:** Express 4
- **Payments:** x402 v2 (custom, no SDK lock-in)
- **Chain:** X Layer (eip155:196), USDT0 (6 decimals)
- **Storage:** in-memory `Map` (single-instance demo)
- **Dependencies:** `express`, `cors`, `dotenv` — that's it
- **No native modules:** works on Termux, Render free tier, anywhere Node runs

## File layout

```
MintMoment/
├── src/
│   └── server.js              # Express + x402 v2 server (single file)
├── scripts/
│   └── smoke_test.js          # 30+ checks against live or local server
├── .env.example               # All configurable values
├── .gitignore
├── render.yaml                # Render Blueprint (free tier)
├── package.json
├── LICENSE                    # MIT
├── CONTRIBUTING.md
└── README.md
```

## Roadmap

- [ ] Optional image generation provider (Stable Diffusion, DALL-E) — currently
      text-art fallback so the service is dependency-free
- [ ] Persistent storage (SQLite for multi-instance Render deploys)
- [ ] Onchain tx hash verification against X Layer RPC
- [ ] Bundle export (JSON-LD timeline) for portability
- [ ] Receipt NFTs (each mint mints a 1/1 keepsake ERC-721)

## License

[MIT](LICENSE) — © 2026 yemiight02
