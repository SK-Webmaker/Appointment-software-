// Import a file made by scripts/fomo-export.js into the wallet universe.
// fomo's response shapes are only visible with a logged-in session, so wallet
// addresses are found by walking each profile for Solana-address-looking
// strings under wallet/address keys, skipping token mint fields.
const fs = require('fs');
const { loadUniverse, saveUniverse, walletEntry, resetSource } = require('./discover');

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MINT_KEY = /token|mint|pool|pair|contract/i;
const WALLET_KEY = /wallet|address|owner|solana/i;

function findWallets(node, keyPath = '', out = new Set()) {
  if (Array.isArray(node)) node.forEach((v) => findWallets(v, keyPath, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) findWallets(v, `${keyPath}.${k}`, out);
  } else if (typeof node === 'string' && BASE58.test(node)) {
    const last = keyPath.split('.').pop();
    if (WALLET_KEY.test(last) && !MINT_KEY.test(last)) out.add(node);
  }
  return out;
}

function importFomoExport(file) {
  const ex = JSON.parse(fs.readFileSync(file, 'utf8'));
  const u = loadUniverse();
  resetSource(u, 'fomo');
  const ranks = {};
  for (const [tf, lb] of Object.entries(ex.leaderboards || {})) {
    const rows = (lb && lb.responseObject && lb.responseObject.leaderboard) || [];
    rows.forEach((e, i) => {
      const h = e.userHandle || (e.user && e.user.userHandle);
      if (h) (ranks[h] ||= []).push({ timeframe: tf, rank: e.rank || i + 1, pnlUsd: e.totalPnlUsd ?? e.pnl ?? e.totalPnL ?? null });
    });
  }
  let matched = 0;
  const unmatched = [];
  for (const [handle, rec] of Object.entries(ex.users || {})) {
    const profile = rec.profile && rec.profile.responseObject;
    const wallets = [...findWallets(profile || {})];
    if (!wallets.length) { unmatched.push(handle); continue; }
    matched++;
    for (const addr of wallets) {
      const w = walletEntry(u, addr);
      w.sources.fomo = ranks[handle] || [{ timeframe: 'profile-only' }];
      w.fomo = { handle, userId: profile.id, displayName: profile.displayName || null };
    }
  }
  saveUniverse(u);
  return { traders: Object.keys(ex.users || {}).length, withWallet: matched, withoutWallet: unmatched.length, unmatchedSample: unmatched.slice(0, 10) };
}

module.exports = { importFomoExport, findWallets };
