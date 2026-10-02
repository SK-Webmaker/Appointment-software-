// Triple T: fomo leaderboard export. READ THIS BEFORE YOU RUN IT.
//
// What it does: while you are logged in at https://fomo.family, it uses your
// own session to read (GET only) the leaderboards plus each leader's public
// profile, balances and recent swaps, then downloads them as one JSON file.
// It never buys, sells, signs or changes anything, and it does not put your
// login token in the file. The only server it talks to is prod-api.fomo.family.
//
// How: open https://fomo.family/leaderboard, press F12 (or Cmd+Opt+J on a Mac)
// for the console, paste this whole file, press Enter, and wait for the
// download (a few minutes for ~100 traders). Send the file to Claude.
//
// Only paste console code you have read and trust. This is the whole script.
(async () => {
  const API = 'https://prod-api.fomo.family';
  const TOP_PER_BOARD = 100; // traders per leaderboard to pull profiles for
  const SWAP_PAGES = 3; // pages of recent swaps per trader

  const tokenKey = Object.keys(localStorage).find((k) => /^privy:(.+:)?token$/.test(k));
  const raw = tokenKey ? localStorage.getItem(tokenKey) : null;
  let token = null;
  try { token = raw ? JSON.parse(raw) : null; } catch { token = raw; }
  if (!token) {
    const c = document.cookie.split('; ').find((x) => x.startsWith('privy-token='));
    token = c ? decodeURIComponent(c.split('=')[1]) : null;
  }
  if (!token) return alert('Triple T: log in to fomo.family first, then run this again.');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = async (path) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
        const body = await r.json().catch(() => null);
        if (r.ok) return body;
        if (r.status === 401) return { error: 'unauthorized (session expired? reload the page and rerun)' };
        if (r.status !== 429 && r.status < 500) return { error: `HTTP ${r.status}`, body };
      } catch (e) { /* network blip, retry */ }
      await sleep(1500 * (attempt + 1));
    }
    return { error: 'failed after retries' };
  };

  const out = { exportedAt: new Date().toISOString(), source: 'fomo.family', leaderboards: {}, users: {} };
  for (const tf of ['all-time', '24h', '7d', '30d']) {
    out.leaderboards[tf] = await get(tf === 'all-time' ? '/v2/leaderboard' : `/v2/leaderboard/${tf}`);
    console.log(`[triple-t] leaderboard ${tf}`, out.leaderboards[tf]);
  }

  const handles = new Set();
  for (const lb of Object.values(out.leaderboards)) {
    const rows = (lb && lb.responseObject && lb.responseObject.leaderboard) || [];
    rows.slice(0, TOP_PER_BOARD).forEach((e) => {
      const h = e.userHandle || (e.user && e.user.userHandle);
      if (h) handles.add(h);
    });
  }

  let n = 0;
  for (const handle of handles) {
    n++;
    const profile = await get(`/v2/users/userHandle/${encodeURIComponent(handle)}`);
    const id = profile && profile.responseObject && profile.responseObject.id;
    const rec = { profile };
    if (id) {
      rec.balances = await get(`/v2/users/${id}/balances`);
      rec.swaps = [];
      let cursor = null;
      for (let p = 0; p < SWAP_PAGES; p++) {
        const page = await get(`/v2/users/${id}/swaps${cursor ? `?lastSwapIdV2=${encodeURIComponent(cursor)}` : ''}`);
        rec.swaps.push(page);
        const ro = page && page.responseObject;
        const last = ro && ro.swaps && ro.swaps[ro.swaps.length - 1];
        if (!ro || !ro.hasNextPage || !last) break;
        cursor = last.swapIdV2 || last.id;
      }
    }
    out.users[handle] = rec;
    console.log(`[triple-t] ${n}/${handles.size} ${handle}`);
    await sleep(250);
  }

  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fomo-export-${out.exportedAt.slice(0, 10)}.json`;
  a.click();
  console.log(`[triple-t] done: ${handles.size} traders exported`);
})();
