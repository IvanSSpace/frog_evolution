// Phase 9: extracted из StarMapScene.ts L1345-1374 (case 3).
// Flash (rng: количество мерцаний, глубина, скорость)
// Phase 7: расширены blinks (1-4), depth (0.15-0.8); subVariant — асимметричный (быстрый-медленный).
// NOTE: special case — без sys параметра.
import type Phaser from 'phaser'

export function compFlash(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  rng: () => number,
): void {
  const blinks = 1 + Math.floor(rng() * 4) // 1-4
  const depth = 0.15 + rng() * 0.65 // 0.15-0.8
  const asymmetric = rng() < 0.3
  const dur = 80 + rng() * 100
  if (asymmetric && blinks >= 2) {
    // 30%: чередуем быстрые/медленные blink'и через delayedCall
    let cur = 0
    const doBlink = () => {
      if (cur >= blinks) return
      const localDur = dur * (cur % 2 === 0 ? 0.6 : 1.4)
      scene.tweens.add({
        targets: sprite,
        alpha: { from: 1, to: 1 - depth },
        yoyo: true, duration: localDur,
        ease: 'Sine.easeInOut',
        onComplete: () => { cur++; doBlink() },
      })
    }
    doBlink()
  } else {
    scene.tweens.add({
      targets: sprite,
      alpha: { from: 1, to: 1 - depth },
      yoyo: true, duration: dur,
      ease: 'Sine.easeInOut',
      repeat: blinks - 1,
    })
  }
}
