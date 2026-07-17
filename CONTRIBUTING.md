# Contributing to MintMoment

Thanks for your interest. MintMoment is a small, single-purpose ASP for the
OKX.AI marketplace, so contribution surface is intentionally limited.

## Quick links

- **Live demo:** [https://mintmoment.onrender.com](https://mintmoment.onrender.com)
- **x402 manifest:** [/.well-known/x402](https://mintmoment.onrender.com/.well-known/x402)
- **OKX.AI listing:** (link once approved)
- **Hackathon:** OKX AI Genesis Hackathon — Lifestyle Companion category

## Development setup

```bash
git clone https://github.com/yemiight02/MintMoment
cd MintMoment
cp .env.example .env       # fill in RECEIVE_ADDRESS
npm install
npm run dev                # http://localhost:10000
npm run smoke              # full test suite
```

Requires Node 18+. No native dependencies — works on Termux, Render free tier,
and any other plain-Node host.

## Code style

- ES modules (`"type": "module"` in `package.json`)
- 2-space indent, single quotes, no semicolons where the linter allows
- No new dependencies unless absolutely necessary — keep the bundle tiny
- All new services must follow the x402 v2 spec:
  - Return HTTP 402 with `PaymentRequired` body when called without `X-PAYMENT`
  - Set `X-PAYMENT-REQUIRED: true` header on 402 responses
  - Use `network: "eip155:196"` (X Layer) and `scheme: "exact"`
  - Settle in USDT0 at 6 decimals

## Reporting issues

Open a GitHub issue with:

1. What you tried (curl command or code snippet)
2. What you expected
3. What happened
4. Server response (with `X-PAYMENT-REQUIRED` header if 402)

For payment-related bugs, include the txHash from the OKLink X Layer explorer
so we can correlate with onchain settlement.

## Pull requests

Small, focused PRs are best. If you're adding a new service, please:

1. Add it to the `SERVICES` array in `src/server.js`
2. Run `npm run smoke` and confirm all checks pass
3. Update the README service table

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.
