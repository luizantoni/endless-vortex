import { ColliderLayer, engine, Transform, TriggerArea, triggerAreaEventsSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { ARENA } from './arena'

export const FLOOR_RESET_PLATFORM = {
  surfaceOffset: 0.0001, // 0.01 cm above the authored ground surface
  thickness: 0.0001,
  radius: ARENA.radius
} as const

/** Mobile clients can miss a very thin trigger event; detect only the local feet crossing that same plane. */
export function crossedLocalPlayerResetPlane(
  previous: { x: number; y: number; z: number },
  position: { x: number; y: number; z: number },
  footOffset: number
): boolean {
  const radialDistance = Math.hypot(position.x - ARENA.center.x, position.z - ARENA.center.z)
  const floorY = ARENA.floorTop + FLOOR_RESET_PLATFORM.surfaceOffset
  const previousFeet = previous.y - footOffset
  const currentFeet = position.y - footOffset
  return position.y >= 0 && radialDistance <= FLOOR_RESET_PLATFORM.radius &&
    Math.abs(position.y - previous.y) <= 1 && position.y <= previous.y &&
    previousFeet > floorY && currentFeet <= floorY
}

/** Local trigger only: it has no MeshCollider and cannot physically support the avatar. */
export function createFloorResetPlatform() {
  const entity = engine.addEntity()
  const { surfaceOffset, thickness, radius } = FLOOR_RESET_PLATFORM
  Transform.create(entity, {
    position: { x: ARENA.center.x, y: ARENA.floorTop + surfaceOffset, z: ARENA.center.z },
    scale: Vector3.create(radius * 2, thickness, radius * 2)
  })
  TriggerArea.setBox(entity, ColliderLayer.CL_PLAYER)
  let localContactPending = false
  triggerAreaEventsSystem.onTriggerEnter(entity, result => {
    if (result.trigger?.entity === engine.PlayerEntity) localContactPending = true
  })
  return {
    entity,
    consumeContact() {
      const contact = localContactPending
      localContactPending = false
      return contact
    }
  }
}
