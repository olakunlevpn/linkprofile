import { posix } from 'node:path';

// Both arguments are paths relative to dist/. A trailing slash and a #hash on the target are kept.
export function relativeHref(fromFile, toPath) {
  const hashAt = toPath.indexOf('#');
  const target = hashAt === -1 ? toPath : toPath.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : toPath.slice(hashAt);
  const trailing = target.endsWith('/') ? '/' : '';
  const rel = posix.relative(posix.dirname(fromFile), target) || '.';
  return (rel === '.' && trailing ? './' : rel + trailing) + hash;
}
