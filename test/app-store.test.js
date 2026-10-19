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
import { lookupAppStoreId, lookupAppStore, appStoreId, appStoreUrl, appStoreVersion, appStoreBanner, BUNDLE_ID, _resetAppStore } from '../src/app-store.js';
import { appVersion, isNewer, updateAvailable } from '../public/js/native.js';

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

test('the lookup also says which version the App Store is giving out, and only a version', async () => {
  const one = (version) => lookupAppStore({ fetchImpl: async () => reply([{ bundleId: BUNDLE_ID, trackId: Number(ID), version }]) });
  assert.deepEqual(await one('1.0.3'), { id: ID, version: '1.0.3' });
  assert.deepEqual(await one('1.0.3"><script>'), { id: ID, version: '' }, 'anything that is not a version is no version');
  assert.deepEqual(await one(undefined), { id: ID, version: '' });
  assert.deepEqual(await lookupAppStore({ fetchImpl: async () => reply([]) }), { id: '', version: '' });
});

test('an app older than the App Store is offered the update; one up to date never is', () => {
  // The builds before 1.0.4 do not say their version, only their bridge's.
  assert.equal(appVersion({ version: 2, platform: 'ios' }), '1.0.2');
  assert.equal(appVersion({ version: 3, platform: 'ios' }), '1.0.3');
  assert.equal(appVersion({ version: 3, platform: 'ios', app: '1.0.4', build: '31' }), '1.0.4');
  assert.equal(appVersion(null), '', 'a browser is no app');
  assert.equal(appVersion({ version: 9 }), '', 'a build it cannot place is never nagged');

  assert.ok(isNewer('1.0.10', '1.0.9'), 'versions compare by number, not as text');
  assert.ok(isNewer('1.1', '1.0.9'));
  assert.ok(!isNewer('1.0.3', '1.0.3'));
  assert.ok(!isNewer('1.0.2', '1.0.3'));

  // Sha's phone: 1.0.1 (bridge 2), App Store giving out 1.0.3.
  assert.ok(updateAvailable('1.0.3', { version: 2 }));
  assert.ok(!updateAvailable('1.0.1', { version: 2 }), 'bridge 2 might be 1.0.2 already: never told to "update" to 1.0.1');
  assert.ok(!updateAvailable('1.0.2', { version: 2 }));
  assert.ok(!updateAvailable('1.0.3', { version: 3 }), 'up to date');
  assert.ok(!updateAvailable('1.0.1', { version: 3, app: '1.0.4' }), 'a TestFlight build ahead of the App Store');
  assert.ok(updateAvailable('1.0.5', { version: 3, app: '1.0.4' }));
  assert.ok(!updateAvailable('', { version: 2 }), 'until Apple says, nothing');
  assert.ok(!updateAvailable('1.0.3<b>', { version: 2 }));
  assert.ok(!updateAvailable('1.0.3', null), 'never in a browser');
});

test('a pinned number wins, and anything that is not a number is ignored', () => {
  const before = { id: process.env.KAIRO_APP_STORE_ID, off: process.env.KAIRO_APP_STORE_LOOKUP, version: process.env.KAIRO_APP_STORE_VERSION };
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
    assert.equal(appStoreVersion(), '', 'no version until Apple says one');
    process.env.KAIRO_APP_STORE_VERSION = '1.0.3';
    assert.equal(appStoreVersion(), '1.0.3');
    process.env.KAIRO_APP_STORE_VERSION = '1.0.3; drop';
    assert.equal(appStoreVersion(), '');
  } finally {
    for (const [k, v] of [['KAIRO_APP_STORE_ID', before.id], ['KAIRO_APP_STORE_LOOKUP', before.off], ['KAIRO_APP_STORE_VERSION', before.version]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

const servers = [];
after(async () => { for (const s of servers) await s.stop(); });

test('once the listing is known: the workspace offers the app, the booking page never does', async () => {
  const k = await startKairo({ env: { KAIRO_APP_STORE_ID: ID, KAIRO_APP_STORE_VERSION: '1.0.3' } });
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
  assert.equal(config.json.app_store_version, '1.0.3', 'so an older app on a phone offers the update');
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
  assert.equal(config.json.app_store_version, '');
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
