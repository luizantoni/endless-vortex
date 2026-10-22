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

/** Light, metal and shadow colors shared by insignia and achievement orb splashes. */
export const RANK_PALETTES = [
  ['#d5e6ee','#6d8c9a','#243f52'],['#ffdda1','#c17c3b','#6c3617'],['#ffebba','#d38c3e','#793c18'],
  ['#f6ffff','#92bed7','#355d82'],['#f5ffff','#abd8ed','#397eab'],['#e8ffff','#32d5ed','#0862a1'],
  ['#fff8c7','#ffc23e','#98500d'],['#fffbd3','#ffcb4b','#aa4e12'],['#ffffff','#bcecff','#5385b7'],
  ['#e7fff5','#56f0cf','#08757e'],['#fffde2','#ffe17b','#c48319']
] as const
