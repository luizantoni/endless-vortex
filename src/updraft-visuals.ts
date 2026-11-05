import { engine, Material, MaterialTransparencyMode, MeshRenderer, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { AIRFLOW } from './vortex'
import { REVERSAL_EFFECT_SECONDS, vortexReversalAt } from './vortex-reversal'

export const REVERSAL_SPARKS = 24

/** Bright rising streaks mark the actual lift column all the way to the crown. */
export function createUpdraftVisuals(getReversal = () => vortexReversalAt(Date.now())) {
  const zone = AIRFLOW.zones.find(zone => zone.id === 'central')!
  const bottom = AIRFLOW.forceMinY, height = AIRFLOW.height - bottom
  const count = 42
  const texture = Material.Texture.Common({ src: 'assets/ui/modular/updraft-streak.png' })
  const streaks = Array.from({ length: count }, (_, i) => {
    const entity = engine.addEntity()
    Transform.create(entity)
    MeshRenderer.setPlane(entity)
    Material.setPbrMaterial(entity, {
      texture, emissiveTexture: texture,
      albedoColor: Color4.create(.62, .92, 1, .92),
      emissiveColor: i % 3 === 0 ? Color3.create(.31, .63, 1) : Color3.create(.53, .92, 1),
      emissiveIntensity: 2.6, specularIntensity: 0,
      roughness: 1, castShadows: false, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
    })
    return { entity, phase: i / count, angle: i * 2.399963, radius: zone.size.x * (.22 + (i % 4) * .075),
      length: 5.6 + i % 4 * .66, width: .85 + i % 3 * .14 }
  })
  const sparks = Array.from({ length: REVERSAL_SPARKS }, (_, i) => {
    const entity = engine.addEntity()
    Transform.create(entity)
    MeshRenderer.setSphere(entity)
    const tint = i % 4 === 0 ? [1, .66, .21] : i % 2 ? [.58, .26, 1] : [.18, .90, 1]
    Material.setPbrMaterial(entity, {
      albedoColor: Color4.create(tint[0], tint[1], tint[2], 1),
      emissiveColor: Color3.create(tint[0], tint[1], tint[2]),
      emissiveIntensity: 4.5, roughness: .4, castShadows: false
    })
    VisibilityComponent.create(entity, { visible: false })
    return entity
  })
  let time = 0, azimuth = 0, accumulator = 0, sparksVisible = false
  function animate(dt: number) {
    if (!Number.isFinite(dt) || dt < 0 || dt > .5) return
    const { spin, age, direction } = getReversal()
    time += dt; accumulator += dt
    azimuth = (azimuth + spin * .95 * dt) % (Math.PI * 2)
    if (dt && accumulator < 1 / 30) return
    accumulator = 0
    const pulse = Math.max(0, 1 - Math.abs(age - 1.25) / 1.25)
    for (const {entity, phase, angle, radius, length, width} of streaks) {
      const t = (phase + time * 6 / height) % 1
      const orbit = angle + azimuth + phase * 4
      const fade = Math.min(1, t * 25, (1 - t) * 25)
      const transform = Transform.getMutable(entity)
      transform.position = Vector3.create(zone.center.x + Math.cos(orbit) * radius,
        bottom + t * height, zone.center.z + Math.sin(orbit) * radius)
      transform.rotation = Quaternion.fromEulerDegrees(0, 90 - orbit * 180 / Math.PI, -15 * spin)
      transform.scale = Vector3.create(width * fade * (1 + .6 * pulse), length * fade * (1 + .25 * pulse), 1)
    }
    const showSparks = age < REVERSAL_EFFECT_SECONDS
    if (showSparks !== sparksVisible) {
      sparksVisible = showSparks
      for (const entity of sparks) VisibilityComponent.getMutable(entity).visible = showSparks
    }
    if (!showSparks) return
    const perRing = REVERSAL_SPARKS / 2
    sparks.forEach((entity, i) => {
      const ring = Math.floor(i / perRing)
      const p = Math.max(0, Math.min(1, (age - ring * .42) / (REVERSAL_EFFECT_SECONDS - .42)))
      const envelope = Math.min(1, p * 7, (1 - p) * 4)
      const angle = i % perRing / perRing * Math.PI * 2 + ring * .22 + direction * p * 4
      const radius = 2.2 + p * 16
      const transform = Transform.getMutable(entity)
      transform.position = Vector3.create(zone.center.x + Math.cos(angle) * radius,
        bottom + p * (height - 2) + Math.sin(angle * 2) * p, zone.center.z + Math.sin(angle) * radius)
      const size = (.23 + .16 * Math.sin(i * 2 + age * 9) ** 2) * envelope
      transform.scale = Vector3.create(size, size, size)
    })
  }
  animate(0)
  engine.addSystem(animate)
}
