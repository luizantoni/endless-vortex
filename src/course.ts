import { Position } from './rules'
import { TUNING as T } from './tuning'

// Leave a permanent central escape column. Only one slot per vertical lane can be active.
export const SLOTS: readonly Position[] = [
  { x: 11, y: 6, z: 13 }, { x: 21, y: 6, z: 19 },
  { x: 11, y: 10, z: 19 }, { x: 21, y: 10, z: 13 },
  { x: 13, y: 14, z: 21 }, { x: 19, y: 14, z: 11 },
  { x: 11, y: 17, z: 13 }, { x: 21, y: 17, z: 19 }
]
export type PlatformPlan = { index: number; kind: 'landing' | 'push'; slot: number; at: number }
export function seedFor(day: string): number {
  let hash = 2166136261
  for (let i = 0; i < day.length; i++) hash = Math.imul(hash ^ day.charCodeAt(i), 16777619)
  return hash >>> 0
}
export function random(seed: number): () => number {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
}
export function intervalAt(elapsed: number): number {
  return T.platforms.initialInterval - (T.platforms.initialInterval - T.platforms.minInterval) *
    Math.min(1, Math.max(0, elapsed) / T.platforms.rampSeconds)
}
export function createCourse(day: string): () => PlatformPlan {
  const rng = random(seedFor(day))
  let at: number = T.platforms.firstSpawn, index = 0
  return () => {
    const plan: PlatformPlan = { index: index++, at, kind: rng() < 0.6 ? 'landing' : 'push', slot: Math.floor(rng() * SLOTS.length) }
    if (SLOTS[plan.slot].y < T.platforms.minPushY) plan.kind = 'landing'
    at += Math.max(T.platforms.minInterval, intervalAt(at) * (0.9 + rng() * 0.2))
    return plan
  }
}
export function safeSpawn(plan: PlatformPlan, player: Position, velocity: Position, active: PlatformPlan[]): boolean {
  if (active.length >= T.platforms.maxActive) return false
  const p = SLOTS[plan.slot]
  if (plan.kind === 'push' && (p.y < T.platforms.minPushY || player.y < T.arena.dangerY)) return false
  // Inflate by the entire platform plus avatar/safety clearance; also check predicted motion.
  const overlaps = (v: Position) => Math.abs(v.x - p.x) < T.platforms.width / 2 + T.platforms.clearance &&
    Math.abs(v.z - p.z) < T.platforms.depth / 2 + T.platforms.clearance && Math.abs(v.y - p.y) < T.platforms.clearance + 1.8
  if (overlaps(player) || overlaps({ x: player.x + velocity.x * T.platforms.warning,
    y: player.y + velocity.y * T.platforms.warning, z: player.z + velocity.z * T.platforms.warning })) return false
  return active.every(other => {
    const q = SLOTS[other.slot]
    return Math.hypot(p.x - q.x, p.z - q.z) >= T.platforms.spacing
  })
}
export function phaseAt(plan: PlatformPlan, elapsed: number): 'warning' | 'active' | 'expiring' | 'fade' | 'gone' {
  const age = elapsed - plan.at
  if (age < T.platforms.warning) return 'warning'
  if (age < T.platforms.warning + T.platforms.lifetime - T.platforms.disappearWarning) return 'active'
  if (age < T.platforms.warning + T.platforms.lifetime) return 'expiring'
  if (age < T.platforms.warning + T.platforms.lifetime + T.platforms.fade) return 'fade'
  return 'gone'
}
