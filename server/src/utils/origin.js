import { escapeRegex } from './mongo.js';

/**
 * Builds a CORS `origin` callback from a list of allowed origins.
 * Entries may contain `*` wildcards, e.g. "https://*.vercel.app".
 * Requests without an Origin header (same-origin, curl, native apps) are allowed.
 */
export function createOriginMatcher(patterns) {
  const matchers = patterns.map(
    (pattern) => new RegExp(`^${pattern.split('*').map(escapeRegex).join('.*')}$`, 'i'),
  );
  return (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = matchers.some((re) => re.test(origin));
    return callback(null, allowed);
  };
}
