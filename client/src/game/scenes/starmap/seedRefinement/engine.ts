// Phase 20-XX: SeedRefinementEngine — извлечён из StarMapScene.ts.
// Изолирует логику обеспечения уникальности сигнатур (texture / anim / sound)
// для всех систем (Race + BgSystem). Перепишет `seed`/`rngSeed` где найдены коллизии.
//
// Public API:
//   - mainSeedOverride: readonly Map<string, number> — public для совместимости с
//     starmap/popovers.ts и starmap/popovers/animationOrchestrator.ts (читают
//     scene.mainSeedOverride через animRng/effectiveSeed). Сцена выставляет этот
//     Map наружу через геттер делегацией к engine.
//   - refineAll(systems): композирует texture → anim → sound → texture
//     (тот же порядок и двойной texture-pass, что был в StarMapScene.create()).
//   - refineTextures / refineAnims / refineSounds — индивидуальные проходы,
//     если нужно вызвать порознь (для тестов / диагностики).
//
// История:
// • До рефакторинга все 7 методов (refineTexture/Anim/SoundSeeds, build*Signature,
//   quantize) и поле mainSeedOverride жили на StarMapScene.
// • THEME_COMPONENTS остаётся на сцене (его читают также popovers.ts,
//   animationOrchestrator.ts и др.). Engine получает его через конструктор
//   как readonly reference.

import type { Race, BgSystem } from '../types'
import { mulberry32, hashId, effectiveSeed, animRng } from '../helpers'
import { deriveModulations } from '../../../../audio/planetVoice'
import { devLog } from '../../../../utils/devLog'

export class SeedRefinementEngine {
  // Phase 7: override-карта для main races (которым нельзя мутировать rngSeed как BG).
  // Заполняется в refineAnims() / refineSounds() при коллизиях signatures.
  // Public — popovers.ts и popovers/animationOrchestrator.ts читают через
  // scene.mainSeedOverride (делегация в сцене).
  readonly mainSeedOverride = new Map<string, number>()

  // THEME_COMPONENTS живёт на сцене (читают также popovers.ts и
  // popovers/animationOrchestrator.ts).
  // Engine получает readonly reference — buildAnimSignature только читает.
  constructor(private readonly themeComponents: Record<string, number[]>) {}

  // Композитный pipeline: texture → anim → sound → texture (стабилизирует
  // редкие texture коллизии после anim/sound mutation; см. комментарий в create()).
  refineAll(systems: ReadonlyArray<Race | BgSystem>): void {
    this.refineTextures(systems)
    this.refineAnims(systems)
    this.refineSounds(systems)
    // Phase 8 plan 06: anim+sound refine могут изменить rngSeed → редко создают
    // новую texture коллизию (наблюдение: 1 collision из 984 после первого прогона).
    // Второй проход texture refine стабилизирует pipeline до 984/984 unique.
    this.refineTextures(systems)
  }

  // === PHASE 7: UNIQUENESS CHECK ===

  // Phase 8: квантует значение в индекс ближайшего бина (по abs distance).
  // thresholds — отсортированный массив центров бинов. Возвращает 0..thresholds.length-1.
  private quantize(value: number, thresholds: number[]): number {
    let bestIdx = 0
    let bestDist = Math.abs(value - thresholds[0])
    for (let i = 1; i < thresholds.length; i++) {
      const d = Math.abs(value - thresholds[i])
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    return bestIdx
  }

  // Симулирует первые RNG-вызовы playUniqueAnimation и возвращает signature.
  // Должен ТОЧНО реплицировать порядок rng() calls в реальной игре.
  // Phase 8: signature расширена strict-параметрами (rotationBin, scaleBin, hueBin, delayBins)
  // для отлова коллизий по visible-различимым параметрам, не только recipe set.
  private buildAnimSignature(sys: Race | BgSystem): string {
    const rng = animRng(sys, this.mainSeedOverride)
    const theme = (sys as BgSystem).archetype ?? sys.type
    const pool = this.themeComponents[theme] ?? [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]

    // (1) recipe size + components — реплицирует playUniqueAnimation
    //     (см. popovers/animationOrchestrator.ts)
    const r1 = rng()
    const targetCount = r1 < 0.5 ? 2 : r1 < 0.85 ? 3 : 4
    const compCount = Math.min(targetCount, pool.length)
    const used = new Set<number>()
    const components: number[] = []
    while (components.length < compCount) {
      const c = pool[Math.floor(rng() * pool.length)]
      if (!used.has(c)) {
        used.add(c)
        components.push(c)
      }
    }

    // (2) modifier flag + rotation/scale (реплицирует playUniqueAnimation
    //     в popovers/animationOrchestrator.ts)
    const useModifier = rng() < 0.25
    const modRotation = useModifier ? (rng() - 0.5) * Math.PI : 0
    const modScale = useModifier ? 0.7 + rng() * 0.6 : 1

    // Phase 8: квантуем modifier params в бины
    // rotation: 4 бина около (-π/2, -π/4, +π/4, +π/2); -1 если modifier нет
    const rotationBin = useModifier
      ? this.quantize(modRotation, [
          -Math.PI / 2,
          -Math.PI / 4,
          Math.PI / 4,
          Math.PI / 2,
        ])
      : -1
    // scale: 4 бина около (0.7, 0.85, 1.15, 1.3); -1 если modifier нет
    const scaleBin = useModifier
      ? this.quantize(modScale, [0.7, 0.85, 1.15, 1.3])
      : -1

    // (3) hue_bin: дополнительный детерминированный hash от seed (НЕ дёргает rng).
    // ВАЖНО: pickColor вызывает rng() уже внутри runAnimComponent
    // (popovers/animationOrchestrator.ts) — мы НЕ можем повторить этот порядок
    // в signature, т.к. он зависит от внутренностей comp.
    // Решение: используем raw seed (как его вычисляет animRng) и проектируем в 8 бинов.
    const seedSource =
      'rngSeed' in sys && typeof (sys as BgSystem).rngSeed === 'number'
        ? (sys as BgSystem).rngSeed
        : (this.mainSeedOverride.get(sys.id) ?? hashId(sys.id))
    // Проектируем seed в 8 hue bins (0..7)
    const hueBin = (seedSource >>> 5) & 0x7

    // (4) delay_bins per non-first comp (3 бина: <100ms / 100-199ms / ≥200ms)
    // ВАЖНО: реплицирует playUniqueAnimation (popovers/animationOrchestrator.ts) —
    // `Math.floor(rng() * 250) + 50` (диапазон 50..299), затем мы квантуем в 3 бина.
    const delayBins: number[] = []
    for (let i = 1; i < components.length; i++) {
      const delay = Math.floor(rng() * 250) + 50
      let bin: number
      if (delay < 100) bin = 0
      else if (delay < 200) bin = 1
      else bin = 2
      delayBins.push(bin)
    }

    // Sorted comps for set-equality (как в Phase 7), плюс strict params
    // (rotationBin, scaleBin, hueBin, delayBins encoded in segments r/s/h/d).
    const compsKey = [...components].sort((a, b) => a - b).join(',')
    return `${compsKey}|m${useModifier ? 1 : 0}|r${rotationBin}|s${scaleBin}|h${hueBin}|d${delayBins.join(',')}|${theme}`
  }

  // После создания allSystems — refine seeds для уникальности recipe.
  // Если signature уже встречалась → детерминированно мутируем seed и пересчитываем.
  // Phase 8: после strict signature — 10 attempts на mutate seed (Phase 7 был 5).
  // Mutation: seed XOR ((attempt+1) * 0x9e3779b9) — golden ratio константа для distribution.
  refineAnims(systems: ReadonlyArray<Race | BgSystem>): void {
    const sigs = new Map<string, string>()
    let conflicts = 0
    for (const sys of systems) {
      let attempt = 0
      let sig = this.buildAnimSignature(sys)
      while (sigs.has(sig) && attempt < 10) {
        const isBg =
          'rngSeed' in sys && typeof (sys as BgSystem).rngSeed === 'number'
        const cur = isBg
          ? (sys as BgSystem).rngSeed
          : (this.mainSeedOverride.get(sys.id) ?? hashId(sys.id))
        const newSeed = (cur ^ ((attempt + 1) * 0x9e3779b9)) >>> 0
        if (isBg) {
          ;(sys as BgSystem).rngSeed = newSeed
        } else {
          this.mainSeedOverride.set(sys.id, newSeed)
        }
        sig = this.buildAnimSignature(sys)
        attempt++
        if (attempt === 10 && sigs.has(sig)) conflicts++
      }
      sigs.set(sig, sys.id)
    }
    devLog(
      `[StarMap] anim signatures (strict): ${sigs.size}/${systems.length} unique, ${conflicts} unresolved conflicts (max 10 attempts)`,
    )
  }

  // Phase 8: signature формат tuple-string. archetype|pitch|rot|inv|det|cutoff.
  // Используется для refineSounds — гарантирует 1000/1000 unique sound signatures.
  private buildSoundSignature(sys: Race | BgSystem): string {
    const archetype = (sys as BgSystem).archetype ?? sys.type
    const seed = effectiveSeed(sys, this.mainSeedOverride)
    const m = deriveModulations(seed, archetype)
    return `${archetype}|${m.pitchStep}|${m.rotationIdx}|${m.inversionIdx}|${m.detuneBin}|${m.cutoffBin}`
  }

  // Phase 8: третий refine pass (после texture → anim → sound).
  // При коллизии sound signature мутирует seed XOR ((attempt+1) * 0xc2b2ae3d).
  // До 10 attempts на планету. Логирует unique/total + unresolved в консоль.
  // ВАЖНО: эта мутация seed повлияет на anim signature, поэтому проводится ПОСЛЕДНЕЙ
  // (после texture и anim refine). Обратная зависимость допустима: после Sound mutation
  // мы НЕ возвращаемся к anim refine, потому что anim signature space уже достаточен
  // (10 attempts × strict signature) для absorbing новых мутаций.
  // Mutation constant 0xc2b2ae3d (FNV-1a hash multiplier) отличается от anim (0x9e3779b9)
  // и texture (0x85ebca6b) чтобы каждый pass разводил seeds в РАЗНОМ направлении.
  refineSounds(systems: ReadonlyArray<Race | BgSystem>): void {
    const sigs = new Map<string, string>()
    let conflicts = 0
    for (const sys of systems) {
      let attempt = 0
      let sig = this.buildSoundSignature(sys)
      while (sigs.has(sig) && attempt < 10) {
        const isBg =
          'rngSeed' in sys && typeof (sys as BgSystem).rngSeed === 'number'
        const cur = isBg
          ? (sys as BgSystem).rngSeed
          : (this.mainSeedOverride.get(sys.id) ?? hashId(sys.id))
        const newSeed = (cur ^ ((attempt + 1) * 0xc2b2ae3d)) >>> 0
        if (isBg) {
          ;(sys as BgSystem).rngSeed = newSeed
        } else {
          this.mainSeedOverride.set(sys.id, newSeed)
        }
        sig = this.buildSoundSignature(sys)
        attempt++
        if (attempt === 10 && sigs.has(sig)) conflicts++
      }
      sigs.set(sig, sys.id)
    }
    devLog(
      `[StarMap] sound signatures: ${sigs.size}/${systems.length} unique, ${conflicts} unresolved conflicts (max 10 attempts)`,
    )
  }

  // Phase 7: signature для текстуры BG-планеты — реплицирует первые ~10 rng() calls
  // в renderBgPoint. Captures: aura/baseRotation/sub-variant choice + первые counts +
  // флаги universal modifiers. Main races не учитываются (уникальны по id).
  private buildTextureSignature(sys: Race | BgSystem): string {
    if (!('archetype' in sys)) return `main:${sys.id}`
    const bg = sys as BgSystem
    const rng = mulberry32(bg.rngSeed)
    // 1) sparkle decision
    rng()
    // 2) aura
    const showAura =
      bg.archetype !== 'dead' &&
      bg.archetype !== 'mineral' &&
      bg.archetype !== 'desert'
    if (showAura) {
      rng() // auraR
      rng() // auraAlpha
      if (rng() < 0.3) {
        rng() // double aura
      }
    }
    // 3) base color shift
    rng() // 0.92 + rng() * 0.07
    rng() // ringOffsetAng
    rng() // ringOffsetMag
    rng() // size factor
    // 4) baseRotation
    rng()
    // 5) sub-variant choice (введём в Task 9 в renderBgPoint, signature заранее реплицирует)
    const variant = Math.floor(rng() * 3)
    // 6-7) первые 2 counts (зависит от archetype, но возьмём как general 0-4)
    const c1 = Math.floor(rng() * 5)
    const c2 = Math.floor(rng() * 5)
    // Phase 8: third count для расширения signature space (особенно важно для dead variant 2 — bare)
    const c3 = Math.floor(rng() * 5)
    // 8) modifier flags (universal modifiers)
    const surfaceLines = rng() < 0.15 ? 1 : 0
    const gradientBands = rng() < 0.12 ? 1 : 0
    const multiSpots = rng() < 0.15 ? 1 : 0
    const stackedRings = rng() < 0.08 ? 1 : 0
    // Phase 8: asymmetric atmosphere + color speckle modifiers (последние 2 universal modifiers)
    const asym = rng() < 0.2 ? 1 : 0
    const speckle = rng() < 0.25 ? 1 : 0
    return `${bg.archetype}:v${variant}:c${c1}-${c2}-${c3}:m${surfaceLines}${gradientBands}${multiSpots}${stackedRings}${asym}${speckle}`
  }

  // Phase 7: refine seed для текстур. Вызывается ДО refineAnims().
  // Phase 8: 10 attempts (вместо 5) — consistent с refineAnims; используется
  // расширенный signature space (c3, asym, speckle).
  refineTextures(systems: ReadonlyArray<Race | BgSystem>): void {
    const sigs = new Map<string, string>()
    let conflicts = 0
    let bgCount = 0
    for (const sys of systems) {
      if (!('archetype' in sys)) continue // skip main
      bgCount++
      const bg = sys as BgSystem
      let attempt = 0
      let sig = this.buildTextureSignature(bg)
      while (sigs.has(sig) && attempt < 10) {
        const cur = bg.rngSeed
        bg.rngSeed = (cur ^ ((attempt + 1) * 0x85ebca6b)) >>> 0
        sig = this.buildTextureSignature(bg)
        attempt++
        if (attempt === 10 && sigs.has(sig)) conflicts++
      }
      sigs.set(sig, sys.id)
    }
    devLog(
      `[StarMap] texture signatures: ${sigs.size}/${bgCount} unique BG, ${conflicts} unresolved`,
    )
  }
}
