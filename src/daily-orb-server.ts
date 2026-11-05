import { Storage } from '@dcl/sdk/server'
import { DailyOrbProgress, dailyOrbProgress, isRareOrb, recordDailyOrb, utcOrbDay } from './daily-orbs'
import { flightRoom } from './multiplayer-messages'

const KEY = 'endless-vortex:daily-orbs:v1'

export function startDailyOrbServer() {
  const busy = new Set<string>()
  flightRoom.onMessage('dailyOrbRequest', async (request, context) => {
    if (!context) return
    const address = context.from, player = address.toLowerCase(), day = utcOrbDay()
    const { kind, id } = request
    if (kind && (!isRareOrb(kind) || !/^[a-z0-9-]{1,64}$/.test(id))) return
    if (busy.has(player)) return
    busy.add(player)
    try {
      const saved = await Storage.player.get<string>(player, KEY)
      const progress = dailyOrbProgress(day, saved ? JSON.parse(saved) as DailyOrbProgress : null)
      if (request.day === day && isRareOrb(kind) && recordDailyOrb(progress, kind, id)) {
        if (!await Storage.player.set(player, KEY, JSON.stringify(progress))) return
      }
      await flightRoom.send('dailyOrbState', { player, payload: JSON.stringify(progress) }, { to: [address] })
    } catch {
      // The client keeps unconfirmed pickups and retries after a failed storage read or write.
    } finally {
      busy.delete(player)
    }
  })
}
