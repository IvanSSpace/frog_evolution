# Frog Evolution — Локализация + Панель настроек

## What This Is

Добавление мультиязычности (RU/EN/ES) и полноэкранной панели настроек с бестиарием в Telegram Mini App "Frog Evolution" — idle merge-clicker на Phaser + React.

## Context

- **Проект:** Telegram Mini App, игра уже работает локально
- **Стек клиента:** React + Vite + TypeScript + Phaser + Zustand + TailwindCSS
- **Стек сервера:** Fastify + Prisma + PostgreSQL (не затрагивается в этом милстоне)
- **Кнопка 📖:** уже существует в BottomBar.tsx, пока ни к чему не подключена (badge "!")
- **Лягушки:** 24 уровня, 4 локации (Болото/Лес/Земля/Космос), данные в `client/src/game/config/frogs.ts`

## Core Value

Игрок может читать интерфейс на своём языке и видеть коллекцию открытых лягушек.

## Requirements

### Validated (уже есть в коде)
- ✓ 24 вида лягушек с именами, доходом/сек, размером — в `frogs.ts`
- ✓ `discoveredLevels` в GameState — отслеживает открытые лягушки
- ✓ BottomBar с кнопкой 📖 — готова к подключению
- ✓ Formatting utils в `utils/formatting.ts`

### Active
- [ ] i18n: поддержка RU (дефолт), EN, ES
- [ ] Имена лягушек переведены на EN/ES по смыслу (не транслитерация)
- [ ] Весь UI текст переведён через react-i18next
- [ ] Язык сохраняется в localStorage, дефолт RU
- [ ] 📖 открывает полноэкранный модал с двумя вкладками
- [ ] Вкладка "Бестиарий": карточки лягушек (только открытые + силуэты с ???)
- [ ] Вкладка "Настройки": смена языка, заглушки музыки/звуков, формат денег, баг репорт
- [ ] Баг репорт: кнопка открывает t.me/[username] (placeholder для замены)
- [ ] Формат денег: переключатель "короткий (1.5K) / полный (1,500)"

### Out of Scope
- Серверное хранение языка — язык только в localStorage
- Telegram auto-detect языка — всегда дефолт RU
- Реальная музыка/звуки — только UI-заглушки (toggle без функции)
- Backend изменения — этот милстон только клиент

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| react-i18next | Стандарт для React i18n, хорошо поддерживается | Используем |
| Языковые файлы JSON | Простой формат, легко поддерживать | `client/src/i18n/{ru,en,es}.json` |
| Хранение в localStorage | Нет нужды синхронизировать язык с сервером | localStorage key `frog_lang` |
| Заблокированные лягушки = силуэт + ??? | Мотивирует исследовать, не спойлерит | CSS filter + placeholder текст |
| Полноэкранный модал | Единый UI-паттерн как FrogShopModal | Новый компонент SettingsModal.tsx |

---
*Last updated: 2026-05-06 after initialization*
