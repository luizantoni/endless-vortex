import { Point } from './arena'

export const BUBBLES = {
  count: 12, radius: 0.48, orbOpacity: 0.72, contactRadius: 1.25, capsuleHalfHeight: 0.5, maxSweep: 4, spawnClearance: 1.8,
  vortexScale: 1.6, vortexEmission: 3.2, glowBaseIntensity: 2.6, glowScanIntensity: 1.8,
  orbitDegrees: 10, spinDegrees: 110, vortexSpinDegrees: 64, respawn: 5, lifetime: 24, popDuration: 0.28,
  glowUpdateInterval: 1 / 12, particleCount: 16, particlesPerPop: 8, particleLifetime: 0.55,
  desktopImpulse: 1.2, mobileImpulse: 0.7, maxUp: 3, cooldown: 0.8,
  sound: 'assets/sounds/hit3.mp3', volume: 0.5, soundInterval: 0.12
} as const

// Closest approach of the moving bubble to the avatar's vertical capsule.
// Relative movement catches contacts between frames; endpoint checks alone miss fast passes.
export function sweptBubbleContact(playerBefore: Point, player: Point, bubbleBefore: Point, bubble: Point): boolean {
  const start = { x: bubbleBefore.x - playerBefore.x, y: bubbleBefore.y - playerBefore.y, z: bubbleBefore.z - playerBefore.z }
  const delta = { x: bubble.x - player.x - start.x, y: bubble.y - player.y - start.y, z: bubble.z - player.z - start.z }
  if (![...Object.values(start), ...Object.values(delta)].every(Number.isFinite)) return false
  const half = BUBBLES.capsuleHalfHeight, cuts = [0, 1]
  if (Math.abs(delta.y) > 1e-9) for (const edge of [-half, half]) {
    const t = (edge - start.y) / delta.y
    if (t > 0 && t < 1) cuts.push(t)
  }
  cuts.sort((a, b) => a - b)
  for (let i = 1; i < cuts.length; i++) {
    const low = cuts[i - 1], high = cuts[i], midY = start.y + delta.y * (low + high) / 2
    const outside = Math.abs(midY) > half
    const y = outside ? start.y - Math.sign(midY) * half : 0
    const dy = outside ? delta.y : 0
    const denominator = delta.x ** 2 + delta.z ** 2 + dy ** 2
    const closest = denominator > 1e-12 ? -(start.x * delta.x + start.z * delta.z + y * dy) / denominator : low
    const t = Math.max(low, Math.min(high, closest))
    if ((start.x + t * delta.x) ** 2 + (start.z + t * delta.z) ** 2 + (y + t * dy) ** 2 <= BUBBLES.contactRadius ** 2) return true
  }
  return false
}

// One instance per local bubble field. A capped pickup still pops, but adds no impulse.
export class BubbleLift {
  private readyAt = 0
  pop(now: number, velocityY: number, mobile: boolean): number | undefined {
    if (!Number.isFinite(now) || !Number.isFinite(velocityY) || now < this.readyAt) return undefined
    this.readyAt = now + BUBBLES.cooldown
    return Math.max(0, Math.min(mobile ? BUBBLES.mobileImpulse : BUBBLES.desktopImpulse, BUBBLES.maxUp - velocityY))
  }
}
