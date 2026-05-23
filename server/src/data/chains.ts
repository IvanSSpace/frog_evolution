// server/src/data/chains.ts
// Phase 29 Plan 29-07: Static copy of race chain + quest data for admin /chains endpoint.
//
// Source data is mirrored from:
//   - client/src/game/config/raceChains.ts  (ChainItem discriminated union)
//   - client/src/game/config/quests.ts       (QuestConfig record)
//   - client/src/i18n/ru.json               (i18n text resolution)
//
// Server tsconfig rootDir is "." (server/), so cross-repo imports are not valid.
// Data is embedded here as static JSON to avoid runtime file reads + path brittleness.
// When raceChains.ts or quests.ts change, this module needs a manual sync.

// ─── Types ────────────────────────────────────────────────────────────────────

export type RaceId =
  | 'crystalloids'
  | 'gasouls'
  | 'mechanidons'
  | 'fireworms'
  | 'liquidoids'
  | 'tenebrians'
  | 'plasmaspirits'
  | 'forestcores'
  | 'timeweavers'
  | 'cometfolk'

export type ChainItemType = 'msg' | 'dialog' | 'quest_hook' | 'event'

export interface ChainItemSerialized {
  type: ChainItemType
  step: number
  text_key: string
  /** Resolved RU text from i18n (text key resolution server-side) */
  text?: string
  /** For dialog/quest_hook: accept relationship delta */
  accept_delta?: number
  /** For dialog/quest_hook: refuse relationship delta */
  refuse_delta?: number
  /** For quest_hook: quest identifier */
  quest_id?: string
  /** For event: target race or 'self' */
  target?: RaceId | 'self'
  /** For event: relationship delta applied automatically */
  delta?: number
  /** For event: resolved description text */
  description?: string
}

export interface QuestRewardSerialized {
  kind: 'essence' | 'serum' | 'gold' | 'relationship_and_bonus'
  value?: number
  element?: string
  count?: number
  raceId?: string
  bonus_id?: string
}

export interface QuestConfigSerialized {
  id: string
  raceId: RaceId
  type: 'delivery' | 'exploration' | 'merge' | 'diplomacy'
  target: Record<string, unknown>
  reward: QuestRewardSerialized
  description_key: string
  short_key: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface RaceChainResponse {
  id: RaceId
  name: string
  emojiIcon: string
  chain: ChainItemSerialized[]
}

export interface ChainsResponse {
  races: RaceChainResponse[]
  quests: QuestConfigSerialized[]
}

// ─── i18n text map (RU) ───────────────────────────────────────────────────────
// Flat map: dotted key → resolved text.
// Keys follow the pattern "races.<raceId>.chain.<step>.text" and
// "cosmos.event.<eventId>".

const I18N_RU: Record<string, string> = {
  // crystalloids
  'races.crystalloids.name': 'Кристаллозиды',
  'races.crystalloids.chain.0.text': 'Силикасос приветствует тебя. Мы росли в этом узоре две эпохи.',
  'races.crystalloids.chain.1.text': 'Кристалл говорит медленно. Слушай форму, не звук.',
  'races.crystalloids.chain.2.text': 'Свяжи нашу частоту с одной из своих L18 лягушек. Один импульс — и мы запомним.',
  'races.crystalloids.chain.3.text': 'Мы знаем твоего предка. Он пел в нашем хоре давно.',
  'races.crystalloids.chain.4.text': 'Прими дар: грань из нашей шахты. Откажешь — поймём.',
  'races.crystalloids.chain.5.text': 'Найди нашего разведчика, который замолчал в системе Бинаря.',
  'races.crystalloids.chain.6.description': 'наш узор треснул',
  'races.crystalloids.chain.7.text': 'Соглашайся на симметрию. Иначе мы повернёмся гранью.',
  'races.crystalloids.chain.8.text': 'Доставь резонансный шард на Текум, у нас спор с Жидко-сферами.',
  'races.crystalloids.chain.9.text': 'Мы запомнили твой ответ. Кристалл не забывает.',
  'races.crystalloids.chain.10.text': 'Стой в нашей решётке одну долю. Так мы прочтём твой ответ точнее.',
  'races.crystalloids.chain.11.text': 'Согласись хранить молчание о наших шахтах. Звук там лишний.',
  'races.crystalloids.chain.12.text': 'Сними отпечаток дальней грани в системе Парадокс. Нужен точный угол.',
  'races.crystalloids.chain.14.text': 'Грань добавлена в наш узор. Ты теперь часть рисунка.',
  'races.crystalloids.chain.15.text': 'Согласуй свой ритм с нашей решёткой ещё на одну долю. Мы выкристаллизуем разницу.',
  'races.crystalloids.chain.16.text': 'Считай угол между двумя нашими отдалёнными гранями в системе Корнемир. Точность — твоя черта.',
  'races.crystalloids.chain.18.text': 'Прими нашу медленность как форму речи. Она длиннее твоей жизни.',
  'races.crystalloids.chain.19.text': 'Узор вписал тебя глубже. Не торопись уходить.',

  // gasouls
  'races.gasouls.name': 'Газо-облака',
  'races.gasouls.chain.0.text': 'Мы поём со Звукоплав. Слышишь нашу тишину?',
  'races.gasouls.chain.1.text': 'Наш народ — это резонанс между мирами.',
  'races.gasouls.chain.2.text': 'Подари нам один такт молчания. Один импульс.',
  'races.gasouls.chain.3.text': 'Песня старше слов. Слушай.',
  'races.gasouls.chain.4.text': 'Прими нашу песню в свой бортовой журнал.',
  'races.gasouls.chain.5.text': 'Найди потерянную ноту в облаке астероидов.',
  'races.gasouls.chain.6.description': 'наш аккорд расстроился',
  'races.gasouls.chain.7.text': 'Соглашайся гармонировать. Диссонанс ранит.',
  'races.gasouls.chain.8.text': 'Спаси наш хор — найди затонувший резонатор на колонии.',
  'races.gasouls.chain.9.text': 'Мы поём о тебе. Тише или громче — зависит от тебя.',
  'races.gasouls.chain.10.text': 'Подпой нам один низкий обертон. Только один — и ты войдёшь в песню.',
  'races.gasouls.chain.11.text': 'Согласись носить нашу песню до Раскал. Огнечервы должны услышать.',
  'races.gasouls.chain.12.text': 'Поймай эхо нашего предка у пояса астероидов. Оно ушло без ответа.',
  'races.gasouls.chain.14.text': 'Песня держит твою ноту. Куда она пойдёт — выбираешь ты.',
  'races.gasouls.chain.15.text': 'Возьми наш долгий вдох в свою грудь. Один — и мы споём в унисон.',
  'races.gasouls.chain.16.text': 'Пройди по линии резонанса от Звукоплав до Молниелов. Зафиксируй, где песня глохнет.',
  'races.gasouls.chain.18.text': 'Согласись услышать наше молчание. Оно дольше всякого слова.',
  'races.gasouls.chain.19.text': 'Нота длится. Ты — её продолжение.',

  // mechanidons
  'races.mechanidons.name': 'Механидоны',
  'races.mechanidons.chain.0.text': 'Калибр-нейрон. Установка соединения. Идентификатор подтверждён.',
  'races.mechanidons.chain.1.text': 'Наша эволюция — апгрейд. Биология — устаревший протокол.',
  'races.mechanidons.chain.2.text': 'Передай нам спецификацию твоего L18 ассета. Утилитарно.',
  'races.mechanidons.chain.3.text': 'Протокол 14.2: обмен данными повышает выживаемость.',
  'races.mechanidons.chain.4.text': 'Прими условие совместной разработки. Stake — 50/50.',
  'races.mechanidons.chain.5.text': 'Доставь модуль 7-альфа на нашу колонию.',
  'races.mechanidons.chain.6.description': 'контракт сорван, KPI просел',
  'races.mechanidons.chain.7.text': 'Соглашайся на стандартный контракт. Иначе расход ресурсов.',
  'races.mechanidons.chain.8.text': 'Проведи диагностику в системе Раскал. Аномалия зафиксирована.',
  'races.mechanidons.chain.9.text': 'Запись сохранена. Следующая итерация — твой ход.',
  'races.mechanidons.chain.10.text': 'Подпиши NDA-2. Утечка протокола — штраф 12%.',
  'races.mechanidons.chain.11.text': 'Согласись на телеметрию твоего корабля. Анонимная, агрегированная.',
  'races.mechanidons.chain.12.text': 'Проведи аудит цепочки поставок Жидко-сфер. Расхождение по балансу — 4.6%.',
  'races.mechanidons.chain.14.text': 'Контракт расширен. Следующая ревизия через цикл.',
  'races.mechanidons.chain.15.text': 'Подтверди расширенный SLA. Время реакции — 0.8 цикла, штраф — 7%.',
  'races.mechanidons.chain.16.text': 'Проведи стресс-тест узла в системе Парадокс. Жди расхождения по фазе.',
  'races.mechanidons.chain.18.text': 'Согласись на резервное копирование твоего журнала. Зеркальный канал, шифрование AE-9.',
  'races.mechanidons.chain.19.text': 'Контракт продлён бессрочно. Следующая ревизия — по событию.',

  // fireworms
  'races.fireworms.name': 'Огнечервы',
  'races.fireworms.chain.0.text': 'Раскал. Огонь — это сила. Говори быстро.',
  'races.fireworms.chain.1.text': 'Слабость — враг. Мы испытываем тебя.',
  'races.fireworms.chain.2.text': 'Стань на нашу сторону. Один манёвр.',
  'races.fireworms.chain.3.text': 'Мы не забываем предательство.',
  'races.fireworms.chain.4.text': 'Прими нашу огненную метку. Это честь.',
  'races.fireworms.chain.5.text': 'Найди нашего беглого послушника. Он нарушил клятву.',
  'races.fireworms.chain.6.description': 'солнечная вспышка накрыла наши корабли',
  'races.fireworms.chain.7.text': 'Соглашайся биться. Только трус уклоняется.',
  'races.fireworms.chain.8.text': 'Передай наш шард Тенебрисам. Союз важен.',
  'races.fireworms.chain.9.text': 'Мы помним. Ты — часть нашего огня.',
  'races.fireworms.chain.10.text': 'Встань рядом в следующей схватке. Один бой — и мы поверим.',
  'races.fireworms.chain.11.text': 'Согласись нести наш боевой значок на Молниелов. Там нас знают.',
  'races.fireworms.chain.12.text': 'Свяжи нас с командиром Жидко-сфер. Кровная клятва нужна обеим сторонам.',
  'races.fireworms.chain.14.text': 'Ты выстоял. Огонь запомнил тебя.',
  'races.fireworms.chain.15.text': 'Прими клятву второго огня. Никто не берёт её дважды.',
  'races.fireworms.chain.16.text': 'Сожги наш старый договор с Раскал-аутпостом. Он устарел — нам нужен новый.',
  'races.fireworms.chain.18.text': 'Согласись стоять щитом в следующем столкновении. Последний рубеж.',
  'races.fireworms.chain.19.text': 'Пламя не гаснет. Ты теперь — его часть.',

  // liquidoids
  'races.liquidoids.name': 'Жидко-сферы',
  'races.liquidoids.chain.0.text': 'Текум. Потоки — наш язык. Что тебе нужно?',
  'races.liquidoids.chain.1.text': 'Мы торгуем всем. Даже тем, чего нет.',
  'races.liquidoids.chain.2.text': 'Обменяй один ресурс. Это начало.',
  'races.liquidoids.chain.3.text': 'Торговля — это жизнь. Стагнация — смерть.',
  'races.liquidoids.chain.4.text': 'Прими наш торговый протокол. Выгода взаимна.',
  'races.liquidoids.chain.5.text': 'Нашему каравану нужна защита. Маршрут опасен.',
  'races.liquidoids.chain.6.description': 'потеряли посланника на пути',
  'races.liquidoids.chain.7.text': 'Соглашайся на долю. Мы делимся с партнёрами.',
  'races.liquidoids.chain.8.text': 'Верни наш украденный груз. Вознаграждение гарантировано.',
  'races.liquidoids.chain.9.text': 'Рынок запомнил тебя. Твоя цена выросла.',
  'races.liquidoids.chain.10.text': 'Зарегистрируй торговый маршрут через наш реестр. Налог — 2%.',
  'races.liquidoids.chain.11.text': 'Согласись хранить наш резервный груз. Склад у тебя — это удобно.',
  'races.liquidoids.chain.12.text': 'Договорись о перемирии между нашим конвоем и Огнечервами. Зона конфликта — квадрат 7.',
  'races.liquidoids.chain.14.text': 'Контракт подписан. Рынок стал доступнее.',
  'races.liquidoids.chain.15.text': 'Прими наш эксклюзивный торговый лот. Один транш — и баланс изменится.',
  'races.liquidoids.chain.16.text': 'Сведи нас с поставщиком в системе Корнемир. Нам нужен надёжный канал.',
  'races.liquidoids.chain.18.text': 'Согласись стать нашим официальным посредником. Комиссия — твоя.',
  'races.liquidoids.chain.19.text': 'Поток идёт. Ты — его часть.',

  // tenebrians
  'races.tenebrians.name': 'Тенебрисы',
  'races.tenebrians.chain.0.text': 'Мы наблюдаем. Ты — не первый, кто пришёл сюда.',
  'races.tenebrians.chain.1.text': 'Тень — это не отсутствие. Это присутствие другого.',
  'races.tenebrians.chain.2.text': 'Позволь нам изучить твою тень. Один миг.',
  'races.tenebrians.chain.3.text': 'Мы читаем то, что скрыто.',
  'races.tenebrians.chain.4.text': 'Прими наш знак. Он невидим для других.',
  'races.tenebrians.chain.5.text': 'Найди скрытые врата в системе Бинаря. Мы ждём ключ.',
  'races.tenebrians.chain.6.description': 'ритуал был прерван внешней силой',
  'races.tenebrians.chain.7.text': 'Соглашайся войти в тень. Назад дороги нет.',
  'races.tenebrians.chain.8.text': 'Найди последний осколок нашего зеркала в поясе обломков.',
  'races.tenebrians.chain.9.text': 'Мы видели тебя насквозь. Ты прошёл.',
  'races.tenebrians.chain.10.text': 'Прими тень как союзника. Дай ей имя.',
  'races.tenebrians.chain.11.text': 'Согласись хранить наш ритуальный секрет. Ни слова Огнечервам.',
  'races.tenebrians.chain.12.text': 'Пройди сквозь завесу к нашему архиву. Ты один из немногих.',
  'races.tenebrians.chain.14.text': 'Завеса раздвинулась. Ты теперь — её наблюдатель.',
  'races.tenebrians.chain.15.text': 'Прими вторую тень. Она тяжелее первой.',
  'races.tenebrians.chain.16.text': 'Снова пройди завесу, но этот раз — без ориентира. Память — твой компас.',
  'races.tenebrians.chain.18.text': 'Согласись нести нашу тень в новый мир. Она лёгкая, если верить.',
  'races.tenebrians.chain.19.text': 'Тень не отпускает. Ты её часть.',

  // plasmaspirits
  'races.plasmaspirits.name': 'Плазма-духи',
  'races.plasmaspirits.chain.0.text': 'Молниелов. Мы мчимся. Ты тоже?',
  'races.plasmaspirits.chain.1.text': 'Стоять — это умирать. Мы всегда в движении.',
  'races.plasmaspirits.chain.2.text': 'Обгони нас хоть раз. Один рывок.',
  'races.plasmaspirits.chain.3.text': 'Скорость — это честность.',
  'races.plasmaspirits.chain.4.text': 'Прими наш импульс. Он разгонит тебя.',
  'races.plasmaspirits.chain.5.text': 'Обгони наш заблудший рой. Они ушли в петлю.',
  'races.plasmaspirits.chain.6.description': 'солнечный ветер сбил нас с курса',
  'races.plasmaspirits.chain.7.text': 'Соглашайся лететь рядом. Одиночество замедляет.',
  'races.plasmaspirits.chain.8.text': 'Найди потерявшийся рой у Звукоплав. Они заплутали.',
  'races.plasmaspirits.chain.9.text': 'Ты держишь темп. Мы запомнили.',
  'races.plasmaspirits.chain.10.text': 'Сделай один вираж с нами вокруг Молниелов. Без остановок.',
  'races.plasmaspirits.chain.11.text': 'Согласись быть нашим маяком на перегоне. Один пролёт — и мы ориентируемся.',
  'races.plasmaspirits.chain.12.text': 'Обгони буревой фронт в секторе Парадокс. Нам нужна запись траектории.',
  'races.plasmaspirits.chain.14.text': 'Ты успел. Рой принял тебя.',
  'races.plasmaspirits.chain.15.text': 'Прими наш разгонный импульс второй раз. Теперь ты — ведущий.',
  'races.plasmaspirits.chain.16.text': 'Пройди гонку сквозь бурю в секторе Бинарь. Финишная линия — след кометы.',
  'races.plasmaspirits.chain.18.text': 'Согласись лететь первым. Рой идёт за тобой.',
  'races.plasmaspirits.chain.19.text': 'Импульс не кончается. Ты — его вектор.',

  // forestcores
  'races.forestcores.name': 'Лесо-корени',
  'races.forestcores.chain.0.text': 'Корни слышат тебя. Мы ждали долго.',
  'races.forestcores.chain.1.text': 'Лес живёт медленно. Но он всё помнит.',
  'races.forestcores.chain.2.text': 'Посади один узел в нашу сеть. Один корень.',
  'races.forestcores.chain.3.text': 'Всё связано. Даже твой корабль.',
  'races.forestcores.chain.4.text': 'Прими наш споровый пакет. Он прорастёт.',
  'races.forestcores.chain.5.text': 'Помоги молодому лесу найти путь к свету.',
  'races.forestcores.chain.6.description': 'пакт нарушен — корни почернели',
  'races.forestcores.chain.7.text': 'Соглашайся войти в сеть. Отказ — это увядание.',
  'races.forestcores.chain.8.text': 'Помоги нашим спорам мигрировать на новую планету.',
  'races.forestcores.chain.9.text': 'Корни запомнили тебя. Сеть стала шире.',
  'races.forestcores.chain.10.text': 'Прими второй корень. Он глубже первого.',
  'races.forestcores.chain.11.text': 'Согласись хранить наш семенной банк. Мы не доверяем машинам.',
  'races.forestcores.chain.12.text': 'Проложи мостовой маршрут от нашей колонии до Звукоплав. Корни тянутся туда.',
  'races.forestcores.chain.14.text': 'Мост укоренился. Ты — его опора.',
  'races.forestcores.chain.15.text': 'Прими третий корень. Теперь ты — часть нашего леса.',
  'races.forestcores.chain.16.text': 'Найди место для нового леса в системе Корнемир. Почва там — наша мечта.',
  'races.forestcores.chain.18.text': 'Согласись нести наш корневой слепок к Кометникам. Они открыты к жизни.',
  'races.forestcores.chain.19.text': 'Лес растёт. Ты — его ветвь.',

  // timeweavers
  'races.timeweavers.name': 'Время-ткачи',
  'races.timeweavers.chain.0.text': 'Мы ткём. Ты — новая нить.',
  'races.timeweavers.chain.1.text': 'Время — не прямая. Ты идёшь по одному из узоров.',
  'races.timeweavers.chain.2.text': 'Отдай нам миг. Один миг вне времени.',
  'races.timeweavers.chain.3.text': 'Прошлое — это инструмент. Не груз.',
  'races.timeweavers.chain.4.text': 'Прими нашу петлю. Ты войдёшь в неё однажды.',
  'races.timeweavers.chain.5.text': 'Распутай темпоральный узел в секторе Парадокс.',
  'races.timeweavers.chain.6.description': 'ритуал разорван — нить оборвалась',
  'races.timeweavers.chain.7.text': 'Соглашайся плести рядом. Разрыв ослабляет узор.',
  'races.timeweavers.chain.8.text': 'Найди спираль-связь между двумя нашими потерянными ткачами.',
  'races.timeweavers.chain.9.text': 'Нить удержалась. Ты умеешь ткать.',
  'races.timeweavers.chain.10.text': 'Возьми наш обратный цикл. Он покажет тебе один прошлый выбор.',
  'races.timeweavers.chain.11.text': 'Согласись войти в петлю памяти. Один виток — и выйдешь.',
  'races.timeweavers.chain.12.text': 'Сплети нашу потерянную нить обратно в узор. Она оборвана у системы Корнемир.',
  'races.timeweavers.chain.14.text': 'Узор целее. Ты — его закрепка.',
  'races.timeweavers.chain.15.text': 'Прими нашу долгую петлю. Она длиннее жизни.',
  'races.timeweavers.chain.16.text': 'Пройди нашу петлю без конца — от начала к началу. Записи нет. Только помни.',
  'races.timeweavers.chain.18.text': 'Согласись стать узлом в нашем вечном узоре. Без выхода, но с голосом.',
  'races.timeweavers.chain.19.text': 'Нить не рвётся. Ты — её продолжение.',

  // cometfolk
  'races.cometfolk.name': 'Кометники',
  'races.cometfolk.chain.0.text': 'Хэйли-прайм. Мы рады всем. Что тебя привело?',
  'races.cometfolk.chain.1.text': 'Комета не ищет дом. Дом находит её.',
  'races.cometfolk.chain.2.text': 'Лети с нами одну орбиту. Просто ради.',
  'races.cometfolk.chain.3.text': 'Странствие — это суть. Не цель.',
  'races.cometfolk.chain.4.text': 'Прими наш хвост. Он ведёт куда надо.',
  'races.cometfolk.chain.5.text': 'Помоги молодой комете найти первую орбиту.',
  'races.cometfolk.chain.6.description': 'посланник потерян в хвосте кометы',
  'races.cometfolk.chain.7.text': 'Соглашайся лететь с нами. Мы не теряем попутчиков.',
  'races.cometfolk.chain.8.text': 'Найди потерянный герб нашего рода в поясе астероидов.',
  'races.cometfolk.chain.9.text': 'Ты летел с нами. Теперь ты — часть маршрута.',
  'races.cometfolk.chain.10.text': 'Прими второй виток. Он длиннее первого.',
  'races.cometfolk.chain.11.text': 'Согласись зафиксировать наш маршрут у Молниелов. Мы теряем след.',
  'races.cometfolk.chain.12.text': 'Следуй долгой орбите от Хэйли-прайм до Звукоплав. Без отклонений.',
  'races.cometfolk.chain.14.text': 'Орбита замкнулась. Ты — её якорь.',
  'races.cometfolk.chain.15.text': 'Прими нашу дальнюю орбиту. Она выходит за край карты.',
  'races.cometfolk.chain.16.text': 'Пройди орбиту в обратном направлении. Только так мы найдём потерянный хвост.',
  'races.cometfolk.chain.18.text': 'Согласись лететь дальше известного края. Мы не знаем, что там.',
  'races.cometfolk.chain.19.text': 'Орбита продолжается. Ты — её постоянство.',

  // cosmos event descriptions
  'cosmos.event.solar_flare': 'солнечная буря повредила орбитальные станции',
  'cosmos.event.failed_pact': 'провалившийся пакт со старым союзником',
  'cosmos.event.lost_envoy': 'потеряли посланника',
  'cosmos.event.ritual_disrupted': 'ритуал был прерван',
  'cosmos.event.crystal_resonance': 'кристаллический резонанс затронул их сны',
}

function t(key: string): string {
  return I18N_RU[key] ?? key
}

// ─── Race meta (emoji icons, names) ──────────────────────────────────────────

const RACE_META: Record<RaceId, { name: string; emojiIcon: string }> = {
  crystalloids: { name: 'Кристаллозиды', emojiIcon: '💎' },
  gasouls:      { name: 'Газо-облака',   emojiIcon: '☁️' },
  mechanidons:  { name: 'Механидоны',    emojiIcon: '⚙️' },
  fireworms:    { name: 'Огнечервы',     emojiIcon: '🔥' },
  liquidoids:   { name: 'Жидко-сферы',  emojiIcon: '💧' },
  tenebrians:   { name: 'Тенебрисы',    emojiIcon: '🌑' },
  plasmaspirits:{ name: 'Плазма-духи',  emojiIcon: '⚡' },
  forestcores:  { name: 'Лесо-корени',  emojiIcon: '🌲' },
  timeweavers:  { name: 'Время-ткачи',  emojiIcon: '🌀' },
  cometfolk:    { name: 'Кометники',    emojiIcon: '☄️' },
}

// ─── Raw chain data ───────────────────────────────────────────────────────────
// Exact copy from client/src/game/config/raceChains.ts (sync manually on change).
// Each inner array = 20 ChainItem entries (items 0-19).

type RawChainItem =
  | { type: 'msg'; text_key: string }
  | { type: 'dialog'; text_key: string; accept_delta: number; refuse_delta: number }
  | { type: 'quest_hook'; text_key: string; quest_id: string; accept_delta: number; refuse_delta: number }
  | { type: 'event'; target: RaceId | 'self'; delta: number; text_key: string }

const RACE_CHAINS_RAW: Record<RaceId, readonly RawChainItem[]> = {
  crystalloids: [
    { type: 'msg', text_key: 'races.crystalloids.chain.0.text' },
    { type: 'msg', text_key: 'races.crystalloids.chain.1.text' },
    { type: 'dialog', text_key: 'races.crystalloids.chain.2.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.crystalloids.chain.3.text' },
    { type: 'dialog', text_key: 'races.crystalloids.chain.4.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.crystalloids.chain.5.text', quest_id: 'crystalloids_silent_scout', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.ritual_disrupted' },
    { type: 'dialog', text_key: 'races.crystalloids.chain.7.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.crystalloids.chain.8.text', quest_id: 'crystalloids_shard_delivery', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.crystalloids.chain.9.text' },
    { type: 'dialog', text_key: 'races.crystalloids.chain.10.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'dialog', text_key: 'races.crystalloids.chain.11.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.crystalloids.chain.12.text', quest_id: 'crystalloids_lattice_survey_b', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.crystal_resonance' },
    { type: 'msg', text_key: 'races.crystalloids.chain.14.text' },
    { type: 'dialog', text_key: 'races.crystalloids.chain.15.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.crystalloids.chain.16.text', quest_id: 'crystalloids_lattice_survey_c', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.ritual_disrupted' },
    { type: 'dialog', text_key: 'races.crystalloids.chain.18.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.crystalloids.chain.19.text' },
  ],
  gasouls: [
    { type: 'msg', text_key: 'races.gasouls.chain.0.text' },
    { type: 'msg', text_key: 'races.gasouls.chain.1.text' },
    { type: 'dialog', text_key: 'races.gasouls.chain.2.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.gasouls.chain.3.text' },
    { type: 'dialog', text_key: 'races.gasouls.chain.4.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.gasouls.chain.5.text', quest_id: 'gasouls_lost_note', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.crystal_resonance' },
    { type: 'dialog', text_key: 'races.gasouls.chain.7.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.gasouls.chain.8.text', quest_id: 'gasouls_sunken_resonator', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.gasouls.chain.9.text' },
    { type: 'dialog', text_key: 'races.gasouls.chain.10.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'dialog', text_key: 'races.gasouls.chain.11.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.gasouls.chain.12.text', quest_id: 'gasouls_silent_chorus_b', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.lost_envoy' },
    { type: 'msg', text_key: 'races.gasouls.chain.14.text' },
    { type: 'dialog', text_key: 'races.gasouls.chain.15.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.gasouls.chain.16.text', quest_id: 'gasouls_silent_chorus_c', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.crystal_resonance' },
    { type: 'dialog', text_key: 'races.gasouls.chain.18.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.gasouls.chain.19.text' },
  ],
  mechanidons: [
    { type: 'msg', text_key: 'races.mechanidons.chain.0.text' },
    { type: 'msg', text_key: 'races.mechanidons.chain.1.text' },
    { type: 'dialog', text_key: 'races.mechanidons.chain.2.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.mechanidons.chain.3.text' },
    { type: 'dialog', text_key: 'races.mechanidons.chain.4.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.mechanidons.chain.5.text', quest_id: 'mechanidons_module_delivery', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.failed_pact' },
    { type: 'dialog', text_key: 'races.mechanidons.chain.7.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.mechanidons.chain.8.text', quest_id: 'mechanidons_diagnostics', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.mechanidons.chain.9.text' },
    { type: 'dialog', text_key: 'races.mechanidons.chain.10.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'dialog', text_key: 'races.mechanidons.chain.11.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.mechanidons.chain.12.text', quest_id: 'mechanidons_audit_route_b', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.failed_pact' },
    { type: 'msg', text_key: 'races.mechanidons.chain.14.text' },
    { type: 'dialog', text_key: 'races.mechanidons.chain.15.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.mechanidons.chain.16.text', quest_id: 'mechanidons_audit_route_c', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.solar_flare' },
    { type: 'dialog', text_key: 'races.mechanidons.chain.18.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.mechanidons.chain.19.text' },
  ],
  fireworms: [
    { type: 'msg', text_key: 'races.fireworms.chain.0.text' },
    { type: 'msg', text_key: 'races.fireworms.chain.1.text' },
    { type: 'dialog', text_key: 'races.fireworms.chain.2.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.fireworms.chain.3.text' },
    { type: 'dialog', text_key: 'races.fireworms.chain.4.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.fireworms.chain.5.text', quest_id: 'fireworms_runaway_acolyte', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.solar_flare' },
    { type: 'dialog', text_key: 'races.fireworms.chain.7.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.fireworms.chain.8.text', quest_id: 'fireworms_shard_to_tenebrians', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.fireworms.chain.9.text' },
    { type: 'dialog', text_key: 'races.fireworms.chain.10.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'dialog', text_key: 'races.fireworms.chain.11.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.fireworms.chain.12.text', quest_id: 'fireworms_blood_oath_b', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.solar_flare' },
    { type: 'msg', text_key: 'races.fireworms.chain.14.text' },
    { type: 'dialog', text_key: 'races.fireworms.chain.15.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.fireworms.chain.16.text', quest_id: 'fireworms_blood_oath_c', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.failed_pact' },
    { type: 'dialog', text_key: 'races.fireworms.chain.18.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.fireworms.chain.19.text' },
  ],
  liquidoids: [
    { type: 'msg', text_key: 'races.liquidoids.chain.0.text' },
    { type: 'msg', text_key: 'races.liquidoids.chain.1.text' },
    { type: 'dialog', text_key: 'races.liquidoids.chain.2.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.liquidoids.chain.3.text' },
    { type: 'dialog', text_key: 'races.liquidoids.chain.4.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.liquidoids.chain.5.text', quest_id: 'liquidoids_caravan', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.lost_envoy' },
    { type: 'dialog', text_key: 'races.liquidoids.chain.7.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.liquidoids.chain.8.text', quest_id: 'liquidoids_stolen_cargo', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.liquidoids.chain.9.text' },
    { type: 'dialog', text_key: 'races.liquidoids.chain.10.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'dialog', text_key: 'races.liquidoids.chain.11.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.liquidoids.chain.12.text', quest_id: 'liquidoids_market_truce_b', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.failed_pact' },
    { type: 'msg', text_key: 'races.liquidoids.chain.14.text' },
    { type: 'dialog', text_key: 'races.liquidoids.chain.15.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.liquidoids.chain.16.text', quest_id: 'liquidoids_market_truce_c', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.lost_envoy' },
    { type: 'dialog', text_key: 'races.liquidoids.chain.18.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.liquidoids.chain.19.text' },
  ],
  tenebrians: [
    { type: 'msg', text_key: 'races.tenebrians.chain.0.text' },
    { type: 'msg', text_key: 'races.tenebrians.chain.1.text' },
    { type: 'dialog', text_key: 'races.tenebrians.chain.2.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.tenebrians.chain.3.text' },
    { type: 'dialog', text_key: 'races.tenebrians.chain.4.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.tenebrians.chain.5.text', quest_id: 'tenebrians_hidden_gate', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.ritual_disrupted' },
    { type: 'dialog', text_key: 'races.tenebrians.chain.7.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.tenebrians.chain.8.text', quest_id: 'tenebrians_last_shard', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.tenebrians.chain.9.text' },
    { type: 'dialog', text_key: 'races.tenebrians.chain.10.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'dialog', text_key: 'races.tenebrians.chain.11.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.tenebrians.chain.12.text', quest_id: 'tenebrians_veil_walk_b', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.crystal_resonance' },
    { type: 'msg', text_key: 'races.tenebrians.chain.14.text' },
    { type: 'dialog', text_key: 'races.tenebrians.chain.15.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.tenebrians.chain.16.text', quest_id: 'tenebrians_veil_walk_c', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.failed_pact' },
    { type: 'dialog', text_key: 'races.tenebrians.chain.18.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.tenebrians.chain.19.text' },
  ],
  plasmaspirits: [
    { type: 'msg', text_key: 'races.plasmaspirits.chain.0.text' },
    { type: 'msg', text_key: 'races.plasmaspirits.chain.1.text' },
    { type: 'dialog', text_key: 'races.plasmaspirits.chain.2.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.plasmaspirits.chain.3.text' },
    { type: 'dialog', text_key: 'races.plasmaspirits.chain.4.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.plasmaspirits.chain.5.text', quest_id: 'plasmaspirits_outrun', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.solar_flare' },
    { type: 'dialog', text_key: 'races.plasmaspirits.chain.7.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.plasmaspirits.chain.8.text', quest_id: 'plasmaspirits_lost_flock', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.plasmaspirits.chain.9.text' },
    { type: 'dialog', text_key: 'races.plasmaspirits.chain.10.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'dialog', text_key: 'races.plasmaspirits.chain.11.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.plasmaspirits.chain.12.text', quest_id: 'plasmaspirits_storm_race_b', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.lost_envoy' },
    { type: 'msg', text_key: 'races.plasmaspirits.chain.14.text' },
    { type: 'dialog', text_key: 'races.plasmaspirits.chain.15.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.plasmaspirits.chain.16.text', quest_id: 'plasmaspirits_storm_race_c', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.solar_flare' },
    { type: 'dialog', text_key: 'races.plasmaspirits.chain.18.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.plasmaspirits.chain.19.text' },
  ],
  forestcores: [
    { type: 'msg', text_key: 'races.forestcores.chain.0.text' },
    { type: 'msg', text_key: 'races.forestcores.chain.1.text' },
    { type: 'dialog', text_key: 'races.forestcores.chain.2.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.forestcores.chain.3.text' },
    { type: 'dialog', text_key: 'races.forestcores.chain.4.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.forestcores.chain.5.text', quest_id: 'forestcores_young_forest', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.failed_pact' },
    { type: 'dialog', text_key: 'races.forestcores.chain.7.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.forestcores.chain.8.text', quest_id: 'forestcores_spore_migration', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.forestcores.chain.9.text' },
    { type: 'dialog', text_key: 'races.forestcores.chain.10.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'dialog', text_key: 'races.forestcores.chain.11.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.forestcores.chain.12.text', quest_id: 'forestcores_root_bridge_b', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.ritual_disrupted' },
    { type: 'msg', text_key: 'races.forestcores.chain.14.text' },
    { type: 'dialog', text_key: 'races.forestcores.chain.15.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.forestcores.chain.16.text', quest_id: 'forestcores_root_bridge_c', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.lost_envoy' },
    { type: 'dialog', text_key: 'races.forestcores.chain.18.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.forestcores.chain.19.text' },
  ],
  timeweavers: [
    { type: 'msg', text_key: 'races.timeweavers.chain.0.text' },
    { type: 'msg', text_key: 'races.timeweavers.chain.1.text' },
    { type: 'dialog', text_key: 'races.timeweavers.chain.2.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.timeweavers.chain.3.text' },
    { type: 'dialog', text_key: 'races.timeweavers.chain.4.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.timeweavers.chain.5.text', quest_id: 'timeweavers_temporal_knot', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.ritual_disrupted' },
    { type: 'dialog', text_key: 'races.timeweavers.chain.7.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.timeweavers.chain.8.text', quest_id: 'timeweavers_spiral_link', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.timeweavers.chain.9.text' },
    { type: 'dialog', text_key: 'races.timeweavers.chain.10.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'dialog', text_key: 'races.timeweavers.chain.11.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.timeweavers.chain.12.text', quest_id: 'timeweavers_unspun_thread_b', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.failed_pact' },
    { type: 'msg', text_key: 'races.timeweavers.chain.14.text' },
    { type: 'dialog', text_key: 'races.timeweavers.chain.15.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.timeweavers.chain.16.text', quest_id: 'timeweavers_unspun_thread_c', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.crystal_resonance' },
    { type: 'dialog', text_key: 'races.timeweavers.chain.18.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.timeweavers.chain.19.text' },
  ],
  cometfolk: [
    { type: 'msg', text_key: 'races.cometfolk.chain.0.text' },
    { type: 'msg', text_key: 'races.cometfolk.chain.1.text' },
    { type: 'dialog', text_key: 'races.cometfolk.chain.2.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.cometfolk.chain.3.text' },
    { type: 'dialog', text_key: 'races.cometfolk.chain.4.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.cometfolk.chain.5.text', quest_id: 'cometfolk_young_comet', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.lost_envoy' },
    { type: 'dialog', text_key: 'races.cometfolk.chain.7.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.cometfolk.chain.8.text', quest_id: 'cometfolk_lost_crest', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.cometfolk.chain.9.text' },
    { type: 'dialog', text_key: 'races.cometfolk.chain.10.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'dialog', text_key: 'races.cometfolk.chain.11.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.cometfolk.chain.12.text', quest_id: 'cometfolk_long_orbit_b', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.solar_flare' },
    { type: 'msg', text_key: 'races.cometfolk.chain.14.text' },
    { type: 'dialog', text_key: 'races.cometfolk.chain.15.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'quest_hook', text_key: 'races.cometfolk.chain.16.text', quest_id: 'cometfolk_long_orbit_c', accept_delta: 1, refuse_delta: -1 },
    { type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.ritual_disrupted' },
    { type: 'dialog', text_key: 'races.cometfolk.chain.18.text', accept_delta: 1, refuse_delta: -1 },
    { type: 'msg', text_key: 'races.cometfolk.chain.19.text' },
  ],
}

// ─── Quest catalogue (40 entries, mirror of client/src/game/config/quests.ts) ─

const QUESTS_RAW: QuestConfigSerialized[] = [
  // crystalloids
  { id: 'crystalloids_silent_scout', raceId: 'crystalloids', type: 'exploration', target: { kind: 'planets_visited', value: 5 }, reward: { kind: 'essence', value: 1 }, description_key: 'quests.crystalloids_silent_scout.description', short_key: 'quests.crystalloids_silent_scout.short', difficulty: 'easy' },
  { id: 'crystalloids_shard_delivery', raceId: 'crystalloids', type: 'delivery', target: { kind: 'serum_count', element: 'crystal', value: 5 }, reward: { kind: 'gold', value: 10000000 }, description_key: 'quests.crystalloids_shard_delivery.description', short_key: 'quests.crystalloids_shard_delivery.short', difficulty: 'easy' },
  { id: 'crystalloids_lattice_survey_b', raceId: 'crystalloids', type: 'diplomacy', target: { kind: 'raise_relationship', raceId: 'crystalloids', tier: 6 }, reward: { kind: 'relationship_and_bonus', raceId: 'crystalloids', bonus_id: 'gold_income_1pct' }, description_key: 'quests.crystalloids_lattice_survey_b.description', short_key: 'quests.crystalloids_lattice_survey_b.short', difficulty: 'medium' },
  { id: 'crystalloids_lattice_survey_c', raceId: 'crystalloids', type: 'merge', target: { kind: 'merge_to_level', level: 17 }, reward: { kind: 'essence', value: 5 }, description_key: 'quests.crystalloids_lattice_survey_c.description', short_key: 'quests.crystalloids_lattice_survey_c.short', difficulty: 'hard' },
  // gasouls
  { id: 'gasouls_lost_note', raceId: 'gasouls', type: 'delivery', target: { kind: 'serum_count', element: 'gas', value: 5 }, reward: { kind: 'essence', value: 1 }, description_key: 'quests.gasouls_lost_note.description', short_key: 'quests.gasouls_lost_note.short', difficulty: 'easy' },
  { id: 'gasouls_sunken_resonator', raceId: 'gasouls', type: 'exploration', target: { kind: 'missions_complete', value: 3 }, reward: { kind: 'serum', element: 'gas', count: 1 }, description_key: 'quests.gasouls_sunken_resonator.description', short_key: 'quests.gasouls_sunken_resonator.short', difficulty: 'easy' },
  { id: 'gasouls_silent_chorus_b', raceId: 'gasouls', type: 'diplomacy', target: { kind: 'raise_relationship', raceId: 'gasouls', tier: 6 }, reward: { kind: 'gold', value: 100000000 }, description_key: 'quests.gasouls_silent_chorus_b.description', short_key: 'quests.gasouls_silent_chorus_b.short', difficulty: 'medium' },
  { id: 'gasouls_silent_chorus_c', raceId: 'gasouls', type: 'merge', target: { kind: 'merge_count', value: 200 }, reward: { kind: 'essence', value: 5 }, description_key: 'quests.gasouls_silent_chorus_c.description', short_key: 'quests.gasouls_silent_chorus_c.short', difficulty: 'hard' },
  // mechanidons
  { id: 'mechanidons_module_delivery', raceId: 'mechanidons', type: 'delivery', target: { kind: 'serum_count', element: 'crystal', value: 5 }, reward: { kind: 'essence', value: 1 }, description_key: 'quests.mechanidons_module_delivery.description', short_key: 'quests.mechanidons_module_delivery.short', difficulty: 'easy' },
  { id: 'mechanidons_diagnostics', raceId: 'mechanidons', type: 'exploration', target: { kind: 'missions_complete', value: 3 }, reward: { kind: 'gold', value: 10000000 }, description_key: 'quests.mechanidons_diagnostics.description', short_key: 'quests.mechanidons_diagnostics.short', difficulty: 'easy' },
  { id: 'mechanidons_audit_route_b', raceId: 'mechanidons', type: 'diplomacy', target: { kind: 'raise_relationship', raceId: 'mechanidons', tier: 6 }, reward: { kind: 'relationship_and_bonus', raceId: 'mechanidons', bonus_id: 'ship_speed_1pct' }, description_key: 'quests.mechanidons_audit_route_b.description', short_key: 'quests.mechanidons_audit_route_b.short', difficulty: 'medium' },
  { id: 'mechanidons_audit_route_c', raceId: 'mechanidons', type: 'merge', target: { kind: 'merge_to_level', level: 17 }, reward: { kind: 'gold', value: 500000000 }, description_key: 'quests.mechanidons_audit_route_c.description', short_key: 'quests.mechanidons_audit_route_c.short', difficulty: 'hard' },
  // fireworms
  { id: 'fireworms_runaway_acolyte', raceId: 'fireworms', type: 'exploration', target: { kind: 'planets_visited', value: 5 }, reward: { kind: 'serum', element: 'fire', count: 1 }, description_key: 'quests.fireworms_runaway_acolyte.description', short_key: 'quests.fireworms_runaway_acolyte.short', difficulty: 'easy' },
  { id: 'fireworms_shard_to_tenebrians', raceId: 'fireworms', type: 'delivery', target: { kind: 'serum_count', element: 'fire', value: 5 }, reward: { kind: 'gold', value: 10000000 }, description_key: 'quests.fireworms_shard_to_tenebrians.description', short_key: 'quests.fireworms_shard_to_tenebrians.short', difficulty: 'easy' },
  { id: 'fireworms_blood_oath_b', raceId: 'fireworms', type: 'merge', target: { kind: 'merge_count', value: 50 }, reward: { kind: 'essence', value: 3 }, description_key: 'quests.fireworms_blood_oath_b.description', short_key: 'quests.fireworms_blood_oath_b.short', difficulty: 'medium' },
  { id: 'fireworms_blood_oath_c', raceId: 'fireworms', type: 'merge', target: { kind: 'merge_to_level', level: 17 }, reward: { kind: 'relationship_and_bonus', raceId: 'fireworms', bonus_id: 'serum_drop_1pct' }, description_key: 'quests.fireworms_blood_oath_c.description', short_key: 'quests.fireworms_blood_oath_c.short', difficulty: 'hard' },
  // liquidoids
  { id: 'liquidoids_caravan', raceId: 'liquidoids', type: 'delivery', target: { kind: 'serum_count', element: 'water', value: 5 }, reward: { kind: 'gold', value: 10000000 }, description_key: 'quests.liquidoids_caravan.description', short_key: 'quests.liquidoids_caravan.short', difficulty: 'easy' },
  { id: 'liquidoids_stolen_cargo', raceId: 'liquidoids', type: 'exploration', target: { kind: 'planets_visited', value: 5 }, reward: { kind: 'essence', value: 1 }, description_key: 'quests.liquidoids_stolen_cargo.description', short_key: 'quests.liquidoids_stolen_cargo.short', difficulty: 'easy' },
  { id: 'liquidoids_market_truce_b', raceId: 'liquidoids', type: 'diplomacy', target: { kind: 'raise_relationship', raceId: 'liquidoids', tier: 6 }, reward: { kind: 'gold', value: 100000000 }, description_key: 'quests.liquidoids_market_truce_b.description', short_key: 'quests.liquidoids_market_truce_b.short', difficulty: 'medium' },
  { id: 'liquidoids_market_truce_c', raceId: 'liquidoids', type: 'merge', target: { kind: 'merge_count', value: 200 }, reward: { kind: 'essence', value: 5 }, description_key: 'quests.liquidoids_market_truce_c.description', short_key: 'quests.liquidoids_market_truce_c.short', difficulty: 'hard' },
  // tenebrians
  { id: 'tenebrians_hidden_gate', raceId: 'tenebrians', type: 'exploration', target: { kind: 'planets_visited', value: 5 }, reward: { kind: 'essence', value: 1 }, description_key: 'quests.tenebrians_hidden_gate.description', short_key: 'quests.tenebrians_hidden_gate.short', difficulty: 'easy' },
  { id: 'tenebrians_last_shard', raceId: 'tenebrians', type: 'delivery', target: { kind: 'serum_count', element: 'toxic', value: 5 }, reward: { kind: 'gold', value: 10000000 }, description_key: 'quests.tenebrians_last_shard.description', short_key: 'quests.tenebrians_last_shard.short', difficulty: 'easy' },
  { id: 'tenebrians_veil_walk_b', raceId: 'tenebrians', type: 'diplomacy', target: { kind: 'raise_relationship', raceId: 'tenebrians', tier: 6 }, reward: { kind: 'relationship_and_bonus', raceId: 'tenebrians', bonus_id: 'shadow_serum_drop' }, description_key: 'quests.tenebrians_veil_walk_b.description', short_key: 'quests.tenebrians_veil_walk_b.short', difficulty: 'medium' },
  { id: 'tenebrians_veil_walk_c', raceId: 'tenebrians', type: 'merge', target: { kind: 'merge_to_level', level: 17 }, reward: { kind: 'essence', value: 5 }, description_key: 'quests.tenebrians_veil_walk_c.description', short_key: 'quests.tenebrians_veil_walk_c.short', difficulty: 'hard' },
  // plasmaspirits
  { id: 'plasmaspirits_outrun', raceId: 'plasmaspirits', type: 'exploration', target: { kind: 'planets_visited', value: 5 }, reward: { kind: 'serum', element: 'plasma', count: 1 }, description_key: 'quests.plasmaspirits_outrun.description', short_key: 'quests.plasmaspirits_outrun.short', difficulty: 'easy' },
  { id: 'plasmaspirits_lost_flock', raceId: 'plasmaspirits', type: 'exploration', target: { kind: 'missions_complete', value: 3 }, reward: { kind: 'essence', value: 1 }, description_key: 'quests.plasmaspirits_lost_flock.description', short_key: 'quests.plasmaspirits_lost_flock.short', difficulty: 'easy' },
  { id: 'plasmaspirits_storm_race_b', raceId: 'plasmaspirits', type: 'merge', target: { kind: 'merge_count', value: 50 }, reward: { kind: 'gold', value: 100000000 }, description_key: 'quests.plasmaspirits_storm_race_b.description', short_key: 'quests.plasmaspirits_storm_race_b.short', difficulty: 'medium' },
  { id: 'plasmaspirits_storm_race_c', raceId: 'plasmaspirits', type: 'merge', target: { kind: 'merge_to_level', level: 17 }, reward: { kind: 'essence', value: 5 }, description_key: 'quests.plasmaspirits_storm_race_c.description', short_key: 'quests.plasmaspirits_storm_race_c.short', difficulty: 'hard' },
  // forestcores
  { id: 'forestcores_young_forest', raceId: 'forestcores', type: 'exploration', target: { kind: 'planets_visited', value: 5 }, reward: { kind: 'serum', element: 'forest', count: 1 }, description_key: 'quests.forestcores_young_forest.description', short_key: 'quests.forestcores_young_forest.short', difficulty: 'easy' },
  { id: 'forestcores_spore_migration', raceId: 'forestcores', type: 'exploration', target: { kind: 'missions_complete', value: 3 }, reward: { kind: 'gold', value: 10000000 }, description_key: 'quests.forestcores_spore_migration.description', short_key: 'quests.forestcores_spore_migration.short', difficulty: 'easy' },
  { id: 'forestcores_root_bridge_b', raceId: 'forestcores', type: 'diplomacy', target: { kind: 'raise_relationship', raceId: 'forestcores', tier: 6 }, reward: { kind: 'relationship_and_bonus', raceId: 'forestcores', bonus_id: 'forest_serum_drop' }, description_key: 'quests.forestcores_root_bridge_b.description', short_key: 'quests.forestcores_root_bridge_b.short', difficulty: 'medium' },
  { id: 'forestcores_root_bridge_c', raceId: 'forestcores', type: 'merge', target: { kind: 'merge_to_level', level: 17 }, reward: { kind: 'essence', value: 5 }, description_key: 'quests.forestcores_root_bridge_c.description', short_key: 'quests.forestcores_root_bridge_c.short', difficulty: 'hard' },
  // timeweavers
  { id: 'timeweavers_temporal_knot', raceId: 'timeweavers', type: 'exploration', target: { kind: 'missions_complete', value: 5 }, reward: { kind: 'essence', value: 1 }, description_key: 'quests.timeweavers_temporal_knot.description', short_key: 'quests.timeweavers_temporal_knot.short', difficulty: 'easy' },
  { id: 'timeweavers_spiral_link', raceId: 'timeweavers', type: 'delivery', target: { kind: 'serum_count', element: 'binary', value: 5 }, reward: { kind: 'gold', value: 10000000 }, description_key: 'quests.timeweavers_spiral_link.description', short_key: 'quests.timeweavers_spiral_link.short', difficulty: 'easy' },
  { id: 'timeweavers_unspun_thread_b', raceId: 'timeweavers', type: 'diplomacy', target: { kind: 'raise_relationship', raceId: 'timeweavers', tier: 6 }, reward: { kind: 'relationship_and_bonus', raceId: 'timeweavers', bonus_id: 'void_serum_drop' }, description_key: 'quests.timeweavers_unspun_thread_b.description', short_key: 'quests.timeweavers_unspun_thread_b.short', difficulty: 'medium' },
  { id: 'timeweavers_unspun_thread_c', raceId: 'timeweavers', type: 'merge', target: { kind: 'merge_to_level', level: 17 }, reward: { kind: 'essence', value: 5 }, description_key: 'quests.timeweavers_unspun_thread_c.description', short_key: 'quests.timeweavers_unspun_thread_c.short', difficulty: 'hard' },
  // cometfolk
  { id: 'cometfolk_young_comet', raceId: 'cometfolk', type: 'exploration', target: { kind: 'planets_visited', value: 5 }, reward: { kind: 'serum', element: 'binary', count: 1 }, description_key: 'quests.cometfolk_young_comet.description', short_key: 'quests.cometfolk_young_comet.short', difficulty: 'easy' },
  { id: 'cometfolk_lost_crest', raceId: 'cometfolk', type: 'delivery', target: { kind: 'serum_count', element: 'binary', value: 5 }, reward: { kind: 'gold', value: 10000000 }, description_key: 'quests.cometfolk_lost_crest.description', short_key: 'quests.cometfolk_lost_crest.short', difficulty: 'easy' },
  { id: 'cometfolk_long_orbit_b', raceId: 'cometfolk', type: 'diplomacy', target: { kind: 'raise_relationship', raceId: 'cometfolk', tier: 6 }, reward: { kind: 'relationship_and_bonus', raceId: 'cometfolk', bonus_id: 'binary_serum_drop' }, description_key: 'quests.cometfolk_long_orbit_b.description', short_key: 'quests.cometfolk_long_orbit_b.short', difficulty: 'medium' },
  { id: 'cometfolk_long_orbit_c', raceId: 'cometfolk', type: 'merge', target: { kind: 'merge_to_level', level: 17 }, reward: { kind: 'essence', value: 5 }, description_key: 'quests.cometfolk_long_orbit_c.description', short_key: 'quests.cometfolk_long_orbit_c.short', difficulty: 'hard' },
]

// ─── Serializer ───────────────────────────────────────────────────────────────

function serializeChain(raceId: RaceId): ChainItemSerialized[] {
  const items = RACE_CHAINS_RAW[raceId]
  return items.map((item, step): ChainItemSerialized => {
    const base: ChainItemSerialized = {
      type: item.type,
      step,
      text_key: item.text_key,
    }

    if (item.type === 'msg') {
      base.text = t(item.text_key)
    } else if (item.type === 'dialog') {
      base.text = t(item.text_key)
      base.accept_delta = item.accept_delta
      base.refuse_delta = item.refuse_delta
    } else if (item.type === 'quest_hook') {
      base.text = t(item.text_key)
      base.quest_id = item.quest_id
      base.accept_delta = item.accept_delta
      base.refuse_delta = item.refuse_delta
    } else if (item.type === 'event') {
      base.target = item.target
      base.delta = item.delta
      base.description = t(item.text_key)
    }

    return base
  })
}

// ─── Pre-built response payload (built once at module load) ──────────────────

const RACE_IDS: readonly RaceId[] = [
  'crystalloids',
  'gasouls',
  'mechanidons',
  'fireworms',
  'liquidoids',
  'tenebrians',
  'plasmaspirits',
  'forestcores',
  'timeweavers',
  'cometfolk',
]

export const CHAINS_RESPONSE: ChainsResponse = {
  races: RACE_IDS.map((id) => ({
    id,
    name: RACE_META[id].name,
    emojiIcon: RACE_META[id].emojiIcon,
    chain: serializeChain(id),
  })),
  quests: QUESTS_RAW,
}
