import { ColliderLayer, engine, GltfContainer, Transform, TriggerArea, triggerAreaEventsSystem, VisibilityComponent } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA } from './arena'

type Point = { x: number; y: number; z: number }
const LEAF_MODEL = 'assets/models/leaf-platform.glb'
export const LANDINGS = {
  count: 18, radius: 1.93, halfWidth: 0.98, thickness: 0.73, warning: 1.2,
  collapseDelay: 2, collapseWarning: 2, fallDuration: 2, fallAcceleration: 12,
  interval: 0.7, jitter: 0.35, firstSpawn: 0.6,
  clearance: 3.5, spacing: 4.8, orbitRadius: 14.5, orbitDegrees: 8,
  orbitWobbleDegrees: 4, radialWobble: 0.45, verticalWobble: 0.18,
  selfSpinMin: 35, selfSpinMax: 70, selfTumbleRange: 40,
  supportTolerance: 0.22,
  sensorHeight: 0.2, avatarRadius: 0.3, nativeSupportTolerance: 0.4,
  heights: [3.5 * ARENA.scale, 6 * ARENA.scale, 8.5 * ARENA.scale] as readonly number[]
} as const
const LEAF_SCALE = 1 // Preserve the source model's proportions.
export const landingSlots: Point[] = LANDINGS.heights.flatMap((y, level) => Array.from({ length: 8 }, (_, index) => {
  const angle = (index + level * 0.5) * Math.PI / 4
  return { x: ARENA.center.x + Math.cos(angle) * LANDINGS.orbitRadius, y,
    z: ARENA.center.z + Math.sin(angle) * LANDINGS.orbitRadius }
}))

// Shared orbital phase preserves separation between platforms throughout their lives.
export function orbitPoint(slot: Point, seconds: number): Point {
  const angle = seconds * LANDINGS.orbitDegrees * Math.PI / 180
  const x = slot.x - ARENA.center.x, z = slot.z - ARENA.center.z
  return { x: ARENA.center.x + x * Math.cos(angle) - z * Math.sin(angle), y: slot.y,
    z: ARENA.center.z + x * Math.sin(angle) + z * Math.cos(angle) }
}
type Motion = { phase: number; angleRate: number; radialRate: number; verticalRate: number;
  spinDegrees: number; tiltDegrees: number; tiltRate: number; tiltAxis: number }
function windOrbitPoint(slot: Point, seconds: number, motion: Motion): Point {
  const base = Math.atan2(slot.z - ARENA.center.z, slot.x - ARENA.center.x) +
    seconds * LANDINGS.orbitDegrees * Math.PI / 180
  const angle = base + Math.sin(seconds * motion.angleRate + motion.phase) *
    LANDINGS.orbitWobbleDegrees * Math.PI / 180
  const radius = LANDINGS.orbitRadius + Math.sin(seconds * motion.radialRate + motion.phase * 1.7) *
    LANDINGS.radialWobble
  return {
    x: ARENA.center.x + Math.cos(angle) * radius,
    y: slot.y + Math.sin(seconds * motion.verticalRate + motion.phase * 0.7) * LANDINGS.verticalWobble,
    z: ARENA.center.z + Math.sin(angle) * radius
  }
}
export function clearLanding(point: Point, player: Point | undefined, occupied: Point[]): boolean {
  return (!player || Math.hypot(point.x - player.x, point.y - player.y, point.z - player.z) > LANDINGS.clearance) &&
    occupied.every(other => Math.hypot(point.x - other.x, point.y - other.y, point.z - other.z) >= LANDINGS.spacing)
}

export function createLandingPlatforms(random = Math.random) {
  const pool = Array.from({ length: LANDINGS.count }, () => {
    const entity = engine.addEntity(), sensor = engine.addEntity()
    Transform.create(entity, { scale: Vector3.create(LEAF_SCALE, LEAF_SCALE, LEAF_SCALE) })
    // A non-solid sensor just above the deck catches the avatar capsule at the rim.
    Transform.create(sensor, { scale: Vector3.create(LANDINGS.radius * 2, LANDINGS.sensorHeight, LANDINGS.halfWidth * 2) })
    GltfContainer.create(entity, { src: LEAF_MODEL, visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
      invisibleMeshesCollisionMask: ColliderLayer.CL_NONE })
    VisibilityComponent.create(entity, { visible: false })
    const item = { entity, sensor, nativeInside: false, age: 0, visible: false, solid: false, styleTick: -1,
      landedAt: undefined as number | undefined, fallAge: undefined as number | undefined,
      motion: { phase: 0, angleRate: 0.6, radialRate: 0.7, verticalRate: 0.9,
        spinDegrees: 140, tiltDegrees: LANDINGS.selfTumbleRange / 2, tiltRate: 0.8, tiltAxis: 0 },
      slot: { x: 0, y: 0, z: 0 }, point: { x: 0, y: 0, z: 0 }, previousPoint: { x: 0, y: 0, z: 0 } }
    // Fixed listeners are reused with the pool. Only the local player's ENTER/EXIT changes contact.
    // Avoid SDK-synthesized STAY events retaining a contact across a recycled sensor.
    triggerAreaEventsSystem.onTriggerEnter(sensor, result => {
      if (result.trigger?.entity === engine.PlayerEntity && item.solid) item.nativeInside = true
    })
    triggerAreaEventsSystem.onTriggerExit(sensor, result => {
      if (result.trigger?.entity === engine.PlayerEntity) item.nativeInside = false
    })
    return item
  })
  let untilSpawn: number = LANDINGS.firstSpawn
  let orbitTime = 0
  function up(rotation: { x: number; y: number; z: number; w: number }) {
    return { x: 2 * (rotation.x * rotation.y - rotation.w * rotation.z),
      y: 1 - 2 * (rotation.x * rotation.x + rotation.z * rotation.z),
      z: 2 * (rotation.y * rotation.z + rotation.w * rotation.x) }
  }
  function right(rotation: { x: number; y: number; z: number; w: number }) {
    return { x: 1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z),
      y: 2 * (rotation.x * rotation.y + rotation.w * rotation.z),
      z: 2 * (rotation.x * rotation.z - rotation.w * rotation.y) }
  }
  function forward(rotation: { x: number; y: number; z: number; w: number }) {
    return { x: 2 * (rotation.x * rotation.z + rotation.w * rotation.y),
      y: 2 * (rotation.y * rotation.z - rotation.w * rotation.x),
      z: 1 - 2 * (rotation.x * rotation.x + rotation.y * rotation.y) }
  }
  function place(item: typeof pool[number]) {
    const transform = Transform.getMutable(item.entity)
    const tilt = Math.sin(item.age * item.motion.tiltRate + item.motion.phase) * item.motion.tiltDegrees
    transform.rotation = Quaternion.fromEulerDegrees(
      Math.cos(item.motion.tiltAxis) * tilt,
      item.age * item.motion.spinDegrees + item.motion.phase * 180 / Math.PI,
      Math.sin(item.motion.tiltAxis) * tilt)
    const normal = up(transform.rotation)
    // The packaged GLB has a centered pivot; the rendered mesh, collider and contact sensor
    // all use the same natural 3.86 × 1.96 m leaf footprint.
    transform.position = { ...item.point }
    const sensor = Transform.getMutable(item.sensor)
    const offset = LANDINGS.thickness / 2 + LANDINGS.sensorHeight / 2
    sensor.position = { x: item.point.x + normal.x * offset, y: item.point.y + normal.y * offset,
      z: item.point.z + normal.z * offset }
    sensor.rotation = transform.rotation
  }
  function release(item: typeof pool[number]) {
    item.solid = item.nativeInside = false
    GltfContainer.getMutable(item.entity).visibleMeshesCollisionMask = ColliderLayer.CL_NONE
    TriggerArea.deleteFrom(item.sensor)
  }
  function hide(item: typeof pool[number]) {
    item.visible = false
    release(item)
    VisibilityComponent.getMutable(item.entity).visible = false
  }
  function onTop(item: typeof pool[number], player: Point, footOffset: number, tolerance: number, extraRadius: number) {
    const transform = Transform.get(item.entity), normal = up(transform.rotation)
    const top = { x: item.point.x + normal.x * LANDINGS.thickness / 2,
      y: item.point.y + normal.y * LANDINGS.thickness / 2,
      z: item.point.z + normal.z * LANDINGS.thickness / 2 }
    const delta = { x: player.x - top.x, y: player.y - footOffset - top.y, z: player.z - top.z }
    const planeDistance = delta.x * normal.x + delta.y * normal.y + delta.z * normal.z
    const rightAxis = right(transform.rotation), forwardAxis = forward(transform.rotation)
    const localX = delta.x * rightAxis.x + delta.y * rightAxis.y + delta.z * rightAxis.z
    const localZ = delta.x * forwardAxis.x + delta.y * forwardAxis.y + delta.z * forwardAxis.z
    const length = LANDINGS.radius + extraRadius, width = LANDINGS.halfWidth + extraRadius
    return Math.abs(planeDistance) <= tolerance &&
      (localX * localX) / (length * length) + (localZ * localZ) / (width * width) <= 1
  }
  function steppedOn(item: typeof pool[number], player: Point | undefined, footOffset: number) {
    if (!player || !item.solid || item.landedAt !== undefined) return false
    return onTop(item, player, footOffset, LANDINGS.nativeSupportTolerance, LANDINGS.avatarRadius)
  }
  function armCollapse(item: typeof pool[number]) {
    if (item.landedAt !== undefined) return
    item.landedAt = item.age
    item.styleTick = -1
  }
  return {
    update(dt: number, player: Point | undefined) {
      if (!Number.isFinite(dt) || dt <= 0) return
      // Never sweep a solid collider across the arena after a suspended client resumes.
      if (dt > 0.5) { pool.forEach(hide); untilSpawn = LANDINGS.firstSpawn; return }
      orbitTime = (orbitTime + dt) % (360 / LANDINGS.orbitDegrees)
      for (const item of pool) {
        if (!item.visible) continue
        item.age += dt
        if (item.fallAge !== undefined) {
          item.fallAge += dt
          item.point.y = item.slot.y - 0.5 * LANDINGS.fallAcceleration * item.fallAge ** 2
          if (item.fallAge >= LANDINGS.fallDuration || item.point.y <= ARENA.floorTop + LANDINGS.thickness / 2) {
            hide(item); continue
          }
          place(item)
          continue
        }
        item.previousPoint = item.point
        item.point = windOrbitPoint(item.slot, orbitTime, item.motion)
        place(item)
        if ((item.nativeInside || steppedOn(item, player, 0.88)) && steppedOn(item, player, 0.88)) armCollapse(item)
        if (item.landedAt !== undefined && item.age - item.landedAt >= LANDINGS.collapseDelay - 1e-6) {
          // Collapse releases the player immediately; the visible deck drops without pushing anyone.
          release(item)
          item.fallAge = 0
          continue
        }
        if (!item.solid && item.age >= LANDINGS.warning) {
          // Recheck at activation: never materialize collision inside an approaching player.
          if (!clearLanding(item.point, player, [])) { hide(item); continue }
          GltfContainer.getMutable(item.entity).visibleMeshesCollisionMask = ColliderLayer.CL_PHYSICS
          TriggerArea.setBox(item.sensor, ColliderLayer.CL_PLAYER)
          item.solid = true
          item.styleTick = -1
        }
        const styleTick = Math.floor(item.age * 10)
        if (styleTick === item.styleTick) continue
        item.styleTick = styleTick
        const remaining = item.landedAt === undefined ? undefined : LANDINGS.collapseDelay - (item.age - item.landedAt)
        const expiring = remaining !== undefined && remaining <= LANDINGS.collapseWarning
        const pulse = expiring ? 1 + (Math.floor(remaining! * 8) % 2) * 0.035 : 1
        Transform.getMutable(item.entity).scale = Vector3.create(LEAF_SCALE * pulse,
          LEAF_SCALE * pulse, LEAF_SCALE * pulse)
      }
      untilSpawn -= dt
      if (untilSpawn > 0) return
      untilSpawn = LANDINGS.interval + random() * LANDINGS.jitter
      const item = pool.find(p => !p.visible)
      if (!item || !player) return
      const occupied = pool.filter(p => p.visible).map(p => p.point)
      const candidates = landingSlots.filter(slot => clearLanding(orbitPoint(slot, orbitTime), player, occupied))
      if (!candidates.length) return
      item.slot = candidates[Math.floor(random() * candidates.length)]
      item.age = 0; item.visible = true; item.solid = false; item.nativeInside = false
      item.landedAt = undefined; item.fallAge = undefined
      item.styleTick = -1
      item.motion = {
        phase: random() * Math.PI * 2,
        angleRate: 0.45 + random() * 0.45,
        radialRate: 0.55 + random() * 0.45,
        verticalRate: 0.7 + random() * 0.5,
        spinDegrees: (LANDINGS.selfSpinMin + random() * (LANDINGS.selfSpinMax - LANDINGS.selfSpinMin)) *
          (random() < 0.5 ? -1 : 1),
        tiltDegrees: LANDINGS.selfTumbleRange / 2,
        tiltRate: 0.55 + random() * 0.65,
        tiltAxis: random() * Math.PI * 2
      }
      item.point = windOrbitPoint(item.slot, orbitTime, item.motion)
      item.previousPoint = item.point
      place(item)
      VisibilityComponent.getMutable(item.entity).visible = true
      Transform.getMutable(item.entity).scale = Vector3.create(LEAF_SCALE, LEAF_SCALE, LEAF_SCALE)
    },
    isPlatform(entity: number | undefined) {
      return pool.some(item => item.entity === entity)
    },
    isSolid(entity: number | undefined) {
      return pool.some(item => item.entity === entity && item.solid)
    },
    checkLanding(player: Point, footOffset: number, velocityY: number, supportingEntity?: number) {
      // A native capsule contact may have small upward correction velocities. Do not discard it
      // because the chest-height estimate or a single-frame velocity differs from ideal geometry.
      // Filter the box sensor's corners and underside; the visible leaf remains the collider.
      const nativeContact = pool.find(item => item.solid && item.nativeInside &&
        onTop(item, player, footOffset, LANDINGS.nativeSupportTolerance, LANDINGS.avatarRadius))
      if (!nativeContact && velocityY > 0.5) return false
      const atTop = (item: typeof pool[number]) => item.solid &&
        onTop(item, player, footOffset, LANDINGS.supportTolerance, LANDINGS.avatarRadius)
      // The confirmed ground ray must arm the same deck that pauses airtime.
      // Geometry also checks the position the client just rendered, before this frame's orbit update.
      // A ray hit refers to the leaf position rendered by the client just before this update.
      // Use the native contact tolerance so orbital motion cannot discard that one-frame landing.
      const landed = nativeContact ?? pool.find(item => item.entity === supportingEntity && item.solid &&
        onTop(item, player, footOffset, LANDINGS.nativeSupportTolerance, LANDINGS.avatarRadius)) ??
        pool.find(item => atTop(item))
      if (landed) armCollapse(landed)
      return !!landed
    },
    confirmRayLanding(entity: number | undefined, player: Point | undefined, hit: Point | undefined,
      footOffset: number, velocityY: number, hitDistance?: number) {
      if (!player || !hit || velocityY > 0.5) return false
      const item = pool.find(candidate => candidate.entity === entity && candidate.solid)
      const footMatches = Math.abs(player.y - footOffset - hit.y) <= LANDINGS.nativeSupportTolerance
      const rayMatches = Number.isFinite(hitDistance) &&
        Math.abs(hitDistance! - (1 + footOffset)) <= LANDINGS.nativeSupportTolerance
      if (!item || Math.hypot(player.x - hit.x, player.z - hit.z) >= 0.45 || (!footMatches && !rayMatches)) return false
      // The native ray hit the visible leaf mesh now. Arm before its next orbital update.
      armCollapse(item)
      return true
    },
    overlaps(point: Point, radius: number) {
      return pool.some(item => item.visible &&
        Math.hypot(point.x - item.point.x, point.z - item.point.z) < LANDINGS.radius + radius &&
        Math.abs(point.y - item.point.y) < LANDINGS.thickness / 2 + radius)
    }
  }
}
