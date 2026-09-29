export type AirSample = {
  dt: number; wallDt: number; now: number; inside: boolean; connected: boolean
  floor: boolean; supported: boolean; moved: boolean; teleported: boolean
  focused?: boolean
}

// Local observed time only. No scores, frame-count timer or wall-clock catch-up.
export class Airtime {
  phase: 'ready' | 'airborne' | 'paused' | 'finished' = 'ready'
  seconds = 0
  day = ''
  reason = 'Jump into the wind'
  private armed = true

  update(s: AirSample): boolean {
    const running = this.phase === 'airborne' || this.phase === 'paused'
    if (!s.connected || s.teleported || !Number.isFinite(s.dt) || !Number.isFinite(s.wallDt) ||
        s.dt <= 0 || s.wallDt < 0 || s.dt > 0.5 || s.wallDt > 0.5) {
      this.armed = false
      if (running) { this.phase = 'finished'; this.reason = 'Interrupted · land to retry'; return true }
      return false
    }
    // Leaving the playable volume pauses the existing run. The first sample back inside
    // only resumes it; its interval is discarded below, so time outside is never credited.
    if (!s.inside) {
      if (running) { this.phase = 'paused'; this.reason = 'Paused · return to arena' }
      return false
    }
    if (s.floor) {
      this.armed = true
      if (running) { this.phase = 'finished'; this.reason = 'Finished · jump to retry'; return true }
      return false
    }
    if (s.focused === false) {
      if (running) { this.phase = 'paused'; this.reason = 'Paused · return to game' }
      return false
    }
    if (!running) {
      if (!this.armed || s.supported || !s.moved) return false
      this.seconds = 0
      this.day = new Date(s.now).toISOString().slice(0, 10)
      this.phase = 'airborne'
      this.reason = 'Airborne'
      this.armed = false
      return false
    }
    if (s.supported || !s.moved) {
      this.phase = 'paused'
      this.reason = s.supported ? 'Paused · jump or step off' : 'Paused · no motion'
      return false
    }
    // Discard landing/takeoff boundary intervals instead of crediting standing time.
    if (this.phase === 'airborne') this.seconds += Math.min(s.dt, s.wallDt)
    this.phase = 'airborne'
    this.reason = 'Airborne'
    return false
  }
  get milliseconds(): number { return Math.floor(this.seconds * 1000 + 1e-6) }
}
