import { ORB_REWARD } from './orb-reward'
import { ARENA, BUILD_SCALE, Point } from './arena'

export const BUBBLES = {
  count: 24, radius: 0.48 * BUILD_SCALE, orbOpacity: 0.72, contactRadius: 1.6 * BUILD_SCALE, capsuleHalfHeight: 0.5, maxSweep: 4, spawnClearance: 1.8 * BUILD_SCALE,
  vortexScale: 1.6, vortexEmission: 3.2, glowBaseIntensity: 2.6, glowScanIntensity: 1.8,
  orbitDegrees: 10, spinDegrees: 110, vortexSpinDegrees: 64, respawn: 5, popDuration: 0.28,
  glowUpdateInterval: 1 / 12, particleCount: 192, particlesPerPop: 64, particleLifetime: 3.2,
  accumulationEvery: ORB_REWARD.every, accumulationPerPop: 12, accumulationCapacity: 60,
  accumulationTravel: 1.6, accumulationRadius: 3.2 * BUILD_SCALE, accumulationSpin: 2.1,
  rewardExplosionLifetime: 3.2, rewardExplosionExpand: 0.55, rewardExplosionMinRadius: 1.4 * BUILD_SCALE,
  rewardExplosionMaxRadius: 8 * BUILD_SCALE, rewardExplosionCenterHeight: 27 * BUILD_SCALE, rewardExplosionHeightRange: 5 * BUILD_SCALE,
  rewardExplosionSpin: 3.6,
  particleMaterialInterval: 0.3, particleBurstDuration: 0.65, particleBurstSpeedMin: 6 * BUILD_SCALE, particleBurstSpeedMax: 12 * BUILD_SCALE,
  particleRadialSpeedMin: 6.5 * BUILD_SCALE, particleRadialSpeedMax: 11.5 * BUILD_SCALE,
  particleSpinMin: 0.6, particleSpinMax: 1.4,
  desktopImpulse: 1.2, mobileImpulse: 0.7, maxUp: 3, cooldown: 0.8,
  sound: 'assets/sounds/goldenorbspickup.mp3', volume: 0.5, soundInterval: 0.12
} as const

// Golden motes spiral inward, then keep orbiting the vortex axis until the reward.
export function goldenVortexOrbitPoint(origin: Point, angle: number, radius: number, height: number,
  phase: number, age: number): Point {
  const travel = Math.max(0, age), approach = Math.min(1, travel / BUBBLES.accumulationTravel)
  const eased = approach * approach * (3 - 2 * approach)
  const dx = origin.x - ARENA.center.x, dz = origin.z - ARENA.center.z
  const startAngle = Math.atan2(dz, dx)
  const startRadius = Math.max(radius, Math.hypot(dx, dz))
  const r = startRadius + (radius - startRadius) * eased
  const theta = startAngle + angle + BUBBLES.accumulationSpin * travel
  return { x: ARENA.center.x + Math.cos(theta) * r,
    y: origin.y + (height - origin.y) * eased + Math.sin(travel * 5 + phase) * 0.12,
    z: ARENA.center.z + Math.sin(theta) * r }
}

// Expands from the vortex crown into a rotating cylindrical particle celebration.
export function goldenVortexCelebrationPoint(index: number, age: number, phase = 0): Point {
  const count = BUBBLES.particleCount
  const fraction = Math.max(0, Math.min(1, index / Math.max(1, count - 1)))
  const travel = Math.max(0, age)
  const approach = Math.min(1, travel / BUBBLES.rewardExplosionExpand)
  const eased = approach * approach * (3 - 2 * approach)
  const radius = BUBBLES.rewardExplosionMinRadius +
    Math.sqrt(fraction) * (BUBBLES.rewardExplosionMaxRadius - BUBBLES.rewardExplosionMinRadius)
  const heightFraction = (index * 37 % count) / Math.max(1, count - 1)
  const height = BUBBLES.rewardExplosionCenterHeight +
    (heightFraction - 0.5) * BUBBLES.rewardExplosionHeightRange
  const angle = index * 2.399963229728653 + phase + travel * BUBBLES.rewardExplosionSpin
  const expandedRadius = radius * eased
  return { x: ARENA.center.x + Math.cos(angle) * expandedRadius,
    y: BUBBLES.rewardExplosionCenterHeight + (height - BUBBLES.rewardExplosionCenterHeight) * eased +
      Math.sin(travel * 9 + phase) * 0.22,
    z: ARENA.center.z + Math.sin(angle) * expandedRadius }
}

export function goldenVortexParticlePoint(origin: Point, burstAngle: number, burstPitch: number, burstSpeed: number,
  radialSpeed: number, spin: number, riseSpeed: number, phase: number, age: number): Point {
  const burstAge = Math.min(age, BUBBLES.particleBurstDuration)
  const horizontal = Math.cos(burstPitch) * burstSpeed * burstAge
  const burstEnd = {
    x: origin.x + Math.cos(burstAngle) * horizontal,
    y: origin.y + Math.sin(burstPitch) * burstSpeed * burstAge,
    z: origin.z + Math.sin(burstAngle) * horizontal
  }
  if (age <= BUBBLES.particleBurstDuration) return burstEnd
  const dx = burstEnd.x - ARENA.center.x, dz = burstEnd.z - ARENA.center.z
  const startRadius = Math.hypot(dx, dz), startAngle = Math.atan2(dz, dx)
  const travel = age - BUBBLES.particleBurstDuration
  const orbitRadius = Math.max(0.2, startRadius - radialSpeed * travel)
  const orbitAngle = startAngle + spin * travel
  return {
    x: ARENA.center.x + Math.cos(orbitAngle) * orbitRadius,
    y: burstEnd.y + riseSpeed * travel + Math.sin(age * 8 + phase) * 0.12,
    z: ARENA.center.z + Math.sin(orbitAngle) * orbitRadius
  }
}

// A tight rising helix around the actual avatar, including across the reward teleport.
export function goldenPlayerWrapPoint(player: Point, index: number, age: number): Point {
  const strand = index % 3, progress = Math.floor(index / 3) / (Math.ceil(BUBBLES.particleCount / 3) - 1)
  const angle = progress * Math.PI * 4 + strand * Math.PI * 2 / 3 + age * 3
  const radius = .65 + .28 * Math.sin(progress * Math.PI) + .07 * Math.sin(age * 4 + index)
  return { x: player.x + Math.cos(angle) * radius,
    y: player.y - .3 + progress * 2.5 + Math.sin(age * 3 + index) * .08,
    z: player.z + Math.sin(angle) * radius }
}

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
