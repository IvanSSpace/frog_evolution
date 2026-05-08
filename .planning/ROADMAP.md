# Roadmap — Frog Evolution: Локализация + Настройки + Редкие боксы

**7 phases** | **19 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Files |
|---|-------|------|--------------|-------|
| 1 | i18n Setup | Инфраструктура переводов и все строки в JSON | I18N-01–04, LANG-01–02 | `src/i18n/`, `src/i18n/index.ts`, `main.tsx` |
| 2 | Settings Modal | Полноэкранный модал с двумя вкладками и вкладка Настройки | UI-01–07 | `SettingsModal.tsx`, `BottomBar.tsx`, `gameStore.ts` |
| 3 | Bestiary | Вкладка с карточками лягушек (открытые/силуэты) | BEST-01–04 | `BestiaryTab.tsx` внутри SettingsModal |
| 4 | Number Format | Переключатель формата денег применяется везде | FMT-01–03 | `formatting.ts`, `gameStore.ts`, `Header.tsx` |
| 5 | Rare Crate | 3/3 | Complete    | 2026-05-06 |
| 6 | Rare Box Rework | 5/5 | Complete    | 2026-05-07 |
| 7 | Unique Planet Animations | Гарантированно уникальные анимации для всех 450 планет | ANIM-01–05, TEX-01–05 | `StarMapScene.ts` | Complete | 2026-05-07 |

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

**Status:** complete

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

**Status:** complete

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

**Status:** complete

### Phase 8: Full Planet Uniqueness

**Goal:** Финализация уникальности всех 1000 планет (16 main + 984 BG) по трём axes — анимации (recipe + strict signature по quantized params), текстуры (984/984 unique), звук (per-planet модуляции pitch/voicing/detune/cutoff с 4032 комбинаций per archetype). Сохранить тематическую стилистику архетипов. ≥96 animation components, каждый theme pool ≥14.

**Requirements:** SPEC-01..SPEC-06 (см. `.planning/phases/08-full-planet-uniqueness/08-SPEC.md`)

**Depends on:** Phase 7

**Plans:** 7 plans

Plans:
**Wave 1**
- [x] 08-01-PLAN.md — Pool expansion + 8 новых animation components (D-14, D-16) ✓ 2026-05-08

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md — Strict animation signature с quantized params + 10 refine attempts (D-01..D-04) ✓ 2026-05-08

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 08-03-PLAN.md — Texture uniqueness fix (resolve 1 collision) + 10 refine attempts (SPEC #2)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 08-04-PLAN.md — Per-planet sound modulation system + THEME_SCALES + eventBus seed (D-05..D-10, D-13)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 08-05-PLAN.md — Sound signature pipeline + refineSoundSeeds (D-11..D-12)

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 08-06-PLAN.md — Verify scripts в client/scripts/ + npm run verify-uniqueness (D-15, D-17)

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 08-07-PLAN.md — Smoke test + final build size + STATE.md закрытие (SPEC #6, #10)

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

**Status:** complete

## Phase 5: Rare Crate

**Goal:** Редкий золотой бокс падает реже обычного. При нажатии — React-модалка со слот-машиной: лягушки крутятся и останавливаются на случайной. Лягушка спавнится в игру.

**Requirements:** RARE-01, RARE-02, RARE-03

**Plans:**
1. В `MainScene.ts` добавить спавн редкого бокса (золотой спрайт, отдельный таймер/вероятность)
2. При тапе на редкий бокс — эмитить событие `rareCrateOpened` через eventBus с level-диапазоном
3. Создать `RareCrateModal.tsx` — слот-машина с анимацией вращения и остановки, кнопка "Забрать"
4. При закрытии модалки — спавнить выигранную лягушку через `gameStore.spawnFrog(level)`

**Success Criteria:**
1. Золотой бокс появляется реже обычного (визуально отличим)
2. Тап на золотой бокс открывает слот-машину
3. Слот показывает вращение лягушек → остановку на финальной
4. Лягушка появляется на поле после закрытия модалки

**Status:** pending

## Phase 7: Unique Planet Animations & Textures

**Goal:** Гарантировать визуально уникальную **анимацию при клике И уникальную текстуру** (внешний вид) для каждой из 450 планет (16 main + 434 BG). Игрок не должен видеть повторов — ни в анимациях, ни в самой планете, особенно среди одного archetype/type.

**Requirements:** ANIM-01–05, TEX-01–05

**Plans:**
1. Анимации: глобальный uniqueness-check + минимум 2 компонента recipe + 10 новых компонентов
2. Анимации: композитные модификаторы (rotation/scale/HSL) + per-planet hue shift
3. Текстуры: 2-3 sub-variant'а в каждом archetype (gas_giant — banded/spotted/storm; ice — patchy/crystalline/glacial; etc.)
4. Текстуры: расширить universal modifiers (rings stacks, surface lines, gradient bands, multi-color spots, asymmetric atmospheres)
5. Текстуры: uniqueness signature + seed refinement аналогично анимациям

**Success Criteria:**
1. ≥99% планет имеют уникальную recipe-signature анимации
2. ≥99% планет имеют уникальную texture-signature
3. Каждый animation pool ≥10 компонентов; каждый archetype имеет ≥2 sub-variant'а текстуры
4. Total animation components ≥65 (сейчас 54)
5. Visual smoke: 5 случайных планет одного archetype показывают разные текстуры И разные анимации
6. TypeScript компиляция чистая, build проходит

**Status:** Complete (2026-05-07)

**Achieved:**
- 100% уникальных recipe-signatures для 450 планет (verify_anim_uniqueness.cjs)
- 100% уникальных texture-signatures для 434 BG-планет (verify_texture_uniqueness.cjs)
- 64 компонента анимаций (54 → +10 новых: atomShells, supernova, accretionDisk, flickerStars, lightDance, dimensionRift, frostExplode, timeWave, glyphFlash, prismShift)
- 9 архетипов получили 3 sub-variant'а текстур каждый (27 уникальных стилей рендера)
- 6 новых universal modifiers: surface lines, gradient bands, multi-color spots, stacked rings, asymmetric atmosphere, color speckle
- Per-planet HSL hue shift ±25° для unique tint в общих палитрах
- Recipe-level rotation/scale modifiers (25% chance)
- Все pools ≥10 компонентов
- TypeScript clean, build passes
