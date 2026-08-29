// Refuse to start on a Node that cannot run Kairo, and say what to change.
//
// Everything a business owns lives in node:sqlite, which arrived in Node 22.5.
// On anything older the failure is ERR_UNKNOWN_BUILTIN_MODULE thrown while the
// import graph is still linking — before a single line of Kairo runs. Render
// restarts it, it fails again, and the log fills with a stack trace that names
// no version and suggests no fix.
//
// yarn used to catch this by accident through package.json's "engines" field,
// during an install step with nothing to install. That misfired badly once, so
// .yarnrc now switches it off. This is the same requirement enforced at the
// moment it actually matters.
//
// Runs as its own process (npm's prestart hook) rather than inside server.js,
// because an ES module graph links before any of its bodies execute — a guard
// sitting at the top of server.js would never get to run.
//
// Deliberately conservative syntax: it has to parse on the old Node it exists
// to complain about.
const NEED = [22, 5, 0];

function parse(v) {
  // "26.8.0-alpha.0.0.0" → [26, 8, 0]. A prerelease is a real version here,
  // which is exactly where yarn's check went wrong.
  const core = String(v || '0').split('-')[0].split('.');
  return [Number(core[0]) || 0, Number(core[1]) || 0, Number(core[2]) || 0];
}

function older(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

const running = process.versions.node;
const want = NEED.join('.');

function refuse(reason) {
  const line = '─'.repeat(64);
  process.stderr.write('\n' + line + '\n');
  process.stderr.write('Kairo cannot start on this version of Node.\n\n');
  process.stderr.write('  running   Node ' + running + '\n');
  process.stderr.write('  needs     Node ' + want + ' or newer\n');
  process.stderr.write('  because   ' + reason + '\n\n');
  process.stderr.write('Fix it on Render:\n');
  process.stderr.write('  Service → Environment → set  NODE_VERSION = 22.22.2\n');
  process.stderr.write('  then Manual Deploy → Clear build cache & deploy.\n\n');
  process.stderr.write('No data has been touched. The database on the disk is\n');
  process.stderr.write('untouched and will be there when this boots.\n');
  process.stderr.write(line + '\n\n');
  process.exit(1);
}

if (older(parse(running), NEED)) {
  refuse('Kairo stores everything in node:sqlite, added in Node ' + want + '.');
}

// The version arithmetic above is for the message. This is the ground truth:
// either this Node can actually open the database or it cannot.
//
// Loading node:sqlite emits an ExperimentalWarning on some versions. The
// server suppresses it with a flag, but this file also gets run by hand when
// someone is working out why a service won't boot, and a health check that
// prints a scary warning while reporting success is a bad health check. So it
// silences its own probe rather than depending on how it was invoked.
process.removeAllListeners('warning');
process.on('warning', () => {});
try {
  await import('node:sqlite');
} catch {
  refuse('node:sqlite would not load on this build of Node ' + running + '.');
}
