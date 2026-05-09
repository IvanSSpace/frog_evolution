// Dev-only console logging helpers.
//
// `devLog` / `devWarn` / `devInfo` / `devDebug` are no-op in production builds.
// Use them instead of `console.*` for diagnostic logs that should not appear
// in the user's Telegram WebView console (or polluting bundle output).
//
// `console.error` should still be used directly — those are real errors that
// need to surface even in production.

const IS_DEV = import.meta.env.DEV

/* eslint-disable no-console */

export const devLog: typeof console.log = IS_DEV
  ? console.log.bind(console)
  : ((() => {}) as typeof console.log)

export const devWarn: typeof console.warn = IS_DEV
  ? console.warn.bind(console)
  : ((() => {}) as typeof console.warn)

export const devInfo: typeof console.info = IS_DEV
  ? console.info.bind(console)
  : ((() => {}) as typeof console.info)

export const devDebug: typeof console.debug = IS_DEV
  ? console.debug.bind(console)
  : ((() => {}) as typeof console.debug)

/* eslint-enable no-console */
