import Phaser from 'phaser'
import {
  type AuraInstance,
  type AuraSpec,
  makeRadialTexture,
} from './ElementAuraOverlay'

// =====================================================================
// FIRE — пламя: outer halo + middle flame + bright core + sparks (epic+)
// =====================================================================

const TEX_FIRE_OUTER = '_aura_fire_outer'
const TEX_FIRE_MIDDLE = '_aura_fire_middle'
const TEX_FIRE_CORE = '_aura_fire_core'
const TEX_FIRE_SPARK = '_aura_fire_spark'

export const fireSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_FIRE_OUTER, 256, [
      [0, 'rgba(255, 130, 40, 0.7)'],
      [0.3, 'rgba(230, 70, 25, 0.5)'],
      [0.6, 'rgba(180, 30, 15, 0.2)'],
      [1, 'rgba(180, 30, 15, 0)'],
    ])
    makeRadialTexture(scene, TEX_FIRE_MIDDLE, 192, [
      [0, 'rgba(255, 200, 70, 0.95)'],
      [0.3, 'rgba(255, 130, 30, 0.75)'],
      [0.65, 'rgba(255, 70, 10, 0.4)'],
      [1, 'rgba(255, 70, 10, 0)'],
    ])
    makeRadialTexture(scene, TEX_FIRE_CORE, 128, [
      [0, 'rgba(255, 250, 220, 1)'],
      [0.35, 'rgba(255, 220, 130, 0.9)'],
      [0.7, 'rgba(255, 160, 50, 0.5)'],
      [1, 'rgba(255, 160, 50, 0)'],
    ])
    makeRadialTexture(scene, TEX_FIRE_SPARK, 32, [
      [0, 'rgba(255, 240, 180, 1)'],
      [0.4, 'rgba(255, 180, 80, 0.8)'],
      [1, 'rgba(255, 100, 30, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    const outer = scene.add.image(0, 0, TEX_FIRE_OUTER)
    outer.setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.6)
    container.add(outer)

    const middle = scene.add.image(0, -5, TEX_FIRE_MIDDLE)
    middle.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.8)
    container.add(middle)

    let core: Phaser.GameObjects.Image | null = null
    if (rarity !== 'common') {
      core = scene.add.image(0, -10, TEX_FIRE_CORE)
      core.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0.9)
      container.add(core)
    }

    if (rarity === 'epic' || rarity === 'legendary') {
      for (let i = 0; i < 5; i++) {
        const spark = scene.add.image((i - 2) * 8, 5, TEX_FIRE_SPARK)
        spark.setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0)
        container.add(spark)
        tweens.push(
          scene.tweens.add({
            targets: spark,
            y: { from: 5, to: -50 },
            alpha: { from: 0, to: 0.9 },
            scale: { from: 0.5, to: 0.15 },
            duration: 1800,
            delay: i * 360,
            repeat: -1,
            ease: 'Sine.easeOut',
          }),
        )
      }
    }

    tweens.push(
      scene.tweens.add({
        targets: outer,
        scale: { from: 0.55, to: 0.72 },
        alpha: { from: 0.5, to: 0.75 },
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )
    tweens.push(
      scene.tweens.add({
        targets: middle,
        scale: { from: 0.5, to: 0.66 },
        alpha: { from: 0.7, to: 0.95 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: -400,
      }),
    )
    if (core) {
      tweens.push(
        scene.tweens.add({
          targets: core,
          scale: { from: 0.35, to: 0.5 },
          alpha: { from: 0.85, to: 1 },
          duration: rarity === 'epic' || rarity === 'legendary' ? 800 : 1050,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: -700,
        }),
      )
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// WATER — ripples: концентрические волны расходятся от центра
// =====================================================================

const TEX_WATER_HALO = '_aura_water_halo'
const TEX_WATER_RING = '_aura_water_ring'
const TEX_WATER_BUBBLE = '_aura_water_bubble'

function bakeRingTexture(scene: Phaser.Scene, key: string, size: number): void {
  // Кольцо: прозрачный центр → яркий ring → прозрачный край
  if (scene.textures.exists(key)) return
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  grad.addColorStop(0, 'rgba(56, 189, 248, 0)')
  grad.addColorStop(0.5, 'rgba(56, 189, 248, 0)')
  grad.addColorStop(0.7, 'rgba(125, 211, 252, 0.7)')
  grad.addColorStop(0.85, 'rgba(56, 189, 248, 1)')
  grad.addColorStop(0.95, 'rgba(186, 230, 253, 0.5)')
  grad.addColorStop(1, 'rgba(186, 230, 253, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  scene.textures.addCanvas(key, canvas)
}

export const waterSpec: AuraSpec = {
  ensureTextures(scene) {
    // Soft halo
    makeRadialTexture(scene, TEX_WATER_HALO, 200, [
      [0, 'rgba(125, 211, 252, 0.75)'],
      [0.4, 'rgba(56, 189, 248, 0.4)'],
      [0.8, 'rgba(14, 116, 191, 0.1)'],
      [1, 'rgba(14, 116, 191, 0)'],
    ])
    bakeRingTexture(scene, TEX_WATER_RING, 256)
    // Bubble — небольшой круг с белым highlight
    makeRadialTexture(scene, TEX_WATER_BUBBLE, 48, [
      [0, 'rgba(224, 242, 254, 1)'],
      [0.3, 'rgba(125, 211, 252, 0.85)'],
      [0.7, 'rgba(56, 189, 248, 0.45)'],
      [1, 'rgba(14, 116, 191, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    // Halo
    const halo = scene.add.image(0, 0, TEX_WATER_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.55)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.5, to: 0.62 },
        alpha: { from: 0.5, to: 0.7 },
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    // Ripples — 3 ring waves для common/rare, 4 для epic/legendary
    const ringCount = rarity === 'epic' || rarity === 'legendary' ? 4 : 3
    const ringDuration = 2000
    for (let i = 0; i < ringCount; i++) {
      const ring = scene.add.image(0, 0, TEX_WATER_RING)
      ring.setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0)
      container.add(ring)
      tweens.push(
        scene.tweens.add({
          targets: ring,
          scale: { from: 0.2, to: 0.65 },
          alpha: { from: 0, to: 0.85 },
          duration: ringDuration,
          delay: (i * ringDuration) / ringCount,
          repeat: -1,
          ease: 'Quad.easeOut',
        }),
      )
      // Fade out на последней четверти — отдельный тwen с задержкой
      tweens.push(
        scene.tweens.add({
          targets: ring,
          alpha: { from: 0.85, to: 0 },
          duration: ringDuration * 0.6,
          delay: (i * ringDuration) / ringCount + ringDuration * 0.4,
          repeat: -1,
          ease: 'Quad.easeIn',
        }),
      )
    }

    // Bubbles для не-common
    if (rarity !== 'common') {
      const bubbleCount = rarity === 'epic' || rarity === 'legendary' ? 5 : 3
      for (let i = 0; i < bubbleCount; i++) {
        const bubble = scene.add.image(
          (i - bubbleCount / 2) * 9,
          20,
          TEX_WATER_BUBBLE,
        )
        bubble.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0)
        container.add(bubble)
        tweens.push(
          scene.tweens.add({
            targets: bubble,
            y: { from: 25, to: -40 },
            alpha: { from: 0, to: 0.9 },
            scale: { from: 0.3, to: 0.6 },
            duration: 1800,
            delay: i * 400,
            repeat: -1,
            ease: 'Sine.easeOut',
          }),
        )
      }
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// FOREST — листья орбитой вокруг центра + ambient halo
// =====================================================================

const TEX_FOREST_HALO = '_aura_forest_halo'
const TEX_FOREST_LEAF = '_aura_forest_leaf'

export const forestSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_FOREST_HALO, 220, [
      [0, 'rgba(190, 242, 100, 0.8)'],
      [0.35, 'rgba(74, 222, 128, 0.55)'],
      [0.7, 'rgba(22, 163, 74, 0.18)'],
      [1, 'rgba(22, 163, 74, 0)'],
    ])
    // Leaf — небольшая зелёная капля с тёмно-зелёным центром
    makeRadialTexture(scene, TEX_FOREST_LEAF, 40, [
      [0, 'rgba(34, 197, 94, 1)'],
      [0.35, 'rgba(74, 222, 128, 0.95)'],
      [0.75, 'rgba(132, 204, 22, 0.55)'],
      [1, 'rgba(132, 204, 22, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    // Halo
    const halo = scene.add.image(0, 0, TEX_FOREST_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.6)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.7 },
        alpha: { from: 0.55, to: 0.8 },
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    // Orbit container с листьями
    const leafCount =
      rarity === 'epic' || rarity === 'legendary'
        ? 7
        : rarity === 'rare'
          ? 5
          : 4
    const radius = 32
    const orbit = scene.add.container(0, 0)
    container.add(orbit)
    for (let i = 0; i < leafCount; i++) {
      const angle = (i / leafCount) * Math.PI * 2
      const lx = Math.cos(angle) * radius
      const ly = Math.sin(angle) * radius * 0.6 // slight ellipse, чтобы выглядело как глубина
      const leaf = scene.add.image(lx, ly, TEX_FOREST_LEAF)
      leaf.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.95)
      orbit.add(leaf)

      // Slight individual pulse
      tweens.push(
        scene.tweens.add({
          targets: leaf,
          scale: { from: 0.5, to: 0.65 },
          alpha: { from: 0.85, to: 1 },
          duration: 1200 + i * 80,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    // Orbit rotation — листья вращаются вокруг лягушки
    const rotationDuration =
      rarity === 'epic' || rarity === 'legendary' ? 5000 : 8000
    tweens.push(
      scene.tweens.add({
        targets: orbit,
        angle: { from: 0, to: 360 },
        duration: rotationDuration,
        repeat: -1,
        ease: 'Linear',
      }),
    )

    return { container, tweens, rarity }
  },
}

// =====================================================================
// TOXIC — токсичные пузырьки поднимаются + мерцающие пятна
// =====================================================================

const TEX_TOXIC_HALO = '_aura_toxic_halo'
const TEX_TOXIC_BUBBLE = '_aura_toxic_bubble'
const TEX_TOXIC_SPOT = '_aura_toxic_spot'

export const toxicSpec: AuraSpec = {
  ensureTextures(scene) {
    // Halo — болезненный зелёный с пурпурным оттенком
    makeRadialTexture(scene, TEX_TOXIC_HALO, 220, [
      [0, 'rgba(134, 239, 172, 0.75)'],
      [0.35, 'rgba(110, 231, 183, 0.5)'],
      [0.7, 'rgba(126, 34, 206, 0.18)'],
      [1, 'rgba(126, 34, 206, 0)'],
    ])
    // Bubble — toxic green с пурпурным core
    makeRadialTexture(scene, TEX_TOXIC_BUBBLE, 56, [
      [0, 'rgba(216, 180, 254, 0.95)'],
      [0.25, 'rgba(134, 239, 172, 0.85)'],
      [0.6, 'rgba(74, 222, 128, 0.5)'],
      [1, 'rgba(74, 222, 128, 0)'],
    ])
    // Spot — крошечный мерцающий yellow-green dot
    makeRadialTexture(scene, TEX_TOXIC_SPOT, 24, [
      [0, 'rgba(217, 249, 157, 1)'],
      [0.4, 'rgba(190, 242, 100, 0.85)'],
      [1, 'rgba(132, 204, 22, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    // Halo
    const halo = scene.add.image(0, 0, TEX_TOXIC_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.6)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.72 },
        alpha: { from: 0.55, to: 0.85 },
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    // Toxic bubbles — поднимаются снизу вверх
    const bubbleCount =
      rarity === 'epic' || rarity === 'legendary'
        ? 5
        : rarity === 'rare'
          ? 4
          : 3
    for (let i = 0; i < bubbleCount; i++) {
      const startX = (i - (bubbleCount - 1) / 2) * 10 + (i % 2 === 0 ? -3 : 3)
      const bubble = scene.add.image(startX, 22, TEX_TOXIC_BUBBLE)
      bubble.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0)
      container.add(bubble)
      tweens.push(
        scene.tweens.add({
          targets: bubble,
          y: { from: 25, to: -45 },
          alpha: { from: 0, to: 0.95 },
          scale: { from: 0.35, to: 0.7 },
          duration: 2200,
          delay: i * 420,
          repeat: -1,
          ease: 'Sine.easeOut',
        }),
      )
    }

    // Twinkling spots — мерцают в случайных точках
    const spotCount =
      rarity === 'epic' || rarity === 'legendary'
        ? 8
        : rarity === 'rare'
          ? 5
          : 3
    for (let i = 0; i < spotCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const r = 15 + Math.random() * 30
      const sx = Math.cos(angle) * r
      const sy = Math.sin(angle) * r * 0.7
      const spot = scene.add.image(sx, sy, TEX_TOXIC_SPOT)
      spot.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0)
      container.add(spot)
      tweens.push(
        scene.tweens.add({
          targets: spot,
          alpha: { from: 0, to: 0.95 },
          scale: { from: 0.3, to: 0.6 },
          duration: 700 + Math.random() * 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: Math.random() * 1500,
        }),
      )
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// PLASMA — электрические разряды: bolts вращаются вокруг ядра
// =====================================================================

const TEX_PLASMA_HALO = '_aura_plasma_halo'
const TEX_PLASMA_BOLT = '_aura_plasma_bolt'
const TEX_PLASMA_CORE = '_aura_plasma_core'
const TEX_PLASMA_SPARK = '_aura_plasma_spark'

export const plasmaSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_PLASMA_HALO, 220, [
      [0, 'rgba(254, 240, 138, 0.8)'],
      [0.35, 'rgba(253, 224, 71, 0.55)'],
      [0.75, 'rgba(202, 138, 4, 0.18)'],
      [1, 'rgba(202, 138, 4, 0)'],
    ])
    makeRadialTexture(scene, TEX_PLASMA_BOLT, 64, [
      [0, 'rgba(255, 255, 240, 1)'],
      [0.3, 'rgba(254, 240, 138, 0.95)'],
      [0.7, 'rgba(253, 224, 71, 0.5)'],
      [1, 'rgba(253, 224, 71, 0)'],
    ])
    makeRadialTexture(scene, TEX_PLASMA_CORE, 96, [
      [0, 'rgba(255, 255, 255, 1)'],
      [0.3, 'rgba(255, 250, 220, 0.95)'],
      [0.7, 'rgba(254, 240, 138, 0.55)'],
      [1, 'rgba(254, 240, 138, 0)'],
    ])
    makeRadialTexture(scene, TEX_PLASMA_SPARK, 24, [
      [0, 'rgba(255, 255, 255, 1)'],
      [0.4, 'rgba(254, 240, 138, 0.85)'],
      [1, 'rgba(253, 224, 71, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    const halo = scene.add.image(0, 0, TEX_PLASMA_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.6)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.72 },
        alpha: { from: 0.5, to: 0.85 },
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    // Bolts — электрические дуги вокруг ядра
    const boltCount =
      rarity === 'epic' || rarity === 'legendary'
        ? 6
        : rarity === 'rare'
          ? 5
          : 4
    const boltRadius = 28
    const orbit = scene.add.container(0, 0)
    container.add(orbit)
    for (let i = 0; i < boltCount; i++) {
      const angle = (i / boltCount) * Math.PI * 2
      const bx = Math.cos(angle) * boltRadius
      const by = Math.sin(angle) * boltRadius
      const bolt = scene.add.image(bx, by, TEX_PLASMA_BOLT)
      bolt.setBlendMode(Phaser.BlendModes.ADD)
      bolt.setRotation(angle + Math.PI / 2)
      bolt.setScale(0.18, 0.7)
      bolt.setAlpha(0.8)
      orbit.add(bolt)
      tweens.push(
        scene.tweens.add({
          targets: bolt,
          alpha: { from: 0.4, to: 1 },
          scaleY: { from: 0.55, to: 0.85 },
          duration: 200 + Math.random() * 200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: Math.random() * 400,
        }),
      )
    }

    const rotationDuration =
      rarity === 'epic' || rarity === 'legendary' ? 3000 : 4500
    tweens.push(
      scene.tweens.add({
        targets: orbit,
        angle: { from: 0, to: 360 },
        duration: rotationDuration,
        repeat: -1,
        ease: 'Linear',
      }),
    )

    if (rarity !== 'common') {
      const core = scene.add.image(0, 0, TEX_PLASMA_CORE)
      core.setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.9)
      container.add(core)
      tweens.push(
        scene.tweens.add({
          targets: core,
          scale: { from: 0.3, to: 0.5 },
          alpha: { from: 0.85, to: 1 },
          duration: rarity === 'epic' || rarity === 'legendary' ? 600 : 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    if (rarity === 'epic' || rarity === 'legendary') {
      for (let i = 0; i < 6; i++) {
        const sangle = Math.random() * Math.PI * 2
        const sr = 18 + Math.random() * 28
        const sx = Math.cos(sangle) * sr
        const sy = Math.sin(sangle) * sr
        const spark = scene.add.image(sx, sy, TEX_PLASMA_SPARK)
        spark.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0)
        container.add(spark)
        tweens.push(
          scene.tweens.add({
            targets: spark,
            alpha: { from: 0, to: 1 },
            scale: { from: 0.3, to: 0.7 },
            duration: 200 + Math.random() * 200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: Math.random() * 1500,
          }),
        )
      }
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// SHADOW — тёмные wisps: облака теней вращаются и поглощают свет
// =====================================================================

const TEX_SHADOW_HALO = '_aura_shadow_halo'
const TEX_SHADOW_WISP = '_aura_shadow_wisp'
const TEX_SHADOW_INNER = '_aura_shadow_inner'
const TEX_SHADOW_SPARK = '_aura_shadow_spark'

export const shadowSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_SHADOW_HALO, 240, [
      [0, 'rgba(107, 114, 128, 0.85)'],
      [0.35, 'rgba(75, 85, 99, 0.6)'],
      [0.7, 'rgba(91, 33, 182, 0.25)'],
      [1, 'rgba(91, 33, 182, 0)'],
    ])
    makeRadialTexture(scene, TEX_SHADOW_WISP, 200, [
      [0, 'rgba(55, 65, 81, 0.9)'],
      [0.4, 'rgba(91, 33, 182, 0.6)'],
      [0.8, 'rgba(15, 23, 42, 0.2)'],
      [1, 'rgba(15, 23, 42, 0)'],
    ])
    makeRadialTexture(scene, TEX_SHADOW_INNER, 120, [
      [0, 'rgba(30, 27, 75, 0.95)'],
      [0.5, 'rgba(76, 29, 149, 0.55)'],
      [1, 'rgba(76, 29, 149, 0)'],
    ])
    makeRadialTexture(scene, TEX_SHADOW_SPARK, 28, [
      [0, 'rgba(196, 181, 253, 1)'],
      [0.4, 'rgba(139, 92, 246, 0.85)'],
      [1, 'rgba(76, 29, 149, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    const halo = scene.add.image(0, 0, TEX_SHADOW_HALO)
    halo.setBlendMode(Phaser.BlendModes.SCREEN).setScale(0.55).setAlpha(0.5)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.7 },
        alpha: { from: 0.45, to: 0.7 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    // Wisps — 2-3 больших облака вращаются в разные стороны
    const wispCount = rarity === 'epic' || rarity === 'legendary' ? 3 : 2
    for (let i = 0; i < wispCount; i++) {
      const wisp = scene.add.image(0, 0, TEX_SHADOW_WISP)
      wisp.setBlendMode(Phaser.BlendModes.SCREEN)
      wisp.setScale(0.5)
      wisp.setAlpha(0.55)
      container.add(wisp)
      const direction = i % 2 === 0 ? 1 : -1
      tweens.push(
        scene.tweens.add({
          targets: wisp,
          angle: { from: 0, to: 360 * direction },
          duration: 8000 + i * 1500,
          repeat: -1,
          ease: 'Linear',
        }),
      )
      tweens.push(
        scene.tweens.add({
          targets: wisp,
          scale: { from: 0.45, to: 0.65 },
          alpha: { from: 0.4, to: 0.7 },
          duration: 2000 + i * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    if (rarity !== 'common') {
      const inner = scene.add.image(0, 0, TEX_SHADOW_INNER)
      inner.setBlendMode(Phaser.BlendModes.SCREEN).setScale(0.4).setAlpha(0.8)
      container.add(inner)
      tweens.push(
        scene.tweens.add({
          targets: inner,
          scale: { from: 0.35, to: 0.5 },
          alpha: { from: 0.7, to: 0.95 },
          duration: 1800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    if (rarity === 'epic' || rarity === 'legendary') {
      for (let i = 0; i < 6; i++) {
        const sangle = Math.random() * Math.PI * 2
        const sr = 20 + Math.random() * 30
        const sx = Math.cos(sangle) * sr
        const sy = Math.sin(sangle) * sr * 0.8
        const spark = scene.add.image(sx, sy, TEX_SHADOW_SPARK)
        spark.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0)
        container.add(spark)
        tweens.push(
          scene.tweens.add({
            targets: spark,
            alpha: { from: 0, to: 0.9 },
            scale: { from: 0.3, to: 0.6 },
            duration: 900 + Math.random() * 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: Math.random() * 2000,
          }),
        )
      }
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// CRYSTAL — лавандовые осколки orbit'инг + bright pulsing core
// =====================================================================

const TEX_CRYSTAL_HALO = '_aura_crystal_halo'
const TEX_CRYSTAL_SHARD = '_aura_crystal_shard'
const TEX_CRYSTAL_CORE = '_aura_crystal_core'
const TEX_CRYSTAL_TWINKLE = '_aura_crystal_twinkle'

export const crystalSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_CRYSTAL_HALO, 220, [
      [0, 'rgba(221, 214, 254, 0.85)'],
      [0.35, 'rgba(167, 139, 250, 0.55)'],
      [0.75, 'rgba(124, 58, 237, 0.18)'],
      [1, 'rgba(124, 58, 237, 0)'],
    ])
    makeRadialTexture(scene, TEX_CRYSTAL_SHARD, 48, [
      [0, 'rgba(255, 255, 255, 1)'],
      [0.3, 'rgba(221, 214, 254, 0.95)'],
      [0.7, 'rgba(167, 139, 250, 0.6)'],
      [1, 'rgba(167, 139, 250, 0)'],
    ])
    makeRadialTexture(scene, TEX_CRYSTAL_CORE, 96, [
      [0, 'rgba(255, 255, 255, 1)'],
      [0.4, 'rgba(237, 233, 254, 0.9)'],
      [0.8, 'rgba(196, 181, 253, 0.4)'],
      [1, 'rgba(196, 181, 253, 0)'],
    ])
    makeRadialTexture(scene, TEX_CRYSTAL_TWINKLE, 20, [
      [0, 'rgba(255, 255, 255, 1)'],
      [0.4, 'rgba(237, 233, 254, 0.85)'],
      [1, 'rgba(196, 181, 253, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    const halo = scene.add.image(0, 0, TEX_CRYSTAL_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.55)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.7 },
        alpha: { from: 0.5, to: 0.8 },
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    // Shards — ромбоидальная форма (узкий вертикальный осколок) orbit'ит
    const shardCount =
      rarity === 'epic' || rarity === 'legendary'
        ? 7
        : rarity === 'rare'
          ? 5
          : 4
    const shardRadius = 30
    const orbit = scene.add.container(0, 0)
    container.add(orbit)
    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * Math.PI * 2
      const sx = Math.cos(angle) * shardRadius
      const sy = Math.sin(angle) * shardRadius * 0.7
      const shard = scene.add.image(sx, sy, TEX_CRYSTAL_SHARD)
      shard.setBlendMode(Phaser.BlendModes.ADD)
      shard.setScale(0.35, 0.65)
      shard.setRotation(angle)
      shard.setAlpha(0.9)
      orbit.add(shard)
      tweens.push(
        scene.tweens.add({
          targets: shard,
          alpha: { from: 0.65, to: 1 },
          scaleY: { from: 0.55, to: 0.75 },
          duration: 900 + i * 100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: i * 150,
        }),
      )
    }

    const rotationDuration =
      rarity === 'epic' || rarity === 'legendary' ? 6000 : 9000
    tweens.push(
      scene.tweens.add({
        targets: orbit,
        angle: { from: 0, to: 360 },
        duration: rotationDuration,
        repeat: -1,
        ease: 'Linear',
      }),
    )

    if (rarity !== 'common') {
      const core = scene.add.image(0, 0, TEX_CRYSTAL_CORE)
      core.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0.85)
      container.add(core)
      tweens.push(
        scene.tweens.add({
          targets: core,
          scale: { from: 0.35, to: 0.55 },
          alpha: { from: 0.75, to: 1 },
          duration: rarity === 'epic' || rarity === 'legendary' ? 900 : 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    if (rarity === 'epic' || rarity === 'legendary') {
      for (let i = 0; i < 8; i++) {
        const tangle = Math.random() * Math.PI * 2
        const tr = 20 + Math.random() * 30
        const tx = Math.cos(tangle) * tr
        const ty = Math.sin(tangle) * tr * 0.8
        const twink = scene.add.image(tx, ty, TEX_CRYSTAL_TWINKLE)
        twink.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0)
        container.add(twink)
        tweens.push(
          scene.tweens.add({
            targets: twink,
            alpha: { from: 0, to: 1 },
            scale: { from: 0.3, to: 0.6 },
            duration: 500 + Math.random() * 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: Math.random() * 1500,
          }),
        )
      }
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// DESERT — песчаные вихри: песчинки кружатся вокруг тёплого halo
// =====================================================================

const TEX_DESERT_HALO = '_aura_desert_halo'
const TEX_DESERT_GRAIN = '_aura_desert_grain'
const TEX_DESERT_CORE = '_aura_desert_core'

export const desertSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_DESERT_HALO, 220, [
      [0, 'rgba(253, 230, 138, 0.8)'],
      [0.35, 'rgba(245, 158, 11, 0.55)'],
      [0.75, 'rgba(146, 64, 14, 0.18)'],
      [1, 'rgba(146, 64, 14, 0)'],
    ])
    makeRadialTexture(scene, TEX_DESERT_GRAIN, 20, [
      [0, 'rgba(254, 243, 199, 1)'],
      [0.4, 'rgba(252, 211, 77, 0.85)'],
      [1, 'rgba(180, 83, 9, 0)'],
    ])
    makeRadialTexture(scene, TEX_DESERT_CORE, 96, [
      [0, 'rgba(255, 247, 215, 0.95)'],
      [0.35, 'rgba(253, 224, 71, 0.75)'],
      [0.8, 'rgba(245, 158, 11, 0.3)'],
      [1, 'rgba(245, 158, 11, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    const halo = scene.add.image(0, 0, TEX_DESERT_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.6)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.72 },
        alpha: { from: 0.5, to: 0.8 },
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    const grainCount =
      rarity === 'epic' || rarity === 'legendary'
        ? 14
        : rarity === 'rare'
          ? 10
          : 7
    const orbit = scene.add.container(0, 0)
    container.add(orbit)
    for (let i = 0; i < grainCount; i++) {
      const angle = (i / grainCount) * Math.PI * 2 + Math.random() * 0.4
      const r = 22 + Math.random() * 18
      const gx = Math.cos(angle) * r
      const gy = Math.sin(angle) * r * 0.65
      const grain = scene.add.image(gx, gy, TEX_DESERT_GRAIN)
      grain.setBlendMode(Phaser.BlendModes.ADD)
      grain.setScale(0.3 + Math.random() * 0.3)
      grain.setAlpha(0.7 + Math.random() * 0.3)
      orbit.add(grain)
      tweens.push(
        scene.tweens.add({
          targets: grain,
          alpha: { from: 0.4, to: 1 },
          duration: 600 + Math.random() * 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: Math.random() * 800,
        }),
      )
    }

    const rotationDuration =
      rarity === 'epic' || rarity === 'legendary' ? 4000 : 6000
    tweens.push(
      scene.tweens.add({
        targets: orbit,
        angle: { from: 0, to: 360 },
        duration: rotationDuration,
        repeat: -1,
        ease: 'Linear',
      }),
    )

    if (rarity !== 'common') {
      const core = scene.add.image(0, 0, TEX_DESERT_CORE)
      core.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0.85)
      container.add(core)
      tweens.push(
        scene.tweens.add({
          targets: core,
          scale: { from: 0.35, to: 0.5 },
          alpha: { from: 0.75, to: 1 },
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// GAS — газовые облака клубятся вокруг лягушки
// =====================================================================

const TEX_GAS_HALO = '_aura_gas_halo'
const TEX_GAS_CLOUD = '_aura_gas_cloud'
const TEX_GAS_WISP = '_aura_gas_wisp'

export const gasSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_GAS_HALO, 240, [
      [0, 'rgba(254, 215, 170, 0.8)'],
      [0.35, 'rgba(251, 146, 60, 0.55)'],
      [0.75, 'rgba(154, 52, 18, 0.2)'],
      [1, 'rgba(154, 52, 18, 0)'],
    ])
    makeRadialTexture(scene, TEX_GAS_CLOUD, 180, [
      [0, 'rgba(255, 237, 213, 0.9)'],
      [0.4, 'rgba(251, 146, 60, 0.65)'],
      [0.8, 'rgba(194, 65, 12, 0.2)'],
      [1, 'rgba(194, 65, 12, 0)'],
    ])
    makeRadialTexture(scene, TEX_GAS_WISP, 80, [
      [0, 'rgba(254, 215, 170, 0.85)'],
      [0.5, 'rgba(251, 146, 60, 0.55)'],
      [1, 'rgba(251, 146, 60, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    const halo = scene.add.image(0, 0, TEX_GAS_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.55)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.72 },
        alpha: { from: 0.5, to: 0.8 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    const cloudCount = rarity === 'epic' || rarity === 'legendary' ? 3 : 2
    for (let i = 0; i < cloudCount; i++) {
      const offsetX = (i - (cloudCount - 1) / 2) * 12
      const cloud = scene.add.image(offsetX, 0, TEX_GAS_CLOUD)
      cloud.setBlendMode(Phaser.BlendModes.ADD)
      cloud.setScale(0.4 + i * 0.05)
      cloud.setAlpha(0.55)
      container.add(cloud)
      const direction = i % 2 === 0 ? 1 : -1
      tweens.push(
        scene.tweens.add({
          targets: cloud,
          angle: { from: 0, to: 360 * direction },
          duration: 9000 + i * 2000,
          repeat: -1,
          ease: 'Linear',
        }),
      )
      tweens.push(
        scene.tweens.add({
          targets: cloud,
          scale: { from: 0.35 + i * 0.05, to: 0.55 + i * 0.05 },
          alpha: { from: 0.4, to: 0.75 },
          duration: 2400 + i * 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    const wispCount =
      rarity === 'epic' || rarity === 'legendary'
        ? 4
        : rarity === 'rare'
          ? 3
          : 0
    for (let i = 0; i < wispCount; i++) {
      const wx = (i - (wispCount - 1) / 2) * 14
      const wisp = scene.add.image(wx, 15, TEX_GAS_WISP)
      wisp.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0)
      container.add(wisp)
      tweens.push(
        scene.tweens.add({
          targets: wisp,
          y: { from: 20, to: -40 },
          alpha: { from: 0, to: 0.7 },
          scale: { from: 0.3, to: 0.55 },
          duration: 2400,
          delay: i * 600,
          repeat: -1,
          ease: 'Sine.easeOut',
        }),
      )
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// RING — кольца Сатурна: концентрические эллипсы вращаются + частицы
// =====================================================================

const TEX_RING_HALO = '_aura_ring_halo'
const TEX_RING_BAND = '_aura_ring_band'
const TEX_RING_PARTICLE = '_aura_ring_particle'

function bakeRingBandTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
): void {
  if (scene.textures.exists(key)) return
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  grad.addColorStop(0, 'rgba(196, 181, 253, 0)')
  grad.addColorStop(0.55, 'rgba(196, 181, 253, 0)')
  grad.addColorStop(0.7, 'rgba(196, 181, 253, 0.55)')
  grad.addColorStop(0.85, 'rgba(167, 139, 250, 1)')
  grad.addColorStop(0.95, 'rgba(221, 214, 254, 0.55)')
  grad.addColorStop(1, 'rgba(221, 214, 254, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  scene.textures.addCanvas(key, canvas)
}

export const ringSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_RING_HALO, 220, [
      [0, 'rgba(221, 214, 254, 0.75)'],
      [0.4, 'rgba(167, 139, 250, 0.4)'],
      [0.8, 'rgba(91, 33, 182, 0.15)'],
      [1, 'rgba(91, 33, 182, 0)'],
    ])
    bakeRingBandTexture(scene, TEX_RING_BAND, 256)
    makeRadialTexture(scene, TEX_RING_PARTICLE, 16, [
      [0, 'rgba(237, 233, 254, 1)'],
      [0.5, 'rgba(196, 181, 253, 0.85)'],
      [1, 'rgba(167, 139, 250, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    const halo = scene.add.image(0, 0, TEX_RING_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.5)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.5, to: 0.65 },
        alpha: { from: 0.45, to: 0.7 },
        duration: 2800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    const ringCount =
      rarity === 'epic' || rarity === 'legendary'
        ? 3
        : rarity === 'rare'
          ? 2
          : 1
    for (let i = 0; i < ringCount; i++) {
      const band = scene.add.image(0, 0, TEX_RING_BAND)
      band.setBlendMode(Phaser.BlendModes.ADD)
      const baseScale = 0.45 + i * 0.12
      band.setScale(baseScale, baseScale * 0.4)
      band.setAlpha(0.7)
      band.setRotation(-0.25)
      container.add(band)
      const direction = i % 2 === 0 ? 1 : -1
      tweens.push(
        scene.tweens.add({
          targets: band,
          angle: { from: -15, to: -15 + 360 * direction },
          duration: 7000 + i * 1500,
          repeat: -1,
          ease: 'Linear',
        }),
      )
      tweens.push(
        scene.tweens.add({
          targets: band,
          alpha: { from: 0.6, to: 0.9 },
          duration: 1800 + i * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    if (rarity === 'epic' || rarity === 'legendary') {
      const particleCount = 8
      const orbit = scene.add.container(0, 0)
      container.add(orbit)
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2
        const r = 36 + Math.random() * 8
        const px = Math.cos(angle) * r
        const py = Math.sin(angle) * r * 0.4
        const particle = scene.add.image(px, py, TEX_RING_PARTICLE)
        particle.setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.8)
        orbit.add(particle)
        tweens.push(
          scene.tweens.add({
            targets: particle,
            alpha: { from: 0.5, to: 1 },
            duration: 500 + Math.random() * 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: Math.random() * 800,
          }),
        )
      }
      orbit.setRotation(-0.25)
      tweens.push(
        scene.tweens.add({
          targets: orbit,
          angle: { from: -15, to: 345 },
          duration: 5000,
          repeat: -1,
          ease: 'Linear',
        }),
      )
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// BINARY — двоение/стереоэффект: aura чуть смещается влево/вправо как 3D
// =====================================================================

const TEX_BINARY_GHOST_L = '_aura_binary_ghost_l'
const TEX_BINARY_GHOST_R = '_aura_binary_ghost_r'
const TEX_BINARY_CORE = '_aura_binary_core'

export const binarySpec: AuraSpec = {
  ensureTextures(scene) {
    // Левая half — cyan/blue (как левая линза 3D-очков)
    makeRadialTexture(scene, TEX_BINARY_GHOST_L, 200, [
      [0, 'rgba(56, 189, 248, 0.85)'],
      [0.4, 'rgba(14, 165, 233, 0.55)'],
      [0.85, 'rgba(7, 89, 133, 0.15)'],
      [1, 'rgba(7, 89, 133, 0)'],
    ])
    // Правая half — red (как правая линза 3D-очков)
    makeRadialTexture(scene, TEX_BINARY_GHOST_R, 200, [
      [0, 'rgba(252, 165, 165, 0.85)'],
      [0.4, 'rgba(239, 68, 68, 0.55)'],
      [0.85, 'rgba(127, 29, 29, 0.15)'],
      [1, 'rgba(127, 29, 29, 0)'],
    ])
    makeRadialTexture(scene, TEX_BINARY_CORE, 100, [
      [0, 'rgba(255, 255, 255, 0.95)'],
      [0.4, 'rgba(254, 240, 138, 0.75)'],
      [0.85, 'rgba(254, 240, 138, 0.2)'],
      [1, 'rgba(254, 240, 138, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    // 3D-очки эффект — два смещённых halo с разным цветом, аддитивно
    const offsetBase =
      rarity === 'epic' || rarity === 'legendary'
        ? 10
        : rarity === 'rare'
          ? 7
          : 5

    const ghostL = scene.add.image(-offsetBase, 0, TEX_BINARY_GHOST_L)
    ghostL.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.65)
    container.add(ghostL)

    const ghostR = scene.add.image(offsetBase, 0, TEX_BINARY_GHOST_R)
    ghostR.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.65)
    container.add(ghostR)

    // Pulse offset — двоение покачивается (как нестабильное стерео)
    tweens.push(
      scene.tweens.add({
        targets: ghostL,
        x: { from: -offsetBase, to: -offsetBase - 4 },
        alpha: { from: 0.55, to: 0.85 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )
    tweens.push(
      scene.tweens.add({
        targets: ghostR,
        x: { from: offsetBase, to: offsetBase + 4 },
        alpha: { from: 0.55, to: 0.85 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 350, // противофаза с левым ghost
      }),
    )
    tweens.push(
      scene.tweens.add({
        targets: [ghostL, ghostR],
        scale: { from: 0.55, to: 0.68 },
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    if (rarity !== 'common') {
      const core = scene.add.image(0, 0, TEX_BINARY_CORE)
      core.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0.85)
      container.add(core)
      tweens.push(
        scene.tweens.add({
          targets: core,
          scale: { from: 0.35, to: 0.5 },
          alpha: { from: 0.7, to: 1 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// ARCANE — магия: руны вращаются по орбите + мистический halo
// =====================================================================

const TEX_ARCANE_HALO = '_aura_arcane_halo'
const TEX_ARCANE_RUNE = '_aura_arcane_rune'
const TEX_ARCANE_CORE = '_aura_arcane_core'
const TEX_ARCANE_SPARK = '_aura_arcane_spark'

export const arcaneSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_ARCANE_HALO, 240, [
      [0, 'rgba(196, 181, 253, 0.8)'],
      [0.35, 'rgba(139, 92, 246, 0.55)'],
      [0.75, 'rgba(76, 29, 149, 0.2)'],
      [1, 'rgba(76, 29, 149, 0)'],
    ])
    // Rune — small bright purple-cyan glow
    makeRadialTexture(scene, TEX_ARCANE_RUNE, 32, [
      [0, 'rgba(237, 233, 254, 1)'],
      [0.3, 'rgba(167, 139, 250, 0.95)'],
      [0.7, 'rgba(124, 58, 237, 0.55)'],
      [1, 'rgba(124, 58, 237, 0)'],
    ])
    makeRadialTexture(scene, TEX_ARCANE_CORE, 100, [
      [0, 'rgba(255, 255, 255, 1)'],
      [0.35, 'rgba(196, 181, 253, 0.9)'],
      [0.85, 'rgba(139, 92, 246, 0.4)'],
      [1, 'rgba(139, 92, 246, 0)'],
    ])
    makeRadialTexture(scene, TEX_ARCANE_SPARK, 18, [
      [0, 'rgba(255, 255, 255, 1)'],
      [0.5, 'rgba(196, 181, 253, 0.85)'],
      [1, 'rgba(139, 92, 246, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    const halo = scene.add.image(0, 0, TEX_ARCANE_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.6)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.72 },
        alpha: { from: 0.5, to: 0.85 },
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    // Two orbit rings (counter-rotating) — внешнее и внутреннее
    const runeCountOuter =
      rarity === 'epic' || rarity === 'legendary'
        ? 6
        : rarity === 'rare'
          ? 5
          : 4
    const outerRadius = 34
    const outerOrbit = scene.add.container(0, 0)
    container.add(outerOrbit)
    for (let i = 0; i < runeCountOuter; i++) {
      const angle = (i / runeCountOuter) * Math.PI * 2
      const rx = Math.cos(angle) * outerRadius
      const ry = Math.sin(angle) * outerRadius * 0.75
      const rune = scene.add.image(rx, ry, TEX_ARCANE_RUNE)
      rune.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.9)
      outerOrbit.add(rune)
      tweens.push(
        scene.tweens.add({
          targets: rune,
          alpha: { from: 0.65, to: 1 },
          scale: { from: 0.45, to: 0.65 },
          duration: 1000 + i * 120,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }
    tweens.push(
      scene.tweens.add({
        targets: outerOrbit,
        angle: { from: 0, to: 360 },
        duration: rarity === 'epic' || rarity === 'legendary' ? 6000 : 8500,
        repeat: -1,
        ease: 'Linear',
      }),
    )

    // Inner counter-rotating ring (rare+)
    if (rarity !== 'common') {
      const runeCountInner = 4
      const innerRadius = 20
      const innerOrbit = scene.add.container(0, 0)
      container.add(innerOrbit)
      for (let i = 0; i < runeCountInner; i++) {
        const angle = (i / runeCountInner) * Math.PI * 2
        const rx = Math.cos(angle) * innerRadius
        const ry = Math.sin(angle) * innerRadius * 0.75
        const rune = scene.add.image(rx, ry, TEX_ARCANE_RUNE)
        rune.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0.85)
        innerOrbit.add(rune)
      }
      tweens.push(
        scene.tweens.add({
          targets: innerOrbit,
          angle: { from: 0, to: -360 },
          duration: 5000,
          repeat: -1,
          ease: 'Linear',
        }),
      )
    }

    // Mystic core
    if (rarity !== 'common') {
      const core = scene.add.image(0, 0, TEX_ARCANE_CORE)
      core.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0.85)
      container.add(core)
      tweens.push(
        scene.tweens.add({
          targets: core,
          scale: { from: 0.35, to: 0.55 },
          alpha: { from: 0.75, to: 1 },
          duration: rarity === 'epic' || rarity === 'legendary' ? 900 : 1300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    // Sparks for epic+
    if (rarity === 'epic' || rarity === 'legendary') {
      for (let i = 0; i < 8; i++) {
        const sangle = Math.random() * Math.PI * 2
        const sr = 24 + Math.random() * 18
        const sx = Math.cos(sangle) * sr
        const sy = Math.sin(sangle) * sr * 0.7
        const spark = scene.add.image(sx, sy, TEX_ARCANE_SPARK)
        spark.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0)
        container.add(spark)
        tweens.push(
          scene.tweens.add({
            targets: spark,
            alpha: { from: 0, to: 1 },
            duration: 600 + Math.random() * 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: Math.random() * 1500,
          }),
        )
      }
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// MECHANICAL — шестерни вращаются, металлический блеск
// =====================================================================

const TEX_MECH_HALO = '_aura_mech_halo'
const TEX_MECH_GEAR = '_aura_mech_gear'
const TEX_MECH_CORE = '_aura_mech_core'

export const mechanicalSpec: AuraSpec = {
  ensureTextures(scene) {
    // Halo — холодный металлический жёлто-серый
    makeRadialTexture(scene, TEX_MECH_HALO, 220, [
      [0, 'rgba(253, 216, 122, 0.8)'],
      [0.35, 'rgba(202, 138, 4, 0.55)'],
      [0.8, 'rgba(82, 82, 82, 0.2)'],
      [1, 'rgba(82, 82, 82, 0)'],
    ])
    // Gear — короткая яркая капля (используем как зубец шестерни)
    makeRadialTexture(scene, TEX_MECH_GEAR, 36, [
      [0, 'rgba(253, 230, 138, 1)'],
      [0.3, 'rgba(202, 138, 4, 0.9)'],
      [0.75, 'rgba(120, 53, 15, 0.45)'],
      [1, 'rgba(120, 53, 15, 0)'],
    ])
    makeRadialTexture(scene, TEX_MECH_CORE, 100, [
      [0, 'rgba(255, 251, 235, 1)'],
      [0.35, 'rgba(253, 216, 122, 0.9)'],
      [0.85, 'rgba(202, 138, 4, 0.4)'],
      [1, 'rgba(202, 138, 4, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    const halo = scene.add.image(0, 0, TEX_MECH_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.55)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.7 },
        alpha: { from: 0.5, to: 0.8 },
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    // Gears — шестерни вращаются. Каждая шестерня — это container с zubcami (radial dots)
    const gearCount = rarity === 'epic' || rarity === 'legendary' ? 3 : 2
    const gearPositions: Array<{ x: number; y: number; size: number }> =
      gearCount === 3
        ? [
            { x: -22, y: -8, size: 0.85 },
            { x: 20, y: -10, size: 0.7 },
            { x: 0, y: 18, size: 1.0 },
          ]
        : [
            { x: -18, y: -6, size: 1.0 },
            { x: 18, y: 8, size: 0.8 },
          ]
    for (let g = 0; g < gearCount; g++) {
      const pos = gearPositions[g]
      const gear = scene.add.container(pos.x, pos.y)
      container.add(gear)
      const teeth = 6
      for (let t = 0; t < teeth; t++) {
        const tangle = (t / teeth) * Math.PI * 2
        const tr = 8 * pos.size
        const tooth = scene.add.image(
          Math.cos(tangle) * tr,
          Math.sin(tangle) * tr,
          TEX_MECH_GEAR,
        )
        tooth.setBlendMode(Phaser.BlendModes.ADD)
        tooth.setScale(0.35 * pos.size)
        tooth.setAlpha(0.85)
        gear.add(tooth)
      }
      const direction = g % 2 === 0 ? 1 : -1
      tweens.push(
        scene.tweens.add({
          targets: gear,
          angle: { from: 0, to: 360 * direction },
          duration: 3500 + g * 700,
          repeat: -1,
          ease: 'Linear',
        }),
      )
    }

    if (rarity !== 'common') {
      const core = scene.add.image(0, 0, TEX_MECH_CORE)
      core.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0.85)
      container.add(core)
      tweens.push(
        scene.tweens.add({
          targets: core,
          scale: { from: 0.35, to: 0.5 },
          alpha: { from: 0.75, to: 1 },
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// WAR — кровавая аура: пульс ярости + красные искры разлетаются
// =====================================================================

const TEX_WAR_HALO = '_aura_war_halo'
const TEX_WAR_BLADE = '_aura_war_blade'
const TEX_WAR_CORE = '_aura_war_core'
const TEX_WAR_SPARK = '_aura_war_spark'

export const warSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_WAR_HALO, 230, [
      [0, 'rgba(220, 38, 38, 0.85)'],
      [0.3, 'rgba(153, 27, 27, 0.6)'],
      [0.7, 'rgba(69, 10, 10, 0.25)'],
      [1, 'rgba(69, 10, 10, 0)'],
    ])
    // Blade — узкий красно-оранжевый "клинок"
    makeRadialTexture(scene, TEX_WAR_BLADE, 56, [
      [0, 'rgba(254, 226, 226, 1)'],
      [0.3, 'rgba(248, 113, 113, 0.95)'],
      [0.75, 'rgba(220, 38, 38, 0.5)'],
      [1, 'rgba(127, 29, 29, 0)'],
    ])
    makeRadialTexture(scene, TEX_WAR_CORE, 110, [
      [0, 'rgba(255, 255, 255, 1)'],
      [0.3, 'rgba(254, 215, 170, 0.95)'],
      [0.7, 'rgba(220, 38, 38, 0.55)'],
      [1, 'rgba(127, 29, 29, 0)'],
    ])
    makeRadialTexture(scene, TEX_WAR_SPARK, 22, [
      [0, 'rgba(255, 255, 255, 1)'],
      [0.4, 'rgba(248, 113, 113, 0.85)'],
      [1, 'rgba(220, 38, 38, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    const halo = scene.add.image(0, 0, TEX_WAR_HALO)
    halo.setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.6)
    container.add(halo)
    // Агрессивный быстрый pulse (как сердцебиение в бою)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.78 },
        alpha: { from: 0.5, to: 1 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Cubic.easeInOut',
      }),
    )

    // Blades — крест-накрест клинки крутятся
    const bladeCount =
      rarity === 'epic' || rarity === 'legendary'
        ? 4
        : rarity === 'rare'
          ? 3
          : 2
    const orbit = scene.add.container(0, 0)
    container.add(orbit)
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2
      const r = 26
      const bx = Math.cos(angle) * r
      const by = Math.sin(angle) * r * 0.7
      const blade = scene.add.image(bx, by, TEX_WAR_BLADE)
      blade.setBlendMode(Phaser.BlendModes.ADD)
      blade.setRotation(angle + Math.PI / 2)
      blade.setScale(0.2, 0.65)
      blade.setAlpha(0.85)
      orbit.add(blade)
      tweens.push(
        scene.tweens.add({
          targets: blade,
          alpha: { from: 0.55, to: 1 },
          scaleY: { from: 0.55, to: 0.8 },
          duration: 400 + i * 80,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      )
    }
    tweens.push(
      scene.tweens.add({
        targets: orbit,
        angle: { from: 0, to: 360 },
        duration: rarity === 'epic' || rarity === 'legendary' ? 2500 : 4000,
        repeat: -1,
        ease: 'Linear',
      }),
    )

    if (rarity !== 'common') {
      const core = scene.add.image(0, 0, TEX_WAR_CORE)
      core.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0.9)
      container.add(core)
      tweens.push(
        scene.tweens.add({
          targets: core,
          scale: { from: 0.35, to: 0.55 },
          alpha: { from: 0.8, to: 1 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Cubic.easeInOut',
        }),
      )
    }

    // Sparks разлетаются хаотично — для epic/legendary
    if (rarity === 'epic' || rarity === 'legendary') {
      for (let i = 0; i < 7; i++) {
        const sangle = Math.random() * Math.PI * 2
        const startX = Math.cos(sangle) * 10
        const startY = Math.sin(sangle) * 10
        const endR = 40 + Math.random() * 15
        const endX = Math.cos(sangle) * endR
        const endY = Math.sin(sangle) * endR * 0.7
        const spark = scene.add.image(startX, startY, TEX_WAR_SPARK)
        spark.setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0)
        container.add(spark)
        tweens.push(
          scene.tweens.add({
            targets: spark,
            x: { from: startX, to: endX },
            y: { from: startY, to: endY },
            alpha: { from: 0, to: 1 },
            scale: { from: 0.5, to: 0.2 },
            duration: 700,
            delay: i * 150,
            repeat: -1,
            ease: 'Cubic.easeOut',
          }),
        )
      }
    }

    return { container, tweens, rarity }
  },
}

// =====================================================================
// VOID — пустота: тёмная пропасть втягивающая всё внутрь
// =====================================================================

const TEX_VOID_HALO = '_aura_void_halo'
const TEX_VOID_HOLE = '_aura_void_hole'
const TEX_VOID_PARTICLE = '_aura_void_particle'

function bakeVoidHole(scene: Phaser.Scene, key: string, size: number): void {
  // Чёрная дыра: чёрный центр → фиолетовый ring → темнота
  if (scene.textures.exists(key)) return
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.95)')
  grad.addColorStop(0.4, 'rgba(15, 15, 30, 0.85)')
  grad.addColorStop(0.6, 'rgba(76, 29, 149, 0.65)')
  grad.addColorStop(0.85, 'rgba(15, 15, 30, 0.3)')
  grad.addColorStop(1, 'rgba(15, 15, 30, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  scene.textures.addCanvas(key, canvas)
}

export const voidSpec: AuraSpec = {
  ensureTextures(scene) {
    makeRadialTexture(scene, TEX_VOID_HALO, 240, [
      [0, 'rgba(31, 41, 55, 0.85)'],
      [0.35, 'rgba(76, 29, 149, 0.55)'],
      [0.75, 'rgba(0, 0, 0, 0.3)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ])
    bakeVoidHole(scene, TEX_VOID_HOLE, 180)
    makeRadialTexture(scene, TEX_VOID_PARTICLE, 18, [
      [0, 'rgba(196, 181, 253, 1)'],
      [0.5, 'rgba(139, 92, 246, 0.85)'],
      [1, 'rgba(76, 29, 149, 0)'],
    ])
  },

  createAura(scene, rarity): AuraInstance {
    const container = scene.add.container(0, 0)
    const tweens: Phaser.Tweens.Tween[] = []

    // Halo — фиолетово-серый pulsing, MULTIPLY чтобы затемнять (NORMAL для CRT)
    const halo = scene.add.image(0, 0, TEX_VOID_HALO)
    halo.setBlendMode(Phaser.BlendModes.MULTIPLY).setScale(0.55).setAlpha(0.7)
    container.add(halo)
    tweens.push(
      scene.tweens.add({
        targets: halo,
        scale: { from: 0.55, to: 0.7 },
        alpha: { from: 0.55, to: 0.85 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )

    // Чёрная дыра вращается
    const hole = scene.add.image(0, 0, TEX_VOID_HOLE)
    hole.setBlendMode(Phaser.BlendModes.NORMAL).setScale(0.4).setAlpha(0.85)
    container.add(hole)
    tweens.push(
      scene.tweens.add({
        targets: hole,
        scale: { from: 0.4, to: 0.55 },
        alpha: { from: 0.75, to: 0.95 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    )
    tweens.push(
      scene.tweens.add({
        targets: hole,
        angle: { from: 0, to: 360 },
        duration: 6000,
        repeat: -1,
        ease: 'Linear',
      }),
    )

    // Частицы засасываются в центр (для rare+)
    if (rarity !== 'common') {
      const particleCount = rarity === 'epic' || rarity === 'legendary' ? 8 : 5
      for (let i = 0; i < particleCount; i++) {
        const startAngle = Math.random() * Math.PI * 2
        const startR = 40 + Math.random() * 15
        const sx = Math.cos(startAngle) * startR
        const sy = Math.sin(startAngle) * startR
        const particle = scene.add.image(sx, sy, TEX_VOID_PARTICLE)
        particle.setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0)
        container.add(particle)
        tweens.push(
          scene.tweens.add({
            targets: particle,
            x: { from: sx, to: 0 },
            y: { from: sy, to: 0 },
            alpha: { from: 0.8, to: 0 },
            scale: { from: 0.6, to: 0.15 },
            duration: 1500,
            delay: i * 250,
            repeat: -1,
            ease: 'Cubic.easeIn',
          }),
        )
      }
    }

    return { container, tweens, rarity }
  },
}
