export type AirSample = {
  dt: number; wallDt: number; now: number; inside: boolean; connected: boolean
  floor: boolean; supported: boolean; moved: boolean; teleported: boolean
  focused?: boolean; airborne?: boolean
}
export type FlightResult = { milliseconds: number; day: string; finishedAt: number; valid: boolean }

/** A landing finishes exactly once. The completed score stays frozen until confirmed takeoff. */
export class Airtime {
  phase: 'ready' | 'airborne' | 'paused' | 'finished' = 'ready'
  seconds = 0
  day = ''
  reason = 'Jump into the wind'
  result: FlightResult | undefined
  private takeoff = 0
  private needsLanding = false
  update(s: AirSample): boolean {
    const running = this.phase === 'airborne' || this.phase === 'paused'
    const gap = !Number.isFinite(s.dt) || !Number.isFinite(s.wallDt) || s.dt <= 0 || s.wallDt < 0 || s.dt > .5 || s.wallDt > .5
    if (!s.connected || s.teleported || gap) {
      this.takeoff = 0
      if (!running) return false
      this.phase = 'finished'; this.needsLanding = true
      this.reason = 'Interrupted · land to retry'
      this.result = { milliseconds: this.milliseconds, day: this.day, finishedAt: s.now, valid: false }
      return true
    }
    if (s.floor) {
      this.takeoff = 0; this.needsLanding = false
      if (!running) return false
      this.phase = 'finished'
      this.reason = 'Finished · lava · take off to retry'
      this.result = { milliseconds: this.milliseconds, day: this.day, finishedAt: s.now, valid: true }
      return true
    }
    if (!s.inside || s.focused === false) {
      this.takeoff = 0
      if (running) { this.phase = 'paused'; this.reason = s.inside ? 'Paused · return to game' : 'Paused · return to arena' }
      return false
    }
    const airborne = (s.airborne ?? !s.supported) && !s.supported
    if (!running) {
      if (this.needsLanding || !airborne) { this.takeoff = 0; return false }
      this.takeoff += Math.min(s.dt, s.wallDt)
      if (this.takeoff + 1e-9 < .15) return false
      this.seconds = 0; this.day = new Date(s.now).toISOString().slice(0, 10)
      this.phase = 'airborne'; this.reason = 'Airborne'; this.result = undefined; this.takeoff = 0
      return false
    }
    if (!airborne) { this.phase = 'paused'; this.reason = 'Paused · jump or step off'; return false }
    if (this.phase === 'airborne') this.seconds += Math.min(s.dt, s.wallDt)
    this.phase = 'airborne'; this.reason = 'Airborne'
    return false
  }
  get milliseconds(): number { return Math.floor(this.seconds * 1000 + 1e-6) }
}
export class FloorContactLatch {
  private pending = false
  record(touching: boolean) { if (touching) this.pending = true }
  consume(): boolean { const value = this.pending; this.pending = false; return value }
}
