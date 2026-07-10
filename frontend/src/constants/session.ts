/** Idle time before showing the session warning (ms). */
export const SESSION_IDLE_MS = 30 * 60 * 1000

/** How long the user has to respond before automatic logout (ms). */
export const SESSION_WARNING_MS = 2 * 60 * 1000

/** Warn when the JWT expires within this window (ms). */
export const SESSION_TOKEN_WARN_BEFORE_MS = 5 * 60 * 1000

/** How often to check token expiry while signed in (ms). */
export const SESSION_EXPIRY_CHECK_MS = 30 * 1000
