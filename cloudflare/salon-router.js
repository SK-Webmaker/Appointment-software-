/**
 * The front door: every salon's address, forwarded to one Kairo shard.
 *
 * Why this exists. Render will only answer for a hostname it has been told
 * about, and the plan caps how many. A wildcard custom domain is supposed to
 * solve that; on this account it verifies, issues a certificate, and then
 * never routes — Render's own edge answers Cloudflare Error 1000, because a
 * salon's hostname resolves to an IP that is itself behind Cloudflare.
 *
 * So the shard stops being addressed by the salon's name at all. Every request
 * is forwarded to the shard's own `onrender.com` address, which Render always
 * answers for, and the salon's real hostname travels in a header instead.
 *
 * That header decides whose client list is served, so it is only believed when
 * it arrives with a secret this Worker holds and nobody else does. Without the
 * secret the shard ignores it completely — see `effectiveHost` in
 * src/tenant.js, and the tests in test/tenants.test.js that try to walk from
 * one salon into another.
 *
 * Deploy: Cloudflare → Workers → create → paste this → add the two secrets
 * below → add a route `*.kairobookings.com/*` on the zone.
 *
 * Secrets (Worker → Settings → Variables):
 *   SHARD_ORIGIN     https://kairo-shard-au.onrender.com
 *   FORWARD_SECRET   the same value as KAIRO_FORWARD_SECRET on the shard
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The salon is the hostname the visitor typed. Everything else about the
    // request is passed through untouched.
    const salonHost = url.hostname;
    const origin = new URL(env.SHARD_ORIGIN);
    url.protocol = origin.protocol;
    url.hostname = origin.hostname;
    url.port = origin.port;

    const headers = new Headers(request.headers);
    // Render matches this to decide the service; the shard ignores it and
    // reads the two below instead.
    headers.set('host', origin.hostname);
    headers.set('x-kairo-host', salonHost);
    headers.set('x-kairo-forward-secret', env.FORWARD_SECRET);
    // A visitor could send these themselves. Overwriting rather than appending
    // is what stops that being a way into somebody else's salon.

    const upstream = new Request(url.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });

    return fetch(upstream);
  },
};
