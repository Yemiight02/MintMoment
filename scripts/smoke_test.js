#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// MintMoment — local smoke test
// Run against a live server (local or Render) to verify the 4 services,
// the x402 manifest, and the 402 payment gate.
//
// Usage:
//   node scripts/smoke_test.js                          # against localhost:10000
//   BASE=https://mintmoment.onrender.com node scripts/smoke_test.js
// ─────────────────────────────────────────────────────────────────────────────

const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 10000}`;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${name}${detail ? '  ' + detail : ''}`);
}

async function get(path, expectStatus = 200) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, text };
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, text, headers: Object.fromEntries(res.headers) };
}

(async () => {
  console.log(`\nMintMoment smoke test — base=${BASE}\n`);

  // 1. /health
  {
    const r = await get('/health');
    record('GET /health returns 200', r.status === 200, `status=${r.status}`);
    record('GET /health has agent name', r.json?.agent === 'MintMoment', `agent=${r.json?.agent}`);
    record('GET /health has chain info', r.json?.chain === 'eip155:196', `chain=${r.json?.chain}`);
  }

  // 2. /.well-known/x402
  {
    const r = await get('/.well-known/x402');
    record('GET /.well-known/x402 returns 200', r.status === 200, `status=${r.status}`);
    record('manifest x402Version is 2', r.json?.x402Version === 2, `x402Version=${r.json?.x402Version}`);
    record('manifest has 4 services', Array.isArray(r.json?.services) && r.json.services.length === 4, `count=${r.json?.services?.length}`);
    record('manifest network is eip155:196', r.json?.network === 'eip155:196');
  }

  // 3. /api/services
  {
    const r = await get('/api/services');
    record('GET /api/services returns 200', r.status === 200);
    record('/api/services lists 4 services', Array.isArray(r.json?.services) && r.json.services.length === 4);
  }

  // 4. /api/quick_moment (free)
  {
    const r = await post('/api/quick_moment', { moment: 'A quiet morning with very good coffee.', mood: 'calm' });
    record('POST /api/quick_moment returns 200', r.status === 200, `status=${r.status}`);
    record('quick_moment returns a preview keepsake', r.json?.preview?.id?.startsWith('mm_'));
    record('quick_moment has a title', typeof r.json?.preview?.title === 'string' && r.json.preview.title.length > 0);
  }

  // 5. /api/quick_moment with bad input
  {
    const r = await post('/api/quick_moment', { moment: 'x' });
    record('POST /api/quick_moment rejects too-short input', r.status === 400);
  }

  // 6. Paid service without payment — must return 402
  {
    const r = await post('/api/mint_keepsake', { moment: 'A long walk home in the rain.' });
    record('POST /api/mint_keepsake without payment returns 402', r.status === 402, `status=${r.status}`);
    const pr = r.json;
    record('402 body has x402Version 2', pr?.x402Version === 2);
    record('402 body has accepts[].scheme=exact', pr?.accepts?.[0]?.scheme === 'exact');
    record('402 body network is eip155:196', pr?.accepts?.[0]?.network === 'eip155:196');
    record('402 body payTo is set', /^0x[a-fA-F0-9]{40}$/.test(pr?.accepts?.[0]?.payTo || ''));
    record('402 body maxAmountRequired matches $0.05', pr?.accepts?.[0]?.maxAmountRequired === '50000');
  }

  // 7. Paid service with mock payment
  {
    const fakePayment = Buffer.from(
      JSON.stringify({
        txHash: '0x' + 'a'.repeat(64),
        from: '0x8bfc0f414be2f70c5930f7713be1db188eb0c3bd',
        amount: '50000',
        asset: '0x779ded0c9e1022225f8a06d3a3c4b3f1e6d5b4d3',
      })
    ).toString('base64');
    const r = await post(
      '/api/mint_keepsake',
      { moment: 'A long walk home in the rain.', mood: 'nostalgic' },
      { 'X-PAYMENT': fakePayment }
    );
    record('POST /api/mint_keepsake with payment returns 200', r.status === 200, `status=${r.status}`);
    record('mint_keepsake returns a txHash', /^0x[a-fA-F0-9]{64}$/.test(r.json?.keepsake?.txHash || ''));
    record('mint_keepsake returns explorerUrl', r.json?.keepsake?.explorerUrl?.includes('oklink.com/xlayer'));
  }

  // 8. monthly_timeline with mock payment
  {
    const fakePayment = Buffer.from(
      JSON.stringify({
        txHash: '0x' + 'b'.repeat(64),
        from: '0x8bfc0f414be2f70c5930f7713be1db188eb0c3bd',
        amount: '200000',
      })
    ).toString('base64');
    const r = await post(
      '/api/monthly_timeline',
      { moments: [
        { moment: 'Coffee with M on Tuesday morning.' },
        { moment: 'First swim of the summer at the lake.' },
        { moment: 'A long phone call with my sister.' },
      ] },
      { 'X-PAYMENT': fakePayment }
    );
    record('POST /api/monthly_timeline with payment returns 200', r.status === 200);
    record('monthly_timeline returns 3 keepsakes', r.json?.bundle?.keepsakes?.length === 3);
    record('monthly_timeline has a narrative', typeof r.json?.bundle?.timelineNarrative === 'string');
  }

  // 9. premium_story with mock payment
  {
    const fakePayment = Buffer.from(
      JSON.stringify({
        txHash: '0x' + 'c'.repeat(64),
        from: '0x8bfc0f414be2f70c5930f7713be1db188eb0c3bd',
        amount: '500000',
      })
    ).toString('base64');
    const r = await post(
      '/api/premium_story',
      {
        arc: 'A long weekend in Lisbon that started with rain and a delayed flight, and ended with the kind of dinner that you do not want to leave, with a new friend you did not expect to make. The taxi driver told us his favourite poem. The hill at sunset looked back at us. We had one last coffee at a long table.',
        mood: 'nostalgic',
        sceneCount: 3,
      },
      { 'X-PAYMENT': fakePayment }
    );
    record('POST /api/premium_story with payment returns 200', r.status === 200);
    record('premium_story returns 3 scenes', r.json?.story?.scenes?.length === 3);
  }

  // 10. Landing page
  {
    const r = await fetch(`${BASE}/`);
    const text = await r.text();
    record('GET / returns HTML', r.status === 200 && text.startsWith('<!doctype html>'));
    record('Landing page mentions MintMoment', text.includes('MintMoment'));
    record('Landing page lists all 4 services', ['Quick Moment', 'Mint Keepsake', 'Monthly Timeline', 'Premium Story'].every((n) => text.includes(n)));
  }

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(2);
});
