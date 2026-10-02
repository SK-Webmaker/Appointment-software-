#!/usr/bin/env node
// Triple T command line.
//   node src/cli.js discover [--skip=winners,kolscan]   build/refresh data/universe.json
//   node src/cli.js summary                             counts for the current universe
//   node src/cli.js gmgn <path>                         raw GMGN GET (debugging)
//   node src/cli.js fomo-import <export.json>           merge a fomo export into the universe
//   node src/cli.js copyfomo                            match copyfomo's public trader pages to known wallets
//   node src/cli.js hunt [--concurrency=5]              criteria.json end to end -> PICKS.md (+ forward test)
//   node src/cli.js report                              re-render PICKS.md from the last hunt
const { discover, loadUniverse, summarize } = require('./discover');

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const flag = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
  if (cmd === 'discover') {
    const skip = (flag('skip') || '').split(',').filter(Boolean);
    const t0 = Date.now();
    const out = await discover({ skip });
    console.log(JSON.stringify({ ...out, seconds: Math.round((Date.now() - t0) / 1000) }, null, 2));
  } else if (cmd === 'summary') {
    console.log(JSON.stringify(summarize(loadUniverse()), null, 2));
  } else if (cmd === 'gmgn') {
    const { Gmgn } = require('./gmgn');
    const g = await new Gmgn({ verbose: true }).open();
    try { console.log(JSON.stringify(await g.get(args[0]), null, 1)); } finally { await g.close(); }
  } else if (cmd === 'copyfomo') {
    const { importCopyfomo } = require('./copyfomo');
    console.log(JSON.stringify(await importCopyfomo(), null, 2));
  } else if (cmd === 'hunt') {
    const { hunt } = require('./hunt');
    const r = await hunt({ concurrency: Number(flag('concurrency') || 5) });
    console.log(JSON.stringify({ funnel: r.funnel, proof: r.proof, picks: r.picks.map((p) => p.address) }, null, 2));
  } else if (cmd === 'report') {
    const r = require('./hunt').report();
    console.log(`PICKS.md written: ${r.picks.length} picks${r.fomoPick ? ' + 1 copyfomo pick' : ''}`);
  } else if (cmd === 'fomo-import') {
    const { importFomoExport } = require('./fomo');
    console.log(JSON.stringify(importFomoExport(args[0]), null, 2));
  } else {
    console.log('usage: node src/cli.js discover|summary|copyfomo|hunt|report|gmgn <path>|fomo-import <file>');
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
