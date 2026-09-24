import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(24);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, cost, salt, expected] = stored.split('$');
    if (scheme !== 'scrypt' || cost !== '16384') return false;
    const target = Buffer.from(expected, 'base64url');
    const actual = scryptSync(password, Buffer.from(salt, 'base64url'), target.length, { N: 16384, r: 8, p: 1 });
    return target.length === actual.length && timingSafeEqual(target, actual);
  } catch {
    return false;
  }
}

export function randomToken() { return randomBytes(32).toString('base64url'); }
export function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }

export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? [] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(pair => pair.length === 2));
}

export function sessionCookie(token, secure) {
  return `bvl_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(secure) {
  return `bvl_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 256;
}
