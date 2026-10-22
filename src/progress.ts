import { weekKey } from './rules'
import { flightRankTier } from './flight-ranks'

type Row = { userId: string; name: string; airtimeMs: number; rank: number }
type Result = { userId: string; name: string; airtimeMs: number; day: string; finishedAt: number }
export class Progress {
  bestMs = 0
  get rankTier() { return flightRankTier(this.bestMs/1000) }
  rows: Row[] = []
  week = weekKey(Date.now())
  status = 'Session records only — service not configured'
  private pending: Result[] = []
  private busy = false
  private generation = 0
  private userId = ''
  private name = ''
  constructor(public url: string) {}
  identify(userId: string, name: string): void {
    if (userId === this.userId) { this.name = name; return }
    this.generation++
    this.userId = userId; this.name = name
    this.bestMs = 0; this.rows = []; this.pending = []
    this.status = this.url ? 'Connecting to records…' : 'Session records only — service not configured'
  }
  record(airtimeMs: number, day: string, now: number): void {
    this.bestMs = Math.max(this.bestMs, airtimeMs)
    if (!this.userId || airtimeMs <= 0 || !this.url) return
    const result = { userId: this.userId, name: this.name, airtimeMs, day, finishedAt: now }
    const index = this.pending.findIndex(item => weekKey(item.finishedAt) === weekKey(now))
    if (index >= 0) { if (this.pending[index].airtimeMs < airtimeMs) this.pending[index] = result }
    else this.pending.push(result)
    this.pending = this.pending.slice(-4)
    this.status = 'Saving record…'
    void this.sync()
  }
  async sync(): Promise<void> {
    if (!this.url || !this.userId || this.busy) return
    this.busy = true
    const generation = this.generation, userId = this.userId
    try {
      const pending = this.pending[0]
      if (pending) {
        const response = await fetch(`${this.url}/v1/results`, { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending), timeout: 5000 })
        if (!response.ok) throw new Error(`Save HTTP ${response.status}`)
        if (generation !== this.generation) return
        const index = this.pending.indexOf(pending)
        if (index >= 0) this.pending.splice(index, 1)
      }
      const response = await fetch(`${this.url}/v1/progress?userId=${encodeURIComponent(userId)}`, { timeout: 5000 })
      if (!response.ok) throw new Error(`Read HTTP ${response.status}`)
      const data = await response.json()
      if (generation !== this.generation) return
      if (!Number.isSafeInteger(data.bestMs) || data.bestMs < 0 || typeof data.week !== 'string' || !Array.isArray(data.rows)) throw new Error('Invalid records response')
      this.bestMs = Math.max(this.bestMs, data.bestMs)
      this.week = weekKey(Date.now())
      // An in-flight Sunday response must not repopulate Monday's cleared table.
      this.rows = data.week === this.week ? data.rows.filter((row: Row) => typeof row.name === 'string' && Number.isSafeInteger(row.airtimeMs) &&
        row.airtimeMs >= 0 && Number.isSafeInteger(row.rank) && row.rank > 0).slice(0, 10) : []
      this.status = this.pending.length ? 'Record pending — keep this session open' : 'Saved · playtest standings (client reported)'
    } catch (error) {
      if (generation === this.generation) this.status = 'Service offline — records held in this session'
      console.log('Vortex records:', String(error))
    } finally { this.busy = false }
  }
  rollover(now: number): void {
    const week = weekKey(now)
    if (week !== this.week) { this.week = week; this.rows = []; void this.sync() }
  }
}
