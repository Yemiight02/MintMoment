# Deploying MintMoment

This guide walks you through deploying MintMoment to Render's free tier in
under 5 minutes. Render's free tier is enough for hackathon traffic.

## Option A — One-click Blueprint (recommended)

This repo includes a `render.yaml` Blueprint. Render will read it and create
the service for you.

1. Click this button:

   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Yemiight02/MintMoment)

2. Render will redirect you to sign in / sign up. Use **GitHub** to link the
   `Yemiight02/MintMoment` repo.

3. On the Blueprint form, fill in the `RECEIVE_ADDRESS` and `PUBLIC_URL`
   fields. The defaults are pre-filled, but you should override `PUBLIC_URL`
   to match the URL Render assigned you (e.g. `https://mintmoment.onrender.com`).

4. Click **Apply**. Render builds and deploys in ~2 minutes.

5. After the first deploy, the service URL is the one shown on the Render
   dashboard for the `mintmoment` service. Test:

   ```bash
   curl https://mintmoment-XXXX.onrender.com/health
   curl https://mintmoment-XXXX.onrender.com/.well-known/x402
   ```

6. The Blueprint sets `autoDeploy: true`, so any future push to `main`
   triggers a rebuild automatically. **Heads up from past projects:**
   free-tier auto-deploy can be flaky when the service sleeps. If a push
   doesn't take effect within 2-3 minutes, click **Manual Deploy** in the
   Render dashboard.

## Option B — Manual web service

If you'd rather configure the service yourself:

1. In Render dashboard, click **+ New** → **Web Service**.
2. Connect the `Yemiight02/MintMoment` repo.
3. Configure:
   - **Environment:** Node
   - **Region:** Oregon (or your nearest)
   - **Branch:** main
   - **Build Command:** `npm install --omit=optional --no-audit --no-fund`
   - **Start Command:** `npm start`
   - **Plan:** Free
   - **Health Check Path:** `/health`
4. Add environment variables (see `.env.example`):
   - `RECEIVE_ADDRESS` = `0x8bfc0f414be2f70c5930f7713be1db188eb0c3bd`
   - `PUBLIC_URL` = the URL Render gave you (paste after first deploy)
   - All other vars from `render.yaml` are pre-baked
5. Click **Create Web Service**.

## After deployment

Verify the live service with the smoke test:

```bash
BASE=https://mintmoment.onrender.com node scripts/smoke_test.js
```

All 30 checks should pass.

## Wiring up auto-deploy via GitHub Actions (optional)

The repo includes `.github/workflows/ci.yml` which runs the smoke test on every
push and, on success, hits a Render deploy hook. To enable:

1. In Render dashboard → your service → **Settings** → copy the **Deploy Hook URL**.
2. In GitHub → `Yemiight02/MintMoment` → **Settings** → **Secrets and variables**
   → **Actions** → **New repository secret**:
   - Name: `RENDER_DEPLOY_HOOK_URL`
   - Value: (paste the URL from step 1)
3. Future pushes to `main` will run tests, then trigger Render to redeploy.

## Notes for hackathon submission

- The form at `https://forms.gle/mddEUagmDbyV37ws8` requires the **live URL**
  of your service. Wait for the Render URL before submitting.
- The OKX.AI marketplace listing step also requires a live, reachable URL.
  Don't submit for listing until the first deploy is green.
- If the free-tier Render instance sleeps (after 15 min of inactivity on the
  free plan), the first request will take ~30s to wake. This is normal and
  doesn't affect marketplace evaluation.
