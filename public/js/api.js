// Thin fetch wrapper for the Kairo API.

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  // Read as text first, then parse. Going straight to res.json() and swallowing
  // the failure returns null on a 200 whose body was cut off — a connection
  // dropped, a navigation mid-flight — and null then travels into whichever
  // caller asked, where it surfaces as "cannot read properties of null" a long
  // way from the thing that actually went wrong. An empty body is a real
  // answer for a 204; a body that arrived and would not parse is a failure and
  // should say so here, once, where the cause is still visible.
  const text = await res.text().catch(() => '');
  let data = null;
  let unreadable = false;
  if (text) {
    try { data = JSON.parse(text); } catch { unreadable = true; }
  }

  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data);
  if (unreadable) throw new ApiError(res.status, 'The server\'s reply was cut short — please try again.', null);
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};
