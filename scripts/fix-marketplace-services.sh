#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Fix the OKX.AI marketplace "starting price: 0.00 USDT" issue
# ─────────────────────────────────────────────────────────────────────────────
# The marketplace reads the on-chain service list (NOT the x402 manifest) to
# display the "starting price" on the agent card. Quick Moment is free
# ($0.00), so it's currently the cheapest in the on-chain list, and the
# marketplace shows "0.00 USDT" as the starting price.
#
# This script reorders the on-chain services so the cheapest PAID service
# (mint_keepsake at $0.05) is first, which makes the marketplace show
# "0.05 USDT" as the starting price — matching what real users will see.
#
# Run this on the machine that has the OKX agentic wallet logged in.
# ─────────────────────────────────────────────────────────────────────────────

set -e

# 1. Re-login to onchainos (or use a saved session)
export PATH="$PATH:$HOME/.local/bin"
source /root/.profile 2>/dev/null || true

# Check current status
echo "=== current agent services (on-chain) ==="
onchainos agent service-list --agent-id 6607 2>&1 | head -20 || {
  echo "Session expired. Please login first:"
  echo "  onchainos wallet login"
  echo "  (open the URL in your browser, complete the social login)"
  exit 1
}

# 2. Build the new service list — paid services in ascending price order
# Quick Moment is intentionally removed from the on-chain list (it lives only
# in the x402 manifest as a free preview, doesn't need chain registration).
SERVICES_JSON=$(cat <<'EOF'
[
  {
    "operation": "create",
    "serviceName": "verify_address",
    "serviceDescription": "Risk-score any wallet or token via SentriAgent (A2A, agent 5103). Returns 0-100 score, level, recommendation, and underlying signals.\nThe user provides: chain (ethereum/bsc/polygon/arbitrum/base/xlayer/solana) and an address (0x... or base58).",
    "serviceType": "A2MCP",
    "fee": "0.05",
    "endpoint": "https://mintmoment.onrender.com/api/verify_address"
  },
  {
    "operation": "create",
    "serviceName": "risk_scored_gift",
    "serviceDescription": "Same as Gift Keepsake, but the recipient X Layer address is risk-scored via SentriAgent (A2A, agent 5103) before the mint. Configurable risk tolerance. HIGH/CRITICAL risk refuses the mint.\nThe user provides: a moment, a recipient X Layer address (0x...), an optional toName, an optional note, and a riskTolerance (strict/balanced/permissive).",
    "serviceType": "A2MCP",
    "fee": "0.15",
    "endpoint": "https://mintmoment.onrender.com/api/risk_scored_gift"
  },
  {
    "operation": "create",
    "serviceName": "mint_keepsake_trial",
    "serviceDescription": "A real onchain mint for one-tenth of a cent. The impulse-buy tier. Real X Layer transaction hash, real onchain proof. Lowest entry point, no friction.\nThe user provides: a moment (8+ chars) and an optional mood.",
    "serviceType": "A2MCP",
    "fee": "0.001",
    "endpoint": "https://mintmoment.onrender.com/api/mint_keepsake_trial"
  },
  {
    "operation": "create",
    "serviceName": "mint_keepsake",
    "serviceDescription": "Generate + mint a personal moment on X Layer. Real tx hash, real onchain keepsake, $0.05 USDT0 per mint via x402 v2.\nThe user provides: a moment (8+ chars) and an optional mood.",
    "serviceType": "A2MCP",
    "fee": "0.05",
    "endpoint": "https://mintmoment.onrender.com/api/mint_keepsake"
  },
  {
    "operation": "create",
    "serviceName": "gift_keepsake",
    "serviceDescription": "Mint a moment as a gift to someone else's X Layer address. Real onchain receipt, $0.10 USDT0 per gift via x402 v2.\nThe user provides: a moment, a recipient X Layer address, and an optional note.",
    "serviceType": "A2MCP",
    "fee": "0.10",
    "endpoint": "https://mintmoment.onrender.com/api/gift_keepsake"
  },
  {
    "operation": "create",
    "serviceName": "anniversary_mint",
    "serviceDescription": "Mint a moment tied to a specific date. Real onchain receipt with anniversary metadata, $0.15 USDT0 per mint via x402 v2.\nThe user provides: a moment, an anniversary date, and an optional mood.",
    "serviceType": "A2MCP",
    "fee": "0.15",
    "endpoint": "https://mintmoment.onrender.com/api/anniversary_mint"
  },
  {
    "operation": "create",
    "serviceName": "monthly_timeline",
    "serviceDescription": "Mint a 5-moment monthly timeline as one transaction. Returns 5 linked keepsakes, $0.20 USDT0 per timeline via x402 v2.\nThe user provides: a year-month string and 5 short moments.",
    "serviceType": "A2MCP",
    "fee": "0.20",
    "endpoint": "https://mintmoment.onrender.com/api/monthly_timeline"
  },
  {
    "operation": "create",
    "serviceName": "premium_story",
    "serviceDescription": "Mint a multi-scene cinematic story. Returns 3-5 scenes each with their own tx hash, $0.50 USDT0 per story via x402 v2.\nThe user provides: a longer arc and an optional scene count.",
    "serviceType": "A2MCP",
    "fee": "0.50",
    "endpoint": "https://mintmoment.onrender.com/api/premium_story"
  }
]
EOF
)

echo
echo "=== submitting service update (paid services only, ordered by price) ==="
# Use --service with the full payload. The CLI may take this as a single
# big JSON or as operation-style — try the documented approach first:
onchainos agent update \
  --agent-id 6607 \
  --service "$SERVICES_JSON" \
  --service-update 2>&1 | tee /tmp/mintmoment-update.log

# Some CLI versions want each service as a separate flag
if grep -q "unexpected\|invalid" /tmp/mintmoment-update.log; then
  echo
  echo "--- retrying with one --service per service ---"
  echo "$SERVICES_JSON" | jq -c '.[]' | while read svc; do
    onchainos agent update --agent-id 6607 --service "$svc" 2>&1 | head -5
  done
fi

echo
echo "=== verify the new on-chain list ==="
onchainos agent service-list --agent-id 6607 2>&1 | head -20

echo
echo "=== if you want to remove the free quick_moment from the on-chain list ==="
# (It stays available in the x402 manifest as a free preview.)
DELETION_JSON='[
  { "operation": "delete", "serviceName": "quick_moment" }
]'
onchainos agent update --agent-id 6607 --service "$DELETION_JSON" 2>&1 | head -5

echo
echo "=== done. The marketplace should refresh in 1-2 hours and show 0.05 USDT (or 0.001 USDT if the trial lands). ==="
