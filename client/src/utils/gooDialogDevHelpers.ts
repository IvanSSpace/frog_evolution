// DEV-хелпер для онбординг-диалога GooDialog. Подключается в App.tsx через
// `if (import.meta.env.DEV) installGooDialogDevHelpers()`.
//
// __gooDialog(text?, title?) — показать диалог с персонажем goo_collector.

import { eventBus } from '../store/eventBus'

declare global {
  interface Window {
    __gooDialog: (text?: string, title?: string) => string
  }
}

export function installGooDialogDevHelpers(): void {
  window.__gooDialog = (text?: string, title?: string): string => {
    eventBus.emit('goo:dialog', {
      text:
        text ??
        'Привет! Я собираю слизь по всему полю. Тапни по боксу — и я прилечу!',
      title: title ?? 'Сборщик слизи',
    })
    return 'shown'
  }
  console.log('[goo-dev] helper installed: __gooDialog(text?, title?)')
}
