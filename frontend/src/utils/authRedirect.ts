const LOGIN_PATH = '/login'

/** Full navigation to login — reliable when JWT is expired or React Router is stuck on a protected URL. */
export function redirectToLogin() {
  const target = `${window.location.origin}${LOGIN_PATH}`
  if (window.location.pathname === LOGIN_PATH) {
    window.location.reload()
    return
  }
  window.location.replace(target)
}
