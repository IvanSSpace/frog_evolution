// Хелперы Telegram WebApp SDK. Все методы безопасны вне Telegram —
// просто становятся no-op (полезно в браузерном dev-режиме).

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? ''
}

export function isInsideTelegram(): boolean {
  return Boolean(getInitData())
}

// Dev-режим: запущены в браузере без Telegram (на проде initData всегда есть).
export function isDevMode(): boolean {
  return import.meta.env.DEV && !isInsideTelegram()
}

// Инициализация SDK. Зовём один раз при старте приложения.
export function initTelegram(): void {
  const tg = getTelegramWebApp()
  if (!tg) return
  tg.ready()
  tg.expand()
  tg.disableVerticalSwipes?.()
  tg.setHeaderColor?.('#1a2e1a')
  tg.setBackgroundColor?.('#1a2e1a')
}

// ============== HAPTIC FEEDBACK ==============

export function hapticImpact(
  style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light',
): void {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred(style)
}

export function hapticNotification(
  type: 'error' | 'success' | 'warning',
): void {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type)
}

export function hapticSelection(): void {
  getTelegramWebApp()?.HapticFeedback?.selectionChanged()
}
