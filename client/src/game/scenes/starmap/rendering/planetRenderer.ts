// Phase 20-XX (StarMapScene refactor, step 4): PlanetRenderer extracted.
// Owns the two large rendering methods previously on StarMapScene:
//   - renderMain(sys: Race) — рисует одну из 16 главных рас.
//   - renderBg(sys: BgSystem) — рисует одну из 984 фоновых систем разных архетипов.
//
// Поведение и алгоритм рендера сохранены строго как было: RNG, palette,
// signature ordering, LOD регистрация — без изменений. Класс — тонкая
// обёртка над scene-state (cullableData, moons, bgArchetypeGfx, и т.д.),
// которые остаются на StarMapScene и доступны через this.scene.X.
//
// Public API:
//   - new PlanetRenderer(scene)
//   - planetRenderer.renderMain(sys)
//   - planetRenderer.renderBg(sys)
//
// Призывается из starfield.ts:renderSystem() диспетчера через
// scene.planetRenderer.renderMain / renderBg.

import Phaser from 'phaser'
import { eventBus } from '../../../../store/eventBus'
import type { StarMapScene } from '../../StarMapScene'
import type { Race, BgSystem } from '../types'
import { mulberry32 } from '../helpers'
import { createSparkleAt } from '../starfield'
import { DPR, BG_PLANET_MIN_ZOOM, generatePalette } from '../planetarium'

export class PlanetRenderer {
  private scene: StarMapScene

  constructor(scene: StarMapScene) {
    this.scene = scene
  }

  // Phase 20-04 (Wave 4): package-public — вызывается из starfield.ts (renderSystem dispatcher).
  renderMain(sys: Race) {
    // Sparkle над планетой — один на каждую главную расу.
    // Создаётся в world coords (НЕ child container), чтобы не зависеть от LOD-скрытия.
    createSparkleAt(
      this.scene,
      sys.x,
      sys.y,
      sys.size,
      mulberry32(sys.id.charCodeAt(0) * 7919 + 13),
    )

    const container = this.scene.add.container(sys.x, sys.y)
    const g = this.scene.add.graphics()

    if (sys.id === 'home') {
      // Phase 7: HOME — выразительные континенты + облачный покров
      g.fillStyle(0x0c4a6e)
      g.fillCircle(0, 0, sys.size)
      g.fillStyle(sys.color)
      g.fillCircle(-4 * DPR, -3 * DPR, sys.size * 0.95)
      // Континенты (зелёные)
      g.fillStyle(sys.accent, 0.85)
      g.fillEllipse(-12 * DPR, 2 * DPR, 28 * DPR, 18 * DPR)
      g.fillStyle(sys.accent, 0.7)
      g.fillEllipse(15 * DPR, -10 * DPR, 20 * DPR, 14 * DPR)
      g.fillStyle(sys.accent, 0.6)
      g.fillCircle(8 * DPR, 18 * DPR, 10 * DPR)
      // Phase 7: дополнительные мелкие острова
      g.fillStyle(sys.accent, 0.7)
      g.fillEllipse(-18 * DPR, -16 * DPR, 12 * DPR, 8 * DPR)
      g.fillStyle(sys.accent, 0.6)
      g.fillCircle(20 * DPR, 12 * DPR, 5 * DPR)
      // Phase 7: тонкие облачные слои
      g.fillStyle(0xffffff, 0.25)
      g.fillEllipse(-2 * DPR, -8 * DPR, 32 * DPR, 4 * DPR)
      g.fillStyle(0xffffff, 0.2)
      g.fillEllipse(2 * DPR, 14 * DPR, 28 * DPR, 3 * DPR)
      // Полярные шапки
      g.fillStyle(0xffffff, 0.8)
      g.fillEllipse(0, -sys.size * 0.85, sys.size * 0.4, sys.size * 0.12)
      g.fillStyle(0xffffff, 0.7)
      g.fillEllipse(0, sys.size * 0.85, sys.size * 0.35, sys.size * 0.1)
      // Атмосфера
      g.lineStyle(2 * DPR, 0x7dd3fc, 0.4)
      g.strokeCircle(0, 0, sys.size + 4 * DPR)
      g.lineStyle(1 * DPR, 0xa5f3fc, 0.2)
      g.strokeCircle(0, 0, sys.size + 8 * DPR)
    } else if (sys.id === 'relict') {
      // Phase 7: RELICT — больше шрамов и обломков
      g.fillStyle(0x171717)
      g.fillCircle(0, 0, sys.size)
      // Большие диагональные трещины
      g.lineStyle(3 * DPR, sys.color, 0.6)
      g.lineBetween(
        -sys.size * 0.6,
        -sys.size * 0.6,
        sys.size * 0.6,
        sys.size * 0.6,
      )
      g.lineBetween(
        -sys.size * 0.6,
        sys.size * 0.6,
        sys.size * 0.6,
        -sys.size * 0.6,
      )
      // Phase 7: дополнительные мелкие шрамы
      g.lineStyle(1.5 * DPR, sys.color, 0.5)
      g.lineBetween(-sys.size * 0.5, 0, sys.size * 0.3, sys.size * 0.4)
      g.lineBetween(0, -sys.size * 0.5, -sys.size * 0.3, sys.size * 0.3)
      // Кратеры от ударов
      g.fillStyle(0x000000, 0.7)
      g.fillCircle(-sys.size * 0.3, sys.size * 0.2, sys.size * 0.12)
      g.fillStyle(0x000000, 0.6)
      g.fillCircle(sys.size * 0.35, -sys.size * 0.25, sys.size * 0.1)
      g.fillStyle(0x000000, 0.5)
      g.fillCircle(sys.size * 0.1, sys.size * 0.45, sys.size * 0.07)
      // Аура трагедии
      g.lineStyle(1 * DPR, 0xfca5a5, 0.4)
      g.strokeCircle(0, 0, sys.size + 6 * DPR)
      g.lineStyle(0.5 * DPR, 0xfca5a5, 0.3)
      g.strokeCircle(0, 0, sys.size + 11 * DPR)
    } else {
      g.fillStyle(sys.accent)
      g.fillCircle(0, 0, sys.size)
      g.fillStyle(sys.color, 0.95)
      g.fillCircle(-3 * DPR, -2 * DPR, sys.size * 0.92)
      const D = DPR
      if (sys.type === 'crystal') {
        // Phase 7: BLIKS — более яркие кристаллы + блики
        g.fillStyle(0xffffff, 0.7)
        for (let a = 0; a < 6; a++) {
          const θ = (a * Math.PI) / 3
          g.fillTriangle(
            Math.cos(θ) * sys.size * 0.3,
            Math.sin(θ) * sys.size * 0.3,
            Math.cos(θ) * sys.size * 0.7 - 3 * D,
            Math.sin(θ) * sys.size * 0.7,
            Math.cos(θ) * sys.size * 0.7 + 3 * D,
            Math.sin(θ) * sys.size * 0.7,
          )
        }
        // Phase 7: маленькие блики на кристаллах
        g.fillStyle(0xffffff, 0.95)
        for (let a = 0; a < 6; a++) {
          const θ = (a * Math.PI) / 3
          g.fillCircle(
            Math.cos(θ) * sys.size * 0.55,
            Math.sin(θ) * sys.size * 0.55,
            1.5 * D,
          )
        }
        // Центральный кристалл
        g.fillStyle(sys.color, 0.9)
        g.fillCircle(0, 0, sys.size * 0.18)
        g.fillStyle(0xffffff, 0.8)
        g.fillCircle(-1.5 * D, -1.5 * D, sys.size * 0.08)
      } else if (sys.type === 'rocky') {
        // Phase 7: ROCKY — больше камней и текстуры
        g.fillStyle(sys.accent, 0.9)
        g.fillCircle(-8 * D, -5 * D, 10 * D)
        g.fillStyle(sys.accent, 0.8)
        g.fillCircle(10 * D, 8 * D, 8 * D)
        g.fillStyle(sys.accent, 0.7)
        g.fillCircle(2 * D, -12 * D, 6 * D)
        g.fillStyle(sys.accent, 0.6)
        g.fillCircle(-12 * D, 10 * D, 5 * D)
        // Тени-впадины
        g.fillStyle(0x000000, 0.3)
        g.fillCircle(-6 * D, -3 * D, 6 * D)
        g.fillStyle(0x000000, 0.25)
        g.fillCircle(12 * D, 10 * D, 5 * D)
      } else if (sys.type === 'ancient') {
        // Phase 7: MAR — древняя раса со множеством символов
        g.lineStyle(2 * D, 0xffffff, 0.4)
        g.strokeCircle(0, 0, sys.size * 0.6)
        g.strokeCircle(0, 0, sys.size * 0.3)
        // Phase 7: внешнее кольцо рун
        g.lineStyle(1 * D, sys.accent, 0.5)
        g.strokeCircle(0, 0, sys.size * 0.85)
        // Маленькие точки-символы по 2 кругам
        g.fillStyle(0xffffff, 0.8)
        for (let a = 0; a < 8; a++) {
          const θ = (a * Math.PI) / 4
          g.fillCircle(
            Math.cos(θ) * sys.size * 0.6,
            Math.sin(θ) * sys.size * 0.6,
            1 * D,
          )
        }
        for (let a = 0; a < 12; a++) {
          const θ = (a * Math.PI) / 6 + 0.15
          g.fillStyle(sys.accent, 0.7)
          g.fillCircle(
            Math.cos(θ) * sys.size * 0.85,
            Math.sin(θ) * sys.size * 0.85,
            0.8 * D,
          )
        }
      } else if (sys.type === 'mystic') {
        // Phase 7: NUM — больше мистических огоньков
        g.fillStyle(0xffffff, 0.5)
        g.fillCircle(-5 * D, -8 * D, 4 * D)
        g.fillCircle(8 * D, 5 * D, 3 * D)
        g.fillCircle(-2 * D, 10 * D, 3 * D)
        // Phase 7: дополнительные огоньки
        g.fillStyle(0xa5f3fc, 0.7)
        g.fillCircle(6 * D, -4 * D, 2 * D)
        g.fillStyle(0xc4b5fd, 0.6)
        g.fillCircle(-9 * D, 4 * D, 2.5 * D)
        g.fillStyle(0xfde047, 0.5)
        g.fillCircle(2 * D, -2 * D, 1.5 * D)
        // Тонкие линии-связи между огоньками (созвездие)
        g.lineStyle(0.5 * D, 0xa5f3fc, 0.4)
        g.lineBetween(-5 * D, -8 * D, 6 * D, -4 * D)
        g.lineBetween(6 * D, -4 * D, 8 * D, 5 * D)
        g.lineBetween(8 * D, 5 * D, -2 * D, 10 * D)
      } else if (sys.type === 'organic') {
        // Phase 7: организм — больше форм
        g.fillStyle(sys.accent, 0.7)
        g.fillEllipse(0, 0, sys.size * 1.2, sys.size * 0.5)
        // Phase 7: дополнительные органические выпуклости
        g.fillStyle(sys.accent, 0.6)
        g.fillEllipse(0, 0, sys.size * 0.5, sys.size * 1.2)
        g.fillStyle(sys.color, 0.5)
        g.fillCircle(-sys.size * 0.3, 0, sys.size * 0.18)
        g.fillStyle(sys.color, 0.5)
        g.fillCircle(sys.size * 0.3, 0, sys.size * 0.18)
        g.fillStyle(0xffffff, 0.4)
        g.fillCircle(0, 0, sys.size * 0.1)
      } else if (sys.type === 'forge') {
        // Phase 7: VRAK — кузнецы: огонь и наковальня
        g.lineStyle(3 * D, sys.accent, 0.9)
        g.beginPath()
        g.moveTo(-sys.size * 0.6, sys.size * 0.3)
        g.lineTo(sys.size * 0.6, -sys.size * 0.3)
        g.strokePath()
        g.lineStyle(2 * D, 0xfff7ed, 0.7)
        g.strokeCircle(-sys.size * 0.4, sys.size * 0.2, 4 * D)
        // Phase 7: горящие очаги по поверхности
        g.fillStyle(0xef4444, 0.85)
        g.fillCircle(sys.size * 0.4, -sys.size * 0.2, 4 * D)
        g.fillStyle(0xfde047, 0.7)
        g.fillCircle(sys.size * 0.4, -sys.size * 0.2, 2.5 * D)
        g.fillStyle(0xfb923c, 0.7)
        g.fillCircle(-sys.size * 0.5, -sys.size * 0.4, 3 * D)
        // Дым над очагами
        g.fillStyle(0x4b5563, 0.4)
        g.fillEllipse(
          sys.size * 0.4,
          -sys.size * 0.45,
          sys.size * 0.3,
          sys.size * 0.1,
        )
      } else if (sys.type === 'military') {
        // Phase 7: VEKTAR — больше техники и оружия
        g.lineStyle(3 * D, sys.accent, 1)
        g.strokeCircle(0, 0, sys.size + 6 * D)
        g.fillStyle(sys.accent, 0.8)
        for (let a = 0; a < 4; a++) {
          const θ = (a * Math.PI) / 2
          g.fillCircle(
            Math.cos(θ) * (sys.size + 6 * D),
            Math.sin(θ) * (sys.size + 6 * D),
            4 * D,
          )
        }
        // Phase 7: дополнительные мини-турели на меньшем кольце
        g.lineStyle(1.5 * D, sys.accent, 0.7)
        g.strokeCircle(0, 0, sys.size * 0.7)
        g.fillStyle(sys.accent, 0.85)
        for (let a = 0; a < 8; a++) {
          const θ = (a * Math.PI) / 4 + Math.PI / 8
          g.fillRect(
            Math.cos(θ) * sys.size * 0.7 - D,
            Math.sin(θ) * sys.size * 0.7 - D,
            2 * D,
            2 * D,
          )
        }
        // Центральный командный пункт
        g.fillStyle(0xef4444, 0.9)
        g.fillCircle(0, 0, sys.size * 0.15)
        g.fillStyle(0xfde047, 0.85)
        g.fillCircle(0, 0, sys.size * 0.07)
      } else if (sys.type === 'crystal_bio') {
        // Phase 7: ШИОН — кристаллы прорастают сквозь органическую поверхность (расширено)
        g.fillStyle(sys.accent, 0.7)
        g.fillEllipse(0, 0, sys.size * 1.3, sys.size * 0.7)
        g.fillStyle(0xffffff, 0.85)
        for (let a = 0; a < 4; a++) {
          const θ = (a * Math.PI) / 2 + 0.4
          const tipR = sys.size * 0.95
          g.fillTriangle(
            Math.cos(θ - 0.15) * sys.size * 0.2,
            Math.sin(θ - 0.15) * sys.size * 0.2,
            Math.cos(θ + 0.15) * sys.size * 0.2,
            Math.sin(θ + 0.15) * sys.size * 0.2,
            Math.cos(θ) * tipR,
            Math.sin(θ) * tipR,
          )
        }
        // Phase 7: малые вторичные кристаллы между большими
        g.fillStyle(sys.color, 0.85)
        for (let a = 0; a < 4; a++) {
          const θ = (a * Math.PI) / 2 + 0.4 + Math.PI / 4
          const tipR = sys.size * 0.55
          g.fillTriangle(
            Math.cos(θ - 0.1) * sys.size * 0.15,
            Math.sin(θ - 0.1) * sys.size * 0.15,
            Math.cos(θ + 0.1) * sys.size * 0.15,
            Math.sin(θ + 0.1) * sys.size * 0.15,
            Math.cos(θ) * tipR,
            Math.sin(θ) * tipR,
          )
        }
        g.fillStyle(sys.color, 0.6)
        g.fillCircle(0, 0, sys.size * 0.25)
        g.fillStyle(0xffffff, 0.7)
        g.fillCircle(0, 0, sys.size * 0.12)
      } else if (sys.type === 'mechano') {
        // Phase 7: ДРЕВИУС — механо-животное (расширено: больше зубцов и заклёпок)
        g.lineStyle(2 * D, sys.accent, 0.85)
        g.strokeCircle(0, 0, sys.size * 0.65)
        g.strokeCircle(0, 0, sys.size * 0.35)
        for (let a = 0; a < 8; a++) {
          const θ = (a * Math.PI) / 4
          g.lineBetween(
            Math.cos(θ) * sys.size * 0.55,
            Math.sin(θ) * sys.size * 0.55,
            Math.cos(θ) * sys.size * 0.85,
            Math.sin(θ) * sys.size * 0.85,
          )
        }
        // Phase 7: внешние зубцы шестерни
        g.fillStyle(sys.accent, 0.85)
        for (let a = 0; a < 12; a++) {
          const θ = (a * Math.PI) / 6
          const r = sys.size * 0.92
          g.fillRect(Math.cos(θ) * r - D, Math.sin(θ) * r - D, 2 * D, 2 * D)
        }
        // Phase 7: заклёпки
        g.fillStyle(0xffffff, 0.7)
        for (let a = 0; a < 4; a++) {
          const θ = (a * Math.PI) / 2 + Math.PI / 4
          g.fillCircle(
            Math.cos(θ) * sys.size * 0.5,
            Math.sin(θ) * sys.size * 0.5,
            1.5 * D,
          )
        }
        g.fillStyle(sys.accent, 0.95)
        g.fillCircle(0, 0, sys.size * 0.18)
        g.fillStyle(0xfde047, 0.8)
        g.fillCircle(0, 0, sys.size * 0.08)
      } else if (sys.type === 'energy') {
        // Phase 7: КАЛЕБ — энергетическая раса (расширено: больше молний и обводка)
        g.lineStyle(2 * D, sys.color, 0.95)
        for (let i = 0; i < 5; i++) {
          const θ = (i * Math.PI * 2) / 5 + 0.2
          let x = Math.cos(θ) * sys.size * 0.3
          let y = Math.sin(θ) * sys.size * 0.3
          g.beginPath()
          g.moveTo(x, y)
          for (let j = 0; j < 3; j++) {
            x +=
              Math.cos(θ) * sys.size * 0.2 +
              (Math.random() - 0.5) * sys.size * 0.15
            y +=
              Math.sin(θ) * sys.size * 0.2 +
              (Math.random() - 0.5) * sys.size * 0.15
            g.lineTo(x, y)
          }
          g.strokePath()
        }
        // Phase 7: внешнее кольцо энергии
        g.lineStyle(1.5 * D, 0xfde047, 0.6)
        g.strokeCircle(0, 0, sys.size * 0.85)
        g.lineStyle(0.8 * D, sys.color, 0.4)
        g.strokeCircle(0, 0, sys.size * 1.05)
        // Точки разрядов вокруг
        g.fillStyle(0xfff7ed, 0.9)
        for (let i = 0; i < 8; i++) {
          const θ = (i * Math.PI) / 4
          g.fillCircle(
            Math.cos(θ) * sys.size * 0.85,
            Math.sin(θ) * sys.size * 0.85,
            1.2 * D,
          )
        }
        g.fillStyle(0xffffff, 0.95)
        g.fillCircle(0, 0, sys.size * 0.35)
        g.fillStyle(0xfde047, 0.85)
        g.fillCircle(0, 0, sys.size * 0.18)
      } else if (sys.type === 'mist') {
        // Phase 7: ТЕВР — туманная раса (расширено: больше слоёв)
        for (let i = 0; i < 6; i++) {
          const θ = (i * Math.PI * 2) / 6
          g.fillStyle(0xffffff, 0.25 + (i % 2) * 0.1)
          g.fillEllipse(
            Math.cos(θ) * sys.size * 0.4,
            Math.sin(θ) * sys.size * 0.4,
            sys.size * 0.55,
            sys.size * 0.25,
          )
        }
        // Phase 7: дополнительный слой завитков
        for (let i = 0; i < 4; i++) {
          const θ = (i * Math.PI) / 2 + Math.PI / 4
          g.fillStyle(sys.color, 0.3)
          g.fillEllipse(
            Math.cos(θ) * sys.size * 0.6,
            Math.sin(θ) * sys.size * 0.6,
            sys.size * 0.4,
            sys.size * 0.18,
          )
        }
        g.lineStyle(1 * D, sys.accent, 0.5)
        g.strokeCircle(0, 0, sys.size * 0.85)
        g.lineStyle(0.5 * D, 0xc4b5fd, 0.4)
        g.strokeCircle(0, 0, sys.size * 0.55)
      } else if (sys.type === 'aquatic') {
        // Phase 7: ЮРУМ — водянистая (расширено: больше волн и капель)
        g.fillStyle(0xffffff, 0.4)
        g.fillEllipse(0, -sys.size * 0.3, sys.size * 1.2, sys.size * 0.18)
        g.fillEllipse(0, sys.size * 0.05, sys.size * 1.3, sys.size * 0.16)
        g.fillEllipse(0, sys.size * 0.4, sys.size * 1.1, sys.size * 0.15)
        // Phase 7: тонкие промежуточные волны
        g.fillStyle(0xffffff, 0.25)
        g.fillEllipse(0, -sys.size * 0.55, sys.size * 0.9, sys.size * 0.08)
        g.fillEllipse(0, -sys.size * 0.1, sys.size * 1.25, sys.size * 0.07)
        g.fillEllipse(0, sys.size * 0.65, sys.size * 0.85, sys.size * 0.07)
        // Капли — много
        g.fillStyle(sys.accent, 0.7)
        g.fillCircle(sys.size * 0.3, sys.size * 0.2, sys.size * 0.15)
        g.fillStyle(sys.accent, 0.6)
        g.fillCircle(-sys.size * 0.4, -sys.size * 0.2, sys.size * 0.1)
        g.fillStyle(sys.color, 0.6)
        g.fillCircle(sys.size * 0.5, -sys.size * 0.45, sys.size * 0.07)
        // Блики на каплях
        g.fillStyle(0xffffff, 0.85)
        g.fillCircle(sys.size * 0.27, sys.size * 0.17, sys.size * 0.04)
      } else if (sys.type === 'shadow') {
        // Phase 7: НОКТИС — тёмная раса (расширено: больше теней)
        g.fillStyle(0x000000, 0.7)
        g.fillCircle(0, 0, sys.size * 0.7)
        g.fillStyle(sys.accent, 0.6)
        for (let a = 0; a < 8; a++) {
          const θ = (a * Math.PI) / 4
          const r = sys.size * (0.6 + Math.random() * 0.3)
          g.fillEllipse(
            Math.cos(θ) * r * 0.6,
            Math.sin(θ) * r * 0.6,
            sys.size * 0.18,
            sys.size * 0.3,
          )
        }
        // Phase 7: дополнительные тёмные щупальца наружу
        g.fillStyle(0x000000, 0.5)
        for (let a = 0; a < 6; a++) {
          const θ = (a * Math.PI) / 3 + 0.2
          g.fillTriangle(
            Math.cos(θ) * sys.size * 0.3,
            Math.sin(θ) * sys.size * 0.3,
            Math.cos(θ - 0.2) * sys.size * 0.85,
            Math.sin(θ - 0.2) * sys.size * 0.85,
            Math.cos(θ + 0.2) * sys.size * 0.85,
            Math.sin(θ + 0.2) * sys.size * 0.85,
          )
        }
        // Глаз тьмы
        g.fillStyle(0xa78bfa, 0.5)
        g.fillCircle(0, 0, sys.size * 0.18)
        g.fillStyle(0x000000, 0.95)
        g.fillCircle(0, 0, sys.size * 0.08)
      } else if (sys.type === 'aerial') {
        // Phase 7: АЛЬТУС — воздушная раса (расширено: больше облаков и потоков)
        g.fillStyle(0xffffff, 0.55)
        g.fillEllipse(0, -sys.size * 0.3, sys.size * 1.4, sys.size * 0.22)
        g.fillEllipse(0, sys.size * 0.0, sys.size * 1.1, sys.size * 0.16)
        g.fillEllipse(0, sys.size * 0.35, sys.size * 1.3, sys.size * 0.2)
        // Phase 7: дополнительный слой пушистых облаков
        g.fillStyle(0xffffff, 0.4)
        g.fillEllipse(
          -sys.size * 0.4,
          -sys.size * 0.15,
          sys.size * 0.5,
          sys.size * 0.12,
        )
        g.fillEllipse(
          sys.size * 0.4,
          sys.size * 0.2,
          sys.size * 0.6,
          sys.size * 0.12,
        )
        // Лёгкие воздушные потоки (тонкие линии)
        g.lineStyle(0.5 * D, sys.accent, 0.45)
        g.strokeEllipse(0, 0, sys.size * 1.4, sys.size * 0.4)
        g.strokeEllipse(0, sys.size * 0.2, sys.size * 1.2, sys.size * 0.35)
        g.lineStyle(1 * D, sys.accent, 0.5)
        g.strokeCircle(0, 0, sys.size + 5 * D)
        g.lineStyle(0.5 * D, 0xa5f3fc, 0.3)
        g.strokeCircle(0, 0, sys.size + 11 * D)
      }
    }

    container.add(g)

    // Idle-анимации отключены — 30 infinite tweens (rotation + scale yoyo на
    // 14 main race планет) убрано для mobile perf. Планеты статичны визуально,
    // tap-анимации (selectSystem) и emoji-вспышки продолжают работать.

    // Подсказка пульсации для bliks (с задержкой, чтобы не вспыхивать при открытии сцены)
    if (sys.id === 'bliks') {
      const pulse = this.scene.add.graphics()
      pulse.lineStyle(2 * DPR, 0xffd700, 0.7)
      pulse.strokeCircle(0, 0, sys.size + 12 * DPR)
      pulse.setAlpha(0)
      container.add(pulse)
      this.scene.time.delayedCall(700, () => {
        this.scene.tweens.add({
          targets: pulse,
          scale: { from: 1, to: 1.4 },
          alpha: { from: 0.7, to: 0 },
          duration: 1200,
          repeat: -1,
          ease: 'Sine.easeOut',
        })
      })
    }

    // Интерактивность через pointerup (drag-aware) с адаптивным hit-area
    const baseR = sys.size + 6 * DPR
    const hitArea = new Phaser.Geom.Circle(0, 0, baseR)
    container.setInteractive(hitArea, Phaser.Geom.Circle.Contains)
    let downTime = 0
    let downX = 0,
      downY = 0
    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      downTime = Date.now()
      downX = p.x
      downY = p.y
    })
    container.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dt = Date.now() - downTime
      const moved = Math.abs(p.x - downX) + Math.abs(p.y - downY)
      if (dt < 300 && moved < 8 * DPR) {
        this.scene.tapHandledThisFrame = true
        eventBus.emit('starmap:planet-select', {
          planetId: sys.id,
          name: sys.name,
          archetype: sys.type ?? '',
        })
        this.scene.popoverController.handlePlanetPress(sys)
        this.scene.popoverController.selectSystem(sys)
        // Main planet: показать тот же popup что у bg-планет (имя + тип + Лететь/Изучить)
        this.scene.popoverController.scheduleBgNamePopup(sys)
      }
    })

    this.scene.systemSprites.set(sys.id, container)
    // Регистрируем для culling
    this.scene.lod.cullableData.push({
      obj: container,
      x: sys.x,
      y: sys.y,
      r: sys.size * 3,
    })
    // Регистрируем для адаптивного hit-area (увеличивается при zoom-out)
    this.scene.mainPlanetHits.push({ container, baseR, circle: hitArea })
    // Регистрируем для batch-toggle interactive по zoom (как BG)
    this.scene.lod.bgInteractiveContainers.push(container)
  }

  // Phase 20-04 (Wave 4): package-public — вызывается из starfield.ts (renderSystem dispatcher).
  renderBg(sys: BgSystem) {
    // Контейнер для всей планеты — позволяет idle-анимации (вращение, дыхание)
    const container = this.scene.add.container(sys.x, sys.y)
    const rng = mulberry32(sys.rngSeed)

    // Sparkle над планетой отключены полностью — каждый = GameObject +
    // recursive timer chain + flash tweens. Юзер хотел чистый фон без
    // мерцающих микро-звёзд.
    // if (rng() < 0.2) { createSparkleAt(this.scene, sys.x, sys.y, sys.size, ...) }

    // ── Базовый рендер — Graphics с ФИКСИРОВАННЫМИ параметрами ──
    // Atlas-pilot откачен. Все BG одного архетипа выглядят похоже (без рандом
    // asymmetric scale, без рандом highlight position) → визуальная
    // согласованность + меньше rng-работы.
    const gBase = this.scene.add.graphics()
    container.add(gBase)

    // Аура — фиксированный размер 1.5× для всех (кроме dead/mineral/desert).
    const showAura =
      sys.archetype !== 'dead' &&
      sys.archetype !== 'mineral' &&
      sys.archetype !== 'desert'
    if (showAura) {
      gBase.fillStyle(sys.color, 0.15 * sys.brightness)
      gBase.fillCircle(0, 0, sys.size * 1.5)
    }

    // Базовый шар — фиксированный highlight сверху-слева.
    gBase.fillStyle(sys.accent, 1)
    gBase.fillCircle(0, 0, sys.size)
    gBase.fillStyle(sys.color, 0.95)
    gBase.fillCircle(-sys.size * 0.08, -sys.size * 0.08, sys.size * 0.9)

    // RNG-bookkeeping: тратим столько же rng() сколько прежний код, чтобы
    // downstream variant choice не сдвинулся (texture signatures сохраняются).
    if (showAura) {
      rng()
      rng()
      if (rng() < 0.3) rng()
    }
    rng()
    rng()
    rng()
    rng()

    // Детальный Graphics — все остальные узоры. Регистрируется для LOD-toggle.
    const g = this.scene.add.graphics()
    container.add(g)
    this.scene.lod.bgArchetypeGfx.push(g)

    // Архетип-специфичная деталировка с большим количеством rng-вариаций.
    // Phase 7: для 9 hot archetypes — sub-variants (3 на каждый).
    // ВАЖНО: variant choice — первый rng() после baseRotation, signature builder
    // (buildTextureSignature) ТОЧНО реплицирует этот порядок.
    const D = DPR
    const baseRotation = rng() * Math.PI * 2 // случайный «поворот» паттерна
    // variant — общий для всех hot archetypes; для остальных variant игнорируется
    const variant = Math.floor(rng() * 3)
    switch (sys.archetype) {
      case 'gas_giant': {
        if (variant === 0) {
          // banded — текущая логика (полосы + штормы)
          const bands = 2 + Math.floor(rng() * 5)
          for (let i = 0; i < bands; i++) {
            const yOff = (i - bands / 2 + 0.5) * sys.size * (0.25 + rng() * 0.2)
            const w =
              sys.size * (1.4 + rng() * 0.4 - Math.abs(yOff / sys.size) * 0.4)
            const h = sys.size * (0.08 + rng() * 0.18)
            const tint = rng() < 0.5 ? sys.accent : sys.color
            g.fillStyle(tint, 0.4 + rng() * 0.3)
            g.fillEllipse(0, yOff, w, h)
          }
          const storms = Math.floor(rng() * 4)
          for (let i = 0; i < storms; i++) {
            const ax = (rng() - 0.5) * sys.size * 0.7
            const ay = (rng() - 0.5) * sys.size * 0.5
            const sw = sys.size * (0.15 + rng() * 0.25)
            const sh = sw * (0.5 + rng() * 0.4)
            g.fillStyle(sys.accent, 0.7 + rng() * 0.25)
            g.fillEllipse(ax, ay, sw, sh)
            if (rng() < 0.5) {
              g.fillStyle(0xffffff, 0.3)
              g.fillEllipse(ax - sw * 0.15, ay - sh * 0.2, sw * 0.4, sh * 0.3)
            }
          }
        } else if (variant === 1) {
          // spotted — 6-12 круглых пятен разного размера
          const spots = 6 + Math.floor(rng() * 7)
          for (let i = 0; i < spots; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * rng() * 0.7
            const r = sys.size * (0.08 + rng() * 0.15)
            g.fillStyle(rng() < 0.5 ? sys.color : sys.accent, 0.5 + rng() * 0.4)
            g.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, r)
          }
        } else {
          // storm — 1 большой ураган в центре + 2 полосы
          g.fillStyle(sys.accent, 0.85)
          g.fillEllipse(0, 0, sys.size * 0.7, sys.size * 0.45)
          g.fillStyle(0xffffff, 0.4)
          g.fillEllipse(
            -sys.size * 0.1,
            -sys.size * 0.05,
            sys.size * 0.45,
            sys.size * 0.25,
          )
          g.fillStyle(sys.color, 0.5)
          g.fillEllipse(0, -sys.size * 0.55, sys.size * 1.4, sys.size * 0.18)
          g.fillEllipse(0, sys.size * 0.55, sys.size * 1.4, sys.size * 0.18)
        }
        break
      }
      case 'gas_ringed': {
        if (variant === 0) {
          // banded-rings — текущая логика
          const bands = 2 + Math.floor(rng() * 3)
          for (let i = 0; i < bands; i++) {
            const yOff = (i - bands / 2 + 0.5) * sys.size * (0.3 + rng() * 0.2)
            g.fillStyle(rng() < 0.5 ? sys.accent : sys.color, 0.5 + rng() * 0.2)
            g.fillEllipse(
              0,
              yOff,
              sys.size * (1.4 + rng() * 0.4),
              sys.size * (0.12 + rng() * 0.15),
            )
          }
          const ringGfx = this.scene.add.graphics()
          const ringRotation = (rng() - 0.5) * 60
          const subRings = 1 + Math.floor(rng() * 3)
          for (let i = 0; i < subRings; i++) {
            const ringScale = 2.4 + i * 0.25 + rng() * 0.3
            ringGfx.lineStyle(
              (2 + rng() * 2) * D,
              i % 2 === 0 ? sys.color : sys.accent,
              0.4 + rng() * 0.4,
            )
            ringGfx.strokeEllipse(
              0,
              0,
              sys.size * ringScale,
              sys.size * (0.4 + rng() * 0.5),
            )
          }
          ringGfx.angle = ringRotation
          container.add(ringGfx)
        } else if (variant === 1) {
          // wide-disk — широкий плоский диск + минимум полос
          g.fillStyle(sys.accent, 0.5)
          g.fillEllipse(0, 0, sys.size * 0.5, sys.size * 1.5) // вертикальный овал
          const ringGfx = this.scene.add.graphics()
          const ringRotation = (rng() - 0.5) * 30
          // Один очень широкий диск
          ringGfx.fillStyle(sys.color, 0.4 + rng() * 0.2)
          ringGfx.fillEllipse(
            0,
            0,
            sys.size * 3.2,
            sys.size * (0.7 + rng() * 0.3),
          )
          ringGfx.fillStyle(sys.accent, 0.6)
          ringGfx.fillEllipse(0, 0, sys.size * 2.6, sys.size * 0.3)
          // отверстие в центре (через темнее эллипс)
          ringGfx.fillStyle(0x000000, 0.5)
          ringGfx.fillEllipse(0, 0, sys.size * 1.4, sys.size * 0.18)
          ringGfx.angle = ringRotation
          container.add(ringGfx)
        } else {
          // multi-ring — 4-5 узких колец разного размера
          const ringGfx = this.scene.add.graphics()
          const ringRotation = (rng() - 0.5) * 70
          const N = 4 + Math.floor(rng() * 2)
          for (let i = 0; i < N; i++) {
            const rs = 1.8 + i * 0.3 + rng() * 0.2
            ringGfx.lineStyle(
              (1 + rng() * 1.5) * D,
              i % 2 === 0 ? sys.color : sys.accent,
              0.5 + rng() * 0.3,
            )
            ringGfx.strokeEllipse(
              0,
              0,
              sys.size * rs,
              sys.size * (0.3 + rng() * 0.3),
            )
          }
          ringGfx.angle = ringRotation
          container.add(ringGfx)
        }
        break
      }
      case 'ice': {
        if (variant === 0) {
          // patchy — текущая (ледяные пятна + полярные шапки)
          const patches = 3 + Math.floor(rng() * 5)
          for (let i = 0; i < patches; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.15 + rng() * 0.55)
            const sr = sys.size * (0.06 + rng() * 0.18)
            g.fillStyle(0xffffff, 0.5 + rng() * 0.4)
            g.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, sr)
          }
          if (rng() < 0.6) {
            g.fillStyle(0xffffff, 0.8)
            g.fillEllipse(
              0,
              -sys.size * 0.7,
              sys.size * (0.5 + rng() * 0.4),
              sys.size * 0.18,
            )
            g.fillEllipse(
              0,
              sys.size * 0.7,
              sys.size * (0.4 + rng() * 0.5),
              sys.size * 0.16,
            )
          }
          g.fillStyle(0xffffff, 0.5 + rng() * 0.3)
          const bx = (rng() - 0.5) * sys.size * 0.6
          const by = (rng() - 0.5) * sys.size * 0.6
          g.fillCircle(bx, by, sys.size * (0.12 + rng() * 0.12))
        } else if (variant === 1) {
          // crystalline — грани кристалла
          g.lineStyle(1.5 * D, 0xa5f3fc, 0.8)
          const facets = 5 + Math.floor(rng() * 4)
          for (let i = 0; i < facets; i++) {
            const ang = baseRotation + (i / facets) * Math.PI * 2
            g.lineBetween(
              0,
              0,
              Math.cos(ang) * sys.size * 0.85,
              Math.sin(ang) * sys.size * 0.85,
            )
          }
          // блики на гранях
          for (let i = 0; i < facets; i++) {
            const ang = baseRotation + (i / facets) * Math.PI * 2 + 0.3
            const r = sys.size * 0.55
            g.fillStyle(0xffffff, 0.4 + rng() * 0.3)
            g.fillCircle(
              Math.cos(ang) * r,
              Math.sin(ang) * r,
              sys.size * (0.06 + rng() * 0.06),
            )
          }
          g.fillStyle(0xffffff, 0.6)
          g.fillCircle(0, 0, sys.size * 0.25)
        } else {
          // glacial — трещины во льду
          g.lineStyle(2 * D, 0xbae6fd, 0.6)
          const cracks = 3 + Math.floor(rng() * 3)
          for (let i = 0; i < cracks; i++) {
            const startAng = rng() * Math.PI * 2
            const startR = sys.size * 0.2
            let px = Math.cos(startAng) * startR,
              py = Math.sin(startAng) * startR
            for (let s = 0; s < 4; s++) {
              const a = startAng + (rng() - 0.5) * 0.6
              const r = startR + ((sys.size * 0.7 - startR) * (s + 1)) / 4
              const x = Math.cos(a) * r,
                y = Math.sin(a) * r
              g.lineBetween(px, py, x, y)
              px = x
              py = y
            }
          }
          // Несколько снежных пятен
          const patches = 2 + Math.floor(rng() * 3)
          for (let i = 0; i < patches; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.2 + rng() * 0.4)
            g.fillStyle(0xffffff, 0.5 + rng() * 0.3)
            g.fillCircle(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.07 + rng() * 0.1),
            )
          }
        }
        break
      }
      case 'ocean': {
        if (variant === 0) {
          // cloudy — облака + материки (текущая)
          const clouds = 2 + Math.floor(rng() * 5)
          for (let i = 0; i < clouds; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.25 + rng() * 0.55)
            g.fillStyle(0xffffff, 0.3 + rng() * 0.3)
            g.fillEllipse(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.4 + rng() * 0.5),
              sys.size * (0.15 + rng() * 0.2),
            )
          }
          const continents = Math.floor(rng() * 4)
          for (let i = 0; i < continents; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.1 + rng() * 0.45)
            g.fillStyle(sys.accent, 0.55 + rng() * 0.3)
            g.fillEllipse(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.4 + rng() * 0.4),
              sys.size * (0.25 + rng() * 0.3),
            )
          }
        } else if (variant === 1) {
          // calm — простой синий gradient + минимум деталей
          g.fillStyle(0xffffff, 0.18)
          g.fillEllipse(0, -sys.size * 0.4, sys.size * 1.6, sys.size * 0.5)
          g.fillStyle(0xffffff, 0.12)
          g.fillEllipse(0, sys.size * 0.3, sys.size * 1.4, sys.size * 0.3)
          // Тонкий блик
          g.fillStyle(0xffffff, 0.3 + rng() * 0.2)
          g.fillEllipse(
            -sys.size * 0.3,
            -sys.size * 0.2,
            sys.size * 0.4,
            sys.size * 0.15,
          )
        } else {
          // archipelago — много маленьких островов
          const islands = 8 + Math.floor(rng() * 6)
          for (let i = 0; i < islands; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.15 + rng() * 0.6)
            g.fillStyle(sys.accent, 0.6 + rng() * 0.3)
            g.fillCircle(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.05 + rng() * 0.1),
            )
          }
          // Тонкие следы волн
          g.fillStyle(0xffffff, 0.2)
          g.fillEllipse(0, 0, sys.size * 1.5, sys.size * 0.08)
          g.fillEllipse(0, sys.size * 0.4, sys.size * 1.3, sys.size * 0.07)
        }
        break
      }
      case 'desert': {
        if (variant === 0) {
          // dunes — текущая (полосы дюн + оазисы)
          const dunes = 2 + Math.floor(rng() * 4)
          for (let i = 0; i < dunes; i++) {
            const yOff = (i - dunes / 2 + 0.5) * sys.size * (0.25 + rng() * 0.2)
            g.fillStyle(sys.accent, 0.3 + rng() * 0.3)
            g.fillEllipse(
              0,
              yOff,
              sys.size * (1.3 + rng() * 0.4),
              sys.size * (0.08 + rng() * 0.1),
            )
          }
          if (rng() < 0.4) {
            g.fillStyle(0x16a34a, 0.5)
            const ox = (rng() - 0.5) * sys.size * 0.7
            const oy = (rng() - 0.5) * sys.size * 0.7
            g.fillCircle(ox, oy, sys.size * (0.06 + rng() * 0.1))
          }
        } else if (variant === 1) {
          // canyon — глубокие линии-каньоны
          g.lineStyle((1.5 + rng() * 1) * D, 0x78350f, 0.6)
          const canyons = 3 + Math.floor(rng() * 3)
          for (let i = 0; i < canyons; i++) {
            const ang =
              baseRotation + (i / canyons) * Math.PI * 2 + (rng() - 0.5) * 0.3
            let px = Math.cos(ang) * sys.size * 0.2
            let py = Math.sin(ang) * sys.size * 0.2
            for (let s = 1; s <= 4; s++) {
              const a = ang + (rng() - 0.5) * 0.4
              const r = sys.size * (0.2 + (s / 4) * 0.65)
              const x = Math.cos(a) * r,
                y = Math.sin(a) * r
              g.lineBetween(px, py, x, y)
              px = x
              py = y
            }
          }
          // Несколько песчаных пятен
          for (let i = 0; i < 3; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * rng() * 0.5
            g.fillStyle(sys.accent, 0.4 + rng() * 0.3)
            g.fillCircle(
              Math.cos(a) * d,
              Math.sin(a) * d,
              sys.size * (0.08 + rng() * 0.1),
            )
          }
        } else {
          // oasis — большой зелёный оазис в центре + кольцо песка
          g.fillStyle(0x16a34a, 0.7)
          g.fillCircle(0, 0, sys.size * (0.25 + rng() * 0.15))
          g.fillStyle(0x86efac, 0.5)
          g.fillCircle(0, 0, sys.size * 0.15)
          // Окружающая дюна-кольцо
          g.lineStyle(2 * D, sys.accent, 0.5)
          g.strokeCircle(0, 0, sys.size * (0.5 + rng() * 0.15))
          // 2-3 малых оазиса вокруг
          const small = 2 + Math.floor(rng() * 2)
          for (let i = 0; i < small; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * (0.55 + rng() * 0.25)
            g.fillStyle(0x16a34a, 0.5)
            g.fillCircle(
              Math.cos(a) * d,
              Math.sin(a) * d,
              sys.size * (0.05 + rng() * 0.07),
            )
          }
        }
        break
      }
      case 'lava': {
        // Тёмная корка — общая для всех variant'ов
        g.fillStyle(0x171717, 0.4 + rng() * 0.3)
        g.fillCircle(0, 0, sys.size * 0.95)
        if (variant === 0) {
          // cracked — текущая (трещины + очаги)
          g.lineStyle((1.5 + rng() * 1.5) * D, sys.color, 0.85 + rng() * 0.15)
          const cracks = 3 + Math.floor(rng() * 6)
          for (let i = 0; i < cracks; i++) {
            const ang =
              baseRotation + (i / cracks) * Math.PI * 2 + (rng() - 0.5) * 0.5
            const startR = sys.size * (0.1 + rng() * 0.2)
            const endR = sys.size * (0.7 + rng() * 0.25)
            if (rng() < 0.4) {
              const midR = (startR + endR) / 2
              const midAng = ang + (rng() - 0.5) * 0.3
              g.beginPath()
              g.moveTo(Math.cos(ang) * startR, Math.sin(ang) * startR)
              g.lineTo(Math.cos(midAng) * midR, Math.sin(midAng) * midR)
              g.lineTo(Math.cos(ang) * endR, Math.sin(ang) * endR)
              g.strokePath()
            } else {
              g.lineBetween(
                Math.cos(ang) * startR,
                Math.sin(ang) * startR,
                Math.cos(ang) * endR,
                Math.sin(ang) * endR,
              )
            }
          }
          const pools = 1 + Math.floor(rng() * 3)
          for (let i = 0; i < pools; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * rng() * 0.6
            g.fillStyle(sys.color, 0.8)
            g.fillCircle(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.06 + rng() * 0.15),
            )
          }
        } else if (variant === 1) {
          // volcanoes — точечные вулканы (большие очаги с выпуклым свечением)
          const volcanoes = 3 + Math.floor(rng() * 3)
          for (let i = 0; i < volcanoes; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.2 + rng() * 0.55)
            const cx = Math.cos(ang) * dist
            const cy = Math.sin(ang) * dist
            // Кратер
            g.fillStyle(0x171717, 0.7)
            g.fillCircle(cx, cy, sys.size * (0.12 + rng() * 0.06))
            // Лава внутри
            g.fillStyle(sys.color, 0.95)
            g.fillCircle(cx, cy, sys.size * (0.08 + rng() * 0.05))
            // Свечение
            g.fillStyle(0xfde047, 0.6)
            g.fillCircle(cx, cy, sys.size * 0.04)
          }
          // Тонкие свечения по поверхности
          for (let i = 0; i < 4; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * rng() * 0.5
            g.fillStyle(sys.color, 0.4)
            g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, sys.size * 0.04)
          }
        } else {
          // flowing — реки лавы (длинные изогнутые потоки)
          g.lineStyle((2.5 + rng() * 1.5) * D, sys.color, 0.9)
          const rivers = 2 + Math.floor(rng() * 3)
          for (let r = 0; r < rivers; r++) {
            const startAng = rng() * Math.PI * 2
            let px = Math.cos(startAng) * sys.size * 0.1
            let py = Math.sin(startAng) * sys.size * 0.1
            for (let s = 1; s <= 6; s++) {
              const a = startAng + Math.sin(s * 0.7) * 0.5
              const radius = sys.size * (0.1 + (s / 6) * 0.7)
              const x = Math.cos(a) * radius,
                y = Math.sin(a) * radius
              g.lineBetween(px, py, x, y)
              px = x
              py = y
            }
          }
          // Жёлтые блики на потоках
          g.lineStyle(0.8 * D, 0xfde047, 0.7)
          for (let i = 0; i < 3; i++) {
            const a = rng() * Math.PI * 2
            const r1 = sys.size * (0.2 + rng() * 0.3)
            const r2 = sys.size * (0.5 + rng() * 0.3)
            g.lineBetween(
              Math.cos(a) * r1,
              Math.sin(a) * r1,
              Math.cos(a) * r2,
              Math.sin(a) * r2,
            )
          }
        }
        break
      }
      case 'forest': {
        if (variant === 0) {
          // patches — текущая (материки + реки)
          const continents = 3 + Math.floor(rng() * 5)
          for (let i = 0; i < continents; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.1 + rng() * 0.5)
            g.fillStyle(sys.accent, 0.5 + rng() * 0.3)
            const w = sys.size * (0.3 + rng() * 0.5)
            const h = sys.size * (0.2 + rng() * 0.35)
            g.fillEllipse(Math.cos(ang) * dist, Math.sin(ang) * dist, w, h)
          }
          if (rng() < 0.5) {
            g.lineStyle(1.5 * D, 0x2563eb, 0.5)
            for (let i = 0; i < 2; i++) {
              const a = rng() * Math.PI * 2
              g.lineBetween(
                Math.cos(a) * sys.size * 0.7,
                Math.sin(a) * sys.size * 0.7,
                Math.cos(a + Math.PI) * sys.size * 0.4,
                Math.sin(a + Math.PI) * sys.size * 0.4,
              )
            }
          }
        } else if (variant === 1) {
          // biomes — несколько разноцветных биомов (тропики/тундра/степь)
          const biomeColors = [0x16a34a, 0x4ade80, 0x65a30d, 0xa3e635]
          const biomes = 4 + Math.floor(rng() * 2)
          for (let i = 0; i < biomes; i++) {
            const ang = (i / biomes) * Math.PI * 2 + rng() * 0.4
            const dist = sys.size * (0.25 + rng() * 0.35)
            const tint = biomeColors[Math.floor(rng() * biomeColors.length)]
            g.fillStyle(tint, 0.5 + rng() * 0.3)
            g.fillEllipse(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.35 + rng() * 0.3),
              sys.size * (0.25 + rng() * 0.2),
            )
          }
          // Тонкие облачка
          for (let i = 0; i < 2; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * rng() * 0.5
            g.fillStyle(0xffffff, 0.3)
            g.fillEllipse(
              Math.cos(a) * d,
              Math.sin(a) * d,
              sys.size * 0.3,
              sys.size * 0.1,
            )
          }
        } else {
          // jungle — плотный покров с тёмными прожилками
          g.fillStyle(sys.accent, 0.7)
          g.fillCircle(0, 0, sys.size * 0.85)
          // Тёмные прожилки джунглей
          g.lineStyle(1.5 * D, 0x14532d, 0.6)
          const veins = 5 + Math.floor(rng() * 4)
          for (let i = 0; i < veins; i++) {
            const ang = rng() * Math.PI * 2
            const r1 = sys.size * 0.1
            const r2 = sys.size * (0.6 + rng() * 0.2)
            let px = Math.cos(ang) * r1,
              py = Math.sin(ang) * r1
            for (let s = 1; s <= 3; s++) {
              const a = ang + (rng() - 0.5) * 0.5
              const r = r1 + (r2 - r1) * (s / 3)
              const x = Math.cos(a) * r,
                y = Math.sin(a) * r
              g.lineBetween(px, py, x, y)
              px = x
              py = y
            }
          }
          // Светлые проплешины
          for (let i = 0; i < 3; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * (0.3 + rng() * 0.3)
            g.fillStyle(0xa3e635, 0.5)
            g.fillCircle(
              Math.cos(a) * d,
              Math.sin(a) * d,
              sys.size * (0.05 + rng() * 0.07),
            )
          }
        }
        break
      }
      case 'mineral': {
        if (variant === 0) {
          // faceted — текущая (грани + жилы)
          g.lineStyle((0.8 + rng() * 1) * D, 0xffffff, 0.4 + rng() * 0.3)
          const facets = 3 + Math.floor(rng() * 5)
          for (let i = 0; i < facets; i++) {
            const ang = baseRotation + (i / facets) * Math.PI * 2
            g.lineBetween(
              0,
              0,
              Math.cos(ang) * sys.size * (0.7 + rng() * 0.2),
              Math.sin(ang) * sys.size * (0.7 + rng() * 0.2),
            )
          }
          const veins = 2 + Math.floor(rng() * 3)
          for (let i = 0; i < veins; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * rng() * 0.5
            g.fillStyle(sys.color, 0.7 + rng() * 0.2)
            g.fillCircle(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.08 + rng() * 0.13),
            )
          }
        } else if (variant === 1) {
          // veined — преимущественно жилы металла без граней
          const veinLines = 4 + Math.floor(rng() * 3)
          g.lineStyle((1.2 + rng()) * D, sys.color, 0.7)
          for (let i = 0; i < veinLines; i++) {
            const a1 = rng() * Math.PI * 2
            const r1 = sys.size * 0.1
            let px = Math.cos(a1) * r1,
              py = Math.sin(a1) * r1
            for (let s = 1; s <= 4; s++) {
              const a = a1 + (rng() - 0.5) * 0.7
              const r = r1 + (sys.size * 0.7 - r1) * (s / 4)
              const x = Math.cos(a) * r,
                y = Math.sin(a) * r
              g.lineBetween(px, py, x, y)
              px = x
              py = y
            }
          }
          // Несколько ярких узлов на жилах
          for (let i = 0; i < 4; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * (0.2 + rng() * 0.4)
            g.fillStyle(0xfde047, 0.7)
            g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, sys.size * 0.05)
          }
        } else {
          // raw — необработанная неравномерная поверхность с вкраплениями
          // Тёмные неровности
          for (let i = 0; i < 8; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * rng() * 0.7
            g.fillStyle(0x1f2937, 0.5)
            g.fillCircle(
              Math.cos(a) * d,
              Math.sin(a) * d,
              sys.size * (0.06 + rng() * 0.08),
            )
          }
          // Яркие кристаллы
          const crystals = 5 + Math.floor(rng() * 4)
          for (let i = 0; i < crystals; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * rng() * 0.65
            const x = Math.cos(a) * d,
              y = Math.sin(a) * d
            const r = sys.size * (0.04 + rng() * 0.07)
            g.fillStyle(sys.color, 0.85)
            g.fillTriangle(
              x,
              y - r,
              x - r * 0.7,
              y + r * 0.5,
              x + r * 0.7,
              y + r * 0.5,
            )
          }
        }
        break
      }
      case 'dead': {
        if (variant === 0) {
          // cratered — текущая (множество кратеров)
          const craters = 5 + Math.floor(rng() * 6)
          for (let i = 0; i < craters; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.1 + rng() * 0.7)
            const r = sys.size * (0.05 + rng() * 0.18)
            g.fillStyle(sys.accent, 0.7 + rng() * 0.3)
            g.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, r)
            if (rng() < 0.4) {
              g.lineStyle(1 * D, 0x000000, 0.35)
              g.strokeCircle(
                Math.cos(ang) * dist,
                Math.sin(ang) * dist,
                r * 0.85,
              )
            }
            g.fillStyle(0xffffff, 0.1 + rng() * 0.15)
            g.fillCircle(
              Math.cos(ang) * dist - r * 0.35,
              Math.sin(ang) * dist - r * 0.35,
              r * 0.5,
            )
          }
        } else if (variant === 1) {
          // scarred — крупные шрамы и трещины
          g.lineStyle((1.5 + rng() * 1.5) * D, 0x4b5563, 0.7)
          const scars = 4 + Math.floor(rng() * 3)
          for (let i = 0; i < scars; i++) {
            const a1 = rng() * Math.PI * 2
            const a2 = a1 + Math.PI + (rng() - 0.5) * 0.8
            const r = sys.size * 0.65
            g.lineBetween(
              Math.cos(a1) * r,
              Math.sin(a1) * r,
              Math.cos(a2) * r,
              Math.sin(a2) * r,
            )
          }
          // 2-3 крупных кратера
          for (let i = 0; i < 3; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * (0.3 + rng() * 0.3)
            const r = sys.size * (0.1 + rng() * 0.1)
            g.fillStyle(0x111827, 0.6)
            g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, r)
            g.lineStyle(1 * D, 0x000000, 0.5)
            g.strokeCircle(Math.cos(a) * d, Math.sin(a) * d, r)
          }
        } else {
          // bare — редкие мелкие кратеры, гладкая монотонная поверхность
          const craters = 2 + Math.floor(rng() * 3)
          for (let i = 0; i < craters; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * rng() * 0.6
            const r = sys.size * (0.03 + rng() * 0.07)
            g.fillStyle(sys.accent, 0.6)
            g.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, r)
          }
          // Тонкая текстура
          g.fillStyle(0x000000, 0.1)
          g.fillEllipse(0, sys.size * 0.4, sys.size * 1.2, sys.size * 0.15)
          g.fillEllipse(0, -sys.size * 0.4, sys.size * 1.0, sys.size * 0.12)
        }
        break
      }
      case 'toxic': {
        // Облака яда + пузыри + waste
        const clouds = 2 + Math.floor(rng() * 4)
        for (let i = 0; i < clouds; i++) {
          const ang = rng() * Math.PI * 2
          const dist = sys.size * (0.2 + rng() * 0.55)
          const cloudColor = rng() < 0.5 ? 0x86efac : 0xfde68a
          g.fillStyle(cloudColor, 0.3 + rng() * 0.25)
          g.fillEllipse(
            Math.cos(ang) * dist,
            Math.sin(ang) * dist,
            sys.size * (0.4 + rng() * 0.4),
            sys.size * (0.15 + rng() * 0.25),
          )
        }
        // Пузыри разных размеров
        const bubbles = 1 + Math.floor(rng() * 4)
        for (let i = 0; i < bubbles; i++) {
          const ang = rng() * Math.PI * 2
          const dist = sys.size * rng() * 0.55
          g.fillStyle(sys.color, 0.65 + rng() * 0.25)
          g.fillCircle(
            Math.cos(ang) * dist,
            Math.sin(ang) * dist,
            sys.size * (0.08 + rng() * 0.18),
          )
          g.fillStyle(0xffffff, 0.25)
          g.fillCircle(
            Math.cos(ang) * dist - sys.size * 0.04,
            Math.sin(ang) * dist - sys.size * 0.04,
            sys.size * 0.05,
          )
        }
        break
      }
      case 'plasma': {
        // Случайное количество лучей
        const rays = 4 + Math.floor(rng() * 6)
        g.lineStyle((1.5 + rng() * 2) * D, sys.color, 0.7 + rng() * 0.3)
        for (let i = 0; i < rays; i++) {
          const ang =
            baseRotation + (i / rays) * Math.PI * 2 + (rng() - 0.5) * 0.4
          const innerR = sys.size * (0.4 + rng() * 0.2)
          const outerR = sys.size * (1.0 + rng() * 0.5)
          g.lineBetween(
            Math.cos(ang) * innerR,
            Math.sin(ang) * innerR,
            Math.cos(ang) * outerR,
            Math.sin(ang) * outerR,
          )
        }
        // Многослойное ядро
        g.fillStyle(sys.color, 0.85 + rng() * 0.15)
        g.fillCircle(0, 0, sys.size * (0.55 + rng() * 0.2))
        g.fillStyle(0xffffff, 0.7 + rng() * 0.25)
        g.fillCircle(0, 0, sys.size * (0.25 + rng() * 0.18))
        break
      }
      case 'binary': {
        // Два соприкасающихся шара разных размеров
        const r1 = sys.size * (0.45 + rng() * 0.2)
        const r2 = sys.size * (0.4 + rng() * 0.2)
        const offset1 = sys.size * (0.3 + rng() * 0.2)
        const ang = baseRotation
        const cx1 = Math.cos(ang) * -offset1
        const cy1 = Math.sin(ang) * -offset1
        const cx2 = Math.cos(ang) * offset1
        const cy2 = Math.sin(ang) * offset1
        g.fillStyle(sys.color, 0.9 + rng() * 0.1)
        g.fillCircle(cx1, cy1, r1)
        // Второй шар — отдельный hue
        const altPalette = generatePalette(sys.archetype, rng)
        g.fillStyle(altPalette.color, 0.9 + rng() * 0.1)
        g.fillCircle(cx2, cy2, r2)
        // Перешеек/гало
        g.fillStyle(0xffffff, 0.2 + rng() * 0.2)
        g.fillEllipse(0, 0, sys.size * (0.3 + rng() * 0.2), sys.size * 0.15)
        break
      }
    }

    // === УНИВЕРСАЛЬНЫЕ МОДИФИКАТОРЫ ПОВЕРХ ===
    // Случайные дополнения: процент планет получают неожиданные элементы,
    // чтобы планеты одного архетипа выглядели РАЗНЫМИ.
    // Phase 7: 6 новых modifier'ов добавлены первыми (их флаги в signature).

    // Phase 7 #1: Surface lines — тонкие меридианы по поверхности (15%)
    if (rng() < 0.15) {
      g.lineStyle(0.6 * D, sys.color, 0.4)
      const lines = 2 + Math.floor(rng() * 3)
      for (let i = 0; i < lines; i++) {
        const yOff = (i - lines / 2 + 0.5) * sys.size * 0.35
        const w = sys.size * Math.cos(((yOff / sys.size) * Math.PI) / 2) * 1.6
        if (w > 0) g.strokeEllipse(0, yOff, w, sys.size * 0.12)
      }
    }

    // Phase 7 #2: Gradient bands — плавный gradient полосы (12%)
    if (rng() < 0.12) {
      const bandY = (rng() - 0.5) * sys.size * 0.5
      for (let i = 0; i < 5; i++) {
        g.fillStyle(rng() < 0.5 ? sys.color : sys.accent, 0.05 + i * 0.03)
        g.fillEllipse(0, bandY, sys.size * 1.6, sys.size * (0.15 - i * 0.02))
      }
    }

    // Phase 7 #3: Multi-color spots — кластеры мелких пятен случайных hue (15%)
    if (rng() < 0.15) {
      const colors = [0xfde047, 0xa5f3fc, 0x86efac, 0xfca5a5, 0xc4b5fd]
      const clusters = 1 + Math.floor(rng() * 2)
      for (let c = 0; c < clusters; c++) {
        const cAng = rng() * Math.PI * 2
        const cDist = sys.size * (0.3 + rng() * 0.4)
        const cx = Math.cos(cAng) * cDist
        const cy = Math.sin(cAng) * cDist
        const tint = colors[Math.floor(rng() * colors.length)]
        for (let i = 0; i < 3 + Math.floor(rng() * 3); i++) {
          const dx = (rng() - 0.5) * sys.size * 0.3
          const dy = (rng() - 0.5) * sys.size * 0.3
          g.fillStyle(tint, 0.5 + rng() * 0.3)
          g.fillCircle(cx + dx, cy + dy, sys.size * (0.04 + rng() * 0.06))
        }
      }
    }

    // Phase 7 #4: Stacked rings — 2-3 кольца разного диаметра/наклона (8%)
    if (
      sys.archetype !== 'gas_ringed' &&
      sys.archetype !== 'binary' &&
      rng() < 0.08
    ) {
      const n = 2 + Math.floor(rng() * 2)
      for (let i = 0; i < n; i++) {
        const ringGfx = this.scene.add.graphics()
        ringGfx.lineStyle(
          (0.8 + rng()) * D,
          i % 2 === 0 ? sys.color : sys.accent,
          0.3 + rng() * 0.3,
        )
        ringGfx.strokeEllipse(
          0,
          0,
          sys.size * (2.0 + i * 0.4),
          sys.size * (0.3 + rng() * 0.4),
        )
        ringGfx.angle = (rng() - 0.5) * 90
        container.add(ringGfx)
      }
    }

    // Phase 7 #5: Asymmetric atmosphere — aura эллипсом / капсулой (20%)
    if (showAura && rng() < 0.2) {
      const ax = sys.size * (1.6 + rng() * 0.4)
      const ay = sys.size * (1.0 + rng() * 0.3)
      g.fillStyle(sys.color, 0.08 * sys.brightness)
      g.fillEllipse(0, 0, ax * 2, ay * 2)
    }

    // Phase 7 #6: Color speckle — мелкие пиксели-точки случайных hue по поверхности (25%)
    if (rng() < 0.25) {
      const N = 8 + Math.floor(rng() * 12)
      for (let i = 0; i < N; i++) {
        const ang = rng() * Math.PI * 2
        const r = sys.size * Math.sqrt(rng()) * 0.85
        const tint = rng() < 0.5 ? sys.color : sys.accent
        g.fillStyle(tint, 0.4 + rng() * 0.4)
        g.fillCircle(
          Math.cos(ang) * r,
          Math.sin(ang) * r,
          (0.5 + rng() * 1) * D,
        )
      }
    }

    // Кратер на не-dead планете (12%)
    if (sys.archetype !== 'dead' && rng() < 0.12) {
      const ang = rng() * Math.PI * 2
      const dist = sys.size * (0.3 + rng() * 0.5)
      const cr = sys.size * (0.08 + rng() * 0.12)
      g.fillStyle(0x000000, 0.5)
      g.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, cr)
    }

    // Тонкое кольцо у любой планеты (~22%) — может быть очень тонкое или толстое
    if (
      sys.archetype !== 'gas_ringed' &&
      sys.archetype !== 'binary' &&
      rng() < 0.22
    ) {
      const ringGfx = this.scene.add.graphics()
      const ringW = (0.8 + rng() * 2.5) * D
      const ringAlpha = 0.3 + rng() * 0.5
      const ringTint =
        rng() < 0.6 ? sys.color : rng() < 0.5 ? sys.accent : 0xffffff
      ringGfx.lineStyle(ringW, ringTint, ringAlpha)
      ringGfx.strokeEllipse(
        0,
        0,
        sys.size * (2.0 + rng() * 0.8),
        sys.size * (0.3 + rng() * 0.6),
      )
      ringGfx.angle = (rng() - 0.5) * 90
      container.add(ringGfx)
      // Иногда — двойное кольцо
      if (rng() < 0.3) {
        ringGfx.lineStyle(ringW * 0.6, ringTint, ringAlpha * 0.7)
        ringGfx.strokeEllipse(
          0,
          0,
          sys.size * (2.5 + rng() * 0.5),
          sys.size * (0.4 + rng() * 0.4),
        )
      }
    }

    // Тёмный пояс в виде эллипса (12%)
    if (rng() < 0.12) {
      g.fillStyle(0x000000, 0.15 + rng() * 0.15)
      g.fillEllipse(
        0,
        (rng() - 0.5) * sys.size * 0.4,
        sys.size * (1.3 + rng() * 0.4),
        sys.size * (0.06 + rng() * 0.08),
      )
    }

    // Яркое пятно (~12%) — бури, огни цивилизации
    if (rng() < 0.12) {
      const spotColor = [0xfde047, 0xffffff, 0xa5f3fc, 0xfca5a5, 0xc4b5fd][
        Math.floor(rng() * 5)
      ]
      const ang = rng() * Math.PI * 2
      const dist = sys.size * rng() * 0.6
      g.fillStyle(spotColor, 0.5 + rng() * 0.3)
      g.fillCircle(
        Math.cos(ang) * dist,
        Math.sin(ang) * dist,
        sys.size * (0.05 + rng() * 0.1),
      )
      // Иногда — кластер огоньков
      if (rng() < 0.5) {
        for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
          const ang2 = ang + (rng() - 0.5) * 0.6
          const dist2 = dist + (rng() - 0.5) * sys.size * 0.2
          g.fillStyle(spotColor, 0.4 + rng() * 0.3)
          g.fillCircle(
            Math.cos(ang2) * dist2,
            Math.sin(ang2) * dist2,
            sys.size * (0.03 + rng() * 0.05),
          )
        }
      }
    }

    // Тёмная сторона (полусфера тени) — 35% планет получают 3D-эффект
    if (rng() < 0.35) {
      const shadowAng = rng() * Math.PI * 2
      const sx = Math.cos(shadowAng) * sys.size * 0.35
      const sy = Math.sin(shadowAng) * sys.size * 0.35
      g.fillStyle(0x000000, 0.18 + rng() * 0.15)
      g.fillCircle(sx, sy, sys.size * (0.85 + rng() * 0.1))
    }

    // Мини-блик (~50%) для объёма — позиция и размер вариативны
    if (rng() < 0.5) {
      const blickAng = (1.0 + rng() * 0.8) * Math.PI // верхне-левый сектор
      const blickDist = sys.size * (0.35 + rng() * 0.2)
      g.fillStyle(0xffffff, 0.15 + rng() * 0.2)
      g.fillEllipse(
        Math.cos(blickAng) * blickDist,
        Math.sin(blickAng) * blickDist,
        sys.size * (0.3 + rng() * 0.25),
        sys.size * (0.2 + rng() * 0.15),
      )
    }

    // === Трансформации g упрощены ===
    // Был случайный поворот + asymmetric scale (4 rng() вызова + 2 transform).
    // Теперь: фиксированный scale 1.0, только лёгкий поворот для разнообразия
    // (1 rng() — компромисс между однообразием и читаемостью).
    g.rotation = rng() * Math.PI * 2
    rng() // bypass aspectX
    rng() // bypass aspectY
    // scaleX/Y не меняем — остаются 1 (planet круглая, не приплюснутая).

    // Спутник у некоторых планет — обновляется в общем update-loop scene,
    // чтобы один раз проверить zoom-порог и пропустить орбит-калькуляцию при отдалении.
    if (sys.hasMoon) {
      const moon = this.scene.add.circle(
        sys.size * 1.4,
        -sys.size * 0.3,
        sys.size * 0.18,
        0xe5e7eb,
        0.85,
      )
      container.add(moon)
      this.scene.lod.moons.push({
        obj: moon,
        angle: rng() * Math.PI * 2,
        radius: sys.size * 1.5,
        speed: 0.3 + rng() * 0.3,
      })
    }

    // Маркер обитаемости — только жёлтое кольцо вокруг планеты.
    // Emoji-значки убраны: каждый был отдельным Text = уникальная текстура
    // = отдельный draw call. 67 обитаемых × 1 draw call = серьёзный налог
    // на mobile GPU (state switches between unique textures).
    if (sys.isInhabited) {
      g.lineStyle(1.5 * DPR, 0xfde047, 0.6)
      g.strokeCircle(0, 0, sys.size + 4 * DPR)
    }

    // Idle-анимации у фоновых планет ОТКЛЮЧЕНЫ — было 454 активных tween (227 × 2),
    // что создавало просадки FPS при zoom. Только для главных рас оставлены анимации.
    // Исключение: ~4% от 1000 фоновых планет (≈40) получают очень медленное вращение
    // (60-120s/оборот). Отдельный rng от seed — не влияет на порядок rng() выше,
    // на котором завязан texture signature.
    const rotRng = mulberry32((sys.rngSeed ^ 0xdeadbeef) >>> 0)
    if (rotRng() < 0.04) {
      const dir = rotRng() < 0.5 ? -1 : 1
      const periodMs = 60000 + Math.floor(rotRng() * 60000)
      this.scene.tweens.add({
        targets: container,
        rotation: dir * Math.PI * 2,
        duration: periodMs,
        repeat: -1,
        ease: 'Linear',
      })
    }
    void rng // подавить unused warning

    // Интерактивность для всех планет — тапы вызывают squish + эмоцию
    const baseR = sys.size + 6 * DPR
    const hitArea = new Phaser.Geom.Circle(0, 0, baseR)
    container.setInteractive(hitArea, Phaser.Geom.Circle.Contains)
    let downTime = 0
    let downX = 0,
      downY = 0
    let springTween: Phaser.Tweens.Tween | null = null
    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      downTime = Date.now()
      downX = p.x
      downY = p.y
    })
    container.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dt = Date.now() - downTime
      const moved = Math.abs(p.x - downX) + Math.abs(p.y - downY)
      if (dt < 300 && moved < 8 * DPR) {
        this.scene.tapHandledThisFrame = true
        eventBus.emit('starmap:planet-select', {
          planetId: sys.id,
          name: sys.name,
          archetype: (sys as BgSystem).archetype ?? '',
        })
        this.scene.popoverController.handlePlanetPress(sys)
        this.scene.popoverController.selectSystem(sys)
        // BG: показать модалку с именем через 400ms
        this.scene.popoverController.scheduleBgNamePopup(sys)
        // Spring-анимация: squish по вертикали → bounce, как у лягушек
        if (springTween) {
          springTween.stop()
          springTween = null
        }
        container.scaleY = 1.0
        springTween = this.scene.tweens.add({
          targets: container,
          scaleY: 0.78,
          duration: 55,
          ease: 'Power2.easeIn',
          onComplete: () => {
            springTween = this.scene.tweens.add({
              targets: container,
              scaleY: 1.0,
              duration: 150,
              ease: 'Back.easeOut',
              onComplete: () => {
                springTween = null
              },
            })
          },
        })
      }
    })

    this.scene.systemSprites.set(sys.id, container)
    // Регистрируем для batch-toggle interactive по zoom
    this.scene.lod.bgInteractiveContainers.push(container)
    // BG-планеты получают LOD: при zoom < BG_PLANET_MIN_ZOOM скрываются полностью
    this.scene.lod.cullableData.push({
      obj: container,
      x: sys.x,
      y: sys.y,
      r: sys.size * 2,
      lodMinZoom: BG_PLANET_MIN_ZOOM,
    })
    // Адаптивный hit-area — растёт при zoom-out, чтобы было удобно тапать
    this.scene.mainPlanetHits.push({ container, baseR, circle: hitArea })
  }
}
