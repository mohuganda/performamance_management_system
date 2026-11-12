/**
 * User-scoped cache utility for PWA.
 * Ensures strict cache isolation between different user accounts on shared browsers.
 */

const LEGACY_STORAGE_KEYS = [
  'moh-pms-attendance-cache',
  'moh-pms-approvals-inbox',
  'moh-pms-approvals-stats',
  'moh-pms-leave-types',
  'moh-pms-leave-balances',
  'moh-pms-leave-requests',
  'moh-pms-oos-reasons',
  'moh-pms-oos-requests',
];

/**
 * Returns a user-scoped storage key: moh-pms:u{userId}:{resource}
 * Returns null if no userId is provided (prevents unauthenticated writes).
 */
export function getUserCacheKey(
  resource: string,
  userId?: number | string | null
): string | null {
  if (userId === undefined || userId === null || userId === '') {
    return null;
  }
  return `moh-pms:u${userId}:${resource}`;
}

/**
 * Safely reads cached JSON data for a specific user.
 */
export function getUserCache<T>(
  resource: string,
  userId?: number | string | null
): T | undefined {
  if (typeof window === 'undefined') return undefined;
  const key = getUserCacheKey(resource, userId);
  if (!key) return undefined;

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch (err) {
    console.warn(`[userCache] Failed to parse cache for key ${key}:`, err);
    return undefined;
  }
}

/**
 * Safely persists JSON data for a specific user.
 */
export function setUserCache<T>(
  resource: string,
  userId: number | string | null | undefined,
  data: T
): void {
  if (typeof window === 'undefined') return;
  const key = getUserCacheKey(resource, userId);
  if (!key) return;

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[userCache] Failed to set cache for key ${key}:`, err);
  }
}

/**
 * Completely clears all cache keys belonging to a specific user,
 * as well as any legacy un-namespaced keys.
 */
export function clearUserCache(userId?: number | string | null): void {
  if (typeof window === 'undefined') return;

  // 1. Remove all legacy un-namespaced keys
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    try {
      localStorage.removeItem(legacyKey);
    } catch {
      // ignore
    }
  }

  // 2. Remove user-specific keys if userId is known, or all moh-pms:u* keys if no userId
  const prefix = userId ? `moh-pms:u${userId}:` : 'moh-pms:u';
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/**
 * Purges ALL user caches across all users on this browser.
 */
export function clearAllUserCaches(): void {
  clearUserCache(null);
}
