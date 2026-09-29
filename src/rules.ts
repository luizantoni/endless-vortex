import { TUNING as T } from './tuning'

export type Position = { x: number; y: number; z: number }
export type Attempt = {
  phase: 'ready' | 'airborne' | 'paused' | 'finished'
  airtime: number
  elapsed: number
  day: string
  reason: string
  stationary: number
  ceilingTime: number
  bubbleReadyAt: number
  pushReadyAt: number
}
export function dayKey(now: number): string { return new Date(now).toISOString().slice(0, 10) }
export function weekKey(now: number): string {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return dayKey(date.getTime())
}
export function newAttempt(): Attempt {
  return { phase: 'ready', airtime: 0, elapsed: 0, day: '', reason: 'Leave the launch deck to begin', stationary: 0, ceilingTime: 0,
    bubbleReadyAt: 0, pushReadyAt: 0 }
}
export function isRunning(run: Attempt): boolean { return run.phase === 'airborne' || run.phase === 'paused' }
export function finish(run: Attempt, reason: string): void {
  if (!isRunning(run)) return
  run.phase = 'finished'
  run.reason = reason
}
export type Sample = {
  dt: number; wallDt: number; now: number; connected: boolean; focused: boolean; inside: boolean
  floor: boolean; launch: boolean; supported: boolean; moved: boolean; teleported: boolean
  atCeiling?: boolean
}
// Only consecutive, observed airborne intervals count. A boundary interval is discarded,
// avoiding credit for the grounded part of a landing/takeoff frame. No wall-clock catch-up.
export function advance(run: Attempt, sample: Sample): void {
  if (run.phase === 'finished') return
  const { dt, wallDt } = sample
  if (!sample.connected || !sample.focused || !Number.isFinite(dt) || !Number.isFinite(wallDt) ||
      dt <= 0 || wallDt < 0 || dt > T.movement.maxSampleGap || wallDt > T.movement.maxSampleGap || sample.teleported) {
    finish(run, 'Interrupted — replay to start a fresh attempt')
    return
  }
  if (!sample.inside) { finish(run, 'Left the arena'); return }
  if (run.phase === 'ready') {
    if (sample.launch || sample.floor) return
    run.day = dayKey(sample.now)
    run.phase = sample.supported ? 'paused' : 'airborne'
    run.reason = sample.supported ? 'On a platform' : 'Airborne'
    return
  }
  if (sample.floor) { finish(run, 'Floor contact'); return }
  const step = Math.min(dt, wallDt)
  run.elapsed += step // Course keeps advancing on a landing; camping cannot freeze expiry.
  run.ceilingTime = sample.atCeiling ? run.ceilingTime + step : 0
  if (run.ceilingTime >= T.movement.ceilingLimit) { finish(run, 'Too long at the ceiling — replay to recover'); return }
  if (sample.supported) {
    run.stationary = 0
    run.phase = 'paused'
    run.reason = 'On a platform — jump or step off'
    return
  }
  if (!sample.moved) {
    run.stationary += step
    run.phase = 'paused'
    run.reason = 'No airborne motion detected'
    if (run.stationary >= T.movement.stationaryLimit) finish(run, 'Stalled — replay to recover')
    return
  }
  run.stationary = 0
  if (run.phase === 'airborne') run.airtime += step
  run.phase = 'airborne'
  run.reason = 'Airborne'
}
export function bubbleImpulse(run: Attempt, velocityY: number, y: number): number {
  if (run.phase !== 'airborne' || run.elapsed < run.bubbleReadyAt || y >= T.bubbles.topY || !Number.isFinite(velocityY)) return 0
  const impulse = Math.max(0, Math.min(T.bubbles.liftImpulse, T.bubbles.maxUp - velocityY))
  if (impulse > 0) run.bubbleReadyAt = run.elapsed + T.bubbles.cooldown
  return impulse
}
export function pushImpulse(run: Attempt, velocityY: number): number {
  if (run.phase !== 'airborne' || run.elapsed < run.pushReadyAt || !Number.isFinite(velocityY)) return 0
  const impulse = -Math.max(0, Math.min(T.platforms.pushImpulse, T.movement.maxDown + velocityY))
  if (impulse < 0) run.pushReadyAt = run.elapsed + T.platforms.pushCooldown
  return impulse
}
export function medalsFor(seconds: number): boolean[] { return T.medals.map(threshold => seconds >= threshold) }
export function milliseconds(seconds: number): number { return Math.max(0, Math.floor(seconds * 1000 + 1e-6)) }

// Observed-velocity correction via supported one-shot impulses; no direct avatar Transform writes.
// Native-client integration must measure the between-sample overshoot of these target limits.
export function speedCorrection(velocity: Position): Position {
  const horizontal = Math.hypot(velocity.x, velocity.z)
  const ratio = horizontal > T.movement.maxHorizontal ? T.movement.maxHorizontal / horizontal : 1
  return { x: velocity.x * (ratio - 1),
    y: Math.max(-T.movement.maxDown, Math.min(T.movement.maxUp, velocity.y)) - velocity.y,
    z: velocity.z * (ratio - 1) }
}

export function windForce(position: Position, velocity: Position): Position {
  const dx = position.x - T.arena.center, dz = position.z - T.arena.center
  const radius = Math.max(0.1, Math.hypot(dx, dz))
  const edge = Math.max(0, Math.max(Math.abs(dx), Math.abs(dz)) - (T.arena.halfWidth - 2))
  const inward = T.movement.inward + edge * T.movement.edgePull
  const horizontal = Math.hypot(velocity.x, velocity.z)
  const drag = Math.max(0, horizontal - T.movement.maxHorizontal) * T.movement.brakeGain / Math.max(horizontal, 0.1)
  let y = position.y >= T.arena.ceilingBrakeY ? -8 : T.movement.lift
  if (velocity.y > T.movement.maxUp) y -= (velocity.y - T.movement.maxUp) * T.movement.brakeGain
  if (velocity.y < -T.movement.maxDown) y += (-T.movement.maxDown - velocity.y) * T.movement.brakeGain
  const clamp = (v: number) => Math.max(-T.movement.maxForce, Math.min(T.movement.maxForce, v))
  return { x: clamp(-dz / radius * T.movement.spin - dx / radius * inward - velocity.x * drag),
    y: clamp(y), z: clamp(dx / radius * T.movement.spin - dz / radius * inward - velocity.z * drag) }
}
