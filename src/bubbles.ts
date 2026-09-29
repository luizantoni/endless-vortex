import { AudioSource, Billboard, BillboardMode, engine, Material, MaterialTransparencyMode, MeshRenderer, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, Point } from './arena'
import { BUBBLES as B, BubbleLift, sweptBubbleContact } from './bubble-rules'

const vortexTexture = 'assets/ui/modular/vortex.png'

// Height lanes sit between platform surfaces so normal orbits don't repeatedly hide/re-spawn bubbles.
const slots = [3.5, 7, 10.5, 15].flatMap((y, layer) => Array.from({ length: 12 }, (_, index) => ({
  y, radius: [9, 13, 17][(index + layer) % 3], angle: index * Math.PI / 6 + layer * 0.3
})))

export function createRecoveryBubbles(blocked: (point: Point, radius: number) => boolean, random = Math.random) {
  const lift = new BubbleLift()
  const sound = engine.addEntity()
  Transform.create(sound, { parent: engine.PlayerEntity })
  AudioSource.create(sound, { audioClipUrl: B.sound, playing: false, loop: false, global: true, volume: B.volume })
  let volume: number = B.volume, time = 0, soundReadyAt = 0, poppedTotal = 0
  let previousPlayer: Point | undefined, previousCanPop = false
  const pool = Array.from({ length: B.count }, (_, index) => {
    const entity = engine.addEntity(), billboard = engine.addEntity(), vortex = engine.addEntity()
    Transform.create(entity, { scale: Vector3.create(B.radius * 2, B.radius * 2, B.radius * 2) })
    MeshRenderer.setSphere(entity)
    Material.setPbrMaterial(entity, { albedoColor: Color4.create(1, 0.58, 0.03, B.orbOpacity),
      emissiveTexture: Material.Texture.Common({ src: vortexTexture }),
      emissiveColor: Color3.create(1, 0.57, 0.12), emissiveIntensity: B.glowBaseIntensity,
      roughness: 0.08, metallic: 0.45, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND })
    // The reusable vortex image is the only orb ornament; no attached highlight sphere.
    Transform.create(billboard, { parent: entity, scale: Vector3.create(B.vortexScale, B.vortexScale, 1) })
    Billboard.create(billboard, { billboardMode: BillboardMode.BM_ALL })
    Transform.create(vortex, { parent: billboard })
    MeshRenderer.setPlane(vortex)
    Material.setPbrMaterial(vortex, { texture: Material.Texture.Common({ src: vortexTexture }),
      albedoColor: Color4.White(), emissiveColor: Color3.create(1, 0.72, 0.22), emissiveIntensity: B.vortexEmission,
      roughness: 1, castShadows: false, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND })
    VisibilityComponent.create(entity, { visible: false })
    VisibilityComponent.create(billboard, { visible: false })
    VisibilityComponent.create(vortex, { visible: false })
    return { entity, billboard, vortex, slot: slots[index], mode: 'waiting' as 'waiting' | 'active' | 'popping',
      readyAt: 0.25 + index * 0.25, expires: 0, poppedAt: 0, glowAt: -Infinity,
      point: { x: 0, y: 0, z: 0 } }
  })
  const sparks = Array.from({ length: B.particleCount }, () => {
    const entity = engine.addEntity()
    Transform.create(entity, { scale: Vector3.create(0.08, 0.08, 0.08) })
    MeshRenderer.setSphere(entity)
    Material.setPbrMaterial(entity, { albedoColor: Color4.create(1, 0.62, 0.12, 1),
      emissiveColor: Color3.create(1, 0.38, 0.035), emissiveIntensity: 2.4,
      roughness: 0.15, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND, castShadows: false })
    VisibilityComponent.create(entity, { visible: false })
    return { entity, born: 0, origin: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, active: false }
  })
  let nextSpark = 0

  function visible(item: typeof pool[number], value: boolean) {
    VisibilityComponent.getMutable(item.entity).visible = value
    VisibilityComponent.getMutable(item.billboard).visible = value
    VisibilityComponent.getMutable(item.vortex).visible = value
  }
  function wait(item: typeof pool[number], delay: number) {
    item.mode = 'waiting'; item.readyAt = time + delay; visible(item, false)
  }
  function position(slot: typeof slots[number]): Point {
    const angle = slot.angle + time * B.orbitDegrees * Math.PI / 180
    return { x: ARENA.center.x + Math.cos(angle) * slot.radius,
      y: slot.y + Math.sin(time * 1.5 + slot.angle) * 0.2, z: ARENA.center.z + Math.sin(angle) * slot.radius }
  }
  function emitSparks(origin: Point) {
    for (let i = 0; i < B.particlesPerPop; i++) {
      const particle = sparks[nextSpark]
      nextSpark = (nextSpark + 1) % sparks.length
      const angle = Math.PI * 2 * i / B.particlesPerPop + random() * 0.35
      const speed = 1.1 + random() * 1.4
      particle.born = time
      particle.origin = { ...origin }
      particle.velocity = { x: Math.cos(angle) * speed, y: 0.7 + random() * 1.6, z: Math.sin(angle) * speed }
      particle.active = true
      Transform.getMutable(particle.entity).scale = Vector3.create(0.07 + random() * 0.055, 0.07 + random() * 0.055, 0.07 + random() * 0.055)
      VisibilityComponent.getMutable(particle.entity).visible = true
    }
  }

  return {
    update(dt: number, player: Point | undefined, velocityY: number, mobile: boolean, canPop: boolean): number {
      if (!Number.isFinite(dt) || dt <= 0 || dt > 0.5) {
        previousPlayer = undefined; previousCanPop = false
        return 0
      }
      time += dt
      const teleported = !!player && !!previousPlayer && Vector3.distance(player, previousPlayer) > B.maxSweep
      const playerBefore = previousCanPop && previousPlayer ? previousPlayer : player
      previousPlayer = player ? { ...player } : undefined
      previousCanPop = canPop && !teleported
      let impulse = 0
      for (const item of pool) {
        const transform = Transform.getMutable(item.entity)
        const vortexTransform = Transform.getMutable(item.vortex)
        if (item.mode === 'popping') {
          const fraction = (time - item.poppedAt) / B.popDuration
          if (fraction >= 1) { wait(item, B.respawn); continue }
          const orbScale = 1 - 0.35 * fraction
          transform.scale = Vector3.create(B.radius * 2 * orbScale, B.radius * 2 * orbScale, B.radius * 2 * orbScale)
          vortexTransform.scale = Vector3.create(1 - fraction, 1 - fraction, 1)
          vortexTransform.rotation = Quaternion.fromEulerDegrees(0, 0,
            (time * B.vortexSpinDegrees + item.slot.angle * 180 / Math.PI) % 360)
          Material.setPbrMaterial(item.entity, { albedoColor: Color4.create(1, 0.58, 0.03, B.orbOpacity * (1 - fraction)),
            emissiveTexture: Material.Texture.Common({ src: vortexTexture }),
            emissiveColor: Color3.create(1, 0.57, 0.12), emissiveIntensity: B.glowBaseIntensity * (1 - fraction),
            roughness: 0.08, metallic: 0.45, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND })
          Material.setPbrMaterial(item.vortex, { texture: Material.Texture.Common({ src: vortexTexture }),
            albedoColor: Color4.create(1, 1, 1, 1 - fraction), emissiveColor: Color3.create(1, 0.72, 0.22),
            emissiveIntensity: B.vortexEmission * (1 - fraction), roughness: 1, castShadows: false,
            transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND })
          continue
        }
        let spawned = false
        if (item.mode === 'waiting') {
          if (time < item.readyAt || !player) continue
          const candidates = slots.filter(slot => {
            const p = position(slot)
            return Vector3.distance(p, player) > B.spawnClearance && !blocked(p, B.radius + 0.2) &&
              pool.every(other => other.mode !== 'active' || Vector3.distance(p, other.point) > B.contactRadius * 2)
          })
          if (!candidates.length) { item.readyAt = time + 1; continue }
          item.slot = candidates[Math.floor(random() * candidates.length)]
          item.mode = 'active'; item.expires = time + B.lifetime
          spawned = true
          transform.scale = Vector3.create(B.radius * 2, B.radius * 2, B.radius * 2)
          vortexTransform.scale = Vector3.create(1, 1, 1)
          Material.setPbrMaterial(item.entity, { albedoColor: Color4.create(1, 0.58, 0.03, B.orbOpacity),
            emissiveTexture: Material.Texture.Common({ src: vortexTexture }),
            emissiveColor: Color3.create(1, 0.57, 0.12), emissiveIntensity: B.glowBaseIntensity,
            roughness: 0.08, metallic: 0.45, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND })
          Material.setPbrMaterial(item.vortex, { texture: Material.Texture.Common({ src: vortexTexture }),
            albedoColor: Color4.White(), emissiveColor: Color3.create(1, 0.72, 0.22), emissiveIntensity: B.vortexEmission,
            roughness: 1, castShadows: false, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND })
          visible(item, true)
        }
        const bubbleBefore = item.point
        item.point = position(item.slot)
        if (time >= item.expires || blocked(item.point, B.radius + 0.2)) { wait(item, 1); continue }
        transform.position = { ...item.point }
        transform.rotation = Quaternion.fromEulerDegrees(15, (time * B.spinDegrees + item.slot.angle * 180 / Math.PI) % 360, 0)
        vortexTransform.rotation = Quaternion.fromEulerDegrees(0, 0,
          (time * B.vortexSpinDegrees + item.slot.angle * 180 / Math.PI) % 360)
        if (time - item.glowAt >= B.glowUpdateInterval) {
          item.glowAt = time
          const scan = (Math.sin(time * 3.2 - item.slot.angle * 2.5) + 1) * 0.5
          Material.setPbrMaterial(item.entity, { albedoColor: Color4.create(1, 0.54 + scan * 0.16, 0.025 + scan * 0.055, B.orbOpacity),
            emissiveTexture: Material.Texture.Common({ src: vortexTexture }),
            emissiveColor: Color3.create(1, 0.42 + scan * 0.38, 0.045 + scan * 0.15),
            emissiveIntensity: B.glowBaseIntensity + scan * B.glowScanIntensity, roughness: 0.08, metallic: 0.45,
            transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND })
        }
        if (!canPop || teleported || !player || !playerBefore || spawned ||
          !sweptBubbleContact(playerBefore, player, bubbleBefore, item.point)) continue
        const amount = lift.pop(time, velocityY, mobile)
        item.mode = 'popping'; item.poppedAt = time
        emitSparks(item.point)
        poppedTotal++
        impulse += amount ?? 0
        if (volume > 0 && time >= soundReadyAt) {
          AudioSource.playSound(sound, B.sound, true)
          soundReadyAt = time + B.soundInterval
        }
      }
      for (const particle of sparks) {
        if (!particle.active) continue
        const age = time - particle.born
        const fraction = age / B.particleLifetime
        if (fraction >= 1) {
          particle.active = false
          VisibilityComponent.getMutable(particle.entity).visible = false
          continue
        }
        const { x, y, z } = particle.velocity
        Transform.getMutable(particle.entity).position = {
          x: particle.origin.x + x * age, y: particle.origin.y + y * age - 1.8 * age * age,
          z: particle.origin.z + z * age
        }
        const size = (1 - fraction) * 0.11
        Transform.getMutable(particle.entity).scale = Vector3.create(size, size, size)
        Material.setPbrMaterial(particle.entity, { albedoColor: Color4.create(1, 0.62, 0.12, 1 - fraction),
          emissiveColor: Color3.create(1, 0.43, 0.045), emissiveIntensity: 2.4 * (1 - fraction),
          roughness: 0.15, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND, castShadows: false })
      }
      return impulse
    },
    setVolume(value: number) {
      volume = Math.max(0, Math.min(1, value))
      AudioSource.getMutable(sound).volume = volume
      if (volume === 0) AudioSource.stopSound(sound, true)
    },
    getPoppedTotal() { return poppedTotal }
  }
}
