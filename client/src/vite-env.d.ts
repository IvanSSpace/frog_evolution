/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Минимальная типизация Telegram WebApp SDK — только то, что используем.
interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
  notificationOccurred(type: 'error' | 'success' | 'warning'): void
  selectionChanged(): void
}

interface TelegramWebApp {
  initData: string
  // 'android' | 'android_x' | 'ios' | 'macos' | 'tdesktop' | 'weba' | 'webk' | 'unigram' | 'unknown'
  platform?: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
    }
  }
  HapticFeedback?: TelegramHapticFeedback
  ready(): void
  expand(): void
  enableClosingConfirmation?(): void
  disableVerticalSwipes?(): void
  setHeaderColor?(color: string): void
  setBackgroundColor?(color: string): void
  openLink?(url: string): void
  openTelegramLink?(url: string): void
  // Bot API 8.0+ — true fullscreen без header'а Telegram (только mobile).
  isFullscreen?: boolean
  requestFullscreen?(): void
  exitFullscreen?(): void
  // Bot API 8.0+ — lock orientation (portrait | landscape). Не работает на всех клиентах.
  lockOrientation?(orientation?: 'portrait' | 'landscape'): void
  unlockOrientation?(): void
  isOrientationLocked?: boolean
  onEvent?(eventType: string, handler: (...args: unknown[]) => void): void
  offEvent?(eventType: string, handler: (...args: unknown[]) => void): void
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp }
}
