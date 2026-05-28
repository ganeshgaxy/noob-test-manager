import { randomBytes, createHash } from 'crypto'

/** Generate a cryptographically random hex token of the given byte length. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

/** SHA-256 hash a token for safe storage. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Returns an ISO datetime string N days from now. */
export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

/** Returns an ISO datetime string N minutes from now. */
export function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

/** Returns true if an ISO datetime string is in the past. */
export function isExpired(isoString: string): boolean {
  return new Date(isoString) < new Date()
}
