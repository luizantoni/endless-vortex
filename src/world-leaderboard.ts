import { engine, Entity, Font, TextAlignMode, TextShape, Transform } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import { ARENA } from './arena'
import { createWorldSign } from './world-sign'
import type { AuthoritySnapshot } from './authority-core'

export const WORLD_LEADERBOARD = {
  position: { x: ARENA.center.x + 15, y: ARENA.floorTop, z: ARENA.center.z + 23 },
  yawDegrees: 40, scale: 1.4, width: 8.4, height: 5.6, faceY: 3.72, rows: 10
} as const

export function createGliderBillboard() {
  const { position, yawDegrees, width } = WORLD_LEADERBOARD
  return createWorldSign({
    ...WORLD_LEADERBOARD,
    position: { ...position, x: 2 * ARENA.center.x - position.x },
    yawDegrees: -yawDegrees
  }, 'assets/ui/billboards/stay-in-the-air.png', width / 2)
}

type BoardRecord = AuthoritySnapshot['rows'][number]
function pilotName(raw: string): string {
  // Some clients parse markup in TextShape. Display player names as plain text.
  const chars = Array.from(raw.replace(/<[^>]*>/g, '').replace(/[<>\[\]\p{C}]/gu, '').replace(/\s+/g, ' ').trim())
  return chars.length > 18 ? chars.slice(0, 17).join('') + '…' : chars.join('') || 'Pilot'
}
function airtime(ms: number): string {
  const minutes = String(Math.floor(ms / 60000)).padStart(2, '0')
  const seconds = String(Math.floor(ms / 1000) % 60).padStart(2, '0')
  return minutes + ':' + seconds + '.' + String(ms % 1000).padStart(3, '0')
}

export function createWorldLeaderboard(getSnapshot: () => AuthoritySnapshot | undefined) {
  const { position, yawDegrees, scale, width, height, faceY, rows } = WORLD_LEADERBOARD
  const root = createWorldSign({ position, yawDegrees, scale, width, height, faceY }, 'assets/ui/leaderboard/flight-records.png')

  const gold = Color4.create(1, .83, .51, 1), ice = Color4.create(.7, .93, 1, 1)
  const white = Color4.create(.93, .96, 1, 1), bronze = Color4.create(.91, .65, .48, 1)
  const muted = Color4.create(.59, .74, .81, 1)
  function label(px: number, py: number, size: number, color: Color4, font: Font, left = false, text = '', maxWidth = left ? 4 : 1.7) {
    const entity = engine.addEntity()
    Transform.create(entity, { parent: root, position: {
      x: (px / 1152 - .5) * width, y: faceY + (.5 - py / 768) * height, z: -.026
    } })
    TextShape.create(entity, { text, font, fontSize: size, textColor: color,
      textAlign: left ? TextAlignMode.TAM_MIDDLE_LEFT : TextAlignMode.TAM_MIDDLE_CENTER,
      width: maxWidth, height: .28, lineCount: 1, textWrapping: false })
    return entity
  }
  const slots = Array.from({ length: rows }, (_, i) => {
    const y = 233 + i * 45
    return {
      rank: label(124, y, 2.03, [gold, ice, bronze][i] || muted, Font.F_MONOSPACE),
      pilot: label(185, y, 2.35, white, Font.F_SANS_SERIF, true),
      time: label(921, y, 2.45, i === 0 ? gold : ice, Font.F_MONOSPACE)
    }
  })
  const status = label(576, 702, 1.68, muted, Font.F_SERIF, false, 'CONNECTING TO FLIGHT RECORDS', 6.5)
  function write(entity: Entity, text: string) {
    if (TextShape.get(entity).text !== text) TextShape.getMutable(entity).text = text
  }

  let previous: BoardRecord[] | undefined, elapsed = 0
  engine.addSystem(dt => {
    if (!Number.isFinite(dt) || dt <= 0) return
    elapsed += dt
    if (elapsed < .25) return
    elapsed %= .25
    const snapshot = getSnapshot()
    // Retain the last published standings while a new record is being saved.
    if (!snapshot?.saved || snapshot.rows === previous) return
    previous = snapshot.rows
    const records = snapshot.rows.filter(row => Number.isSafeInteger(row.rank) && row.rank > 0 &&
      typeof row.name === 'string' && Number.isSafeInteger(row.airtimeMs) && row.airtimeMs >= 0)
      .slice(0, rows)
    for (let i = 0; i < rows; i++) {
      const row = records[i], slot = slots[i]
      write(slot.rank, row ? String(row.rank).padStart(2, '0') : '–')
      write(slot.pilot, row ? pilotName(row.name) : '')
      write(slot.time, row ? airtime(row.airtimeMs) : '')
    }
    write(status, records.length ? 'BEST COMPLETED FLIGHTS' : 'NO RECORDS YET  ·  COMPLETE A FLIGHT TO CLAIM A PLACE')
  })
}
