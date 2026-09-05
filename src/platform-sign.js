// How the platform proves a control request is really from the platform.
//
// Its own file, with no imports but node:crypto, because both sides need it:
// the shard (src/platform.js) to check a signature, and the platform
// (platform/shard.js) to make one. Sharing it through either of those would
// drag that side's whole module graph into the other process.
import crypto from 'node:crypto';

/** The moment, the verb, the path, and the exact bytes of the body. */
export const signingString = (t, method, path, rawBody) =>
  `${t}.${String(method).toUpperCase()}.${path}.${rawBody || ''}`;

export const sign = (t, method, path, rawBody, secret) =>
  crypto.createHmac('sha256', secret).update(signingString(t, method, path, rawBody)).digest('hex');
