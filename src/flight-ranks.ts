/** Existing run progression: one insignia tier per 100 airborne seconds, capped at 1,000. */
export const FLIGHT_RANKS = [
  { name: 'Cadet', seconds: 0 },
  { name: 'Scout', seconds: 100 },
  { name: 'Pilot', seconds: 200 },
  { name: 'Ace', seconds: 300 },
  { name: 'Sky Captain', seconds: 400 },
  { name: 'Storm Rider', seconds: 500 },
  { name: 'Sky Marshal', seconds: 600 },
  { name: 'Vortex Guard', seconds: 700 },
  { name: 'Aether Commander', seconds: 800 },
  { name: 'Celestial', seconds: 900 },
  { name: 'Vortex Legend', seconds: 1000 }
] as const
export function flightRankTier(airtime: number | string): number {
  const seconds = typeof airtime === 'number' ? airtime : Number.parseFloat(airtime)
  return Number.isFinite(seconds) ? Math.min(10, Math.floor(Math.max(0, seconds) / 100)) : 0
}
