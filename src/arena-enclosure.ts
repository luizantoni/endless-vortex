import { ColliderLayer, engine, MeshCollider, Transform } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, BUILD_SCALE } from './arena'

// Hollow, invisible cylindrical wall; a solid cylinder would occupy the playable interior.
export const ENCLOSURE = {
  segments: 64, radius: ARENA.radius * 0.9 * 0.9,
  bottom: ARENA.floorTop + 1.5,
  top: ARENA.floorTop + 1.5 + (ARENA.height + 12 * BUILD_SCALE - ARENA.floorTop - 1.5) * 0.9 + 20,
  thickness: 0.4 * BUILD_SCALE * 0.9
} as const
export function createArenaEnclosure() {
  const { segments, radius, bottom, top, thickness } = ENCLOSURE
  const chord = 2 * (radius + thickness / 2) * Math.tan(Math.PI / segments) + thickness * .2
  return Array.from({ length: segments }, (_, i) => {
    const angle = i * Math.PI * 2 / segments
    const entity = engine.addEntity()
    Transform.create(entity, {
      position: Vector3.create(ARENA.center.x + Math.cos(angle) * (radius + thickness / 2),
        (bottom + top) / 2, ARENA.center.z + Math.sin(angle) * (radius + thickness / 2)),
      rotation: Quaternion.fromEulerDegrees(0, -angle * 180 / Math.PI, 0),
      scale: Vector3.create(thickness, top - bottom, chord)
    })
    // No renderer or pointer layer: physical containment only, with an open center and top.
    MeshCollider.setBox(entity, ColliderLayer.CL_PHYSICS)
    return entity
  })
}
