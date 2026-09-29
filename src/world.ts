import { AudioSource, Billboard, ColliderLayer, engine, Entity, GltfContainer, Material,
  MaterialTransparencyMode, MeshCollider, MeshRenderer, TextShape, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { phaseAt, PlatformPlan, SLOTS } from './course'
import { Position } from './rules'
import { TUNING as T } from './tuning'

export type Platform = { entity: Entity; rotor: Entity; label: Entity; plan?: PlatformPlan; enabled: boolean; contacted: boolean }
export type Bubble = { entity: Entity; position: Position; readyAt: number }
const cyan = Color4.create(0.08, 0.76, 0.9, 1)
const orange = Color4.create(1, 0.3, 0.07, 1)
export function paint(entity: Entity, color: Color4): void {
  Material.setPbrMaterial(entity, { albedoColor: color, roughness: 0.7,
    emissiveColor: Color3.create(color.r * 0.3, color.g * 0.3, color.b * 0.3), emissiveIntensity: 0.7,
    transparencyMode: color.a < 1 ? MaterialTransparencyMode.MTM_ALPHA_BLEND : MaterialTransparencyMode.MTM_OPAQUE })
}
function box(position: Position, scale: Position, color: Color4, collider = false): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale })
  MeshRenderer.setBox(entity)
  paint(entity, color)
  if (collider) MeshCollider.setBox(entity, ColliderLayer.CL_PHYSICS)
  return entity
}
function label(position: Position, text: string): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, { position })
  Billboard.create(entity)
  TextShape.create(entity, { text, fontSize: 2.2, textColor: Color4.White(), outlineWidth: 0.1,
    outlineColor: Color3.Black() })
  return entity
}
export function createArena(): { floor: Entity; launch: Entity } {
  const source = 'assets/scene/Models/wind_tunnel2/wind_tunnel2.glb'
  const existing = [...engine.getEntitiesWith(GltfContainer)].find(([, model]) => model.src === source)
  const tunnel = existing?.[0] ?? engine.addEntity()
  if (!Transform.has(tunnel)) Transform.create(tunnel, { position: Vector3.create(16, 0, 15.75) })
  // Retain the existing asset as scenery; its curved collisions caused snagging.
  GltfContainer.createOrReplace(tunnel, { src: source,
    visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  const floor = box({ x: 16, y: T.arena.floorY - 0.15, z: 16 }, { x: 20.5, y: 0.3, z: 20.5 },
    Color4.create(0.38, 0.07, 0.025, 1), true)
  for (let i = 0; i < 7; i++) box({ x: 16, y: T.arena.floorY + 0.01, z: 7 + i * 3 },
    { x: 20, y: 0.015, z: 0.16 }, Color4.create(1, 0.5, 0.04, 1))
  // Smooth flat containment, with visible boundary rails. Roof is omitted: no ceiling to stick to.
  for (const axis of ['x', 'z'] as const) for (const sign of [-1, 1]) {
    const position = { x: 16, y: 11, z: 16 }; position[axis] += sign * (T.arena.halfWidth + 0.3)
    const size = axis === 'x' ? { x: 0.6, y: 22, z: 21.2 } : { x: 21.2, y: 22, z: 0.6 }
    const wall = box(position, size, Color4.create(0.1, 0.55, 0.65, 0.045), true)
    VisibilityComponent.create(wall, { visible: true })
    for (const y of [1, 10, 19]) box({ ...position, y }, { ...size, y: 0.08 }, Color4.create(0.12, 0.6, 0.7, 0.6))
  }
  const launch = box({ x: T.launch.x, y: T.launch.y - 0.2, z: T.launch.z },
    { x: T.launch.width, y: 0.4, z: T.launch.depth }, Color4.create(0.1, 0.45, 0.26, 1), true)
  label({ x: T.launch.x, y: T.launch.y + 1, z: T.launch.z - 1.8 }, 'LAUNCH\nSteer + jump\nLeave deck to begin')
  label({ x: 16, y: 1.2, z: 16 }, 'FLOOR = RUN OVER')
  return { floor, launch }
}
export function createPlatforms(): Platform[] {
  return Array.from({ length: T.platforms.maxActive }, () => {
    const entity = box({ x: 16, y: 1, z: 16 }, { x: T.platforms.width, y: T.platforms.thickness, z: T.platforms.depth }, cyan)
    const rotor = box({ x: 16, y: 1, z: 16 }, { x: 2.3, y: 0.05, z: 0.16 }, Color4.White())
    const text = label({ x: 16, y: 1, z: 16 }, '')
    const platform = { entity, rotor, label: text, enabled: false, contacted: false }
    hidePlatform(platform)
    return platform
  })
}
export function hidePlatform(platform: Platform): void {
  MeshCollider.deleteFrom(platform.entity)
  for (const entity of [platform.entity, platform.rotor, platform.label]) VisibilityComponent.createOrReplace(entity, { visible: false })
  platform.plan = undefined; platform.enabled = false; platform.contacted = false
}
export function showPlatform(platform: Platform, plan: PlatformPlan): void {
  platform.plan = plan; platform.enabled = false; platform.contacted = false
  for (const entity of [platform.entity, platform.rotor, platform.label]) VisibilityComponent.createOrReplace(entity, { visible: true })
  const position = SLOTS[plan.slot]
  Transform.getMutable(platform.entity).position = { ...position, y: position.y - T.platforms.thickness / 2 }
  Transform.getMutable(platform.entity).rotation = Quaternion.fromEulerDegrees(0, plan.kind === 'push' ? 45 : 0, 0)
  if (plan.kind === 'landing') MeshRenderer.setCylinder(platform.entity)
  else MeshRenderer.setBox(platform.entity)
  Transform.getMutable(platform.rotor).position = { ...position, y: position.y + 0.04 }
  Transform.getMutable(platform.label).position = { ...position, y: position.y + 0.9 }
}
export function enablePlatform(platform: Platform): void {
  if (platform.plan?.kind === 'landing') MeshCollider.setCylinder(platform.entity, ColliderLayer.CL_PHYSICS)
  platform.enabled = true
}
export function drawPlatform(platform: Platform, elapsed: number): void {
  if (!platform.plan) return
  const { plan } = platform, phase = phaseAt(plan, elapsed)
  const remaining = plan.at + T.platforms.warning + T.platforms.lifetime - elapsed
  const landing = plan.kind === 'landing'
  const base = landing ? cyan : orange
  const alpha = phase === 'warning' ? 0.24 : phase === 'fade' ? Math.max(0, 1 + remaining / T.platforms.fade) : 1
  paint(platform.entity, Color4.create(base.r, base.g, base.b, alpha))
  Transform.getMutable(platform.rotor).rotation = Quaternion.fromEulerDegrees(0,
    landing ? (elapsed - plan.at) * T.platforms.rotationDegrees : 45, 0)
  TextShape.getMutable(platform.label).text = phase === 'warning' ?
    `${landing ? 'ROUND DECK' : '↓ PUSH'} IN ${Math.max(0, plan.at + T.platforms.warning - elapsed).toFixed(1)}` :
    phase === 'expiring' ? `DISAPPEARS ${Math.max(0, remaining).toFixed(1)}s` :
    phase === 'fade' ? '' : landing ? 'PAUSE · JUMP' : '↓↓ PUSH ↓↓'
  paint(platform.rotor, phase === 'expiring' && Math.floor(elapsed * 4) % 2 === 0 ? orange : Color4.White())
}
export function createBubbles(): Bubble[] {
  return Array.from({ length: T.bubbles.count }, (_, index) => {
    const angle = index * Math.PI * 2 / T.bubbles.count
    const position = { x: 16 + Math.cos(angle) * (4 + index % 3), y: 4 + index % 4 * 3, z: 16 + Math.sin(angle) * (4 + index % 3) }
    const entity = engine.addEntity()
    Transform.create(entity, { position, scale: Vector3.create(0.7, 0.7, 0.7) })
    MeshRenderer.setSphere(entity)
    paint(entity, Color4.create(0.3, 0.85, 1, 0.72))
    return { entity, position, readyAt: 0 }
  })
}
export function createAudio(): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.create(16, 10, 16) })
  AudioSource.create(entity, { audioClipUrl: T.audio.clip, playing: false, loop: false, volume: T.audio.defaultVolume, global: true })
  return entity
}
