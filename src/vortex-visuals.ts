import { engine, Entity, Material, MaterialTransparencyMode, MeshRenderer, Transform } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { AIRFLOW } from './vortex'
import { ARENA } from './arena'

type WindVisual = {
  entity: Entity; kind: 'stripe' | 'ring'; angle: number; radius: number; height: number
  speed: number; phase: number; layer: number
}

// Restore the original moving wind ribbons and three segmented rings.
// Visuals have no colliders and are independent of timers, pickups or platforms.
export function createWindVisuals(): WindVisual[] {
  const visuals: WindVisual[] = []
  function add(visual: Omit<WindVisual, 'entity'>) {
    const entity = engine.addEntity()
    Transform.create(entity, { position: AIRFLOW.center })
    MeshRenderer.setPlane(entity)
    const stripe = visual.kind === 'stripe'
    Material.setPbrMaterial(entity, {
      albedoColor: stripe ? Color4.create(0.2, 0.78, 1, 0.18) : Color4.create(0.55, 0.9, 1, 0.13),
      emissiveColor: stripe ? Color3.create(0.08, 0.38, 1) : Color3.create(0.12, 0.5, 1),
      emissiveIntensity: stripe ? 0.9 : 0.7,
      roughness: stripe ? 0.35 : 0.22,
      specularIntensity: stripe ? 0.7 : 1.1,
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
    })
    visuals.push({ ...visual, entity })
  }
  for (let i = 0; i < 18; i++) add({ kind: 'stripe', angle: Math.PI * 2 * i / 18,
    radius: 2.2 + i % 7 * 0.58, height: 1.8 + i % 9 * 1.05,
    speed: 0.35 + i % 5 * 0.045, phase: i * 0.73, layer: i % 6 })
  for (let layer = 0; layer < 3; layer++) for (let segment = 0; segment < 10; segment++) {
    add({ kind: 'ring', angle: Math.PI * 2 * segment / 10,
      radius: 2.5 + layer * 1.45, height: 2.2 + layer * 2.65,
      speed: 0.24 + layer * 0.04, phase: segment * 0.41 + layer * 1.3, layer })
  }
  updateWindVisuals(visuals, 0, 0)
  return visuals
}

export function updateWindVisuals(visuals: WindVisual[], time: number, dt: number): void {
  const degrees = (radians: number) => radians * 180 / Math.PI
  for (const visual of visuals) {
    visual.angle += visual.speed * dt
    const transform = Transform.getMutable(visual.entity)
    const wave = Math.sin(time * 0.8 + visual.phase)
    if (visual.kind === 'stripe') {
      const radius = visual.radius + wave * 0.35
      const height = (visual.height + time * 0.65 + visual.layer * 0.35) % 11.5 + 0.8
      const angle = visual.angle + Math.sin(time * 0.53 + visual.phase) * 0.28
      transform.position = Vector3.create(ARENA.center.x + Math.cos(angle) * radius * ARENA.scale,
        height * ARENA.scale, ARENA.center.z + Math.sin(angle) * radius * ARENA.scale)
      transform.rotation = Quaternion.fromEulerDegrees(10 + wave * 7, degrees(-angle) + 90,
        16 + Math.sin(time + visual.phase) * 8)
      transform.scale = Vector3.create((0.38 + wave * 0.04) * ARENA.scale, (2.4 + visual.layer * 0.2) * ARENA.scale, ARENA.scale)
    } else {
      const radius = visual.radius + Math.sin(time * 0.45 + visual.phase) * 0.2
      const angle = visual.angle + Math.sin(time * 0.31 + visual.phase) * 0.08
      transform.position = Vector3.create(ARENA.center.x + Math.cos(angle) * radius * ARENA.scale,
        (visual.height + Math.sin(time * 0.9 + visual.phase) * 0.25) * ARENA.scale,
        ARENA.center.z + Math.sin(angle) * radius * ARENA.scale)
      transform.rotation = Quaternion.fromEulerDegrees(88, degrees(-angle) + 90, wave * 10)
      transform.scale = Vector3.create((1.05 + wave * 0.12) * ARENA.scale, 0.28 * ARENA.scale, ARENA.scale)
    }
  }
}
