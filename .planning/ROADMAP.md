# Roadmap — Frog Evolution: Локализация + Настройки

**4 phases** | **16 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Files |
|---|-------|------|--------------|-------|
| 1 | i18n Setup | Инфраструктура переводов и все строки в JSON | I18N-01–04, LANG-01–02 | `src/i18n/`, `src/i18n/index.ts`, `main.tsx` |
| 2 | Settings Modal | Полноэкранный модал с двумя вкладками и вкладка Настройки | UI-01–07 | `SettingsModal.tsx`, `BottomBar.tsx`, `gameStore.ts` |
| 3 | Bestiary | Вкладка с карточками лягушек (открытые/силуэты) | BEST-01–04 | `BestiaryTab.tsx` внутри SettingsModal |
| 4 | Number Format | Переключатель формата денег применяется везде | FMT-01–03 | `formatting.ts`, `gameStore.ts`, `Header.tsx` |

---

## Phase 1: i18n Setup

**Goal:** Установить react-i18next, создать переводы RU/EN/ES для всего UI и придумать имена лягушек на EN/ES.

**Requirements:** I18N-01, I18N-02, I18N-03, I18N-04, LANG-01, LANG-02

**Plans:**
1. Установить `react-i18next` и `i18next`, настроить `src/i18n/index.ts`
2. Создать `ru.json`, `en.json`, `es.json` — все UI строки + 24 имени лягушек
3. Подключить провайдер в `main.tsx`, добавить `useLang` hook с localStorage

**Success Criteria:**
1. `npm run build` проходит без ошибок после установки i18n
2. В `ru.json` есть все 24 имени лягушек
3. В `en.json` и `es.json` имена лягушек — осмысленные переводы, не транслитерация
4. `localStorage.getItem('frog_lang')` возвращает `'ru'` при первом запуске

**Status:** pending

---

## Phase 2: Settings Modal

**Goal:** Кнопка 📖 открывает полноэкранный модал, вкладка "Настройки" работает полностью.

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07

**Plans:**
1. Создать `SettingsModal.tsx` — полноэкранный, две вкладки (Бестиарий / Настройки)
2. Подключить 📖 в `BottomBar.tsx` и пробросить через `App.tsx`
3. Реализовать вкладку "Настройки": язык, музыка (заглушка), звуки (заглушка), формат денег, баг репорт

**Success Criteria:**
1. Клик по 📖 открывает модал
2. Переключение языка мгновенно меняет весь UI текст
3. Выбранный язык сохраняется после перезагрузки страницы
4. Кнопка баг репорт открывает Telegram в новой вкладке

**Status:** pending

---

## Phase 3: Bestiary

**Goal:** Вкладка "Бестиарий" показывает коллекцию лягушек с правильными силуэтами для неоткрытых.

**Requirements:** BEST-01, BEST-02, BEST-03, BEST-04

**Plans:**
1. Создать `BestiaryTab.tsx` — сетка карточек всех 24 лягушек
2. Открытые лягушки (`discoveredLevels`): имя (i18n), локация, доход/сек, размер
3. Неоткрытые: CSS `grayscale(1) blur(2px)` + "???" вместо имени, заблокированные данные

**Success Criteria:**
1. Все 24 лягушки отображаются в бестиарии
2. Неоткрытые — серые силуэты без имени
3. Имена лягушек меняются при смене языка
4. Данные (доход/сек) берутся из `TARGET_INCOME_PER_SEC` в `frogs.ts`

**Status:** pending

---

## Phase 4: Number Format

**Goal:** Настройка формата денег применяется во всём приложении.

**Requirements:** FMT-01, FMT-02, FMT-03

**Plans:**
1. Добавить `numberFormat: 'short' | 'full'` в gameStore + localStorage
2. Обновить `formatting.ts` — поддержать оба формата
3. Убедиться что Header, магазин, бестиарий используют store-формат

**Success Criteria:**
1. Переключение в настройках мгновенно меняет формат везде
2. "Короткий": `1.5K`, `2.3M`, `1.1B`
3. "Полный": `1,500`, `2,300,000`, `1,100,000,000`
4. Формат сохраняется после перезагрузки

**Status:** pending
