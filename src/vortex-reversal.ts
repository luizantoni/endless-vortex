// Jitter each 90-second window by up to 30 seconds. Consecutive reversals
// are 60–120 seconds apart, and late joiners share the same direction.
const WINDOW_MS = 90_000
const JITTER_MS = 30_000
const TURN_SECONDS = 1.5
export const REVERSAL_EFFECT_SECONDS = 4

export function vortexReversalTime(window: number): number {
  let seed = Math.imul(window ^ 0x51f15e, 0x45d9f3b)
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b)
  return window * WINDOW_MS + ((seed ^ (seed >>> 16)) >>> 0) % JITTER_MS
}

export function vortexReversalAt(now: number) {
  const window = Math.floor(now / WINDOW_MS)
  const index = now < vortexReversalTime(window) ? window - 1 : window
  const age = (now - vortexReversalTime(index)) / 1000
  const direction = index % 2 === 0 ? 1 : -1
  const t = Math.min(1, age / TURN_SECONDS)
  const eased = t * t * (3 - 2 * t)
  return { age, spin: direction * (2 * eased - 1), direction }
}
