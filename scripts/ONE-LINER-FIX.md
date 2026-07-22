# Fix the "Starting price: 0.00 USDT" — one-liner

## What's wrong

The OKX.AI marketplace detail page shows:
- **Starting price: 0.00 USDT**
- **6 services, lowest is "Quick Moment" (free)**

This is because the marketplace **reads the on-chain service list** (not the x402 manifest), and the on-chain list still has `quick_moment` as the cheapest entry. When I reordered things on the server side, only the x402 manifest changed — not the chain state.

## What needs to happen

A signed transaction on X Layer that **deletes `quick_moment` from the on-chain service list** (it stays available as a free preview in the x402 manifest, no wallet needed). After the delete, the cheapest on-chain service is `mint_keepsake` at $0.05, and the marketplace will show "0.05 USDT" as the starting price.

This is one transaction. It costs nothing (OKX covers network fees on the agent updates).

## How to do it

### Option 1 — Run the prepared script

On your machine (where the OKX agentic wallet is logged in):

```bash
curl -fsSL https://raw.githubusercontent.com/Yemiight02/MintMoment/main/scripts/fix-marketplace-services.sh | bash
```

The script will:
1. Verify your `onchainos` CLI is logged in
2. Delete the free `quick_moment` service from the on-chain list
3. Add the new `mint_keepsake_trial` ($0.001) service
4. Reorder the remaining paid services by ascending price
5. Verify the change and print the new on-chain list

### Option 2 — Run the one-liner directly

If you already have `onchainos` CLI installed and the agentic wallet logged in:

```bash
onchainos agent update --agent-id 6607 --service '[{"operation":"delete","serviceName":"quick_moment"},{"operation":"create","serviceName":"mint_keepsake_trial","serviceDescription":"A real onchain mint for one-tenth of a cent. The impulse-buy tier. Real X Layer transaction hash, real onchain proof, real sold count.\nThe user provides: a moment (8+ chars) and an optional mood.","serviceType":"A2MCP","fee":"0.001","endpoint":"https://mintmoment.onrender.com/api/mint_keepsake_trial"}]'
```

## After the fix

1. The X Layer tx takes ~3 seconds to confirm
2. The OKX.AI marketplace indexer will pick up the change on its next crawl cycle (1-2 hours typical)
3. The agent card will then show "0.001 USDT" (the trial) as the starting price

## If you can't run it right now

The agent card will still say 0.00 USDT, but the **detail page** still shows all 6 paid services and their correct prices. Users who click into the listing can see the full menu. The "0.00 USDT" is a first-impression problem only — once they click in, the pricing is correct.

**This is one transaction, takes 30 seconds, costs you nothing.** The fix unlocks the first impression problem permanently.
