import { MessageBus } from '@dcl/sdk/message-bus'
import { myProfile } from '@dcl/sdk/network'

export type SharedObstacleEvent = {
  id: string
  kind: 'leaf' | 'rock' | 'orb'
  index: number
  action: 'collapse' | 'step' | 'pop'
  at: number
}

const CHANNEL = 'endless-vortex:obstacle-state:v1'
const bus = new MessageBus()
const listeners = new Set<(event: SharedObstacleEvent) => void>()
const seen = new Set<string>()
let serial = 0

function valid(value: any): value is SharedObstacleEvent {
  return value && typeof value.id === 'string' && value.id.length <= 128 &&
    ['leaf', 'rock', 'orb'].includes(value.kind) && Number.isInteger(value.index) && value.index >= 0 &&
    ((value.kind === 'leaf' && value.action === 'collapse') ||
      (value.kind === 'rock' && value.action === 'step') ||
      (value.kind === 'orb' && value.action === 'pop')) && Number.isFinite(value.at) &&
    Math.abs(Date.now() - value.at) < 10 * 60 * 1000
}

function deliver(event: SharedObstacleEvent) {
  if (seen.has(event.id)) return
  seen.add(event.id)
  if (seen.size > 2048) seen.delete(seen.values().next().value!)
  for (const listener of listeners) listener(event)
}

bus.on(CHANNEL, (value) => {
  if (valid(value)) deliver(value)
})

/** State changes are event-driven; geometry remains local and is never streamed per frame. */
export function onSharedObstacleEvent(listener: (event: SharedObstacleEvent) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishSharedObstacleEvent(
  kind: SharedObstacleEvent['kind'], index: number, action: SharedObstacleEvent['action']
): void {
  if (!Number.isInteger(index) || index < 0) return
  const event: SharedObstacleEvent = {
    id: `${myProfile.userId || 'player'}:${Date.now()}:${++serial}`,
    kind, index, action, at: Date.now()
  }
  deliver(event)
  bus.emit(CHANNEL, event)
}

/** Same initial spawn sequence on every client; contact changes still travel as small events. */
export function createSharedRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
