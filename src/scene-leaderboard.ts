import { getPlayer, onEnterScene, onLeaveScene } from '@dcl/sdk/players'
import { ARENA, insideArena, Point } from './arena'

export type SceneLeaderRow = {
  rank: number; userId: string; name: string; airtime: string; phase: string; approximate?: boolean
}
type Entry = { userId: string; name: string; seconds: number; phase: string; previous?: Point }

// Remote airtime is estimated from scene-avatar movement; only the local row uses the exact run timer.
export class SceneLeaderboard {
  private entries = new Map<string, Entry>()
  private accumulator = 0

  constructor() {
    onEnterScene(player => this.add(player.userId, player.name, player.position))
    onLeaveScene(userId => this.entries.delete(userId))
  }

  private add(userId: string, name: string, position?: Point): void {
    if (!userId) return
    const entry = this.entries.get(userId) ?? { userId, name, seconds: 0, phase: 'READY' }
    entry.name = name || entry.name || 'Runner'
    if (position) entry.previous = { ...position }
    this.entries.set(userId, entry)
  }

  update(dt: number, localUser: string, localSeconds: number, localPhase: string): SceneLeaderRow[] | undefined {
    this.accumulator += dt
    if (this.accumulator < 0.1) return undefined
    const elapsed = Math.min(0.25, this.accumulator)
    this.accumulator = 0
    const self = getPlayer()
    if (self?.userId) this.add(self.userId, self.name, self.position)
    const activeLocalUser = localUser || self?.userId || ''
    if (localUser && !this.entries.has(localUser)) {
      const player = getPlayer({ userId: localUser })
      if (player) this.add(player.userId, player.name, player.position)
    }

    const rows: Omit<SceneLeaderRow, 'rank'>[] = []
    for (const [userId, entry] of this.entries) {
      const player = getPlayer({ userId })
      if (!player) { this.entries.delete(userId); continue }
      entry.name = player.name || entry.name || 'Runner'
      const position = player.position
      if (!position) continue
      if (userId === activeLocalUser) {
        entry.seconds = localSeconds
        entry.phase = localPhase
        entry.previous = { ...position }
        rows.push({ userId, name: entry.name, airtime: entry.seconds.toFixed(2), phase: entry.phase })
        continue
      }

      const distance = entry.previous ? Math.hypot(position.x - entry.previous.x,
        position.y - entry.previous.y, position.z - entry.previous.z) : 0
      const aboveFloor = position.y > ARENA.floorTop + 1.05
      if (!insideArena(position, ARENA.height + 7)) {
        entry.seconds = 0; entry.phase = 'OUT'
      } else if (!aboveFloor) {
        if (entry.phase === 'AIRBORNE' || entry.phase === 'PAUSED') entry.phase = 'ENDED'
        else if (entry.phase !== 'ENDED') entry.phase = 'READY'
      } else if (distance > 4) {
        entry.seconds = 0; entry.phase = 'READY'
      } else if (distance > 0.002) {
        if (entry.phase === 'ENDED' || entry.phase === 'READY' || entry.phase === 'OUT') entry.seconds = 0
        entry.seconds += elapsed
        entry.phase = 'AIRBORNE'
      } else if (entry.phase === 'AIRBORNE') {
        entry.phase = 'PAUSED'
      }
      entry.previous = { ...position }
      rows.push({ userId, name: entry.name, airtime: entry.seconds.toFixed(2), phase: entry.phase, approximate: true })
    }
    rows.sort((a, b) => Number(b.phase === 'AIRBORNE') - Number(a.phase === 'AIRBORNE') ||
      Number(b.phase === 'PAUSED') - Number(a.phase === 'PAUSED') || Number(b.airtime) - Number(a.airtime) || a.name.localeCompare(b.name))
    return rows.map((row, index) => ({ ...row, rank: index + 1 }))
  }
}
