# Server — Frog Evolution

## О проекте
Серверная часть Frog Evolution — Telegram Mini App, idle merge-clicker.
REST API для авторизации через Telegram и синхронизации игрового состояния.

## Стек
- Fastify — веб фреймворк
- TypeScript + ts-node
- Prisma — ORM
- PostgreSQL — база данных
- node-telegram-bot-api — Telegram Bot API
- nodemon — hot reload

## Структура
- src/ — исходный код
  - plugins/auth.ts — JWT auth + dev-режим без бота
  - services/telegram.ts — валидация initData по HMAC-SHA256
  - routes/ — auth, users, gameState
  - bot.ts — Telegram-бот с кнопкой WebApp
- prisma/schema.prisma — User + GameState (1:1)

## Модель данных
- User: telegramId, username, firstName, lastName, photoUrl
- GameState: gold (BigInt), upgrades (JSON), frogPurchases (JSON),
  discoveredLevels (JSON), magnetEnabled, lastSessionAt

## Эндпоинты
- POST /auth/telegram — обмен initData на JWT
- GET /users/me — профиль
- GET /game/state — загрузить состояние игры
- PUT /game/state — сохранить состояние игры (полная замена)
- GET /health — health check
- POST /telegram/webhook — webhook от Telegram

## Команды
- npm run dev — локальный запуск с hot reload
- npm run build — компиляция TypeScript
- npm run start — запуск скомпилированного сервера
- npm run prisma:add-migration [name] — создать миграцию
- npm run prisma:generate — сгенерировать Prisma клиент
- npm run local:db — поднять локальный Postgres через Docker

## Dev-режим
Если `TELEGRAM_BOT_TOKEN` пустой и `NODE_ENV !== production`:
- Бот не стартует
- Auth-плагин автоматически подставляет dev-юзера (telegramId='dev')
- validateInitData принимает мок-данные

## Telegram интеграция
1. Клиент получает `Telegram.WebApp.initData` из SDK
2. POST /auth/telegram { initData } → { token, user }
3. Все последующие запросы с заголовком `Authorization: Bearer <token>`
4. Сервер валидирует initData через HMAC-SHA256 с botToken (по доке Telegram)
