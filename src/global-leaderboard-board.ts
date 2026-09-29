import { engine, Font, Material, MeshRenderer, TextAlignMode, TextShape, Transform } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion } from '@dcl/sdk/math'

type RecordRow = { rank: number; name: string; airtimeMs: number }
const yaw = 135
const rotation = Quaternion.fromEulerDegrees(0, yaw, 0)
const center = { x: 4.22, y: 12.15, z: 43.62 }

function box(position: { x: number; y: number; z: number }, scale: { x: number; y: number; z: number }, color: Color4) {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale, rotation })
  MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, { albedoColor: color, emissiveColor: Color3.create(color.r * 0.28, color.g * 0.28, color.b * 0.28),
    emissiveIntensity: 0.6, roughness: 0.62, metallic: 0.45 })
  return entity
}

function boardPoint(offsetX: number, offsetY: number, front = 0.12) {
  const radians = yaw * Math.PI / 180
  return { x: center.x + Math.cos(radians) * offsetX + Math.sin(radians) * front,
    y: center.y + offsetY, z: center.z - Math.sin(radians) * offsetX + Math.cos(radians) * front }
}

function text(value: string, offsetX: number, offsetY: number, color: Color4, width = 4.5) {
  const entity = engine.addEntity()
  Transform.create(entity, { position: boardPoint(offsetX, offsetY), rotation })
  TextShape.create(entity, { text: value, font: Font.F_SERIF, fontSize: 0.38, fontAutoSize: true,
    width, height: 0.34, textAlign: TextAlignMode.TAM_MIDDLE_LEFT, textWrapping: false, lineCount: 1,
    textColor: color, outlineWidth: 0.025, outlineColor: Color3.create(0.01, 0.03, 0.08) })
  return entity
}

/** Persistent weekly standings mounted beside the north-west concrete pillar. */
export function createGlobalLeaderboardBoard() {
  const navy = Color4.create(0.018, 0.055, 0.12, 1)
  const cyan = Color4.create(0.12, 0.76, 0.92, 1)
  const gold = Color4.create(1, 0.68, 0.12, 1)
  box(center, { x: 4.9, y: 5.25, z: 0.2 }, navy)
  box(boardPoint(0, 2.58, 0), { x: 4.98, y: 0.1, z: 0.26 }, gold)
  for (const edge of [-2.4, 2.4]) box(boardPoint(edge, 0, 0), { x: 0.08, y: 5.1, z: 0.24 }, cyan)
  box(boardPoint(0, -2.58, 0), { x: 4.98, y: 0.1, z: 0.26 }, gold)

  const title = text('ENDLESS VORTEX · WEEKLY AIRTIME', 0, 2.13, gold, 4.45)
  const subtitle = text('GLOBAL RECORDS · RESETS MONDAY 00:00 UTC', 0, 1.72, cyan, 4.45)
  const rows = Array.from({ length: 10 }, (_, index) => text('', 0, 1.2 - index * 0.4,
    index === 0 ? gold : Color4.create(0.92, 0.96, 1, 1), 4.45))
  let signature = ''
  return {
    update(records: RecordRow[], status: string) {
      const valid = records.slice(0, rows.length)
      const state = valid.length ? valid.map(row => `${row.rank}|${row.name}|${row.airtimeMs}`).join(';') : status
      if (state === signature) return
      signature = state
      TextShape.getMutable(subtitle).text = valid.length ? 'GLOBAL RECORDS · RESETS MONDAY 00:00 UTC' :
        /offline|pending|connecting/i.test(status) ? 'GLOBAL RECORDS · SERVICE OFFLINE' : 'GLOBAL RECORDS · NO RUNS YET'
      rows.forEach((entity, index) => {
        const record = valid[index]
        TextShape.getMutable(entity).text = record
          ? `${record.rank}. ${record.name.slice(0, 17)}     ${(record.airtimeMs / 1000).toFixed(2)} s`
          : ''
      })
    }
  }
}
