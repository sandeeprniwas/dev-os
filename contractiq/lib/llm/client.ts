import 'server-only'
import { getEnv } from '@/lib/env'
import { sha256Hex } from '@/lib/utils/hash'

/** Opaque, salted user identifier (no PII leaves the server); also scopes the Azure agent's Memory per user. */
export function hashUserId(userId: string): string {
  return sha256Hex(getEnv().USER_ID_HASH_SALT + userId)
}
