import { createContactSound } from './contact-audio'
import { ColliderLayer, engine, GltfContainer, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, BUILD_SCALE } from './arena'
import { leafLocalPoint, touchesLeaf } from './leaf-contact'
import { createSharedRandom, onSharedObstacleEvent, publishSharedObstacleEvent } from './shared-obstacles'

type Point = { x: number; y: number; z: number }
export const LEAF_SCALE = BUILD_SCALE * 0.9
const LEAF_MODEL = 'assets/models/leaf-platform.glb'
export const LANDINGS = {
  count: 48, radius: 1.93 * LEAF_SCALE, halfWidth: 0.98 * LEAF_SCALE, thickness: 0.73 * LEAF_SCALE, warning: 1.2,
  collapseDelay: 0.3, collapseWarning: 0.3, fallDuration: 2, fallAcceleration: 12 * BUILD_SCALE,
  interval: 0.45, jitter: 0.25, firstSpawn: 0.6,
  clearance: 3.5 * BUILD_SCALE, spacing: 4 * BUILD_SCALE, orbitRadius: 14.5 * BUILD_SCALE, upperOrbitRadius: 13.5 * BUILD_SCALE, orbitDegrees: 8,
  orbitWobbleDegrees: 4, radialWobble: 0.45 * BUILD_SCALE, verticalWobble: 0.18 * BUILD_SCALE,
  selfSpinMin: 8, selfSpinMax: 12, selfTumbleRange: 0,
  contactEpsilon: 0.35,
  heights: [3 * ARENA.scale, 5.5 * ARENA.scale, 8 * ARENA.scale, 10 * ARENA.scale] as readonly number[]
} as const
export const landingSlots: Point[] = LANDINGS.heights.flatMap((y, level) => {
  const count = level < 2 ? 16 : 24
  const radius = level < 2 ? LANDINGS.orbitRadius : LANDINGS.upperOrbitRadius
  return Array.from({ length: count }, (_, index) => {
    const angle = (index + level * 0.5) * Math.PI * 2 / count
    return { x: ARENA.center.x + Math.cos(angle) * radius, y,
      z: ARENA.center.z + Math.sin(angle) * radius }
  })
})

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
  const baseRadius = Math.hypot(slot.x - ARENA.center.x, slot.z - ARENA.center.z)
  const radius = baseRadius + Math.sin(seconds * motion.radialRate + motion.phase * 1.7) *
    LANDINGS.radialWobble
  return {
    x: ARENA.center.x + Math.cos(angle) * radius,
    y: slot.y + Math.sin(seconds * motion.verticalRate + motion.phase * 0.7) * LANDINGS.verticalWobble,
    z: ARENA.center.z + Math.sin(angle) * radius
  }
}
export function clearLanding(point: Point, player: Point | undefined, occupied: Point[]): boolean {
  return clearLandingForPlayers(point, player ? [player] : [], occupied)
}
function clearLandingForPlayers(point: Point, players: Point[], occupied: Point[]): boolean {
  return players.every(player => Math.hypot(point.x - player.x, point.y - player.y, point.z - player.z) > LANDINGS.clearance) &&
    occupied.every(other => Math.hypot(point.x - other.x, point.y - other.y, point.z - other.z) >= LANDINGS.spacing)
}

export function createLandingPlatforms(random: () => number = Math.random) {
  const playContact = createContactSound('assets/sounds/leavestouch.mp3')
  const pool = Array.from({ length: LANDINGS.count }, () => {
    const entity = engine.addEntity()
    Transform.create(entity, { scale: Vector3.create(LEAF_SCALE, LEAF_SCALE, LEAF_SCALE) })
    GltfContainer.create(entity, { src: LEAF_MODEL, visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
      invisibleMeshesCollisionMask: ColliderLayer.CL_NONE })
    VisibilityComponent.create(entity, { visible: false })
    const item = { entity, index: 0, age: 0, visible: false, solid: false, styleTick: -1,
      landedAt: undefined as number | undefined, fallAge: undefined as number | undefined,
      motion: { phase: 0, angleRate: 0.6, radialRate: 0.7, verticalRate: 0.9,
        spinDegrees: 140, tiltDegrees: LANDINGS.selfTumbleRange / 2, tiltRate: 0.8, tiltAxis: 0 },
      fallStartY: 0, slot: { x: 0, y: 0, z: 0 }, point: { x: 0, y: 0, z: 0 }, previousPoint: { x: 0, y: 0, z: 0 } }
    return item
  })
  pool.forEach((item, index) => { item.index = index })
  // Match spawn choices and leaf motion across clients without streaming transforms.
  if (random === Math.random) random = createSharedRandom(0x45564f52)
  let untilSpawn: number = LANDINGS.firstSpawn
  let orbitTime = 0
  const pendingCollapses = new Map<number, number>()
  function place(item: typeof pool[number]) {
    const transform = Transform.getMutable(item.entity)
    const tilt = Math.sin(item.age * item.motion.tiltRate + item.motion.phase) * item.motion.tiltDegrees
    transform.rotation = Quaternion.fromEulerDegrees(
      Math.cos(item.motion.tiltAxis) * tilt,
      item.age * item.motion.spinDegrees + item.motion.phase * 180 / Math.PI,
      Math.sin(item.motion.tiltAxis) * tilt)
    // The visible GLB mesh is also the only leaf collider and landing surface.
    transform.position = { ...item.point }
  }
  function release(item: typeof pool[number]) {
    item.solid = false
    GltfContainer.getMutable(item.entity).visibleMeshesCollisionMask = ColliderLayer.CL_NONE
  }
  function hide(item: typeof pool[number]) {
    item.visible = false
    release(item)
    VisibilityComponent.getMutable(item.entity).visible = false
  }
  function armCollapse(item: typeof pool[number], broadcast = true, at = Date.now()) {
    if (item.landedAt !== undefined) return
    item.landedAt = item.age - (broadcast ? 0 : Math.max(0, (Date.now() - at) / 1000))
    item.styleTick = -1
    if (broadcast) {
      playContact()
      publishSharedObstacleEvent('leaf', item.index, 'collapse')
    }
  }
  const stopListening = onSharedObstacleEvent(event => {
    if (event.kind !== 'leaf' || event.action !== 'collapse') return
    const item = pool[event.index]
    if (item?.visible) armCollapse(item, false, event.at)
    else pendingCollapses.set(event.index, event.at)
  })
  return {
    update(dt: number, player: Point | undefined, players: Point[] = player ? [player] : []) {
      if (!Number.isFinite(dt) || dt <= 0) return
      // Never sweep a solid collider across the arena after a suspended client resumes.
      if (dt > 0.5) { pool.forEach(hide); untilSpawn = LANDINGS.firstSpawn; return }
      orbitTime = (orbitTime + dt) % (360 / LANDINGS.orbitDegrees)
      for (const item of pool) {
        if (!item.visible) continue
        item.age += dt
        if (item.fallAge !== undefined) {
          item.fallAge += dt
          item.point.y = item.fallStartY - 0.5 * LANDINGS.fallAcceleration * item.fallAge ** 2
          if (item.fallAge >= LANDINGS.fallDuration || item.point.y <= ARENA.floorTop + LANDINGS.thickness / 2) {
            hide(item); continue
          }
          place(item)
          continue
        }
        item.previousPoint = item.point
        item.point = windOrbitPoint(item.slot, orbitTime, item.motion)
        place(item)
        if (item.solid && player && touchesLeaf(player, item.point, Transform.get(item.entity).rotation,
          LANDINGS.radius, LANDINGS.halfWidth, LANDINGS.thickness)) armCollapse(item)
        if (item.landedAt !== undefined && item.age - item.landedAt >= LANDINGS.collapseDelay - 1e-6) {
          // Collapse releases the player immediately; the visible deck drops without pushing anyone.
          release(item)
          item.fallAge = 0
          item.fallStartY = item.point.y
          continue
        }
        if (!item.solid && item.age >= LANDINGS.warning) {
          // Recheck at activation: never materialize collision inside an approaching player.
          if (!clearLandingForPlayers(item.point, players, [])) { hide(item); continue }
          GltfContainer.getMutable(item.entity).visibleMeshesCollisionMask = ColliderLayer.CL_PHYSICS
          item.solid = true
          item.styleTick = -1
        }
        const styleTick = Math.floor(item.age * 10)
        if (styleTick === item.styleTick) continue
        item.styleTick = styleTick
        const remaining = item.landedAt === undefined ? undefined : LANDINGS.collapseDelay - (item.age - item.landedAt)
        const expiring = remaining !== undefined && remaining <= LANDINGS.collapseWarning
        const pulse = 1 // Keep the collision surface stable throughout the countdown.
        Transform.getMutable(item.entity).scale = Vector3.create(LEAF_SCALE * pulse,
          LEAF_SCALE * pulse, LEAF_SCALE * pulse)
      }
      untilSpawn -= dt
      if (untilSpawn > 0) return
      untilSpawn = LANDINGS.interval + random() * LANDINGS.jitter
      const item = pool.find(p => !p.visible)
      if (!item || !player) return
      const occupied = pool.filter(p => p.visible).map(p => p.point)
      const candidates = landingSlots.filter(slot => clearLandingForPlayers(orbitPoint(slot, orbitTime), players, occupied))
      if (!candidates.length) return
      item.slot = candidates[Math.floor(random() * candidates.length)]
      item.age = 0; item.visible = true; item.solid = false
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
      const pendingAt = pendingCollapses.get(item.index)
      if (pendingAt !== undefined) {
        armCollapse(item, false, pendingAt)
        pendingCollapses.delete(item.index)
      }
    },
    supportsPlayer(player?: Point) {
      if (!player) return false
      return pool.some(item => {
        if (!item.solid) return false
        const p=leafLocalPoint({...player,y:player.y-.88},item.point,Transform.get(item.entity).rotation)
        return Math.abs(p.x)<=LANDINGS.radius+.2 && Math.abs(p.z)<=LANDINGS.halfWidth+.2 &&
          Math.abs(p.y-LANDINGS.thickness/2)<=.25
      })
    },
    isPlatform(entity: number | undefined) {
      return pool.some(item => item.entity === entity)
    },
    isSolid(entity: number | undefined) {
      return pool.some(item => item.entity === entity && item.solid)
    },
    checkLanding(supportingEntity?: number) {
      if (supportingEntity === undefined) return false
      const landed = pool.find(item => item.entity === supportingEntity && item.solid)
      if (landed) armCollapse(landed)
      return !!landed
    },
    confirmRayLanding(entity: number | undefined, player: Point | undefined, hit: Point | undefined,
      footOffset: number) {
      if (!player || !hit) return false
      const item = pool.find(candidate => candidate.entity === entity && candidate.solid)
      // Test the avatar capsule, including side and underside contact, against an actual mesh ray hit.
      const vertical = Math.max(0, Math.abs(player.y - hit.y) - footOffset)
      const distance = Math.hypot(player.x - hit.x, vertical, player.z - hit.z)
      if (!item || distance > LANDINGS.contactEpsilon) return false
      // A short ray from the feet point hit this leaf's visible collider, regardless of approach direction.
      armCollapse(item)
      return true
    },
    overlaps(point: Point, radius: number) {
      return pool.some(item => item.visible &&
        Math.hypot(point.x - item.point.x, point.z - item.point.z) < LANDINGS.radius + radius &&
        Math.abs(point.y - item.point.y) < LANDINGS.thickness / 2 + radius)
    },
    dispose() { stopListening() }
  }
}
