import { DAILY_GOALS, DailyOrbProgress, RareOrb, dailyOrbProgress, recordDailyOrb, utcOrbDay } from './daily-orbs'
import { flightRoom } from './multiplayer-messages'

export function createDailyOrbClient() {
  let user = '', day = '', sequence = 0, next = 0
  const session = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
  let saved: DailyOrbProgress | undefined, progress: DailyOrbProgress | undefined
  let pending: { kind: RareOrb; id: string }[] = []

  function refreshProgress() {
    const visible = dailyOrbProgress(day)
    for (const kind of Object.keys(DAILY_GOALS) as RareOrb[]) {
      visible.pickups[kind] = [...(saved?.pickups[kind] ?? [])]
    }
    for (const { kind, id } of pending) recordDailyOrb(visible, kind, id)
    progress = visible
  }

  flightRoom.onMessage('dailyOrbState', data => {
    if (data.player !== user) return
    const state = JSON.parse(data.payload) as DailyOrbProgress
    if (state.day !== day) return
    saved = state
    pending = pending.filter(({kind, id}) =>
      state.pickups[kind].length < DAILY_GOALS[kind] && !state.pickups[kind].includes(id))
    refreshProgress()
  })
  return {
    get progress() { return progress },
    collect(kind: RareOrb) {
      if (!day || (progress?.pickups[kind].length ?? 0) >= DAILY_GOALS[kind]) return
      pending.push({ kind, id: session + '-' + (++sequence).toString(36) })
      refreshProgress()
      next = 0
    },
    update(now: number, address: string) {
      const today = utcOrbDay(now), player = address.toLowerCase()
      if (day !== today || (player && player !== user)) {
        // Keep early pickups when the local identity first becomes available.
        if (day !== today || user) pending = []
        user = player; day = today; saved = undefined; next = 0
        refreshProgress()
      }
      if (!player || now < next || !flightRoom.isReady()) return
      next = now + (pending.length ? 800 : 5000)
      const pickup = pending[0]
      void flightRoom.send('dailyOrbRequest', { day, kind: pickup?.kind || '', id: pickup?.id || '' })
    }
  }
}
