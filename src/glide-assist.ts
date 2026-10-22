/** Keep held glide responsive if the native client briefly drops its gliding state.
 * Only brakes an existing descent; never launches, teleports, or locks player steering.
 */
export function heldGlideBrake(held: boolean, airborne: boolean, velocityY: number): number {
  if (!held || !airborne || !Number.isFinite(velocityY) || velocityY >= -3) return 0
  return Math.min(24, 9.8 + (-3 - velocityY) * 6)
}
