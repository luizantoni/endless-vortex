export const DAILY_ORBS = ['blue', 'purple', 'rainbow'] as const
export type RareOrb = typeof DAILY_ORBS[number]
export type BonusOrb = 'blue' | 'purple'
export const GOLD_ORB_SECONDS = 6
export const ORB_PICKUP_BONUS = { blue: 10, purple: 20 } as const
export function isBonusOrb(kind: string | undefined): kind is BonusOrb {
  return kind === 'blue' || kind === 'purple'
}
export function orbSetPieceSeconds(kind: RareOrb | undefined): number {
  return isBonusOrb(kind) ? ORB_PICKUP_BONUS[kind] : GOLD_ORB_SECONDS
}
export const DAILY_GOALS = { blue: 5, purple: 3, rainbow: 1 } as const
export type DailyOrbProgress = { day: string; pickups: Record<RareOrb, string[]> }
export const utcOrbDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)

export function rollRareOrb(roll: number): RareOrb | undefined {
  return roll < .01 ? 'rainbow' : roll < .06 ? 'purple' : roll < .21 ? 'blue' : undefined
}
export function isRareOrb(value: string): value is RareOrb {
  return DAILY_ORBS.some(kind => value === kind)
}
export function dailyOrbProgress(day: string, saved?: DailyOrbProgress | null): DailyOrbProgress {
  if (saved?.day === day) return saved
  return { day, pickups: { blue: [], purple: [], rainbow: [] } }
}
export function recordDailyOrb(progress: DailyOrbProgress, kind: RareOrb, id: string): boolean {
  const pickups = progress.pickups[kind]
  if (pickups.length >= DAILY_GOALS[kind] || DAILY_ORBS.some(key => progress.pickups[key].includes(id))) return false
  pickups.push(id)
  return true
}
export const rareOrbTexture = (kind: RareOrb) => `assets/ui/modular/orb-${kind}.png`
