import { ARENA, Point } from './arena'
import { GOLD_ORB_SECONDS } from './daily-orbs'
export type OrbRewardKind = 'set' | 'rainbow'
const SET_SIZE = 5
export const ORB_REWARD = {
  every: SET_SIZE,
  bonusSeconds: SET_SIZE * GOLD_ORB_SECONDS,
  rainbowBonusSeconds: 60,
  minOffset: .8,
  maxOffset: 1.6,
  height: ARENA.floorTop + 15,
  rainbowHeight: ARENA.floorTop + 20
} as const

export function orbsSinceReset(totalPopped:number,resetAt:number):number {
  return Math.max(0,Math.min(ORB_REWARD.every,totalPopped-resetAt))
}

export function orbRewardForPickups(count: number, caughtRainbow: boolean): OrbRewardKind | undefined {
  if (caughtRainbow) return 'rainbow'
  if (count >= ORB_REWARD.every) return 'set'
}

export function randomOrbRewardDestination(random = Math.random, kind: OrbRewardKind = 'set'): Point {
  const angle = random() * Math.PI * 2
  const min = ORB_REWARD.minOffset, max = ORB_REWARD.maxOffset
  const radius = Math.sqrt(min * min + random() * (max * max - min * min))
  return { x: ARENA.center.x + Math.cos(angle) * radius, y: kind === 'rainbow' ? ORB_REWARD.rainbowHeight : ORB_REWARD.height,
    z: ARENA.center.z + Math.sin(angle) * radius }
}

export function orbRewardBonus(kind: OrbRewardKind): number {
  return kind === 'rainbow' ? ORB_REWARD.rainbowBonusSeconds : ORB_REWARD.bonusSeconds
}

// The two landing bands let the server distinguish rewards from player position.
export function orbRewardKindAt(position: Point): OrbRewardKind | undefined {
  if (Math.hypot(position.x-ARENA.center.x,position.z-ARENA.center.z) >= 2) return undefined
  if (Math.abs(position.y-ORB_REWARD.height) < 2) return 'set'
  if (Math.abs(position.y-ORB_REWARD.rainbowHeight) < 2) return 'rainbow'
  return undefined
}

export function isOrbRewardDestination(position: Point): boolean {
  return orbRewardKindAt(position) !== undefined
}

/** The mobile Explorer currently returns {}, while desktop reports success explicitly.
 * Neither reply proves arrival: the live player transform must confirm it separately.
 */
export function orbTeleportResponseAccepted(response: unknown): boolean {
  return typeof response === 'object' && response !== null &&
    (!('success' in response) || response.success === true)
}

export function orbRewardArrivalStatus(position: Point | undefined, confirmed: boolean, now: number,
  deadline: number, destination?: Point): 'waiting' | 'arrived' | 'expired' {
  if (now>deadline) return 'expired'
  if (!confirmed || !position || !isOrbRewardDestination(position)) return 'waiting'
  if (destination && (Math.hypot(position.x - destination.x, position.z - destination.z) > .55 ||
    Math.abs(position.y - destination.y) > 1.5)) return 'waiting'
  return 'arrived'
}
