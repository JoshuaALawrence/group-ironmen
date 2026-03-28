import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let SECRET: string;
try {
  SECRET = fs.readFileSync(path.join(__dirname, '..', '..', 'secret'), 'utf8');
} catch {
  SECRET = process.env.BACKEND_SECRET || '';
}

/**
 * Blake2s-256 hash matching the Rust server's algorithm:
 * Hash value `iterations` times, then append salt and secret.
 */
export function hash(value: string, salt: string, iterations: number): Buffer {
  const h = crypto.createHash('blake2s256');
  const v = Buffer.from(value, 'utf8');
  for (let i = 0; i < iterations; i++) {
    h.update(v);
  }
  h.update(Buffer.from(salt, 'utf8'));
  h.update(Buffer.from(SECRET, 'utf8'));
  return h.digest();
}

export function tokenHash(token: string, salt: string): string {
  const hashed = hash(token, salt, 2);
  return hashed.toString('hex');
}
