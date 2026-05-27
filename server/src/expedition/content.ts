import type { Scenario } from './types'

// ──────────────────────────────────────────────────────────────────────────
// Cosmo-setting content for the ship's journal. Voice: a lone frog pilot
// narrating into the log, Fallout-Shelter-explorer style — terse structured
// lines ("Найдено место: ...") mixed with first-person chatter and diary beats.
//
// Slots {galaxy}/{planet}/... fill from DICT (nominative — keep declension
// safe). {slime}/{gold} fill with the real loot the beat grants.
//
// Continuity via tags:
//   set:   mood this beat leaves behind (decays over ~3 beats)
//   needs: reaction beat — only fires while that mood is recent
// So a fight (set: combat) gets "played out" by aftermath beats (needs: combat).
//
// Add freely. More entries = richer journals. Keep lines SHORT.
// ──────────────────────────────────────────────────────────────────────────

export const DICT = {
  galaxy: [
    'Мерсено',
    'Тихоокеанская Спираль',
    'Велаам',
    'Скопление Орзо',
    'Гало Кетцаль',
    'Туманность Соляриса',
    'Дрейф Угасших',
    'Корона Иблиса',
    'Спираль Тины',
    'Холодный Брод',
    'Звёздная Заводь',
    'Око Левиафана',
    'Янтарный Вихрь',
    'Скопление Тысячи Глаз',
    'Млечная Трясина',
    'Перекрёсток Сабаль',
    'Угли Тагора',
    'Призрачная Дуга',
  ],
  arm: [
    'Внешний рукав',
    'рукав Стрельца',
    'Тёмный рукав',
    'рукав Персея',
    'Спиральный отрог',
    'Жёлтый рукав',
    'Рваный край галактики',
    'Сумеречный пояс',
  ],
  planet: [
    'Глизе-4',
    'Кварц-Прайм',
    'Болотный Двойник',
    'Серая Сфера',
    'Иссушённая VII',
    'Линза',
    'Кисельный Гигант',
    'Аметист',
    'Тинистая-9',
    'Голодная Луна',
    'Стеклянный Шар',
    'Ржавая Терра',
    'Близнецы Ка и Ро',
    'Утопия-13',
    'Соляная Капля',
    'Тёмная Жемчужина',
    'Лазурный Окоём',
    'Грибная Пустошь',
  ],
  star: [
    'красный карлик',
    'белый гигант',
    'погасший пульсар',
    'двойная звезда',
    'голубой сверхгигант',
    'умирающий квазар',
    'оранжевое солнце-старик',
    'нейтронная искра',
    'жёлтый карлик с пятнами',
  ],
  anomaly: [
    'гравитационная воронка',
    'космический мираж',
    'червоточина',
    'зеркальное эхо',
    'поле антивещества',
    'разлом времени',
    'слизевое облако',
    'тёмное пятно на карте',
    'петля пространства',
    'магнитная буря',
    'облако светящейся пыли',
    'застывшая ударная волна',
    'эхо чужого сигнала',
  ],
  phenomenon: [
    'двойная вспышка',
    'дождь из микрокомет',
    'полярное сияние на обшивке',
    'тишина радиодиапазона',
    'пульсация маяка',
    'дрейф ледяных глыб',
    'медленный звёздный ветер',
    'хоровод падающих звёзд',
    'зелёное мерцание на горизонте',
    'волна тепла от близкой звезды',
    'россыпь алмазной пыли',
    'долгий низкий гул в эфире',
  ],
  creature: [
    'стая кремниевых скатов',
    'одинокий планктонный кит',
    'рой зондов неизвестной расы',
    'светящийся головастик-исполин',
    'кочующая колония спор',
    'хор медуз-биолюминофоров',
    'космическая черепаха с садом на панцире',
    'стеклянная стрекоза размером с шаттл',
    'клубок звёздных червей',
    'одинокий бледный угорь',
    'выводок пыльных мотыльков',
    'дремлющий каменный полип',
  ],
  faction: [
    'торговцы Велаама',
    'молчаливые сборщики',
    'патруль Короны',
    'старатели-отшельники',
    'паломники Угасших',
    'контрабандисты слизи',
    'картографы-кочевники',
    'сборщики долгов из Орзо',
    'монахи пустого эфира',
    'весёлые мусорщики',
    'дрейфующий цирк-караван',
  ],
  place: [
    'дрейфующий контейнер',
    'спасательная капсула',
    'заброшенная станция',
    'кристаллический риф',
    'обломок крейсера',
    'запертый грузовой модуль',
    'старый буй',
    'затонувший в пыли купол',
    'разбитый зонд-разведчик',
    'покинутая орбитальная ферма',
    'сейф в куске метеорита',
    'древний саркофаг-капсула',
    'торговый понтон без команды',
    'башня старого маяка',
  ],
  adj: [
    'странн',
    'тих',
    'мерцающ',
    'покинут',
    'древн',
    'безымянн',
    'ржав',
    'промёрзш',
    'пыльн',
    'молчалив',
    'выжженн',
    'дремлющ',
  ],
}

export type DictKey = keyof typeof DICT

// ── Departure: always the first beat. ──
export const DEPARTURE: Scenario[] = [
  {
    id: 'departure_standard',
    category: 'departure',
    weight: 3,
    lines: [
      { dt: 0, text: 'Вылетаю с орбиты. Двигатели в норме.' },
      { dt: 3, text: 'Идентифицирована галактика {galaxy}.' },
      { dt: 6, text: 'Вхожу в {arm}. Связь с базой стабильна.' },
    ],
  },
  {
    id: 'departure_eager',
    category: 'departure',
    weight: 2,
    lines: [
      { dt: 0, text: 'Отстыковка прошла. Ну, поехали.' },
      { dt: 2, text: 'Курс — {galaxy}. Трюм пустой, лапы чешутся.' },
      { dt: 5, text: 'Кофе в тюбике, музыка в наушниках. Хороший день.' },
    ],
  },
  {
    id: 'departure_groggy',
    category: 'departure',
    weight: 1,
    lines: [
      { dt: 0, text: 'Поднимаюсь с орбиты. Не выспался, но полетели.' },
      { dt: 3, text: 'Навигатор предлагает {galaxy}. Спорить не буду.' },
    ],
  },
  {
    id: 'departure_quiet',
    category: 'departure',
    weight: 2,
    lines: [
      { dt: 0, text: 'Шлюз закрыт. Тишина. Только гул двигателей.' },
      { dt: 3, text: 'Беру курс на {galaxy}. Поехали искать приключения.' },
    ],
  },
  {
    id: 'departure_veteran',
    category: 'departure',
    weight: 1,
    lines: [
      { dt: 0, text: 'Сотый вылет. А сердце всё равно колотится.' },
      { dt: 3, text: 'Цель — {arm}. Старый конь борозды не испортит.' },
    ],
  },
]

// ── Mid-flight pool. ──
export const SCENARIOS: Scenario[] = [
  // ─────────────── navigation / chatter (filler, keeps tempo) ───────────────
  { id: 'nav_1', category: 'travel', weight: 7, lines: [{ dt: 0, text: 'Наверное, пройду ещё в эту сторону.' }] },
  { id: 'nav_2', category: 'travel', weight: 7, lines: [{ dt: 0, text: 'Курс скорректирован. Иду дальше.' }] },
  { id: 'nav_3', category: 'travel', weight: 6, lines: [{ dt: 0, text: 'Обойду {anomaly} стороной. Целее буду.' }] },
  { id: 'nav_4', category: 'travel', weight: 6, lines: [{ dt: 0, text: 'Заложу петлю вокруг звезды — {star}. Красиво.' }] },
  { id: 'nav_5', category: 'travel', weight: 6, lines: [{ dt: 0, text: 'Сверюсь со звёздами. Вроде не заблудился.' }] },
  { id: 'nav_6', category: 'travel', weight: 5, lines: [{ dt: 0, text: 'Пойду-ка вон туда, к тому скоплению.' }] },
  { id: 'nav_7', category: 'travel', weight: 5, lines: [{ dt: 0, text: 'Заберусь повыше над плоскостью галактики, осмотрюсь.' }] },
  { id: 'nav_8', category: 'travel', weight: 5, lines: [{ dt: 0, text: 'Лучше пройти сквозь этот пылевой коридор.' }] },
  { id: 'mundane_tea', category: 'mundane', weight: 6, lines: [{ dt: 0, text: 'Ничего нового. Пишу в дневник, пью чай из тюбика.' }] },
  { id: 'mundane_repair', category: 'mundane', weight: 5, lines: [
    { dt: 0, text: 'Мелкая поломка в системе охлаждения. Чиню.' },
    { dt: 4, text: 'Готово. Потерял минуту, ничего страшного.' },
  ] },
  { id: 'mundane_music', category: 'mundane', weight: 4, lines: [{ dt: 0, text: 'Кручу любимую кассету. Под неё и лететь веселее.' }] },
  { id: 'mundane_snack', category: 'mundane', weight: 4, lines: [{ dt: 0, text: 'Перекус: сушёные мухи. Запас тает быстрее карты.' }] },
  { id: 'mundane_stretch', category: 'mundane', weight: 4, lines: [{ dt: 0, text: 'Размял лапы у иллюминатора. Затекли от долгого сидения.' }] },
  { id: 'mundane_check', category: 'mundane', weight: 5, lines: [{ dt: 0, text: 'Прогнал диагностику. Все системы зелёные.' }] },

  // ─────────────── discovery ───────────────
  {
    id: 'mirage_planets',
    category: 'discovery',
    weight: 5,
    set: ['weird'],
    lines: [
      { dt: 0, text: 'На радаре чисто, но визуально вижу планету. Странно.' },
      { dt: 3, text: 'Рядом ещё несколько таких же. Подлетаю ближе.' },
      { dt: 7, text: 'Это {anomaly} — планеты растворились. Записал координаты.' },
    ],
  },
  {
    id: 'dead_planet',
    category: 'discovery',
    weight: 5,
    minSec: 60,
    set: ['lonely'],
    lines: [
      { dt: 0, text: 'Вышел к планете {planet}. {adj}ое место.' },
      { dt: 4, text: 'Жизни нет. Сканеры ловят только ветер и пыль.' },
    ],
  },
  {
    id: 'gas_giant',
    category: 'discovery',
    weight: 4,
    lines: [
      { dt: 0, text: 'Передо мной газовый гигант. Огромный, как страх.' },
      { dt: 3, text: 'Внутри — пусто. Жизни в таких не бывает. Лечу мимо.' },
    ],
  },
  {
    id: 'beacon',
    category: 'discovery',
    weight: 4,
    set: ['weird'],
    lines: [
      { dt: 0, text: 'Поймал сигнал маяка. Очень старый код.' },
      { dt: 4, text: 'Маяк ведёт в пустоту. Кто-то не хотел, чтобы сюда летели.' },
    ],
  },
  {
    id: 'twin_suns',
    category: 'discovery',
    weight: 4,
    lines: [{ dt: 0, text: 'Прошёл систему с двумя солнцами. Тени двоятся, голова кругом.' }],
  },
  {
    id: 'ring_planet',
    category: 'discovery',
    weight: 3,
    lines: [
      { dt: 0, text: 'Планета {planet} с кольцами. Кольца — изо льда и чего-то зелёного.' },
      { dt: 4, text: 'Зелёное — слизь. Откуда она в кольцах? Загадка.' },
    ],
  },
  {
    id: 'comet',
    category: 'discovery',
    weight: 4,
    lines: [{ dt: 0, text: 'Догнал комету. Хвост тянется на пол-системы. Сделал снимок.' }],
  },
  {
    id: 'derelict_seen',
    category: 'discovery',
    weight: 4,
    minSec: 90,
    set: ['wreck'],
    lines: [
      { dt: 0, text: 'Найдено место: {place}.' },
      { dt: 4, text: 'Кажется, там что-то было... Подхожу аккуратно.' },
    ],
  },

  // ─────────────── "locked safe" loop (FS classic): find → try → maybe fail ──
  {
    id: 'locked_fail',
    category: 'lore',
    weight: 3,
    minSec: 90,
    needs: 'wreck',
    lines: [
      { dt: 0, text: 'Пытаюсь вскрыть замок.' },
      { dt: 4, text: 'Не хватает навыков. Так и не узнаю, что внутри...' },
    ],
  },
  {
    id: 'locked_win',
    category: 'loot',
    weight: 4,
    minSec: 90,
    needs: 'wreck',
    loot: { gold: 350 },
    set: ['loot'],
    lines: [
      { dt: 0, text: 'Пытаюсь вскрыть замок.' },
      { dt: 4, text: 'Поддался! Внутри — золото. В трюм: +{gold}.' },
    ],
  },
  {
    id: 'derelict_log',
    category: 'lore',
    weight: 3,
    needs: 'wreck',
    set: ['lonely'],
    lines: [
      { dt: 0, text: 'В обломках — чужой бортжурнал. Последняя запись оборвана.' },
      { dt: 4, text: 'Помолчал минуту. За них. Полетел дальше.' },
    ],
  },

  // ─────────────── encounters: peaceful ───────────────
  {
    id: 'creature_pass',
    category: 'encounter',
    weight: 5,
    lines: [
      { dt: 0, text: 'По курсу — {creature}. Меня будто не заметили.' },
      { dt: 4, text: 'Иду параллельно. Красиво и жутко.' },
    ],
  },
  {
    id: 'creature_whale',
    category: 'encounter',
    weight: 3,
    lines: [
      { dt: 0, text: 'Планктонный кит трётся боком об обшивку. Не агрессивно.' },
      { dt: 4, text: 'Погладил бы, да скафандра жалко. Машу лапой.' },
    ],
  },
  {
    id: 'faction_trade',
    category: 'encounter',
    weight: 4,
    minSec: 90,
    loot: { gold: 250 },
    set: ['loot'],
    lines: [
      { dt: 0, text: 'Встретил: {faction}. Поднял лапы — мирный.' },
      { dt: 4, text: 'Обменял образцы на золото: +{gold}. Сделка честная.' },
    ],
  },
  {
    id: 'faction_gift',
    category: 'encounter',
    weight: 3,
    minSec: 120,
    loot: { serums: {} },
    set: ['loot'],
    lines: [
      { dt: 0, text: 'Паломники Угасших дали канистру слизи. Просто так.' },
      { dt: 4, text: 'В трюм: +{slime} слизи. Странный народ, добрый.' },
    ],
  },
  {
    id: 'silent_hail',
    category: 'encounter',
    weight: 4,
    set: ['lonely'],
    lines: [
      { dt: 0, text: 'Эй? Э-э-э-эй? Не-а. Похоже, тут никого нет.' },
      { dt: 4, text: 'Кто-то окликнул на частоте, которой нет в базе. Или показалось.' },
    ],
  },

  // ─────────────── encounters: hostile (set combat) ───────────────
  {
    id: 'combat_pirates',
    category: 'encounter',
    weight: 3,
    minSec: 120,
    set: ['combat', 'spooked'],
    lines: [
      { dt: 0, text: 'Контакт! Пара рейдеров идёт на перехват.' },
      { dt: 3, text: 'Манёвр уклонения. Дал предупредительный из ионки.' },
      { dt: 6, text: 'Отстали. Кажется, я их убедил. Сердце колотится.' },
    ],
  },
  {
    id: 'combat_swarm',
    category: 'hazard',
    weight: 3,
    minSec: 150,
    set: ['combat', 'spooked'],
    lines: [
      { dt: 0, text: 'Рой зондов облепил корпус. Кусаются, заразы!' },
      { dt: 4, text: 'Сбросил их форсажем. Обшивка в царапинах, но цела.' },
    ],
  },
  {
    id: 'combat_ambush',
    category: 'encounter',
    weight: 2,
    minSec: 180,
    loot: { gold: 200 },
    set: ['combat', 'loot'],
    lines: [
      { dt: 0, text: 'Засада из-за астероида! Не успели — я успел раньше.' },
      { dt: 4, text: 'Подобрал, что они обронили: +{gold}. Трофей честный.' },
    ],
  },

  // ─────────────── reactions to COMBAT (played out after) ───────────────
  { id: 'react_combat_breath', category: 'mundane', weight: 4, needs: 'combat', lines: [{ dt: 0, text: 'Перевожу дух после стычки. Лапы ещё дрожат.' }] },
  { id: 'react_combat_weapon', category: 'mundane', weight: 4, needs: 'combat', lines: [{ dt: 0, text: 'Проверяю пушку — перегрелась, но рабочая.' }] },
  { id: 'react_combat_scars', category: 'lore', weight: 3, needs: 'combat', lines: [
    { dt: 0, text: 'Считаю новые вмятины на броне. Будет что рассказать на базе.' },
  ] },
  { id: 'react_combat_adrenaline', category: 'mundane', weight: 3, needs: 'combat', lines: [{ dt: 0, text: 'Адреналин отпускает. Руки на штурвале расслабляются.' }] },

  // ─────────────── reactions to SPOOKED ───────────────
  { id: 'react_spooked_slow', category: 'travel', weight: 4, needs: 'spooked', lines: [{ dt: 0, text: 'После такого иду осторожнее. Сбавил ход.' }] },
  { id: 'react_spooked_jumpy', category: 'mundane', weight: 3, needs: 'spooked', lines: [{ dt: 0, text: 'Каждый шорох в обшивке теперь как выстрел. Нервы.' }] },
  { id: 'react_spooked_watch', category: 'travel', weight: 3, needs: 'spooked', lines: [{ dt: 0, text: 'Не свожу глаз с радара. Дважды за минуту проверяю тылы.' }] },

  // ─────────────── reactions to LOOT ───────────────
  { id: 'react_loot_sort', category: 'mundane', weight: 4, needs: 'loot', lines: [{ dt: 0, text: 'Надо рассортировать добычу в трюме. Потом. Сейчас лень.' }] },
  { id: 'react_loot_base', category: 'lore', weight: 3, needs: 'loot', lines: [{ dt: 0, text: 'База обрадуется. Может, дадут увольнительную к пруду.' }] },
  { id: 'react_loot_greed', category: 'mundane', weight: 3, needs: 'loot', lines: [{ dt: 0, text: 'Вкус добычи на языке. Поищу-ка ещё, раз пошло.' }] },

  // ─────────────── reactions to LONELY ───────────────
  { id: 'react_lonely_talk', category: 'mundane', weight: 4, needs: 'lonely', lines: [{ dt: 0, text: 'Разговариваю сам с собой. Собеседник так себе, но не спорит.' }] },
  { id: 'react_lonely_home', category: 'lore', weight: 3, needs: 'lonely', lines: [{ dt: 0, text: 'Скучаю по болоту. По тёплой тине, по комарам даже.' }] },
  { id: 'react_lonely_silence', category: 'mundane', weight: 3, needs: 'lonely', lines: [{ dt: 0, text: 'Тишина давит на уши. Включил радио — там только шум звёзд.' }] },

  // ─────────────── reactions to WEIRD ───────────────
  { id: 'react_weird_diary', category: 'lore', weight: 4, needs: 'weird', set: ['lonely'], lines: [
    { dt: 0, text: 'Дневник пилота. Новая запись: флора и фауна тут... довольно странные.' },
  ] },
  { id: 'react_weird_doubt', category: 'mundane', weight: 3, needs: 'weird', lines: [{ dt: 0, text: 'Протёр иллюминатор. Нет, не показалось. Космос шутит.' }] },
  { id: 'react_weird_sensors', category: 'travel', weight: 3, needs: 'weird', lines: [{ dt: 0, text: 'Перекалибровал сенсоры — на всякий случай. Доверяй, но проверяй.' }] },

  // ─────────────── loot (active finds) ───────────────
  {
    id: 'loot_slime_cloud',
    category: 'loot',
    weight: 6,
    loot: { serums: {} },
    set: ['loot'],
    lines: [
      { dt: 0, text: 'Прямо по курсу — слизевое облако. Сенсоры визжат от концентрации.' },
      { dt: 4, text: 'Зачерпнул полный контейнер: +{slime} слизи. Чистейшая.' },
    ],
  },
  {
    id: 'loot_slime_reef',
    category: 'loot',
    weight: 4,
    minSec: 120,
    loot: { serums: {} },
    set: ['loot'],
    lines: [
      { dt: 0, text: 'Кристаллический риф сочится слизью. Аккуратно соскрёб.' },
      { dt: 4, text: 'В трюм: +{slime} слизи. Лапы липкие, зато трюм полнее.' },
    ],
  },
  {
    id: 'loot_derelict_cargo',
    category: 'loot',
    weight: 4,
    minSec: 150,
    loot: { gold: 400 },
    set: ['loot', 'wreck'],
    lines: [
      { dt: 0, text: 'Нашёл брошенный грузовой модуль. Внутри — кое-что ценное.' },
      { dt: 4, text: 'Забрал груз: +{gold}. База будет довольна.' },
    ],
  },
  {
    id: 'loot_asteroid_vein',
    category: 'loot',
    weight: 4,
    loot: { gold: 180 },
    set: ['loot'],
    lines: [
      { dt: 0, text: 'В астероиде блестит жила. Отколол кусок буром.' },
      { dt: 4, text: 'Чистый металл: +{gold}. Мелочь, а приятно.' },
    ],
  },
  {
    id: 'loot_lucky_drift',
    category: 'loot',
    weight: 3,
    loot: { gold: 120, serums: {} },
    set: ['loot'],
    lines: [
      { dt: 0, text: 'Прямо в люк влетел дрейфующий ящик. Подарок космоса.' },
      { dt: 4, text: 'Внутри: +{gold} и +{slime} слизи. Сегодня везёт.' },
    ],
  },

  // ─────────────── lore / diary (atmosphere) ───────────────
  { id: 'lore_phenomenon', category: 'lore', weight: 5, set: ['weird'], lines: [
    { dt: 0, text: 'За бортом — {phenomenon}. Прилип к иллюминатору, забыл про штурвал.' },
  ] },
  { id: 'lore_silence', category: 'lore', weight: 4, set: ['lonely'], lines: [
    { dt: 0, text: 'Радиодиапазон мёртв. Ни писка. В такой тишине слышно, как бьётся сердце.' },
  ] },
  { id: 'lore_dream', category: 'lore', weight: 4, lines: [
    { dt: 0, text: 'Снилось болото. Проснулся — за окном {galaxy}. Тоже неплохо.' },
  ] },
  { id: 'lore_old_star', category: 'lore', weight: 3, set: ['weird'], lines: [
    { dt: 0, text: 'Слева — {star}. Свет шёл сюда миллионы лет. Я моложе этого луча.' },
  ] },
  { id: 'lore_map_edge', category: 'lore', weight: 3, minSec: 180, set: ['lonely'], lines: [
    { dt: 0, text: 'Карта закончилась. Дальше — белое пятно и слово «здесь драконы».' },
  ] },
  { id: 'lore_diary_home', category: 'lore', weight: 4, lines: [
    { dt: 0, text: 'Дневник пилота. Запись на память: если читаешь это — передай на базу, что я старался.' },
  ] },

  // ─────────────── hazard (narrative; weigh up with risk) ───────────────
  {
    id: 'hazard_minor',
    category: 'hazard',
    weight: 4,
    minSec: 120,
    set: ['spooked'],
    lines: [
      { dt: 0, text: 'Тряхнуло. {anomaly} ближе, чем казалось.' },
      { dt: 4, text: 'Обшивка держит. Но датчики нервничают.' },
    ],
  },
  {
    id: 'hazard_micrometeor',
    category: 'hazard',
    weight: 4,
    minSec: 120,
    set: ['spooked'],
    lines: [
      { dt: 0, text: 'Микрометеоритный дождь барабанит по корпусу.' },
      { dt: 4, text: 'Одна пробоина, заклеил пеной. Пронесло.' },
    ],
  },
  {
    id: 'hazard_warning',
    category: 'hazard',
    weight: 5,
    minSec: 300,
    set: ['spooked'],
    lines: [
      { dt: 0, text: '⚠ Фон растёт. Возвращаться надо бы скоро.' },
      { dt: 4, text: 'Ещё чуть — и оторвусь слишком далеко от базы.' },
    ],
  },
  {
    id: 'hazard_gravity',
    category: 'hazard',
    weight: 4,
    minSec: 360,
    set: ['spooked'],
    lines: [
      { dt: 0, text: '⚠ Гравитация тянет вбок. Двигатели на пределе.' },
      { dt: 4, text: 'Вырвался. Но топлива поубавилось, а до дома далеко.' },
    ],
  },

  // ═══════════════ ДОБАВЛЕНО: расширенный пул ═══════════════

  // ── навигация / болтовня ──
  { id: 'nav_9', category: 'travel', weight: 6, lines: [{ dt: 0, text: 'Срезаю через пылевой пояс. Видимость ноль, зато тихо.' }] },
  { id: 'nav_10', category: 'travel', weight: 6, lines: [{ dt: 0, text: 'Иду по приборам. За бортом — сплошная чернота.' }] },
  { id: 'nav_11', category: 'travel', weight: 5, lines: [{ dt: 0, text: 'По курсу — {star}. Обхожу по широкой дуге, жар чую даже сквозь обшивку.' }] },
  { id: 'nav_12', category: 'travel', weight: 5, lines: [{ dt: 0, text: 'Поймал попутный звёздный ветер. Экономлю топливо.' }] },
  { id: 'nav_13', category: 'travel', weight: 5, lines: [{ dt: 0, text: 'Навигатор предлагает три пути. Выбрал тот, что покрасивее.' }] },
  { id: 'nav_14', category: 'travel', weight: 4, lines: [{ dt: 0, text: 'Кажется, я тут уже пролетал. Или это другая такая же звезда.' }] },
  { id: 'nav_15', category: 'travel', weight: 4, lines: [{ dt: 0, text: 'Сделал крюк, чтобы заглянуть за {planet}. Любопытство сильнее плана.' }] },

  { id: 'mundane_radio', category: 'mundane', weight: 5, lines: [{ dt: 0, text: 'Ловлю обрывки чужих радиопередач. Музыка? Молитва? Не разобрать.' }] },
  { id: 'mundane_plant', category: 'mundane', weight: 4, lines: [{ dt: 0, text: 'Полил мох в каюте. Единственное живое на борту, кроме меня.' }] },
  { id: 'mundane_log_short', category: 'mundane', weight: 6, lines: [{ dt: 0, text: 'Записал координаты в журнал. Рука уже на автомате.' }] },
  { id: 'mundane_coffee', category: 'mundane', weight: 5, lines: [{ dt: 0, text: 'Кончился кофе. Это, пожалуй, страшнее любой аномалии.' }] },
  { id: 'mundane_window', category: 'mundane', weight: 5, lines: [{ dt: 0, text: 'Просто смотрю в иллюминатор. Имею право.' }] },
  { id: 'mundane_count', category: 'mundane', weight: 4, lines: [{ dt: 0, text: 'От скуки считаю звёзды по правому борту. Сбился на четырёхстах.' }] },
  { id: 'mundane_filter', category: 'mundane', weight: 5, lines: [
    { dt: 0, text: 'Чищу воздушные фильтры. Пахнет озоном и болотом.' },
    { dt: 4, text: 'Готово. Дышится легче.' },
  ] },

  // ── открытия ──
  { id: 'disc_nebula', category: 'discovery', weight: 5, set: ['awe'], lines: [
    { dt: 0, text: 'Вошёл в туманность. Кругом розовый и золотой свет.' },
    { dt: 4, text: 'Будто лечу внутри витража. Аж дыхание перехватило.' },
  ] },
  { id: 'disc_ringworld', category: 'discovery', weight: 3, minSec: 180, set: ['awe', 'weird'], lines: [
    { dt: 0, text: 'Гигантское кольцо вокруг звезды — не природное. Слишком ровное.' },
    { dt: 4, text: 'Кто-то построил это. Давно. Огромное и пустое.' },
  ] },
  { id: 'disc_graveyard', category: 'discovery', weight: 4, minSec: 120, set: ['wreck', 'lonely'], lines: [
    { dt: 0, text: 'Кладбище кораблей. Десятки корпусов дрейфуют без огней.' },
    { dt: 4, text: 'Иду медленно, чтобы не тревожить. Хотя тревожить некого.' },
  ] },
  { id: 'disc_ocean_planet', category: 'discovery', weight: 4, set: ['awe'], lines: [
    { dt: 0, text: 'Планета {planet} — сплошной океан. Ни клочка суши.' },
    { dt: 4, text: 'Под волнами что-то светится. Огромное. Лучше не нырять.' },
  ] },
  { id: 'disc_frozen', category: 'discovery', weight: 4, lines: [
    { dt: 0, text: 'Вышел к замёрзшему миру. {adj}ое место, аж приборы инеем взялись.' },
  ] },
  { id: 'disc_signal', category: 'discovery', weight: 4, set: ['weird'], lines: [
    { dt: 0, text: 'Повторяющийся сигнал из глубины {arm}.' },
    { dt: 4, text: 'Раскодировал три символа и сдался. Не наш алфавит.' },
  ] },
  { id: 'disc_garden', category: 'discovery', weight: 3, set: ['awe'], lines: [
    { dt: 0, text: 'На панцире кочующей черепахи — целый сад. Цветёт в вакууме.' },
    { dt: 4, text: 'Как такое возможно? Записал, сам не верю.' },
  ] },
  { id: 'disc_mirror_ship', category: 'discovery', weight: 3, minSec: 240, set: ['weird', 'spooked'], lines: [
    { dt: 0, text: 'Вижу корабль, точь-в-точь как мой. Сближаюсь.' },
    { dt: 4, text: 'Это {anomaly} — отражение. В кабине «двойника» помахал сам себе.' },
  ] },
  { id: 'disc_storm_planet', category: 'discovery', weight: 4, lines: [
    { dt: 0, text: 'Планета в вечной буре. Молнии бьют с полюса на полюс.' },
  ] },
  { id: 'disc_empty_city', category: 'discovery', weight: 3, minSec: 180, set: ['lonely', 'weird'], lines: [
    { dt: 0, text: 'На {planet} — город. Огни горят, дороги целы.' },
    { dt: 4, text: 'Никого. Ни одной живой души. Жутковато.' },
  ] },

  // ── встречи (мирные) ──
  { id: 'enc_caravan', category: 'encounter', weight: 4, minSec: 90, lines: [
    { dt: 0, text: 'Поравнялся с караваном: {faction}. Машут фонарями.' },
    { dt: 4, text: 'Перекинулись новостями на общей частоте. Стало теплее на душе.' },
  ] },
  { id: 'enc_circus', category: 'encounter', weight: 2, minSec: 150, set: ['awe'], lines: [
    { dt: 0, text: 'Встретил дрейфующий цирк-караван. На обшивке — гирлянды!' },
    { dt: 4, text: 'Жонглёр в скафандре отсалютовал кеглями. Лучшее, что видел за день.' },
  ] },
  { id: 'enc_turtle', category: 'encounter', weight: 3, set: ['awe'], lines: [
    { dt: 0, text: 'Космическая черепаха проплыла подо мной. Медленно, величаво.' },
  ] },
  { id: 'enc_lost_pilot', category: 'encounter', weight: 3, minSec: 120, set: ['lonely'], lines: [
    { dt: 0, text: 'На связь вышел такой же одиночка. Поболтали ни о чём.' },
    { dt: 4, text: 'Разошлись курсами. Почему-то стало грустно.' },
  ] },
  { id: 'enc_monks', category: 'encounter', weight: 3, minSec: 180, set: ['weird'], lines: [
    { dt: 0, text: 'Монахи пустого эфира предложили помолчать вместе.' },
    { dt: 4, text: 'Помолчали минуту. Странно, но полегчало.' },
  ] },

  // ── встречи (враждебные) ──
  { id: 'combat_dogfight', category: 'encounter', weight: 3, minSec: 150, set: ['combat', 'spooked'], lines: [
    { dt: 0, text: 'Перехватчик сел на хвост. Ну, потанцуем.' },
    { dt: 4, text: 'Крутанул бочку, ушёл в тень астероида. Оторвался.' },
  ] },
  { id: 'combat_boarders', category: 'encounter', weight: 2, minSec: 240, set: ['combat', 'spooked'], lines: [
    { dt: 0, text: 'Кто-то цепляется к шлюзу! Абордаж?!' },
    { dt: 4, text: 'Дал импульс двигателями — отцепились. Сердце в пятках.' },
  ] },
  { id: 'combat_mine', category: 'hazard', weight: 3, minSec: 200, set: ['spooked'], lines: [
    { dt: 0, text: 'Минное поле! Старое, военное.' },
    { dt: 4, text: 'Прошёл на цыпочках. Одна рванула в стороне — обошлось.' },
  ] },

  // ── лут ──
  { id: 'loot_pod', category: 'loot', weight: 4, minSec: 90, loot: { gold: 220 }, set: ['loot', 'wreck'], lines: [
    { dt: 0, text: 'Спасательная капсула, пустая. Внутри — чей-то тайник.' },
    { dt: 4, text: 'Забрал: +{gold}. Прости, хозяин, тебе уже не нужно.' },
  ] },
  { id: 'loot_comet_ice', category: 'loot', weight: 5, loot: { serums: {} }, set: ['loot'], lines: [
    { dt: 0, text: 'В ядре кометы — замёрзшая слизь. Откалываю буром.' },
    { dt: 4, text: 'В трюм: +{slime}. Холодная, аж лапы свело.' },
  ] },
  { id: 'loot_jackpot', category: 'loot', weight: 2, minSec: 300, loot: { gold: 600, serums: {} }, set: ['loot'], lines: [
    { dt: 0, text: 'Целый брошенный сейф в куске метеорита. И он открыт!' },
    { dt: 4, text: 'Джекпот: +{gold} и +{slime} слизи. Сегодня мой день!' },
  ] },
  { id: 'loot_mutagen', category: 'loot', weight: 2, minSec: 240, loot: { mutagen: 1 }, set: ['loot', 'weird'], lines: [
    { dt: 0, text: 'В дрейфующей капсуле — пульсирующий сгусток. Биосканер визжит.' },
    { dt: 4, text: 'Это мутаген! Чистая эволюционная масса. В трюм: +{mutagen} 🧬.' },
  ] },
  { id: 'loot_mutagen_reef', category: 'loot', weight: 2, minSec: 360, loot: { mutagen: 1 }, set: ['loot', 'awe'], lines: [
    { dt: 0, text: 'Кристаллы рифа светятся живым. Внутри — капля мутагена.' },
    { dt: 4, text: 'Аккуратно извлёк: +{mutagen} 🧬. Редкая удача.' },
  ] },
  { id: 'loot_salvage', category: 'loot', weight: 4, minSec: 120, loot: { gold: 300 }, set: ['loot', 'wreck'], lines: [
    { dt: 0, text: 'Разобрал разбитый зонд на запчасти. Цветмет в цене.' },
    { dt: 4, text: 'Сдам на базе: +{gold}.' },
  ] },
  { id: 'loot_trade_run', category: 'loot', weight: 3, minSec: 180, loot: { gold: 280 }, set: ['loot'], lines: [
    { dt: 0, text: 'Сборщики долгов из Орзо купили мои карты звёзд.' },
    { dt: 4, text: 'Неплохо: +{gold}. Карты-то я и так помню.' },
  ] },

  // ── лор / дневник ──
  { id: 'lore_diary_fear', category: 'lore', weight: 4, set: ['lonely'], lines: [
    { dt: 0, text: 'Дневник пилота. Иногда космос так велик, что страшно. Но красиво.' },
  ] },
  { id: 'lore_diary_count', category: 'lore', weight: 4, lines: [
    { dt: 0, text: 'Дневник пилота. День не знаю какой. Часы тут врут, считаю по кофе.' },
  ] },
  { id: 'lore_old_war', category: 'lore', weight: 3, minSec: 180, set: ['weird'], lines: [
    { dt: 0, text: 'Прошёл место старой битвы. Обломки висят, как и сто лет назад.' },
    { dt: 4, text: 'За что дрались — уже никто не помнит. Грустная арифметика.' },
  ] },
  { id: 'lore_home_thought', category: 'lore', weight: 4, set: ['lonely'], lines: [
    { dt: 0, text: 'Подумал: на базе сейчас кормят. А я тут, среди звёзд, с тюбиком.' },
  ] },
  { id: 'lore_name_star', category: 'lore', weight: 3, set: ['awe'], lines: [
    { dt: 0, text: 'Безымянную звезду назвал в честь себя. Имею право — я первый.' },
  ] },
  { id: 'lore_silence_deep', category: 'lore', weight: 4, set: ['lonely', 'weird'], lines: [
    { dt: 0, text: 'Тут так тихо, что слышно собственные мысли. Слишком громко.' },
  ] },
  { id: 'lore_beauty', category: 'lore', weight: 4, set: ['awe'], lines: [
    { dt: 0, text: 'За бортом — {phenomenon}. Ради таких минут и стоит летать.' },
  ] },
  { id: 'lore_map_blank', category: 'lore', weight: 3, minSec: 240, set: ['weird'], lines: [
    { dt: 0, text: 'Тут на карте — белое пятно. Значит, я первый, кто его закрасит.' },
  ] },

  // ── опасности ──
  { id: 'hazard_solar_flare', category: 'hazard', weight: 4, minSec: 200, set: ['spooked'], lines: [
    { dt: 0, text: 'Солнечная вспышка! Прячусь за {planet}.' },
    { dt: 4, text: 'Радиацию переждал в тени. Приборы потом отойдут.' },
  ] },
  { id: 'hazard_leak', category: 'hazard', weight: 4, minSec: 240, set: ['spooked'], lines: [
    { dt: 0, text: '⚠ Утечка в топливной магистрали. Зажимаю.' },
    { dt: 4, text: 'Заварил на ходу. Лапы дрожат, но цел.' },
  ] },
  { id: 'hazard_drift', category: 'hazard', weight: 4, minSec: 300, set: ['spooked'], lines: [
    { dt: 0, text: '⚠ Сбой навигации. Минуту летел вслепую.' },
    { dt: 4, text: 'Поймал ориентир — {star}. Уф. Чуть не заблудился навсегда.' },
  ] },
  { id: 'hazard_whisper', category: 'hazard', weight: 3, minSec: 360, set: ['spooked', 'weird'], lines: [
    { dt: 0, text: '⚠ В эфире — чей-то шёпот. Слов нет, но мурашки есть.' },
    { dt: 4, text: 'Вырубил приёмник. Не хочу знать, что это было.' },
  ] },

  // ── реакции: AWE (после красоты) ──
  { id: 'react_awe_silent', category: 'mundane', weight: 4, needs: 'awe', lines: [{ dt: 0, text: 'Долго молчу. Некоторые вещи словами не испортишь.' }] },
  { id: 'react_awe_photo', category: 'mundane', weight: 4, needs: 'awe', lines: [{ dt: 0, text: 'Нащёлкал снимков. Покажу на базе — не поверят.' }] },
  { id: 'react_awe_small', category: 'lore', weight: 3, needs: 'awe', lines: [{ dt: 0, text: 'На фоне такого я — крошечный головастик. И это почему-то приятно.' }] },

  // ── реакции: расширение существующих настроений ──
  { id: 'react_combat_log2', category: 'lore', weight: 3, needs: 'combat', lines: [{ dt: 0, text: 'Записал стычку в журнал. Подробно — для рапорта и для внуков.' }] },
  { id: 'react_spooked_pray', category: 'mundane', weight: 3, needs: 'spooked', lines: [{ dt: 0, text: 'Постучал по корпусу на удачу. Глупо, но привычка.' }] },
  { id: 'react_loot_dream', category: 'lore', weight: 3, needs: 'loot', lines: [{ dt: 0, text: 'Прикидываю, на что потрачу награду. Новый радар? Или просто отдых.' }] },
  { id: 'react_lonely_song', category: 'mundane', weight: 3, needs: 'lonely', lines: [{ dt: 0, text: 'Напеваю под нос болотную песенку. Эхо в рубке подпевает.' }] },
  { id: 'react_weird_note', category: 'lore', weight: 3, needs: 'weird', lines: [{ dt: 0, text: 'Записал странность в отдельную тетрадь. Их у меня уже три.' }] },
  { id: 'react_wreck_salute', category: 'lore', weight: 3, needs: 'wreck', lines: [{ dt: 0, text: 'Отсалютовал погибшему кораблю. Мог бы быть и я.' }] },
]

// ── Return leg: appended once the player recalls the ship. ──
export const RETURN: Scenario[] = [
  {
    id: 'return_standard',
    category: 'return',
    weight: 2,
    lines: [
      { dt: 0, text: 'Получен приказ на возврат. Разворачиваюсь к дому.' },
      { dt: 4, text: 'Иду форсажем — обратно втрое быстрее.' },
    ],
  },
  {
    id: 'return_relief',
    category: 'return',
    weight: 1,
    lines: [
      { dt: 0, text: 'Домой так домой. Если честно — устал.' },
      { dt: 4, text: 'Курс на базу. Уже чую запах родной тины.' },
    ],
  },
]

export const ARRIVAL: Scenario[] = [
  {
    id: 'arrival_standard',
    category: 'arrival',
    weight: 2,
    lines: [
      { dt: 0, text: 'Вижу родную орбиту. Стыковка через минуту.' },
      { dt: 4, text: 'Шасси на палубе. Экспедиция завершена. Разгружаюсь.' },
    ],
  },
  {
    id: 'arrival_proud',
    category: 'arrival',
    weight: 1,
    lines: [
      { dt: 0, text: 'База на связи. «С возвращением, пилот».' },
      { dt: 4, text: 'Трюм полон, лапы целы. День прожит не зря.' },
    ],
  },
]

// Shown if the ship was lost (recalled too late).
export const LOST: Scenario = {
  id: 'lost',
  category: 'hazard',
  weight: 1,
  lines: [
    { dt: 0, text: '⚠⚠ Критический сбой. {anomaly} затягивает корабль.' },
    { dt: 4, text: 'Связь обрывается. Последняя запись в дневнике...' },
    { dt: 8, text: '— ...передайте на базу, что я видел {galaxy} вблизи. Оно того стоило.' },
  ],
}
