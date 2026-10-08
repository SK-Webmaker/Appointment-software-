// The iPhone app's App Store listing, once Apple has one.
//
// Nothing here may ever reach Apple: the lookup is exercised with a stand-in
// fetch, and the servers run with KAIRO_APP_STORE_ID pinned or the lookup off.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startKairo, tenantCli } from './helpers/kairo.js';
import { lookupAppStoreId, appStoreId, appStoreUrl, appStoreBanner, BUNDLE_ID, _resetAppStore } from '../src/app-store.js';

const ID = '6740000001';
const reply = (results, ok = true) => ({ ok, json: async () => ({ resultCount: results.length, results }) });

test('the lookup takes the number from the listing with our bundle id, and nothing else', async () => {
  const asked = [];
  const id = await lookupAppStoreId({ fetchImpl: async (url) => {
    asked.push(url);
    return reply([{ bundleId: 'com.someone.else', trackId: 1111111111 }, { bundleId: BUNDLE_ID, trackId: Number(ID) }]);
  } });
  assert.equal(id, ID);
  assert.equal(asked.length, 1);
  assert.match(asked[0], /^https:\/\/itunes\.apple\.com\/lookup\?bundleId=com\.kairobookings\.kairo&country=au$/);
});

test('not listed in Australia: it asks the default storefront; not listed anywhere: no number', async () => {
  const asked = [];
  const id = await lookupAppStoreId({ fetchImpl: async (url) => {
    asked.push(url);
    return url.includes('country=au') ? reply([]) : reply([{ bundleId: BUNDLE_ID, trackId: Number(ID) }]);
  } });
  assert.equal(id, ID);
  assert.equal(asked.length, 2);

  assert.equal(await lookupAppStoreId({ fetchImpl: async () => reply([]) }), '');
  assert.equal(await lookupAppStoreId({ fetchImpl: async () => reply([{ bundleId: 'com.someone.else', trackId: 1 }]) }), '');
  assert.equal(await lookupAppStoreId({ fetchImpl: async () => reply([], false) }), '');
  assert.equal(await lookupAppStoreId({ fetchImpl: async () => { throw new Error('offline'); } }), '',
    'Apple being unreachable is no number, never an error');
});

test('a pinned number wins, and anything that is not a number is ignored', () => {
  const before = { id: process.env.KAIRO_APP_STORE_ID, off: process.env.KAIRO_APP_STORE_LOOKUP };
  try {
    process.env.KAIRO_APP_STORE_LOOKUP = 'off';
    _resetAppStore();
    process.env.KAIRO_APP_STORE_ID = ID;
    assert.equal(appStoreId(), ID);
    assert.equal(appStoreUrl(), `https://apps.apple.com/app/id${ID}`);
    assert.equal(appStoreBanner(), `<meta name="apple-itunes-app" content="app-id=${ID}">`);
    process.env.KAIRO_APP_STORE_ID = '"><script>alert(1)</script>';
    assert.equal(appStoreId(), '');
    assert.equal(appStoreUrl(), '');
    assert.equal(appStoreBanner(), '');
  } finally {
    for (const [k, v] of [['KAIRO_APP_STORE_ID', before.id], ['KAIRO_APP_STORE_LOOKUP', before.off]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

const servers = [];
after(async () => { for (const s of servers) await s.stop(); });

test('once the listing is known: the workspace offers the app, the booking page never does', async () => {
  const k = await startKairo({ env: { KAIRO_APP_STORE_ID: ID } });
  servers.push(k);
  const banner = `<meta name="apple-itunes-app" content="app-id=${ID}">`;

  const shell = await k.api('GET', '/');
  assert.ok(shell.text.includes(banner), 'the workspace shell carries the Smart App Banner');
  const deep = await k.api('GET', '/some/route');
  assert.ok(deep.text.includes(banner), 'so does the shell served for any app route');
  const book = await k.api('GET', '/book');
  assert.ok(!book.text.includes('apple-itunes-app'), 'the booking page is for customers, not for the app');

  const { cookie } = await k.login();
  const config = await k.api('GET', '/api/app/config', { cookie });
  assert.equal(config.json.app_store_url, `https://apps.apple.com/app/id${ID}`);
  const list = await k.api('GET', '/api/checklist', { cookie });
  const app = list.json.items.find((i) => i.id === 'app');
  assert.deepEqual(app.action, { label: 'Get the iPhone app', url: `https://apps.apple.com/app/id${ID}`, external: true });
});

test('until it is known: no banner, and the checklist explains the home-screen version', async () => {
  const k = await startKairo();
  servers.push(k);
  const shell = await k.api('GET', '/');
  assert.ok(!shell.text.includes('apple-itunes-app'));
  const { cookie } = await k.login();
  const config = await k.api('GET', '/api/app/config', { cookie });
  assert.equal(config.json.app_store_url, '');
  const list = await k.api('GET', '/api/checklist', { cookie });
  assert.deepEqual(list.json.items.find((i) => i.id === 'app').action, { label: 'How', hash: '#/settings' });
});

test('the sign-in page offers the app too', async () => {
  const DOMAIN = 'kairobookings.test';
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-appstore-'));
  tenantCli(dataDir, ['create', 'alpha', '--name', 'Alpha Salon', '--email', 'owner@alpha.test', '--password', 'alpha-pass-2026!!']);
  const k = await startKairo({ dataDir, env: { KAIRO_MULTI_TENANT: '1', KAIRO_BASE_DOMAIN: DOMAIN, KAIRO_APP_STORE_ID: ID } });
  servers.push(k);
  const page = await k.api('GET', '/', { host: `login.${DOMAIN}` });
  assert.equal(page.status, 200);
  assert.ok(page.text.includes(`<meta name="apple-itunes-app" content="app-id=${ID}">`));
});
