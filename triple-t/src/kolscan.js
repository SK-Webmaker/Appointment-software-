// kolscan.io (pump.fun's KOL leaderboard). Its JSON API refuses outside calls,
// but the leaderboard page is server-rendered with the top 50 for each of the
// daily, weekly and monthly boards embedded in the Next.js flight data.
const https = require('https');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => (res.statusCode === 200 ? resolve(body) : reject(new Error(`kolscan HTTP ${res.statusCode}`))));
    }).on('error', reject);
  });
}

function parseLeaderboard(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => JSON.parse(`"${m[1]}"`));
  const blob = chunks.join('');
  const key = '"initLeaderboard":';
  const at = blob.indexOf(key);
  if (at < 0) throw new Error('kolscan: leaderboard data not found in page');
  // Walk to the matching close bracket of the array.
  let i = at + key.length, depth = 0, inStr = false;
  const start = i;
  for (; i < blob.length; i++) {
    const ch = blob[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') { depth--; if (depth === 0) break; }
  }
  return JSON.parse(blob.slice(start, i + 1));
}

// Rows: { wallet_address, name, twitter, telegram, profit (SOL), wins, losses, timeframe (1|7|30) }
async function kolscanLeaderboard() {
  const rows = parseLeaderboard(await fetchText('https://kolscan.io/leaderboard'));
  const rankIn = {};
  return rows.map((r) => {
    rankIn[r.timeframe] = (rankIn[r.timeframe] || 0) + 1;
    return { ...r, rank: rankIn[r.timeframe] };
  });
}

module.exports = { kolscanLeaderboard, parseLeaderboard };
