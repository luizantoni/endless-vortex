import { ARENA, Point } from './arena'
export const ORB_REWARD = {
  every: 5,
  height: ARENA.floorTop + 5,
  returnHeight: ARENA.height + 1,
  returnGraceSeconds: 12
} as const

export function orbsSinceReset(totalPopped:number,resetAt:number):number {
  return Math.max(0,Math.min(ORB_REWARD.every,totalPopped-resetAt))
}

// Shared client/server destination check; only the low center reward relocation is exempt.
export function isOrbRewardDestination(position: Point): boolean {
  return Math.hypot(position.x-ARENA.center.x,position.z-ARENA.center.z)<2 &&
    Math.abs(position.y-ORB_REWARD.height)<2
}

/** The mobile Explorer currently returns {}, while desktop reports success explicitly.
 * Neither reply proves arrival: the live player transform must confirm it separately.
 */
export function orbTeleportResponseAccepted(response: unknown): boolean {
  return typeof response === 'object' && response !== null &&
    (!('success' in response) || response.success === true)
}

export function orbRewardArrivalStatus(position: Point | undefined, confirmed: boolean, now: number,
  deadline: number): 'waiting' | 'arrived' | 'expired' {
  if (now>deadline) return 'expired'
  return confirmed && position && isOrbRewardDestination(position) ? 'arrived' : 'waiting'
}
