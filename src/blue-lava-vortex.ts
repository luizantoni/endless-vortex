import { ColliderLayer, engine, Entity, GltfContainer, GltfNodeModifiers, Material, Transform } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector2, Vector3 } from '@dcl/sdk/math'
import { ARENA, BUILD_SCALE, GROUND_ASSET_LIFT } from './arena'
import { TUNING } from './tuning'

const ORIGINAL_MODEL = 'assets/models/blue-lava-vortex.glb'
const BASE_MODEL = 'assets/models/blue-lava-vortex-base.glb'
const LAVA_MODEL = 'assets/models/blue-lava-vortex-lava.glb'
const LAVA_TEXTURE = 'assets/materials/blue-lava-molten.png'
const VORTEX_SCALE = TUNING.blueLavaVortex.scale * BUILD_SCALE

function getModelEntity(src: string): Entity {
  const existing = [...engine.getEntitiesWith(GltfContainer)].find(([, model]) => model.src === src)?.[0]
  return existing ?? engine.addEntity()
}

function animateLavaMaterial(entity: Entity, elapsed: number) {
  const { pulseFrequency, emissiveMin, emissiveMax, uvOrbitPeriodSeconds, uvOffsetRadius } = TUNING.blueLavaVortex
  const pulse = (Math.sin(elapsed * Math.PI * 2 * pulseFrequency) + 1) / 2
  const colorShift = (Math.sin(elapsed * Math.PI * 2 * pulseFrequency * 0.5) + 1) / 2
  const angle = elapsed * Math.PI * 2 / uvOrbitPeriodSeconds
  // SDK 7.29 textures expose UV offset/tiling but no UV rotation. A slow, seamless
  // circular offset makes the lava flow around the material without touching its mesh.
  const uvOffset = Vector2.create(uvOffsetRadius * (Math.cos(angle) - 1), uvOffsetRadius * Math.sin(angle))
  GltfNodeModifiers.createOrReplace(entity, { modifiers: [{
    path: '',
    castShadows: false,
    material: { material: { $case: 'pbr', pbr: {
      texture: Material.Texture.Common({ src: LAVA_TEXTURE, wrapMode: 0, offset: uvOffset }),
      albedoColor: Color4.White(),
      emissiveColor: Color3.create(0.08 + colorShift * 0.04, 0.48 + colorShift * 0.32, 1),
      emissiveIntensity: emissiveMin + pulse * (emissiveMax - emissiveMin),
      metallic: 0.18,
      roughness: 0.42,
      directIntensity: 0.8
    } } }
  }] })
}

/** A static two-part GLB: original gray base plus a separately animated lava material. */
export function createBlueLavaVortex() {
  // Remove any previously authored instance of the unsplit two-material model.
  for (const [entity, model] of engine.getEntitiesWith(GltfContainer)) {
    if (model.src !== ORIGINAL_MODEL) continue
    GltfContainer.deleteFrom(entity)
    GltfNodeModifiers.deleteFrom(entity)
  }

  const position = { x: ARENA.center.x, y: TUNING.blueLavaVortex.y * BUILD_SCALE + GROUND_ASSET_LIFT, z: ARENA.center.z }
  const base = getModelEntity(BASE_MODEL)
  Transform.createOrReplace(base, { position, rotation: Quaternion.Identity(),
    scale: Vector3.create(VORTEX_SCALE, VORTEX_SCALE, VORTEX_SCALE) })
  GltfContainer.createOrReplace(base, { src: BASE_MODEL,
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE, invisibleMeshesCollisionMask: ColliderLayer.CL_NONE })
  // No modifier is applied to the base, so its authored neutral gray material remains intact.
  GltfNodeModifiers.deleteFrom(base)

  const lava = getModelEntity(LAVA_MODEL)
  Transform.createOrReplace(lava, { position, rotation: Quaternion.Identity(),
    scale: Vector3.create(VORTEX_SCALE, VORTEX_SCALE, VORTEX_SCALE) })
  GltfContainer.createOrReplace(lava, { src: LAVA_MODEL,
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE, invisibleMeshesCollisionMask: ColliderLayer.CL_NONE })

  let elapsed = 0
  let accumulated = 0
  animateLavaMaterial(lava, elapsed)
  engine.addSystem(dt => {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.5) return
    elapsed += dt
    accumulated += dt
    if (accumulated < TUNING.blueLavaVortex.materialInterval) return
    accumulated %= TUNING.blueLavaVortex.materialInterval
    // UV/emissive material animation only. Neither GLB Transform is touched after placement.
    animateLavaMaterial(lava, elapsed)
  })
}
