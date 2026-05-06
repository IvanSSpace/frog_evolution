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
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp }
}
