// Schema-based request-body validation: type checks, length limits, and
// rejection of unexpected fields. This is the outer gate; route handlers keep
// their own str()/clampInt sanitization as a second layer (defense in depth).
//
// Rule shapes:
//   { type:'string',  max, required, pattern }         accepts string|number → string
//   { type:'numeric', min, max, required }             accepts number|numeric string
//   { type:'boolean' }                                 accepts true/false only
//   { type:'enum',    values:[...], required }
//   { type:'object',  schema:{...}, required }         nested, same rules
//   { type:'array',   of:<rule>, maxItems, required }
import { httpError } from './util.js';

export function checkBody(body, schema, path = '') {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw httpError(400, `Expected a JSON object${path ? ` at ${path}` : ''}`);
  }
  for (const key of Object.keys(body)) {
    if (!(key in schema)) throw httpError(400, `Unexpected field: ${path}${key}`);
  }
  for (const [key, rule] of Object.entries(schema)) {
    const label = `${path}${key}`;
    const v = body[key];
    const missing = v === undefined || v === null || v === '';
    if (missing) {
      if (rule.required) throw httpError(400, `${label} is required`);
      continue;
    }
    checkValue(v, rule, label);
  }
  return body;
}

function checkValue(v, rule, label) {
  switch (rule.type) {
    case 'string': {
      if (typeof v !== 'string' && typeof v !== 'number') {
        throw httpError(400, `${label} must be text`);
      }
      const s = String(v);
      if (rule.max && s.length > rule.max) throw httpError(400, `${label} is too long (max ${rule.max} characters)`);
      if (rule.pattern && !rule.pattern.test(s)) throw httpError(400, `${label} has an invalid format`);
      return;
    }
    case 'numeric': {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
      if (!Number.isFinite(n)) throw httpError(400, `${label} must be a number`);
      if (rule.min !== undefined && n < rule.min) throw httpError(400, `${label} must be at least ${rule.min}`);
      if (rule.max !== undefined && n > rule.max) throw httpError(400, `${label} must be at most ${rule.max}`);
      return;
    }
    case 'boolean': {
      if (typeof v !== 'boolean') throw httpError(400, `${label} must be true or false`);
      return;
    }
    case 'enum': {
      if (!rule.values.includes(v)) throw httpError(400, `${label} must be one of: ${rule.values.join(', ')}`);
      return;
    }
    case 'object': {
      checkBody(v, rule.schema, `${label}.`);
      return;
    }
    case 'raw': {
      // Passed through untouched — the route validates this field itself
      // (e.g. a settings object checked key-by-key against an allowlist).
      return;
    }
    case 'array': {
      if (!Array.isArray(v)) throw httpError(400, `${label} must be a list`);
      if (rule.maxItems && v.length > rule.maxItems) throw httpError(400, `${label} has too many items (max ${rule.maxItems})`);
      v.forEach((item, i) => {
        if (rule.of.type === 'object') checkBody(item, rule.of.schema, `${label}[${i}].`);
        else checkValue(item, rule.of, `${label}[${i}]`);
      });
      return;
    }
    default:
      throw httpError(500, `Unknown validation rule for ${label}`);
  }
}

// Shorthand builders keep route schemas compact and readable.
export const s = {
  str: (max, opts = {}) => ({ type: 'string', max, ...opts }),
  num: (opts = {}) => ({ type: 'numeric', ...opts }),
  bool: () => ({ type: 'boolean' }),
  oneOf: (values, opts = {}) => ({ type: 'enum', values, ...opts }),
  obj: (schema, opts = {}) => ({ type: 'object', schema, ...opts }),
  arr: (of, maxItems, opts = {}) => ({ type: 'array', of, maxItems, ...opts }),
};
