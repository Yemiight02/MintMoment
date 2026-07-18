# MintMoment — Hackathon Submission Prep

This is a copy-paste ready package for the OKX AI Genesis Hackathon Google form
and the X post.

## Live URLs

- **Landing page (judge-facing):** https://mintmoment.onrender.com
- **x402 manifest:** https://mintmoment.onrender.com/.well-known/x402
- **Health:** https://mintmoment.onrender.com/health
- **GitHub repo:** https://github.com/Yemiight02/MintMoment
- **OKX.AI marketplace:** https://www.okx.ai/agents (search "mintmoment" or browse Lifestyle)
- **OKX.AI agent page (direct):** https://www.okx.ai/agent/6607 *(once approved)*
- **Receive address (X Layer):** `0x1d238d991786b57d0cf61b854b476489320d86de`
- **Network:** X Layer (eip155:196)
- **Asset:** USDT0 (6 decimals, contract `0x779ded0c9e1022225f8a06d3a3c4b3f1e6d5b4d3`)

## Marketplace Listing

| Field | Value |
|---|---|
| **Agent ID** | `6607` |
| **Name** | `MintMoment` |
| **Role** | `ASP` |
| **Chain** | X Layer (chain 196) |
| **Status** | Listing under review (approvalStatus=2) |
| **Tx hash (create)** | `0xc5878a3572b540e772fe37ee45659cd3ffc0b94801107eb21b065d9e83e23dfc` |
| **Avatar CDN** | https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/0fbc54ed-089d-4346-b9ce-773f5a6b85ca.png |
| **Review notification** | `fijinfolu@gmail.com` (24h–2 business days) |

## Services (6 total)

| # | Service | Type | Fee | Endpoint |
|---|---|---|---|---|
| 1 | Quick Moment | A2MCP | 0 USDT | https://mintmoment.onrender.com/api/quick_moment |
| 2 | Mint Keepsake | A2MCP | 0.05 USDT | https://mintmoment.onrender.com/api/mint_keepsake |
| 3 | Gift Keepsake | A2MCP | 0.10 USDT | https://mintmoment.onrender.com/api/gift_keepsake |
| 4 | Anniversary Mint | A2MCP | 0.15 USDT | https://mintmoment.onrender.com/api/anniversary_mint |
| 5 | Monthly Timeline | A2MCP | 0.20 USDT | https://mintmoment.onrender.com/api/monthly_timeline |
| 6 | Premium Story | A2MCP | 0.50 USDT | https://mintmoment.onrender.com/api/premium_story |

## Google Form Answers

When you open the form (https://forms.gle/mddEUagmDbyV37ws8), use these:

| Field | Value |
|---|---|
| ASP Name | `MintMoment` |
| Agent ID | `6607` |
| ASP Type | `A2MCP` |
| Live URL | `https://mintmoment.onrender.com` |
| Source / Repo URL | `https://github.com/Yemiight02/MintMoment` |
| x402 manifest | `https://mintmoment.onrender.com/.well-known/x402` |
| Wallet address (receive) | `0x1d238d991786b57d0cf61b854b476489320d86de` |
| Network | `X Layer (eip155:196)` |
| Asset | `USDT0 (6 decimals)` |
| Description | *see below* |
| Demo X post URL | *(paste after posting on X)* |

### Description (long, for the form)

> MintMoment is a Lifestyle Companion ASP for the OKX.AI marketplace that
> turns personal moments into onchain keepsakes on X Layer, paid in USDT0
> via the x402 v2 protocol. Six services, ranging from a free preview
> (Quick Moment, no wallet needed) to a multi-scene cinematic narrative
> (Premium Story, 3–5 minted scenes).
>
> Unlike a chatbot, MintMoment is *agentic*: it composes a keepsake (title,
> palette, caption, mood), mints it on X Layer for a fraction of a cent in
> USDT0, and returns a permanent transaction hash + OKLink explorer link.
> No platform owns the memory. No server can take it down.
>
> Services: Quick Moment (free), Mint Keepsake ($0.05), Gift Keepsake
> ($0.10), Anniversary Mint ($0.15), Monthly Timeline ($0.20), Premium
> Story ($0.50). Built on Node 18 + Express, zero native dependencies,
> fully open source under MIT. The x402 v2 spec is implemented natively:
> every paid endpoint returns HTTP 402 with a PaymentRequired body that
> Claude Code, Codex, Hermes, or OpenClaw can auto-handle.

## X Post Template (≤90s demo + #OKXAI)

### Option 1 — Single tweet (most concise, easy to do)
```
🧵 Meet MintMoment — a Lifestyle Companion ASP on @okx AI marketplace.

Type a moment. Mint it onchain on X Layer. Pay in USDT0 via x402 v2. 
Get back a permanent transaction hash on @oklink explorer.

6 services:
🆓 Quick Moment — text → preview, no mint, no wallet
🪙 Mint Keepsake — $0.05 — single onchain moment
🎁 Gift Keepsake — $0.10 — mint to a recipient
📅 Anniversary Mint — $0.15 — date-stamped milestones
📅 Monthly Timeline — $0.20 — 5 mints + curated narrative
🎬 Premium Story — $0.50 — multi-scene cinematic

Live: https://mintmoment.onrender.com
x402 manifest: https://mintmoment.onrender.com/.well-known/x402
Source: https://github.com/Yemiight02/MintMoment

Built for the @OKX AI Genesis Hackathon. Lifestyle Companion category.

#OKXAI
```

### Option 2 — 5-tweet thread (more demo + context)
```
🧵 1/5

We just shipped MintMoment — a Lifestyle Companion ASP on @okx AI marketplace.

Type a moment. Mint it onchain on X Layer. Pay in USDT0 via x402 v2. 
Get back a permanent transaction hash on @oklink explorer.

Your life, minted onchain. 🟢

#OKXAI

🧵 2/5

How it works:

1. POST a moment to /api/quick_moment (FREE) → get a preview keepsake
2. POST a moment to /api/mint_keepsake ($0.05) with X-PAYMENT → 402
   PaymentRequired
3. x402 facilitator settles USDT0 → server re-runs → 200 with txHash

Open standards. No platform lock-in. No server can take it down.

#OKXAI

🧵 3/5

Six services for the lifestyle category:

🆓 Quick Moment — text → preview, no mint, no wallet
🪙 Mint Keepsake — $0.05 — single onchain moment
🎁 Gift Keepsake — $0.10 — mint to a recipient
📅 Anniversary Mint — $0.15 — date-stamped milestones
📅 Monthly Timeline — $0.20 — 5 mints + curated narrative
🎬 Premium Story — $0.50 — multi-scene cinematic

All payable in USDT0. All on X Layer. All yours forever.

#OKXAI

🧵 4/5

Built for agents, too. MCP-compatible clients (Claude Code, Codex,
Hermes, OpenClaw) can discover the manifest at:

→ https://mintmoment.onrender.com/.well-known/x402

…and call any service automatically via the x402 v2 flow.

Zero native deps. Termux-safe. Render free tier. Open source MIT.

#OKXAI

🧵 5/5

Try the live demo at → https://mintmoment.onrender.com

The landing page has a built-in x402 demo that runs the full 402 →
payment → 200 dance in your browser. No signup, no install.

Built for the @OKX AI Genesis Hackathon. Lifestyle Companion category.

#OKXAI
```

## 90-second demo script (for the X video)

1. **[0-10s]** Open https://mintmoment.onrender.com in browser
2. **[10-20s]** Scroll to "Try the live x402 flow" — show the input + mood selector
3. **[20-40s]** Type a moment → click "Generate free preview" → show the keepsake appear in the log
4. **[40-65s]** Click "Mint onchain for $0.05 USDT0" → show the full log: 402 PaymentRequired → settlement → 200 with txHash → explorer link
5. **[65-80s]** Scroll down to "Recent keepsakes" — show the social proof feed with real txHash links to OKLink
6. **[80-90s]** Final shot of the services grid with all 6 prices visible

## How to post on X (3 options)

### Option A — Manual (easiest, 30 seconds)
1. Open https://x.com in your browser
2. Sign in
3. Click "Post" (the compose button)
4. Copy-paste one of the X post templates above
5. Add a screenshot or screen recording of the live demo if you want
6. Click "Post"
7. Copy the resulting URL (e.g. https://x.com/YourHandle/status/1234567890) — that's the "Demo X post URL" for the form

### Option B — With screen recording (recommended for judges)
1. Open https://mintmoment.onrender.com in browser, set to mobile or 1280x720
2. Use a screen recorder (OBS, Loom, your phone) to capture the 90-second flow
3. Upload the video to X (as a video tweet, not just text)
4. Include the X post template text as the caption

### Option C — Programmatic (requires X API keys)
If you have X API access, I can post automatically. But manual is faster.

## Post-submission

Once you submit the Google form with the X post URL, the OKX.AI review team
will:
1. Confirm the marketplace listing (24h-2 business days)
2. Confirm the X post (a few hours)
3. Score the submission against the judging criteria:
   - Product quality
   - Use case strength
   - Marketplace fit
   - Innovation
   - Reliability
   - Long-term potential
   - Social traction

## Contact

- Email: fijinfolu@gmail.com
- GitHub: @Yemiight02
- X handle: *(fill in)*
