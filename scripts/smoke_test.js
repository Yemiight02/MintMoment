#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// MintMoment — full smoke test (covers all 10 services + x402 flow + landing)
// Usage:
//   node scripts/smoke_test.js
//   BASE=https://mintmoment.onrender.com node scripts/smoke_test.js
// ─────────────────────────────────────────────────────────────────────────────

const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 10000}`;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${name}${detail ? '  ' + detail : ''}`);
}

async function get(path) {
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

function makePayment(amount) {
  const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return Buffer.from(JSON.stringify({
    txHash,
    from: '0x8bfc0f414be2f70c5930f7713be1db188eb0c3bd',
    amount,
    asset: '0x779ded0c9e1022225f8a06d3a3c4b3f1e6d5b4d3',
  })).toString('base64');
}

(async () => {
  console.log(`\nMintMoment smoke test — base=${BASE}\n`);

  // ── 1. /health ───────────────────────────────────────────────────────
  {
    const r = await get('/health');
    record('GET /health returns 200', r.status === 200, `status=${r.status}`);
    record('GET /health has agent name', r.json?.agent === 'MintMoment');
    record('GET /health has chain eip155:196', r.json?.chain === 'eip155:196');
    record('GET /health reports 10 services', r.json?.services === 10, `services=${r.json?.services}`);
  }

  // ── 2. /.well-known/x402 ────────────────────────────────────────────
  {
    const r = await get('/.well-known/x402');
    record('GET /.well-known/x402 returns 200', r.status === 200);
    record('manifest x402Version is 2', r.json?.x402Version === 2);
    record('manifest has 10 services', Array.isArray(r.json?.services) && r.json.services.length === 10);
    record('manifest network is eip155:196', r.json?.network === 'eip155:196');
    record('manifest has agentCategory Lifestyle', r.json?.agentCategory === 'Lifestyle');
    const ids = r.json?.services?.map((s) => s.id) || [];
    ['quick_moment', 'mint_keepsake', 'gift_keepsake', 'anniversary_mint', 'monthly_timeline', 'premium_story'].forEach((id) => {
      record(`manifest has service: ${id}`, ids.includes(id));
    });
  }

  // ── 3. /api/services ────────────────────────────────────────────────
  {
    const r = await get('/api/services');
    record('GET /api/services returns 200', r.status === 200);
    record('/api/services lists 10 services', r.json?.services?.length === 10);
  }

  // ── 4. /api/recent (live social proof) ──────────────────────────────
  {
    const r = await get('/api/recent?limit=5');
    record('GET /api/recent returns 200', r.status === 200);
    record('/api/recent has at least 3 mints (seeded)', r.json?.mints?.length >= 3);
    if (r.json?.mints?.[0]) {
      record('recent mint has txHash', /^0x[a-fA-F0-9]{64}$/.test(r.json.mints[0].txHash || ''));
      record('recent mint has explorerUrl', r.json.mints[0].explorerUrl?.includes('oklink.com/xlayer'));
    }
  }

  // ── 5. /api/quick_moment (free) ─────────────────────────────────────
  {
    const r = await post('/api/quick_moment', { moment: 'A quiet morning with very good coffee.', mood: 'calm' });
    record('POST /api/quick_moment returns 200', r.status === 200);
    record('quick_moment returns preview keepsake', r.json?.preview?.id?.startsWith('mm_'));
    record('quick_moment has title', typeof r.json?.preview?.title === 'string' && r.json.preview.title.length > 0);
    record('quick_moment has palette (4 colors)', Array.isArray(r.json?.preview?.palette) && r.json.preview.palette.length === 4);
  }
  {
    const r = await post('/api/quick_moment', { moment: 'x' });
    record('quick_moment rejects too-short input (400)', r.status === 400);
  }

  // ── 6. /api/keepsake/:id (lookup) ───────────────────────────────────
  {
    const create = await post('/api/quick_moment', { moment: 'A moment for lookup testing.' });
    const id = create.json?.preview?.id;
    const lookup = await get(`/api/keepsake/${id}`);
    record('GET /api/keepsake/:id returns the kept keepsake', lookup.status === 200 && lookup.json?.id === id);
  }

  // ── 7. x402 402 gate (no payment) ───────────────────────────────────
  {
    const r = await post('/api/mint_keepsake', { moment: 'A long walk home in the rain.' });
    record('POST /api/mint_keepsake no payment → 402', r.status === 402);
    record('402 sets X-PAYMENT-REQUIRED header', r.headers['x-payment-required'] === 'true');
    record('402 body has x402Version 2', r.json?.x402Version === 2);
    record('402 body accepts[].scheme=exact', r.json?.accepts?.[0]?.scheme === 'exact');
    record('402 body network eip155:196', r.json?.accepts?.[0]?.network === 'eip155:196');
    record('402 body payTo is a 0x address', /^0x[a-fA-F0-9]{40}$/.test(r.json?.accepts?.[0]?.payTo || ''));
    record('402 body amount = 50000 ($0.05)', r.json?.accepts?.[0]?.maxAmountRequired === '50000');
    record('402 body resource points to /api/ endpoint', r.json?.accepts?.[0]?.resource?.includes('/api/mint_keepsake'));
  }

  // ── 8. x402 with payment → 200 with txHash ──────────────────────────
  {
    const payment = makePayment('50000');
    const r = await post('/api/mint_keepsake', { moment: 'A long walk home in the rain.', mood: 'nostalgic' }, { 'X-PAYMENT': payment });
    record('POST /api/mint_keepsake with payment → 200', r.status === 200);
    record('mint_keepsake returns valid txHash', /^0x[a-fA-F0-9]{64}$/.test(r.json?.keepsake?.txHash || ''));
    record('mint_keepsake returns OKLink explorer URL', r.json?.keepsake?.explorerUrl?.includes('oklink.com/xlayer/tx/'));
    record('mint_keepsake returns recipient', /^0x[a-fA-F0-9]{40}$/.test(r.json?.keepsake?.recipient || ''));
  }

  // ── 9. /api/gift_keepsake ───────────────────────────────────────────
  {
    const r = await post('/api/gift_keepsake', { moment: 'A gift for M.' });
    record('gift_keepsake no payment → 402', r.status === 402);
  }
  {
    const payment = makePayment('100000');
    const r = await post(
      '/api/gift_keepsake',
      { moment: 'For M, the morning we met.', mood: 'tender', recipient: '0x1234567890123456789012345678901234567890', toName: 'M', note: 'I keep this one for us.' },
      { 'X-PAYMENT': payment }
    );
    record('gift_keepsake with payment → 200', r.status === 200);
    record('gift_keepsake embeds toName', r.json?.keepsake?.toName === 'M');
    record('gift_keepsake embeds note', r.json?.keepsake?.note === 'I keep this one for us.');
    record('gift_keepsake returns txHash', /^0x[a-fA-F0-9]{64}$/.test(r.json?.keepsake?.txHash || ''));
  }
  {
    const payment = makePayment('100000');
    const r = await post('/api/gift_keepsake', { moment: 'Bad gift without recipient.', toName: 'X' }, { 'X-PAYMENT': payment });
    record('gift_keepsake rejects missing recipient (400)', r.status === 400);
  }

  // ── 10. /api/anniversary_mint ───────────────────────────────────────
  {
    const r = await post('/api/anniversary_mint', { moment: 'Three years in.' });
    record('anniversary_mint no payment → 402', r.status === 402);
  }
  {
    const payment = makePayment('150000');
    const r = await post(
      '/api/anniversary_mint',
      { moment: 'The day we moved into the new apartment.', anniversaryDate: '2023-07-17', mood: 'nostalgic' },
      { 'X-PAYMENT': payment }
    );
    record('anniversary_mint with payment → 200', r.status === 200);
    record('anniversary_mint records anniversaryDate', r.json?.keepsake?.anniversaryDate === '2023-07-17');
    record('anniversary_mint computes yearsSince (>=2)', (r.json?.keepsake?.yearsSince ?? 0) >= 2);
  }
  {
    const payment = makePayment('150000');
    const r = await post('/api/anniversary_mint', { moment: 'Bad anniversary.', anniversaryDate: 'not-a-date' }, { 'X-PAYMENT': payment });
    record('anniversary_mint rejects bad date (400)', r.status === 400);
  }

  // ── 11. /api/monthly_timeline ───────────────────────────────────────
  {
    const payment = makePayment('200000');
    const r = await post(
      '/api/monthly_timeline',
      { moments: [
        { moment: 'Coffee with M on Tuesday morning.' },
        { moment: 'First swim of the summer at the lake.' },
        { moment: 'A long phone call with my sister.' },
      ] },
      { 'X-PAYMENT': payment }
    );
    record('monthly_timeline with payment → 200', r.status === 200);
    record('monthly_timeline returns 3 keepsakes', r.json?.bundle?.keepsakes?.length === 3);
    record('monthly_timeline has narrative', typeof r.json?.bundle?.timelineNarrative === 'string');
    record('monthly_timeline keepsakes have txHashes', r.json?.bundle?.keepsakes?.every((k) => /^0x[a-fA-F0-9]{64}$/.test(k.txHash)));
  }

  // ── 12. /api/premium_story ──────────────────────────────────────────
  {
    const payment = makePayment('500000');
    const r = await post(
      '/api/premium_story',
      {
        arc: 'A long weekend in Lisbon that started with rain and a delayed flight, and ended with the kind of dinner that you do not want to leave, with a new friend you did not expect to make. The taxi driver told us his favourite poem. The hill at sunset looked back at us. We had one last coffee at a long table.',
        mood: 'nostalgic',
        sceneCount: 3,
      },
      { 'X-PAYMENT': payment }
    );
    record('premium_story with payment → 200', r.status === 200);
    record('premium_story returns 3 scenes', r.json?.story?.scenes?.length === 3);
    record('premium_story has story title', typeof r.json?.story?.title === 'string');
  }

  // ── 13. Landing page (judge-facing) ──────────────────────────────────
  {
    const r = await fetch(`${BASE}/`);
    const text = await r.text();
    record('GET / returns HTML', r.status === 200 && text.startsWith('<!doctype html>'));
    record('Landing page mentions MintMoment', text.includes('MintMoment'));
    record('Landing page lists all 10 services', [
      'Quick Moment', 'Mint Trial', 'Verify Address', 'Forward Command', 'Mint Keepsake', 'Risk-Scored Gift', 'Gift Keepsake', 'Anniversary Mint', 'Monthly Timeline', 'Premium Story'
    ].every((n) => text.includes(n)));
    record('Landing page has live x402 demo', text.includes('demo-log') || text.includes('id="demo-paid-btn"'));
    record('Landing page has recent mints feed', text.includes('recent-tx'));
    record('Landing page has network eip155:196', text.includes('eip155:196'));
    record('Landing page has USDT0 mention', text.includes('USDT0'));
    record('Landing page has pricing for all paid services',
      ['$0.001', '$0.05', '$0.10', '$0.15', '$0.20', '$0.50'].every((p) => text.includes(p)));
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(2);
});
