import { AudioSource, Billboard, BillboardMode, engine, Material, MaterialTransparencyMode, MeshRenderer, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, Point } from './arena'
import { BUBBLES as B, BubbleLift, goldenVortexCelebrationPoint, goldenVortexOrbitPoint,
  goldenVortexParticlePoint, sweptBubbleContact } from './bubble-rules'
import { createSharedRandom, onSharedObstacleEvent, publishSharedObstacleEvent } from './shared-obstacles'

const vortexTexture = 'assets/ui/modular/vortex.png'

// Height lanes sit between platform surfaces so normal orbits don't repeatedly hide/re-spawn bubbles.
const slots = [3.5, 7, 10.5, 15].flatMap((y, layer) => Array.from({ length: 12 }, (_, index) => ({
  y, radius: [9, 13, 17][(index + layer) % 3], angle: index * Math.PI / 6 + layer * 0.3
})))

export function createRecoveryBubbles(_blocked: (point: Point, radius: number) => boolean, random = Math.random) {
  if (random === Math.random) random = createSharedRandom(0x4f524253)
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
    return { entity, billboard, vortex, index, slot: slots[(index * 5) % slots.length],
      mode: 'waiting' as 'waiting' | 'active' | 'popping',
      readyAt: 0.2 + index * 0.16, expires: 0, poppedAt: 0, glowAt: -Infinity,
      // A stable slot per orb keeps an orb index tied to the same world
      // position on every client, even when one peer delays its appearance.
      point: { x: 0, y: 0, z: 0 } }
  })
  const sparks = Array.from({ length: B.particleCount }, (_, index) => {
    const entity = engine.addEntity()
    Transform.create(entity, { scale: Vector3.create(0.08, 0.08, 0.08) })
    MeshRenderer.setSphere(entity)
    Material.setPbrMaterial(entity, { albedoColor: Color4.create(1, 0.62, 0.12, 1),
      emissiveColor: Color3.create(1, 0.38, 0.035), emissiveIntensity: 2.4,
      roughness: 0.15, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND, castShadows: false })
    VisibilityComponent.create(entity, { visible: false })
    return { entity, born: 0, materialAt: 0, origin: { x: 0, y: 0, z: 0 }, angle: 0, pitch: 0, burstSpeed: 0,
      radialSpeed: 0, spin: 0, riseSpeed: 0, phase: 0, size: 0.08, shade: 0, active: false,
      index, kind: 'idle' as 'idle' | 'burst' | 'orbit' | 'celebrate', orbitRadius: 0, orbitHeight: 0 }
  })
  const burstSparks = sparks.slice(B.accumulationCapacity)
  let nextSpark = B.accumulationCapacity

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
  function showSpark(particle: typeof sparks[number]) {
    Transform.getMutable(particle.entity).scale = Vector3.create(particle.size, particle.size, particle.size)
    const shade = particle.shade
    Material.setPbrMaterial(particle.entity, { albedoColor: Color4.create(1, 0.58 + shade * 0.35, 0.12 + shade * 0.55, 1),
      emissiveColor: Color3.create(1, 0.42 + shade * 0.42, 0.04 + shade * 0.22),
      emissiveIntensity: 5 + shade * 5, metallic: 0.76, roughness: 0.035,
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND, castShadows: false })
    particle.active = true
    VisibilityComponent.getMutable(particle.entity).visible = true
  }
  function emitSparks(origin: Point, orbIndex: number) {
    // A six-mote cohort joins a 60-mote maximum ring: exactly ten pickups.
    const cohort = orbIndex % B.accumulationEvery
    for (let i = 0; i < B.accumulationPerPop; i++) {
      const slot = cohort * B.accumulationPerPop + i
      const particle = sparks[slot]
      particle.kind = 'orbit'; particle.born = time; particle.origin = { ...origin }
      particle.angle = slot * Math.PI * 2 / B.accumulationCapacity
      particle.phase = random() * Math.PI * 2; particle.size = 0.105 + random() * 0.045
      particle.shade = (i + cohort % 4) / 5
      particle.orbitRadius = B.accumulationRadius + (slot % 3) * 0.42
      particle.orbitHeight = ARENA.center.y + 3 + Math.floor(slot / 12) * 0.58
      showSpark(particle)
    }
    for (let i = 0; i < B.particlesPerPop; i++) {
      const particle = burstSparks[(nextSpark++ - B.accumulationCapacity) % burstSparks.length]
      particle.born = time
      particle.materialAt = time - (nextSpark % 16) / 16 * B.particleMaterialInterval
      particle.origin = { ...origin }
      particle.kind = 'burst'
      particle.angle = Math.PI * 2 * (i + random()) / B.particlesPerPop
      particle.pitch = -0.35 + (i % 6) / 5 * 1.7 + (random() - 0.5) * 0.16
      particle.burstSpeed = B.particleBurstSpeedMin + (i % 3) * 2 +
        random() * (B.particleBurstSpeedMax - B.particleBurstSpeedMin - 4)
      particle.radialSpeed = B.particleRadialSpeedMin + random() *
        (B.particleRadialSpeedMax - B.particleRadialSpeedMin)
      particle.spin = B.particleSpinMin + random() * (B.particleSpinMax - B.particleSpinMin)
      particle.riseSpeed = 0.35 + random() * 0.8
      particle.phase = random() * Math.PI * 2
      particle.size = 0.055 + (i % 3) * 0.025 + random() * 0.03
      particle.shade = (i % 4 + random()) / 4
      showSpark(particle)
    }
  }
  const pendingPops = new Map<number, number>()
  function popOrb(item: typeof pool[number], at: number) {
    if (item.mode !== 'active') return false
    item.mode = 'popping'
    item.poppedAt = time - Math.max(0, (Date.now() - at) / 1000)
    emitSparks(item.point, item.index)
    return true
  }
  const stopListening = onSharedObstacleEvent(event => {
    if (event.kind !== 'orb' || event.action !== 'pop') return
    const item = pool[event.index]
    if (!item || item.mode === 'popping') return
    if (!popOrb(item, event.at)) pendingPops.set(event.index, event.at)
  })

  return {
    update(dt: number, player: Point | undefined, velocityY: number, mobile: boolean, canPop: boolean,
      _players: Point[] = player ? [player] : []): number {
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
          const spawnPoint = position(item.slot)
          if (_players.some(avatar => Vector3.distance(spawnPoint, avatar) <= B.spawnClearance) ||
            _blocked(spawnPoint, B.radius + 0.2)) {
            item.readyAt = time + 1
            continue
          }
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
          const pendingAt = pendingPops.get(item.index)
          if (pendingAt !== undefined) {
            popOrb(item, pendingAt)
            pendingPops.delete(item.index)
          }
        }
        const bubbleBefore = item.point
        item.point = position(item.slot)
        if (time >= item.expires) { wait(item, 1); continue }
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
        popOrb(item, Date.now())
        publishSharedObstacleEvent('orb', item.index, 'pop')
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
        const lifetime = particle.kind === 'orbit' ? Number.POSITIVE_INFINITY :
          particle.kind === 'celebrate' ? B.rewardExplosionLifetime : B.particleLifetime
        const fraction = age / lifetime
        if (fraction >= 1) {
          particle.active = false
          VisibilityComponent.getMutable(particle.entity).visible = false
          continue
        }
        const shimmer = 0.65 + 0.35 * Math.sin(age * 24 + particle.phase)
        if (particle.kind === 'celebrate') {
          Transform.getMutable(particle.entity).position = goldenVortexCelebrationPoint(
            particle.index, age, particle.phase)
        } else if (particle.kind === 'orbit') {
          Transform.getMutable(particle.entity).position = goldenVortexOrbitPoint(particle.origin, particle.angle,
            particle.orbitRadius, particle.orbitHeight, particle.phase, age)
        } else {
          Transform.getMutable(particle.entity).position = goldenVortexParticlePoint(particle.origin,
            particle.angle, particle.pitch, particle.burstSpeed, particle.radialSpeed, particle.spin,
            particle.riseSpeed, particle.phase, age)
        }
        const burstScale = particle.kind !== 'orbit' && age < B.particleBurstDuration ?
          1 + 2.4 * (1 - age / B.particleBurstDuration) : 1
        const size = particle.size * burstScale * (0.72 + shimmer * 0.55) *
          (particle.kind === 'orbit' ? 1 : 1 - fraction)
        Transform.getMutable(particle.entity).scale = Vector3.create(size, size, size)
        if (time - particle.materialAt >= B.particleMaterialInterval) {
          particle.materialAt = time
          const shade = particle.shade
          Material.setPbrMaterial(particle.entity, { albedoColor: Color4.create(1, 0.58 + shade * 0.35,
            0.12 + shade * 0.55, 1 - fraction),
            emissiveColor: Color3.create(1, 0.42 + shade * 0.42, 0.04 + shade * 0.22),
            emissiveIntensity: (5 + shade * 5) * shimmer * (1 - fraction), metallic: 0.76, roughness: 0.035,
            transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND, castShadows: false })
        }
      }
      return impulse
    },
    setVolume(value: number) {
      volume = Math.max(0, Math.min(1, value))
      AudioSource.getMutable(sound).volume = volume
      if (volume === 0) AudioSource.stopSound(sound, true)
    },
    explodeAccumulation() {
      // Reuse the whole 128-spark pool for a dense, two-second crown burst.
      for (let i = 0; i < sparks.length; i++) {
        const particle = sparks[i]
        particle.born = time
        particle.kind = 'celebrate'
        particle.phase = (i % 17) * 0.17
        particle.size = 0.1 + (i % 4) * 0.025
        particle.shade = (i % 6) / 5
        particle.materialAt = -Infinity
        particle.active = true
        Transform.getMutable(particle.entity).position = goldenVortexCelebrationPoint(i, 0, particle.phase)
        Transform.getMutable(particle.entity).scale = Vector3.create(particle.size, particle.size, particle.size)
        VisibilityComponent.getMutable(particle.entity).visible = true
      }
    },
    dispose() { stopListening() },
    getPoppedTotal() { return poppedTotal }
  }
}
